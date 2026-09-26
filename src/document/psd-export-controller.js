import { frameBounds, clamp } from '../core/geometry.js';
import {
  createRasterLayer, checkedCanvasSize, DEFAULT_LAYER_FILTERS,
  sanitizeFilters, sanitizeColorManagement, isLayerVisible,
} from '../core/state.js';
import { hexToRgb } from '../core/pixels.js';
import {
  createRgba8PixelBuffer, deserializePixelBufferSource,
  compositePixelBufferLayers, compositeCmykPixelBufferLayers,
  MAX_HIGH_DEPTH_COMPOSITE_BYTES,
} from '../core/pixel-buffer.js';
import { layerStyleOutset } from '../core/layer-styles.js';
import { psdAdjustmentNativePlan, psdShapeNativePlan, psdSmartObjectMetadataForExport, psdSmartObjectRoundTripPlan, psdTextNativePlan } from './psd-native-metadata-plans.js';

/**
 * Owns PSD/PSB document-to-writer preparation.
 *
 * Binary parsing/writing remains in formats/psd.js. Photoshop native metadata
 * eligibility/rewrite planning lives in psd-native-metadata-plans.js. Browser
 * canvas/render effects and the shared vector-mask bridge remain explicit ports,
 * keeping native high-depth/CMYK preparation directly testable without a DOM.
 */
