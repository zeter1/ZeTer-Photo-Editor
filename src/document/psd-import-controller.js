import { clamp } from '../core/geometry.js';
import {
  createDocument, createRasterLayer, createTextLayer, createShapeLayer,
  createSmartObjectLayer, createAdjustmentLayer, createLayerMask,
  createLayerGroup, sanitizeColorManagement,
} from '../core/state.js';
import { sanitizeAdjustmentModel } from '../core/adjustments.js';
import {
  pixelBufferToRgba8Preview, serializePixelBufferSource,
  MAX_PIXEL_BUFFER_SOURCE_BYTES,
} from '../core/pixel-buffer.js';
import {
  createCmykToSrgbTransform, createCmykSoftProofTransform,
  cmykPixelBufferToRgba8Preview,
} from '../core/color-management.js';
import { bytesToDataUrl } from '../core/io.js';

/**
 * Owns the PSD/PSB decoded-payload → canonical ZPE document import transaction.
 *
 * The binary codec stays in formats/psd.js and is injected through `codec`.
 * Browser raster encoding and runtime publication are explicit effectful ports.
 * Photoshop Text/Shape/Adjustment/Smart Object mapping is supplied by the
 * dedicated psd-import-semantics boundary; export planning is out of scope.
 */
export function createPsdImportController({
  codec = {},
  runtime = {},
  profiles = {},
  rendering = {},
  semantics = {},
  ui = {},
} = {}) {
  async function open(file){
    if(runtime.blockPendingDocumentEdit())return;
    if(!runtime.canReplaceDocument())return;
    if(Number(file?.size)>512*1024*1024){
      const message='PSD/PSB больше 512 МБ пока не импортируется: используйте уменьшенную копию или дождитесь tiled pipeline';
      ui.toast(message,'error');ui.setStatus(message);return;
    }
    const targetDocument=runtime.getDocument();
    const targetSessionId=runtime.getActiveSessionId();
    const targetHistoryEntry=runtime.getHistoryEntry();
    const targetChangeSerial=runtime.getChangeSerial();
    ui.setStatus('PSD/PSB: чтение структуры и каналов…');
    try{
      const parsed=await codec.decodePsd(await file.arrayBuffer(),{maxPixels:48_000_000,maxLayers:500});
      const warnings=[...parsed.warnings];
      if(parsed.fillLayers?.length)warnings.push(`Stage 15d: найдено ${parsed.fillLayers.length} Photoshop gradient/pattern fill layer(s); bounded GdFl/PtFl metadata разобраны, но canvas пока использует composite preview до editable fill renderer`);
      if(parsed.adjustmentLayers?.length)warnings.push(`Stage 16c: найдено ${parsed.adjustmentLayers.length} Photoshop adjustment layer(s): Brightness/Contrast, Exposure, Hue/Saturation, Levels, Curves, Invert, Posterize и Threshold мапятся semantic-first`);
      const adjustmentOnlyComposite=Boolean(parsed.adjustmentLayers?.length&&!parsed.layers.length&&parsed.compositePixelBuffer);
      if(adjustmentOnlyComposite)warnings.push('Stage 16a: adjustment-only PSD не содержит base bitmap layers; используется composite preview, чтобы не применить adjustment повторно');
      const isCmyk=parsed.colorMode===4;
      const colorPolicy=sanitizeColorManagement(targetDocument.colorManagement);
      const sourceProfileBytes=parsed.iccProfile?.bytes||null,proofProfileBytes=profiles.profileBytes(targetDocument.proofProfile),displayProfileBytes=profiles.profileBytes(targetDocument.displayProfile);
      const cmykTransform=isCmyk?(colorPolicy.softProofEnabled&&proofProfileBytes
        ? createCmykSoftProofTransform(sourceProfileBytes,proofProfileBytes,{sourceIntent:colorPolicy.renderingIntent,intent:colorPolicy.proofRenderingIntent,blackPointCompensation:colorPolicy.blackPointCompensation,displayProfileBytes,gamutWarningThreshold:colorPolicy.gamutWarningThreshold})
        : createCmykToSrgbTransform(sourceProfileBytes,{intent:colorPolicy.renderingIntent,displaySpace:colorPolicy.displaySpace,displayProfileBytes,gamutWarningThreshold:colorPolicy.gamutWarningThreshold})):null;
      const previewPixelsFor=buffer=>buffer?.model==='cmyk'
        ? cmykPixelBufferToRgba8Preview(buffer,cmykTransform,{gamutWarning:colorPolicy.gamutWarningEnabled})
        : pixelBufferToRgba8Preview(buffer);
      if(isCmyk){
        if(cmykTransform.managed){
          warnings.push(`CMYK preview: применён ICC ${cmykTransform.tag} ${cmykTransform.method}, intent ${cmykTransform.intent} → ${cmykTransform.pcs} → ${cmykTransform.displaySpace.toUpperCase()} display transform. Native CMYK samples сохраняются отдельно`);
          if(cmykTransform.warning)warnings.push(`CMYK ICC policy: ${cmykTransform.warning}`);
        }else{
          warnings.push(`CMYK preview: ${cmykTransform.warning}. Native CMYK samples сохраняются отдельно; display preview не следует считать proof/press simulation`);
        }
      }
      if(parsed.iccProfile&&!isCmyk){
        const profile=parsed.iccProfile;
        warnings.push(`ICC profile обнаружен: ${profile.colorSpace||'unknown'} → ${profile.pcs||'unknown'}, v${profile.version||'?'}${profile.signatureValid?'':' (header signature invalid)'}. RGB Canvas preview пока не выполняет явное ICC-преобразование`);
      }else if(parsed.iccUntagged&&!isCmyk){
        warnings.push('PSD/PSB помечен как intentionally untagged ICC; ZPE не назначает профиль автоматически');
      }
      const modeLabel=isCmyk?'CMYK':'RGB';
      if(parsed.bitsPerChannel===16)warnings.push(`${modeLabel} 16-bit/channel декодирован без потери channel precision; bounded native source сохраняется внутри .zpe`);
      if(parsed.bitsPerChannel===32)warnings.push(`${modeLabel} 32-bit/channel декодирован в Float32 PixelBuffer; bounded native source сохраняется внутри .zpe`);
      if(parsed.layers.some(layer=>layer.transparencyProtected))warnings.push('Protect Transparency из PSD/PSB пока не переносится как отдельный lock-режим ZPE');
      const sourceGroups=new Map((parsed.groups||[]).map(group=>[group.key,group]));
      const adjustmentSources=adjustmentOnlyComposite?[]:(parsed.adjustmentLayers||[]);
      const usedGroupKeys=new Set([...parsed.layers,...adjustmentSources].map(layer=>layer.groupKey).filter(Boolean));
      for(const key of [...usedGroupKeys]){
        let current=sourceGroups.get(key);
        const seen=new Set();
        while(current?.parentKey&&!seen.has(current.key)){
          seen.add(current.key);
          usedGroupKeys.add(current.parentKey);
          current=sourceGroups.get(current.parentKey);
        }
      }
      const importedGroups=[];
      const groupIdByKey=new Map();
      for(const sourceGroup of parsed.groups||[]){
        if(!usedGroupKeys.has(sourceGroup.key))continue;
        const group=createLayerGroup({
          name:sourceGroup.name||'PSD Group',
          visible:sourceGroup.visible!==false,
          collapsed:Boolean(sourceGroup.collapsed),
          opacity:clamp(Number(sourceGroup.opacity??1),0,1),
          blendMode:sourceGroup.blendMode||'pass-through',
        });
        importedGroups.push(group);
        groupIdByKey.set(sourceGroup.key,group.id);
      }
      for(const sourceGroup of parsed.groups||[]){
        const groupId=groupIdByKey.get(sourceGroup.key);
        if(!groupId)continue;
        const group=importedGroups.find(item=>item.id===groupId);
        group.parentGroupId=sourceGroup.parentKey?(groupIdByKey.get(sourceGroup.parentKey)??null):null;
      }
      const prepared=[];
      let highDepthBytesUsed=0;
      const sourceStack=[
        ...parsed.layers.map(layer=>({...layer,__psdKind:'pixel'})),
        ...adjustmentSources.map(layer=>({...layer,__psdKind:'adjustment'})),
      ].sort((left,right)=>(left.stackIndex??0)-(right.stackIndex??0)).reverse();
      for(const sourceLayer of sourceStack){
        if(sourceLayer.__psdKind==='adjustment'){
          const semantic=sanitizeAdjustmentModel(sourceLayer.psdAdjustment?.parsed);
          if(!semantic){
            warnings.push(`Слой «${sourceLayer.name}»: adjustment metadata не поддержаны semantic renderer и пропущены`);
            continue;
          }
          const adjustmentMaskDataUrl=sourceLayer.mask?.pixels
            ? await rendering.rgbaPixelsToDataUrl(parsed.width,parsed.height,sourceLayer.mask.pixels,`Маска adjustment «${sourceLayer.name}»`)
            : null;
          const imported=createAdjustmentLayer({
            name:sourceLayer.name||'PSD Adjustment',
            visible:sourceLayer.visible!==false,
            opacity:clamp(Number(sourceLayer.opacity),0,1),
            blendMode:sourceLayer.blendMode||'source-over',
            clipping:sourceLayer.clipping===true,
            width:parsed.width,height:parsed.height,
            groupId:sourceLayer.groupKey?(groupIdByKey.get(sourceLayer.groupKey)??null):null,
            adjustment:semantic,
            mask:adjustmentMaskDataUrl?createLayerMask({enabled:sourceLayer.mask.disabled!==true,dataUrl:adjustmentMaskDataUrl}):null,
          });
          imported.psdAdjustment=semantics.importPsdAdjustmentMetadata({
            ...sourceLayer.psdAdjustment,
            channelIds:sourceLayer.channelIds,
          },semantic);
          imported.vectorMask=semantics.importPsdVectorMask(sourceLayer.vectorMask,imported);
          prepared.push(imported);
          warnings.push(`Слой «${sourceLayer.name}»: Photoshop ${semantic.kind} импортирован как editable ZPE adjustment layer с bounded native metadata${sourceLayer.mask?' + raster mask':''}${sourceLayer.clipping?' + clipping':''}`);
          continue;
        }
        const sourcePixels=sourceLayer.pixelBuffer
          ? previewPixelsFor(sourceLayer.pixelBuffer)
          : sourceLayer.pixels;
        const dataUrl=await rendering.rgbaPixelsToDataUrl(sourceLayer.width,sourceLayer.height,sourcePixels,`PSD/PSB слой «${sourceLayer.name}»`);
        let highDepthSource=null;
        if(sourceLayer.pixelBuffer&&(sourceLayer.pixelBuffer.bitsPerChannel>8||sourceLayer.pixelBuffer.model==='cmyk')){
          const rawBytes=sourceLayer.pixelBuffer.data?.byteLength||0;
          const remaining=Math.max(0,MAX_PIXEL_BUFFER_SOURCE_BYTES-highDepthBytesUsed);
          if(rawBytes>0&&rawBytes<=remaining){
            highDepthSource=serializePixelBufferSource(sourceLayer.pixelBuffer,{maxBytes:remaining});
            highDepthBytesUsed+=highDepthSource.rawBytes;
          }else{
            warnings.push(`Слой «${sourceLayer.name}»: high-depth source ${Math.ceil(rawBytes/1024/1024)} МБ не помещается в bounded .zpe budget ${Math.round(MAX_PIXEL_BUFFER_SOURCE_BYTES/1024/1024)} МБ; сохранён только 8-bit preview`);
          }
        }
        const maskDataUrl=sourceLayer.mask
          ? await rendering.rgbaPixelsToDataUrl(sourceLayer.width,sourceLayer.height,sourceLayer.mask.pixels,`Маска PSD/PSB слоя «${sourceLayer.name}»`)
          : null;
        const commonLayer={
          name:sourceLayer.name||'PSD Layer',
          visible:sourceLayer.visible!==false,
          opacity:clamp(Number(sourceLayer.opacity),0,1),
          blendMode:sourceLayer.blendMode||'source-over',
          clipping:sourceLayer.clipping===true,
          x:sourceLayer.x,y:sourceLayer.y,width:sourceLayer.width,height:sourceLayer.height,
          groupId:sourceLayer.groupKey?(groupIdByKey.get(sourceLayer.groupKey)??null):null,
          mask:maskDataUrl?createLayerMask({enabled:sourceLayer.mask.disabled!==true,dataUrl:maskDataUrl}):null,
        };
        const canMapText=Boolean(sourceLayer.psdText?.parsed)&&sourceLayer.psdText.parsed.orientation!=='Vrtc';
        const canMapShape=semantics.canMapPsdSolidShape(sourceLayer);
        const embeddedDocument=!canMapShape&&!canMapText&&sourceLayer.psdSmartObject
          ? await semantics.importPsdEmbeddedAssetDocument(sourceLayer.psdSmartObject,sourceLayer.name||'Smart Object',warnings)
          : null;
        let importedLayer;
        if(canMapShape){
          importedLayer=createShapeLayer({
            ...commonLayer,
            shape:'path',
            fill:sourceLayer.psdShape.fillEnabled===false?'transparent':sourceLayer.psdShape.fill,
            stroke:sourceLayer.psdShape.strokeEnabled&&sourceLayer.psdShape.stroke?sourceLayer.psdShape.stroke:'transparent',
            strokeWidth:sourceLayer.psdShape.strokeEnabled?Math.max(0,Number(sourceLayer.psdShape.strokeWidth)||0):0,
            pathClosed:true,
          });
          const localMask=semantics.importPsdVectorMask(sourceLayer.vectorMask,importedLayer);
          const subpath=localMask?.subpaths?.[0];
          importedLayer.pathPoints=structuredClone(subpath?.points||[]);
          importedLayer.pathClosed=subpath?.closed!==false;
          importedLayer.psdShape=semantics.importPsdShapeMetadata(sourceLayer.psdShape,importedLayer);
          warnings.push(`Слой «${sourceLayer.name}»: Photoshop solid-color vector shape импортирован как editable ZPE path; fill/stroke/width и path geometry можно менять с native descriptor rewrite`);
        }else if(canMapText){
          const parsedText=sourceLayer.psdText.parsed;
          const typography=parsedText.typography||{};
          importedLayer=createTextLayer({
            ...commonLayer,
            text:String(parsedText.text||'').replace(/\r/g,'\n')||sourceLayer.name||'Текст',
            fontFamily:typography.fontFamily||'Arial, sans-serif',
            fontLabel:typography.fontName||'',
            fontSize:clamp(Number(typography.fontSize)||Math.round(sourceLayer.height*.8)||18,6,500),
            fontWeight:typography.fontWeight==='700'?'700':'400',
            fontStyle:typography.fontStyle==='italic'?'italic':'normal',
            align:['left','center','right'].includes(typography.align)?typography.align:'left',
            lineHeight:clamp(Number(typography.lineHeight)||1.18,.8,3),
            letterSpacing:clamp(Number(typography.letterSpacing)||0,-5,20),
            underline:typography.underline===true,
            strikeThrough:typography.strikeThrough===true,
            width:sourceLayer.width,height:sourceLayer.height,
            color:typography.color||'#000000',
          });
          importedLayer.psdText=semantics.importPsdTextMetadata(sourceLayer.psdText,sourceLayer,importedLayer);
          const runMode=typography.editableSingleStyle?'single-run EngineData writeback готов':'multi-run typography сохранена только для безопасного fallback';
          warnings.push(`Слой «${sourceLayer.name}»: Photoshop TySh импортирован как editable ZPE text с EngineData typography (${runMode})`);
        }else if(sourceLayer.psdSmartObject){
          importedLayer=createSmartObjectLayer({
            ...commonLayer,
            previewDataUrl:dataUrl,
            embeddedDocument,
            psdSmartObject:semantics.importPsdSmartObjectMetadata(sourceLayer.psdSmartObject,sourceLayer,dataUrl,embeddedDocument),
          });
        }else{
          importedLayer=createRasterLayer({...commonLayer,dataUrl,highDepthSource});
        }
        importedLayer.vectorMask=canMapShape?null:semantics.importPsdVectorMask(sourceLayer.vectorMask,importedLayer);
        if(!canMapShape&&!canMapText&&sourceLayer.psdText?.parsed?.orientation==='Vrtc'){
          warnings.push(`Слой «${sourceLayer.name}»: vertical Photoshop text пока оставлен raster preview; TySh vertical mapping будет отдельным этапом`);
        }
        if(!canMapShape&&!canMapText&&sourceLayer.psdSmartObject){
          const asset=sourceLayer.psdSmartObject.asset;
          if(embeddedDocument)warnings.push(`Слой «${sourceLayer.name}»: embedded ${asset?.detectedFileType||'asset'} «${asset?.filename||''}» извлечён в editable content-tab; исходные Photoshop bytes сохраняются пока содержимое не изменено`);
          else warnings.push(`Слой «${sourceLayer.name}»: Photoshop Smart Object/Placed Layer сохранён как non-destructive preview + opaque native metadata; linked/unsupported payload не читается с внешней файловой системы`);
        }
        if(!canMapShape&&sourceLayer.vectorMask?.linked===false)warnings.push(`Слой «${sourceLayer.name}»: Photoshop vector mask unlinked-флаг сохранён, но ZPE при трансформациях пока перемещает её вместе со слоем`);
        prepared.push(importedLayer);
        sourceLayer.pixelBuffer=null;
        sourceLayer.pixels=null;
        if(sourceLayer.mask)sourceLayer.mask.pixels=null;
      }
      if(!prepared.length&&(parsed.compositePixelBuffer||parsed.composite)){
        const compositePixels=parsed.compositePixelBuffer
          ? previewPixelsFor(parsed.compositePixelBuffer)
          : parsed.composite;
        let highDepthSource=null;
        if(parsed.compositePixelBuffer&&(parsed.compositePixelBuffer.bitsPerChannel>8||parsed.compositePixelBuffer.model==='cmyk')){
          const rawBytes=parsed.compositePixelBuffer.data?.byteLength||0;
          const remaining=Math.max(0,MAX_PIXEL_BUFFER_SOURCE_BYTES-highDepthBytesUsed);
          if(rawBytes>0&&rawBytes<=remaining){
            highDepthSource=serializePixelBufferSource(parsed.compositePixelBuffer,{maxBytes:remaining});
            highDepthBytesUsed+=highDepthSource.rawBytes;
          }else{
            warnings.push(`PSD/PSB composite: high-depth source ${Math.ceil(rawBytes/1024/1024)} МБ не помещается в bounded .zpe precision budget; сохранён только 8-bit preview`);
          }
        }
        prepared.push(createRasterLayer({
          name:'PSD/PSB Composite',x:0,y:0,width:parsed.width,height:parsed.height,
          dataUrl:await rendering.rgbaPixelsToDataUrl(parsed.width,parsed.height,compositePixels,'PSD/PSB composite'),
          highDepthSource,
        }));
      }
      if(!prepared.length)throw new Error('PSD/PSB не содержит bitmap-данных, которые текущий RGB/8-bit pipeline может импортировать');
  
      if(runtime.getDocument()!==targetDocument||runtime.getActiveSessionId()!==targetSessionId||
        runtime.getHistoryEntry()!==targetHistoryEntry||runtime.getChangeSerial()!==targetChangeSerial){
        ui.setStatus('Импорт PSD/PSB отменён: документ изменился во время декодирования');
        ui.toast('Повторите импорт PSD/PSB в нужной вкладке','warn');
        return;
      }
      if(runtime.blockPendingDocumentEdit())return;
      const next=createDocument({
        name:(file.name||'PSD').replace(/\.ps[db]$/i,''),
        width:parsed.width,height:parsed.height,background:'transparent'
      });
      next.layers=prepared;
      next.groups=importedGroups;
      next.paths=structuredClone(parsed.paths||[]);
      next.psdLinkedLayerBlocks=(parsed.linkedLayerBlocks||[]).map(semantics.psdOpaqueBlockToState).filter(Boolean);
      next.psdSmartObjectSourceCount=prepared.filter(layer=>Boolean(layer.psdSmartObject)).length;
      next.colorManagement=colorPolicy;
      next.proofProfile=targetDocument.proofProfile?structuredClone(targetDocument.proofProfile):null;
      next.displayProfile=targetDocument.displayProfile?structuredClone(targetDocument.displayProfile):null;
      next.colorProfile=parsed.iccProfile?{
        kind:'icc',
        untagged:Boolean(parsed.iccUntagged),
        dataUrl:bytesToDataUrl(parsed.iccProfile.bytes,'application/vnd.iccprofile'),
        name:parsed.iccProfile.name||'',
        version:parsed.iccProfile.version||'',
        deviceClass:parsed.iccProfile.deviceClass||'',
        colorSpace:parsed.iccProfile.colorSpace||'',
        pcs:parsed.iccProfile.pcs||'',
        signatureValid:parsed.iccProfile.signatureValid===true,
      }:(parsed.iccUntagged?{kind:'untagged',untagged:true}:null);
      if(parsed.iccProfile)parsed.iccProfile.bytes=null;
      next.selectedLayerId=prepared.at(-1)?.id??null;
      runtime.publishDocument(next,{label:'Импорт PSD/PSB'});
      ui.setStatus(`PSD/PSB импортирован: ${prepared.length} слоёв, групп: ${importedGroups.length}, paths: ${next.paths.length}. Сохраните проект как .zpe`);
      ui.toast(`PSD/PSB открыт: ${prepared.length} слоёв, групп: ${importedGroups.length}, paths: ${next.paths.length}`,'success');
      if(warnings.length){
        ui.consoleRef.warn('PSD/PSB import warnings',warnings);
        ui.toast(`PSD/PSB импортирован с ограничениями: ${warnings.length}. Подробности — в консоли`,'warn');
      }
    }catch(error){
      ui.consoleRef.error('PSD/PSB import failed',{name:file?.name,size:file?.size,error});
      const message=`Не удалось импортировать PSD/PSB: ${error?.message||error}`;
      ui.alert(message);ui.setStatus('Ошибка импорта PSD/PSB');ui.toast(message,'error');
    }
  }

  return { open };
}
