import { clamp } from '../core/geometry.js';
import { bytesToDataUrl } from '../core/io.js';
import { pixelBufferToRgba8Preview } from '../core/pixel-buffer.js';
import { createCmykToSrgbTransform, cmykPixelBufferToRgba8Preview } from '../core/color-management.js';
import { sanitizeAdjustmentModel } from '../core/adjustments.js';
import {
  createDocument,
  createRasterLayer,
  createLayerMask,
  createLayerGroup,
  sanitizeProject,
} from '../core/state.js';
import {
  psdPreviewFingerprint,
  psdEmbeddedDocumentFingerprint,
} from './psd-native-metadata-plans.js';

/**
 * Photoshop-specific import semantics used by the PSD import transaction.
 *
 * Stable pure/domain dependencies are imported directly. Browser/effectful work
 * and shared cross-feature primitives stay explicit ports:
 * - decodePsd: binary codec boundary
 * - rgbaPixelsToDataUrl / dimensionsFromDataUrl: browser raster boundary
 * - importVectorMask: shared document↔layer vector-mask localization
 * - opaqueBlockToState: shared Photoshop opaque-resource persistence bridge
 *
 * This module does not own document publication, session/history state, or
 * PSD/PSB binary writing.
 */
export function createPsdImportSemantics({
  decodePsd,
  rgbaPixelsToDataUrl,
  dimensionsFromDataUrl,
  importVectorMask,
  opaqueBlockToState,
} = {}) {
  function requirePort(port, name) {
    if (typeof port !== 'function') throw new TypeError(`PSD import semantics requires ${name}`);
    return port;
  }

  function opaqueBlocks(blocks) {
    const convert = requirePort(opaqueBlockToState, 'opaqueBlockToState');
    return blocks.map(convert).filter(Boolean);
  }

  function canMapPsdSolidShape(sourceLayer) {
    const shape=sourceLayer?.psdShape,mask=sourceLayer?.vectorMask;
    if(shape?.fillType!=='solid'||!shape.fill||!mask?.subpaths?.length)return false;
    if(mask.subpaths.length!==1)return false;
    const path=mask.subpaths[0];
    return path.closed!==false&&path.operation==='add'&&(path.points?.length||0)>=2;
  }

  function importPsdShapeMetadata(source,shapeLayer) {
    if(!source?.blocks?.length)return null;
    return{
      fillType:source.fillType==='solid'?'solid':null,
      fill:source.fill||null,
      fillEnabled:source.fillEnabled!==false,
      stroke:source.stroke||null,
      strokeEnabled:source.strokeEnabled===true,
      strokeWidth:Number(source.strokeWidth)||0,
      sourceContentKey:['SoCo','vscg'].includes(source.sourceContentKey)?source.sourceContentKey:null,
      strokeStyle:source.strokeStyle?{
        opacity:Number(source.strokeStyle.opacity)||0,
        lineCap:source.strokeStyle.lineCap||null,
        lineJoin:source.strokeStyle.lineJoin||null,
        lineAlignment:source.strokeStyle.lineAlignment||null,
      }:null,
      baseline:{
        fill:String(shapeLayer.fill||'transparent'),
        stroke:String(shapeLayer.stroke||'transparent'),
        strokeWidth:Number(shapeLayer.strokeWidth)||0,
        pathClosed:shapeLayer.pathClosed!==false,
        width:Number(shapeLayer.width)||1,
        height:Number(shapeLayer.height)||1,
        scaleX:Number(shapeLayer.scaleX??1)||1,
        scaleY:Number(shapeLayer.scaleY??1)||1,
        rotation:Number(shapeLayer.rotation)||0,
      },
      blocks:opaqueBlocks(source.blocks),
    };
  }

  function importPsdTextMetadata(source,sourceLayer,textLayer){
    if(!source?.data||!source?.parsed)return null;
    return{
      signature:source.signature==='8B64'?'8B64':'8BIM',
      key:'TySh',
      dataUrl:bytesToDataUrl(source.data,'application/octet-stream'),
      parsed:structuredClone(source.parsed),
      baseline:{
        x:Number(sourceLayer.x)||0,y:Number(sourceLayer.y)||0,
        width:Number(sourceLayer.width)||1,height:Number(sourceLayer.height)||1,
        scaleX:Number(textLayer.scaleX??1)||1,scaleY:Number(textLayer.scaleY??1)||1,rotation:Number(textLayer.rotation)||0,
        text:String(textLayer.text||''),
        fontFamily:String(textLayer.fontFamily||'Inter, Arial, sans-serif'),
        fontSize:Number(textLayer.fontSize)||48,
        fontWeight:String(textLayer.fontWeight||'400'),
        fontStyle:textLayer.fontStyle==='italic'?'italic':'normal',
        align:['left','center','right'].includes(textLayer.align)?textLayer.align:'left',
        lineHeight:Number(textLayer.lineHeight)||1.18,
        letterSpacing:Number(textLayer.letterSpacing)||0,
        underline:textLayer.underline===true,
        strikeThrough:textLayer.strikeThrough===true,
        color:String(textLayer.color||'#ffffff'),
      },
    };
  }

  function importPsdAdjustmentMetadata(source,adjustment) {
    if(!source?.blocks?.length||!adjustment)return null;
    return{
      kind:adjustment.kind,
      blocks:opaqueBlocks(source.blocks),
      baseline:structuredClone(sanitizeAdjustmentModel(adjustment)),
      channelIds:Array.isArray(source.channelIds)?source.channelIds.slice(0,16):[],
    };
  }

  function psdEmbeddedAssetMime(type){
    if(type==='png')return'image/png';
    if(type==='jpg'||type==='jpeg')return'image/jpeg';
    if(type==='webp')return'image/webp';
    if(type==='gif')return'image/gif';
    if(type==='bmp')return'image/bmp';
    return null;
  }

  async function importPsdNestedDocument(asset,layerName,warnings){
    const decode = requirePort(decodePsd, 'decodePsd');
    const encodePreview = requirePort(rgbaPixelsToDataUrl, 'rgbaPixelsToDataUrl');
    const localizeVectorMask = requirePort(importVectorMask, 'importVectorMask');
    const parsed=await decode(asset.data,{maxPixels:12_000_000,maxLayers:200});
    const nested=createDocument({
      name:(asset.filename||layerName||'Embedded PSD').replace(/\.ps[db]$/i,''),
      width:parsed.width,height:parsed.height,background:'transparent',
    });
    const isCmyk=parsed.colorMode===4;
    const transform=isCmyk?createCmykToSrgbTransform(parsed.iccProfile?.bytes||null,{intent:'perceptual'}):null;
    const previewFor=buffer=>buffer?.model==='cmyk'?cmykPixelBufferToRgba8Preview(buffer,transform):pixelBufferToRgba8Preview(buffer);
    const groupMap=new Map();
    nested.groups=(parsed.groups||[]).map(sourceGroup=>{
      const group=createLayerGroup({
        name:sourceGroup.name||'PSD Group',visible:sourceGroup.visible!==false,collapsed:Boolean(sourceGroup.collapsed),
        opacity:clamp(Number(sourceGroup.opacity??1),0,1),blendMode:sourceGroup.blendMode||'pass-through',
      });
      groupMap.set(sourceGroup.key,group.id);
      return group;
    });
    for(const sourceGroup of parsed.groups||[]){
      const target=nested.groups.find(group=>group.id===groupMap.get(sourceGroup.key));
      if(target)target.parentGroupId=sourceGroup.parentKey?(groupMap.get(sourceGroup.parentKey)??null):null;
    }
    const layers=[];
    for(const sourceLayer of [...(parsed.layers||[])].reverse()){
      const pixels=sourceLayer.pixelBuffer?previewFor(sourceLayer.pixelBuffer):sourceLayer.pixels;
      if(!pixels)continue;
      const dataUrl=await encodePreview(sourceLayer.width,sourceLayer.height,pixels,'Embedded PSD layer');
      const maskDataUrl=sourceLayer.mask?.pixels?await encodePreview(sourceLayer.width,sourceLayer.height,sourceLayer.mask.pixels,'Embedded PSD mask'):null;
      const child=createRasterLayer({
        name:sourceLayer.name||'Embedded PSD Layer',visible:sourceLayer.visible!==false,
        opacity:clamp(Number(sourceLayer.opacity),0,1),blendMode:sourceLayer.blendMode||'source-over',
        x:sourceLayer.x,y:sourceLayer.y,width:sourceLayer.width,height:sourceLayer.height,
        groupId:sourceLayer.groupKey?(groupMap.get(sourceLayer.groupKey)??null):null,
        dataUrl,mask:maskDataUrl?createLayerMask({enabled:sourceLayer.mask.disabled!==true,dataUrl:maskDataUrl}):null,
      });
      child.vectorMask=localizeVectorMask(sourceLayer.vectorMask,child);
      layers.push(child);
    }
    if(!layers.length&&(parsed.compositePixelBuffer||parsed.composite)){
      const pixels=parsed.compositePixelBuffer?previewFor(parsed.compositePixelBuffer):parsed.composite;
      layers.push(createRasterLayer({
        name:'Embedded PSD Composite',x:0,y:0,width:parsed.width,height:parsed.height,
        dataUrl:await encodePreview(parsed.width,parsed.height,pixels,'Embedded PSD composite'),
      }));
    }
    if(!layers.length)throw new Error('embedded PSD не содержит поддерживаемого bitmap preview');
    nested.layers=layers;
    nested.selectedLayerId=layers.at(-1)?.id??null;
    nested.colorProfile=parsed.iccProfile?{
      kind:'icc',untagged:Boolean(parsed.iccUntagged),
      dataUrl:bytesToDataUrl(parsed.iccProfile.bytes,'application/vnd.iccprofile'),
      name:parsed.iccProfile.name||'',version:parsed.iccProfile.version||'',deviceClass:parsed.iccProfile.deviceClass||'',
      colorSpace:parsed.iccProfile.colorSpace||'',pcs:parsed.iccProfile.pcs||'',signatureValid:parsed.iccProfile.signatureValid===true,
    }:(parsed.iccUntagged?{kind:'untagged',untagged:true}:null);
    if((parsed.layers||[]).some(item=>item.psdSmartObject))warnings.push(`Embedded PSD «${asset.filename||layerName}»: nested Smart Objects открыты как raster previews внутри content-tab`);
    return sanitizeProject(nested);
  }

  async function importPsdEmbeddedAssetDocument(source,layerName,warnings){
    const asset=source?.asset;
    if(asset?.kind!=='data'||!(asset.data instanceof Uint8Array)||!asset.data.length)return null;
    try{
      const type=String(asset.detectedFileType||'').toLowerCase();
      if(type==='psd'||type==='psb')return await importPsdNestedDocument(asset,layerName,warnings);
      const mime=psdEmbeddedAssetMime(type);
      if(!mime)return null;
      const dimensions = requirePort(dimensionsFromDataUrl, 'dimensionsFromDataUrl');
      const dataUrl=bytesToDataUrl(asset.data,mime);
      const size=await dimensions(dataUrl);
      const embedded=createDocument({
        name:asset.filename||layerName||'Embedded Smart Object',
        width:size.width,height:size.height,background:'transparent',
      });
      const raster=createRasterLayer({name:asset.filename||'Embedded asset',x:0,y:0,width:size.width,height:size.height,dataUrl});
      embedded.layers=[raster];embedded.selectedLayerId=raster.id;
      return sanitizeProject(embedded);
    }catch(error){
      warnings.push(`Слой «${layerName}»: embedded asset ${source?.asset?.filename||''} не открыт как editable content (${error?.message||error}); opaque round-trip сохранён`);
      return null;
    }
  }

  function importPsdSmartObjectMetadata(source,sourceLayer,previewDataUrl,embeddedDocument=null){
    if(!source?.blocks?.length)return null;
    const asset=source.asset?{
      sourceKey:source.asset.sourceKey||null,kind:source.asset.kind||null,uuid:source.asset.uuid||null,
      filename:source.asset.filename||'',filetype:source.asset.filetype||'',detectedFileType:source.asset.detectedFileType||null,
      dataSize:Number(source.asset.dataSize)||0,fileSize:source.asset.fileSize==null?null:Number(source.asset.fileSize),
    }:null;
    return{
      kind:['embedded','linked','placed'].includes(source.kind)?source.kind:'placed',
      uniqueId:source.uniqueId||null,
      placedVersion:Number.isInteger(source.placedVersion)?source.placedVersion:null,
      placedTransform:Array.isArray(source.placedTransform)?source.placedTransform.slice(0,8):null,
      descriptor:source.descriptor?structuredClone(source.descriptor):null,
      asset,
      baseline:{
        x:Number(sourceLayer.x)||0,y:Number(sourceLayer.y)||0,
        width:Number(sourceLayer.width)||1,height:Number(sourceLayer.height)||1,
        scaleX:1,scaleY:1,rotation:0,
        previewFingerprint:psdPreviewFingerprint(previewDataUrl),
        embeddedFingerprint:psdEmbeddedDocumentFingerprint(embeddedDocument),
        embeddedWidth:Number(embeddedDocument?.width)||1,
        embeddedHeight:Number(embeddedDocument?.height)||1,
      },
      blocks:opaqueBlocks(source.blocks),
    };
  }

  return {
    importPsdAdjustmentMetadata,
    importPsdVectorMask: requirePort(importVectorMask, 'importVectorMask'),
    canMapPsdSolidShape,
    importPsdEmbeddedAssetDocument,
    importPsdShapeMetadata,
    importPsdTextMetadata,
    importPsdSmartObjectMetadata,
    psdOpaqueBlockToState: requirePort(opaqueBlockToState, 'opaqueBlockToState'),
  };
}