export function createPsdExportController({
  vectors: { exportPsdVectorMask } = {},
  rendering: { createCanvas, renderLayer, renderDocument } = {},
} = {}) {
  function psdExportBounds(layer){
    const scale=Math.max(Math.abs(Number(layer.scaleX)||1),Math.abs(Number(layer.scaleY)||1));
    const blur=Math.max(0,Number(layer.filters?.blur)||0)*scale*3;
    const stroke=layer.type==='shape'?Math.max(0,Number(layer.strokeWidth)||0)*scale/2:0;
    const bounds=frameBounds(layer,Math.ceil(blur+stroke+layerStyleOutset(layer.styles)*scale+2));
    const x=Math.floor(bounds.x),y=Math.floor(bounds.y);
    const width=Math.max(1,Math.ceil(bounds.x+bounds.width)-x);
    const height=Math.max(1,Math.ceil(bounds.y+bounds.height)-y);
    checkedCanvasSize(width,height,`PSD export слоя «${layer.name||'Без имени'}»`);
    return{x,y,width,height};
  }
  
  function canvasRgbaPixels(canvas,label){
    try{
      return canvas.getContext('2d',{alpha:true,willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
    }catch(error){
      throw new Error(`${label}: не удалось прочитать пиксели (${error?.message||error})`);
    }
  }
  
  async function renderPsdLayerPixels(layer,bounds){
    const canvas=createCanvas();canvas.width=bounds.width;canvas.height=bounds.height;
    const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
    ctx.translate(-bounds.x,-bounds.y);
    const preview=structuredClone(layer);
    preview.mask=null;
    preview.vectorMask=null;
    preview.opacity=1;
    preview.blendMode='source-over';
    await renderLayer(ctx,preview);
    return canvasRgbaPixels(canvas,`PSD слой «${layer.name||'Без имени'}»`);
  }
  
  async function renderPsdMaskPixels(layer,bounds){
    if(!layer.mask?.dataUrl)return null;
    const canvas=createCanvas();canvas.width=bounds.width;canvas.height=bounds.height;
    const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
    ctx.translate(-bounds.x,-bounds.y);
    const maskLayer=createRasterLayer({
      name:`${layer.name||'Слой'} — mask`,
      x:layer.x,y:layer.y,width:layer.width,height:layer.height,
      scaleX:layer.scaleX,scaleY:layer.scaleY,rotation:layer.rotation,
      opacity:1,blendMode:'source-over',dataUrl:layer.mask.dataUrl,
      filters:{...DEFAULT_LAYER_FILTERS},styles:null,mask:null,
    });
    await renderLayer(ctx,maskLayer);
    return canvasRgbaPixels(canvas,`PSD mask «${layer.name||'Без имени'}»`);
  }
  
  function layerNeedsSemanticRasterWarning(layer){
    if(layer.type!=='raster')return true;
    if(layer.styles)return true;
    const filters=sanitizeFilters(layer.filters);
    return Object.keys(DEFAULT_LAYER_FILTERS).some(key=>Math.abs(Number(filters[key])-Number(DEFAULT_LAYER_FILTERS[key]))>1e-9)||
      Math.abs(Number(layer.scaleX??1)-1)>1e-9||Math.abs(Number(layer.scaleY??1)-1)>1e-9||Math.abs(Number(layer.rotation)||0)>1e-9;
  }
  
  function nativeHighDepthPsdSource(layer){
    if(!layer?.highDepthSource||layer.type!=='raster'||layerNeedsSemanticRasterWarning(layer))return null;
    if(!Number.isInteger(Number(layer.x))||!Number.isInteger(Number(layer.y)))return null;
    try{
      const buffer=deserializePixelBufferSource(layer.highDepthSource);
      const supported=buffer.model==='cmyk'?[8,16,32].includes(buffer.bitsPerChannel):buffer.model==='rgb'&&[16,32].includes(buffer.bitsPerChannel);
      if(!supported)return null;
      if(buffer.width!==Math.trunc(Number(layer.width))||buffer.height!==Math.trunc(Number(layer.height)))return null;
      return buffer;
    }catch(error){
      console.warn(`PSD/PSB native source «${layer.name||'Без имени'}» не прошёл export validation`,error);
      return null;
    }
  }
  
  function nativePsdBounds(layer,buffer){
    return{x:Math.trunc(Number(layer.x)||0),y:Math.trunc(Number(layer.y)||0),width:buffer.width,height:buffer.height};
  }
  
  function highDepthCompositePlan(exportDoc,planned){
    const groups=Array.isArray(exportDoc.groups)?exportDoc.groups:[];
    const groupMap=new Map(groups.map(group=>[group.id,group]).filter(([id])=>Boolean(id)));
    const plannedById=new Map(planned.map(item=>[item.layer.id,item]));
    const directLayers=new Map(),childGroups=new Map(),groupRanks=new Map();
    const append=(map,key,value)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(value);};
    for(const group of groups){
      const parentId=group.parentGroupId&&groupMap.has(group.parentGroupId)?group.parentGroupId:null;
      append(childGroups,parentId,group);
    }
    for(let index=0;index<exportDoc.layers.length;index+=1){
      const layer=exportDoc.layers[index];
      const groupId=layer.groupId&&groupMap.has(layer.groupId)?layer.groupId:null;
      const plannedItem=plannedById.get(layer.id);
      if(plannedItem)append(directLayers,groupId,{item:plannedItem,index});
      let currentId=groupId;
      const seen=new Set();
      while(currentId&&!seen.has(currentId)){
        seen.add(currentId);
        if(!groupRanks.has(currentId)||index<groupRanks.get(currentId))groupRanks.set(currentId,index);
        const current=groupMap.get(currentId);
        currentId=current?.parentGroupId&&groupMap.has(current.parentGroupId)?current.parentGroupId:null;
      }
    }
    const entriesFor=parentId=>{
      const entries=[];
      for(const direct of directLayers.get(parentId)||[])entries.push({type:'layer',item:direct.item,rank:direct.index,order:direct.index});
      for(const group of childGroups.get(parentId)||[])entries.push({type:'group',group,rank:groupRanks.get(group.id)??Number.POSITIVE_INFINITY,order:groups.indexOf(group)});
      entries.sort((a,b)=>a.rank-b.rank||a.order-b.order);
      return entries;
    };
    const ordered=[],active=new Set();
    let reason=null;
    const visit=parentId=>{
      for(const entry of entriesFor(parentId)){
        if(reason)return;
        if(entry.type==='layer'){
          if(isLayerVisible(exportDoc,entry.item.layer)&&Number(entry.item.layer.opacity??1)>0)ordered.push(entry.item);
          continue;
        }
        const group=entry.group;
        if(!group||group.visible===false||Number(group.opacity??1)<=0)continue;
        const mode=group.blendMode||'pass-through';
        if(mode!=='pass-through'||Math.abs(Number(group.opacity??1)-1)>1e-9){
          reason='группа «'+(group.name||'Без имени')+'» требует isolated Canvas group composite';
          return;
        }
        if(active.has(group.id)){reason='обнаружен цикл групп';return;}
        active.add(group.id);visit(group.id);active.delete(group.id);
      }
    };
    visit(null);
    return{items:ordered,reason};
  }
  
  function highDepthCompositeBackground(exportDoc){
    if(!exportDoc.background||exportDoc.background==='transparent')return{background:null,reason:null};
    try{
      const [r,g,b]=hexToRgb(exportDoc.background);
      return{background:{rgba:[r/255,g/255,b/255,1],colorSpace:'srgb'},reason:null};
    }catch(error){
      return{background:null,reason:'фон документа не является поддерживаемым RGB hex-цветом'};
    }
  }
  
  function buildHighDepthComposite(exportDoc,planned,prepared,bitsPerChannel,hasAdjustmentLayers,warnings){
    if(bitsPerChannel<=8||hasAdjustmentLayers)return null;
    const plan=highDepthCompositePlan(exportDoc,planned);
    if(plan.reason){
      warnings.push('Stage 12g: merged composite оставлен на Canvas8 fallback: '+plan.reason);
      return null;
    }
    const vectorMasked=plan.items.find(item=>item.layer.vectorMask?.enabled!==false&&item.layer.vectorMask?.subpaths?.length);
    if(vectorMasked){
      warnings.push('Stage 12g: merged composite оставлен на Canvas8 fallback: vector mask слоя «'+(vectorMasked.layer.name||'Без имени')+'» пока требует rasterized mask bridge');
      return null;
    }
    const backgroundInfo=highDepthCompositeBackground(exportDoc);
    if(backgroundInfo.reason){
      warnings.push('Stage 12g: merged composite оставлен на Canvas8 fallback: '+backgroundInfo.reason);
      return null;
    }
    const requiredBytes=exportDoc.width*exportDoc.height*4*(bitsPerChannel/8);
    if(!Number.isSafeInteger(requiredBytes)||requiredBytes>MAX_HIGH_DEPTH_COMPOSITE_BYTES){
      warnings.push('Stage 12g: merged composite оставлен на Canvas8 fallback: typed output требует около '+Math.ceil(requiredBytes/1048576)+' МБ при лимите '+Math.floor(MAX_HIGH_DEPTH_COMPOSITE_BYTES/1048576)+' МБ');
      return null;
    }
    const preparedByLayerId=new Map(planned.map((item,index)=>[item.layer.id,prepared[index]]));
    const layers=[];
    for(const item of plan.items){
      const exported=preparedByLayerId.get(item.layer.id);
      if(!exported)continue;
      let buffer=item.nativePixelBuffer;
      if(!buffer){
        if(!exported.pixels){
          warnings.push('Stage 12g: merged composite оставлен на Canvas8 fallback: нет raster preview для слоя «'+(item.layer.name||'Без имени')+'»');
          return null;
        }
        buffer=createRgba8PixelBuffer(exported.width,exported.height,exported.pixels,{colorSpace:'srgb'});
      }
      layers.push({
        buffer,x:item.bounds.x,y:item.bounds.y,
        opacity:clamp(Number(item.layer.opacity??1),0,1),
        blendMode:item.layer.blendMode||'source-over',
        maskPixels:exported.mask&&!exported.mask.disabled?exported.mask.pixels:null,
      });
    }
    try{
      return compositePixelBufferLayers(exportDoc.width,exportDoc.height,layers,{
        bitsPerChannel,
        colorSpace:bitsPerChannel===32?'linear-rgb-unmanaged':'srgb',
        background:backgroundInfo.background,
        maxBytes:MAX_HIGH_DEPTH_COMPOSITE_BYTES,
      });
    }catch(error){
      console.warn('Stage 12g typed merged composite failed; using Canvas8 fallback',error);
      warnings.push('Stage 12g: typed merged composite не собран ('+(error?.message||error)+'); использован Canvas8 fallback');
      return null;
    }
  }
  
  function cmykNativeExportEligibility(exportDoc,planned,hasAdjustmentLayers,bitsPerChannel){
    if(hasAdjustmentLayers)return{eligible:false,reason:'видимые adjustment layers требуют RGB Canvas composite'};
    if(!planned.length)return{eligible:false,reason:'нет native CMYK raster layers'};
    const missing=planned.find(item=>item.nativePixelBuffer?.model!=='cmyk');
    if(missing)return{eligible:false,reason:'слой «'+(missing.layer.name||'Без имени')+'» не имеет совместимого native CMYK source'};
    const vector=planned.find(item=>item.layer.vectorMask?.enabled!==false&&item.layer.vectorMask?.subpaths?.length);
    if(vector)return{eligible:false,reason:'vector mask слоя «'+(vector.layer.name||'Без имени')+'» пока требует RGB raster bridge'};
    const plan=highDepthCompositePlan(exportDoc,planned);
    if(plan.reason)return{eligible:false,reason:plan.reason};
    if(exportDoc.background&&exportDoc.background!=='transparent')return{eligible:false,reason:'непрозрачный RGB background пока не переводится в native CMYK'};
    const required=exportDoc.width*exportDoc.height*5*(bitsPerChannel/8);
    if(!Number.isSafeInteger(required)||required>MAX_HIGH_DEPTH_COMPOSITE_BYTES)return{eligible:false,reason:'native CMYK composite требует около '+Math.ceil(required/1048576)+' МБ при лимите '+Math.floor(MAX_HIGH_DEPTH_COMPOSITE_BYTES/1048576)+' МБ'};
    return{eligible:true,reason:null,plan};
  }
  
  function buildNativeCmykComposite(exportDoc,planned,prepared,bitsPerChannel,eligibility){
    const preparedByLayerId=new Map(planned.map((item,index)=>[item.layer.id,prepared[index]]));
    const layers=[];
    for(const item of eligibility.plan.items){
      const exported=preparedByLayerId.get(item.layer.id);
      if(!exported)continue;
      const buffer=item.nativePixelBuffer;
      if(!buffer||buffer.model!=='cmyk')throw new Error('Stage 13b CMYK composite потерял native source слоя «'+(item.layer.name||'Без имени')+'»');
      layers.push({buffer,x:item.bounds.x,y:item.bounds.y,opacity:clamp(Number(item.layer.opacity??1),0,1),blendMode:item.layer.blendMode||'source-over',maskPixels:exported.mask&&!exported.mask.disabled?exported.mask.pixels:null});
    }
    return compositeCmykPixelBufferLayers(exportDoc.width,exportDoc.height,layers,{bitsPerChannel,colorSpace:'device-cmyk',maxBytes:MAX_HIGH_DEPTH_COMPOSITE_BYTES});
  }
  
  async function preparePsdExport(exportDoc){
    const warnings=[];
    const psdSmartPlan=psdSmartObjectRoundTripPlan(exportDoc);
    const visibleAdjustmentLayers=exportDoc.layers.filter(layer=>layer.type==='adjustment'&&isLayerVisible(exportDoc,layer));
    const adjustmentPlans=new Map(exportDoc.layers.filter(layer=>layer.type==='adjustment').map(layer=>[layer.id,psdAdjustmentNativePlan(layer)]));
    const unsupportedVisibleAdjustment=visibleAdjustmentLayers.find(layer=>!adjustmentPlans.get(layer.id)?.eligible);
    const needsAdjustmentRasterFallback=Boolean(unsupportedVisibleAdjustment);
    const hasAdjustmentLayers=visibleAdjustmentLayers.length>0;
    const sourceLayers=exportDoc.layers.filter(layer=>layer.type!=='adjustment'||(!needsAdjustmentRasterFallback&&adjustmentPlans.get(layer.id)?.eligible));
    const planned=sourceLayers.map(layer=>{
      const nativePixelBuffer=nativeHighDepthPsdSource(layer);
      const nativeText=layer.psdText?psdTextNativePlan(layer):null;
      const nativeShape=layer.psdShape?psdShapeNativePlan(layer):null;
      const nativeAdjustment=layer.type==='adjustment'?adjustmentPlans.get(layer.id):null;
      const baseline=psdSmartPlan.eligible&&layer.psdSmartObject?layer.psdSmartObject.baseline:null;
      const bounds=nativeAdjustment?.eligible?{x:0,y:0,width:0,height:0}:nativeText?.eligible?nativeText.bounds:baseline
        ? {x:Math.trunc(Number(baseline.x)||0),y:Math.trunc(Number(baseline.y)||0),width:Math.max(1,Math.trunc(Number(baseline.width)||1)),height:Math.max(1,Math.trunc(Number(baseline.height)||1))}
        : nativePixelBuffer?nativePsdBounds(layer,nativePixelBuffer):psdExportBounds(layer);
      return{layer,nativePixelBuffer,nativeText,nativeShape,nativeAdjustment,bounds};
    });
    const cmykDepths=planned.filter(item=>item.nativePixelBuffer?.model==='cmyk').map(item=>item.nativePixelBuffer.bitsPerChannel);
    const tentativeCmykDepth=cmykDepths.includes(32)?32:cmykDepths.includes(16)?16:8;
    const cmykEligibility=cmykNativeExportEligibility(exportDoc,planned,hasAdjustmentLayers,tentativeCmykDepth);
    const colorMode=cmykEligibility.eligible?'cmyk':'rgb';
    const writerNative=planned.map(item=>colorMode==='cmyk'?(item.nativePixelBuffer?.model==='cmyk'?item.nativePixelBuffer:null):(item.nativePixelBuffer?.model==='rgb'?item.nativePixelBuffer:null));
    const nativeDepths=writerNative.map(buffer=>buffer?.bitsPerChannel||0);
    const bitsPerChannel=nativeDepths.includes(32)?32:nativeDepths.includes(16)?16:8;
    let totalPixels=exportDoc.width*exportDoc.height+planned.reduce((sum,item)=>sum+item.bounds.width*item.bounds.height,0);
    if(hasAdjustmentLayers)totalPixels+=exportDoc.width*exportDoc.height;
    if(totalPixels>48_000_000){
      throw new Error(`PSD export Stage 4 ограничен суммарно 48 МП временных RGBA-буферов; документ требует около ${Math.ceil(totalPixels/1_000_000)} МП. Для больших документов нужен tiled/streaming writer.`);
    }
    const groupsById=new Map((exportDoc.groups||[]).map(group=>[group.id,group]));
    const sourceGroupIds=new Set(sourceLayers.map(layer=>layer.groupId).filter(Boolean));
    for(const id of [...sourceGroupIds]){
      let current=groupsById.get(id);
      const seen=new Set();
      while(current?.parentGroupId&&!seen.has(current.id)){
        seen.add(current.id);
        sourceGroupIds.add(current.parentGroupId);
        current=groupsById.get(current.parentGroupId);
      }
    }
    const exportGroups=(exportDoc.groups||[])
      .filter(group=>sourceGroupIds.has(group.id))
      .map(group=>({
        key:group.id,
        parentKey:group.parentGroupId&&sourceGroupIds.has(group.parentGroupId)?group.parentGroupId:null,
        name:group.name||'Group',
        visible:group.visible!==false,
        collapsed:Boolean(group.collapsed),
        opacity:clamp(Number(group.opacity??1),0,1),
        blendMode:group.blendMode||'pass-through',
      }));
    if(planned.some(item=>!(psdSmartPlan.eligible&&item.layer.psdSmartObject)&&!item.nativeText?.eligible&&!item.nativeShape?.eligible&&!item.nativeAdjustment?.eligible&&layerNeedsSemanticRasterWarning(item.layer)))warnings.push('Text/shape, transforms, filters и layer styles экспортированы как raster preview соответствующих слоёв');
    const nativeTextCount=planned.filter(item=>item.nativeText?.eligible).length;
    const fallbackText=planned.filter(item=>item.layer.psdText&&!item.nativeText?.eligible);
    if(nativeTextCount)warnings.push(`Stage 15b: ${nativeTextCount} Photoshop TySh text layer(s) сохраняют native descriptor + EngineData + transform metadata`);
    for(const item of fallbackText)warnings.push(`Stage 15b: text layer «${item.layer.name||'Без имени'}» экспортируется raster preview (${item.nativeText?.reason||'native text mapping unavailable'})`);
    const nativeAdjustmentCount=planned.filter(item=>item.nativeAdjustment?.eligible).length;
    if(nativeAdjustmentCount)warnings.push(`Stage 16b: ${nativeAdjustmentCount} Photoshop adjustment layer(s) сохраняют native blocks + semantic parameters/masks/clipping`);
    if(needsAdjustmentRasterFallback)warnings.push(`Stage 16b: adjustment layer «${unsupportedVisibleAdjustment?.name||'Без имени'}» требует composite fallback (${adjustmentPlans.get(unsupportedVisibleAdjustment?.id)?.reason||'unsupported adjustment'})`);
    const nativeShapeCount=planned.filter(item=>item.nativeShape?.eligible).length;
    const fallbackShapes=planned.filter(item=>item.layer.psdShape&&!item.nativeShape?.eligible);
    if(nativeShapeCount)warnings.push(`Stage 15c: ${nativeShapeCount} Photoshop solid vector shape layer(s) сохраняют native fill/stroke + vector-mask metadata`);
    for(const item of fallbackShapes)warnings.push(`Stage 15c: shape layer «${item.layer.name||'Без имени'}» экспортируется raster preview (${item.nativeShape?.reason||'native shape mapping unavailable'})`);
    if(psdSmartPlan.imported.length){
      if(psdSmartPlan.eligible)warnings.push(`Stage 14a: ${psdSmartPlan.imported.length} Photoshop Smart Object layer(s) сохраняют opaque PlLd/SoLd/SoLE + linked-resource metadata`);
      else warnings.push(`Stage 14a: Photoshop Smart Object native passthrough отключён (${psdSmartPlan.reason}); сохранён безопасный raster preview без stale placed/linked metadata`);
    }
    const cmykSources=planned.filter(item=>item.layer.highDepthSource?.model==='cmyk');
    if(colorMode==='cmyk')warnings.push(`Stage 13b: ${cmykSources.length} native CMYK layer source экспортируются как настоящий CMYK PSD/PSB с сохранением channel precision`);
    else if(cmykSources.length)warnings.push(`Stage 13b: native CMYK round-trip отключён для этого документа (${cmykEligibility.reason}); ${cmykSources.length} CMYK source экспортируются через sRGB display preview`);
    const downgradedHighDepth=planned.filter((item,index)=>item.layer.highDepthSource?.model==='rgb'&&!writerNative[index]);
    if(downgradedHighDepth.length)warnings.push(`${downgradedHighDepth.length} high-depth RGB слой(я) с transform/filter/style или несовместимой геометрией экспортированы через 8-bit raster preview`);
    if(bitsPerChannel>8&&writerNative.some(buffer=>!buffer))warnings.push(`Документ экспортируется как ${bitsPerChannel}-bit; raster-preview слои без native source расширены из 8-bit без восстановления утраченной точности`);
    if(sourceLayers.some(layer=>layer.vectorMask?.linked===false))warnings.push('Unlinked vector mask flag записывается в PSD/PSB, но ZPE при трансформациях пока перемещает такую маску вместе со слоем');
    if(exportDoc.layers.some(layer=>layer.mask&&!layer.mask.dataUrl))warnings.push('Пустые маски «показать всё» не создают отдельный PSD mask channel');
  
    const prepared=[];
    for(let planIndex=0;planIndex<planned.length;planIndex+=1){
      const {layer,bounds,nativeText,nativeShape,nativeAdjustment}=planned[planIndex];
      const nativePixelBuffer=writerNative[planIndex];
      if(nativeAdjustment?.eligible){
        const adjustmentMask=layer.mask?.dataUrl?{
          pixels:await renderPsdMaskPixels(layer,{x:0,y:0,width:exportDoc.width,height:exportDoc.height}),
          disabled:layer.mask.enabled===false,
          x:0,y:0,width:exportDoc.width,height:exportDoc.height,defaultColor:255,
        }:null;
        prepared.push({
          name:layer.name||'Photoshop Adjustment',
          x:0,y:0,width:0,height:0,
          opacity:clamp(Number(layer.opacity??1),0,1),
          blendMode:layer.blendMode||'source-over',
          clipping:layer.clipping===true,
          groupKey:layer.groupId&&sourceGroupIds.has(layer.groupId)?layer.groupId:null,
          visible:layer.groupId&&sourceGroupIds.has(layer.groupId)?layer.visible!==false:isLayerVisible(exportDoc,layer),
          mask:adjustmentMask,vectorMask:exportPsdVectorMask(layer),
          psdAdjustment:nativeAdjustment.metadata,
        });
        continue;
      }
      const item={
        name:layer.name||'ZPE Layer',
        x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,
        opacity:clamp(Number(layer.opacity??1),0,1),
        blendMode:layer.blendMode||'source-over',
        clipping:layer.clipping===true,
        groupKey:layer.groupId&&sourceGroupIds.has(layer.groupId)?layer.groupId:null,
        visible:needsAdjustmentRasterFallback?false:(layer.groupId&&sourceGroupIds.has(layer.groupId)?layer.visible!==false:isLayerVisible(exportDoc,layer)),
        mask:layer.mask?.dataUrl?{
          pixels:await renderPsdMaskPixels(layer,bounds),
          disabled:layer.mask.enabled===false,
        }:null,
        vectorMask:nativeShape?.eligible?nativeShape.vectorMask:exportPsdVectorMask(layer),
        psdShape:nativeShape?.eligible?nativeShape.metadata:null,
        psdSmartObject:psdSmartPlan.eligible&&layer.psdSmartObject?psdSmartObjectMetadataForExport(layer):null,
        psdText:nativeText?.eligible?nativeText.block:null,
      };
      if(nativePixelBuffer)item.pixelBuffer=nativePixelBuffer;
      else item.pixels=await renderPsdLayerPixels(layer,bounds);
      prepared.push(item);
    }
  
    let compositePixelBuffer=null;
    let composite=null;
    if(colorMode==='cmyk'){
      compositePixelBuffer=buildNativeCmykComposite(exportDoc,planned,prepared,bitsPerChannel,cmykEligibility);
    }else{
      compositePixelBuffer=buildHighDepthComposite(exportDoc,planned,prepared,bitsPerChannel,hasAdjustmentLayers,warnings);
      if(!compositePixelBuffer){
        const compositeCanvas=createCanvas();
        await renderDocument(compositeCanvas,exportDoc,{checker:false});
        composite=canvasRgbaPixels(compositeCanvas,'PSD/PSB composite');
        if(bitsPerChannel>8)warnings.push(`${bitsPerChannel}-bit layer channels сохранены с native precision, но merged composite использует 8-bit Canvas fallback и затем расширяется до глубины документа`);
      }
    }
  
    if(needsAdjustmentRasterFallback){
      warnings.push('Неподдержанный adjustment layer сохранён через верхний Composite Preview; исходные raster/vector layers оставлены скрытыми, чтобы не удвоить baked-эффект');
      prepared.push({
        name:'ZPE Composite Preview (adjustments baked)',
        x:0,y:0,width:exportDoc.width,height:exportDoc.height,
        pixels:composite,opacity:1,blendMode:'source-over',visible:true,mask:null,
      });
    }else if(!prepared.length){
      prepared.push({
        name:'ZPE Composite Preview',
        x:0,y:0,width:exportDoc.width,height:exportDoc.height,
        pixels:composite,opacity:1,blendMode:'source-over',visible:true,mask:null,
      });
    }
  
    const policy=sanitizeColorManagement(exportDoc.colorManagement);
    if(exportDoc.colorProfile?.kind==='icc'){
      if(colorMode==='cmyk')warnings.push(`ICC profile embedded с native CMYK channels; display policy ZPE: ${policy.renderingIntent} → ${policy.displaySpace.toUpperCase()}`);
      else warnings.push('ICC profile сохранён как metadata resource; RGB Canvas fallback не объявляется profile-converted');
    }
    return{layers:[...prepared].reverse(),groups:exportGroups,paths:structuredClone(exportDoc.paths||[]),linkedLayerBlocks:psdSmartPlan.eligible?psdSmartPlan.linkedLayerBlocks:[],composite,compositePixelBuffer,bitsPerChannel,colorMode,warnings};
  }

  return { prepareDocument: preparePsdExport };
}
