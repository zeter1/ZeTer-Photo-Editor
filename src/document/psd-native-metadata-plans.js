import { layerPixelToDocumentPoint } from '../core/geometry.js';
import { dataUrlToBytes } from '../core/io.js';
import { DEFAULT_LAYER_FILTERS, sanitizeFilters } from '../core/state.js';
import { sanitizeAdjustmentModel } from '../core/adjustments.js';
import { rewriteTypeToolText, rewritePsdShapeStyle, rewritePsdAdjustmentBlocks } from '../formats/psd.js';

const MAX_SHAPE_BLOCK_BYTES = 4 * 1024 * 1024;
const MAX_ADJUSTMENT_BLOCK_BYTES = 4 * 1024 * 1024;
const MAX_SMART_OBJECT_BLOCK_BYTES = 8 * 1024 * 1024;
const MAX_LINKED_LAYER_BLOCK_BYTES = 128 * 1024 * 1024;
const MAX_TEXT_BLOCK_BYTES = 16 * 1024 * 1024;
const EPSILON = 1e-9;

function sameNumber(left, right) {
  return Math.abs(Number(left) - Number(right)) <= EPSILON;
}

function hasNonDefaultFilters(filtersValue) {
  const filters = sanitizeFilters(filtersValue);
  return Object.keys(DEFAULT_LAYER_FILTERS)
    .some(key => Math.abs(Number(filters[key]) - Number(DEFAULT_LAYER_FILTERS[key])) > EPSILON);
}

export function psdOpaqueBlockFromState(block, { maxBytes = MAX_SMART_OBJECT_BLOCK_BYTES } = {}) {
  if (!block?.key || !block.dataUrl) return null;
  return {
    signature: block.signature === '8B64' ? '8B64' : '8BIM',
    key: String(block.key).slice(0, 4),
    data: dataUrlToBytes(block.dataUrl, { maxBytes }),
  };
}

function exportPsdShapePathMask(layer) {
  const points = Array.isArray(layer?.pathPoints) ? layer.pathPoints : [];
  if (layer?.type !== 'shape' || layer.shape !== 'path' || points.length < 2 || layer.pathClosed === false) return null;
  const documentize = node => {
    const anchor = layerPixelToDocumentPoint(node, layer);
    return {
      x: anchor.x, y: anchor.y,
      handleIn: node.handleIn ? layerPixelToDocumentPoint(node.handleIn, layer) : null,
      handleOut: node.handleOut ? layerPixelToDocumentPoint(node.handleOut, layer) : null,
      kind: node.kind === 'smooth' ? 'smooth' : 'corner',
    };
  };
  return {
    enabled:true, invert:false, linked:true, fillStartsWithAllPixels:false,
    subpaths:[{ operation:'add', closed:true, fillRule:'non-zero', points:points.map(documentize) }],
  };
}

export function psdShapeNativePlan(layer) {
  const source = layer?.psdShape, baseline = source?.baseline;
  if (layer?.type !== 'shape' || layer.shape !== 'path' || !source?.blocks?.length || source.fillType !== 'solid' || !baseline) {
    return { eligible:false, reason:'нет поддержанного imported solid-shape metadata', metadata:null, vectorMask:null };
  }
  if (layer.pathClosed === false || baseline.pathClosed === false) {
    return { eligible:false, reason:'open path не совместим с imported closed Photoshop Shape', metadata:null, vectorMask:null };
  }
  if (!sameNumber(layer.width, baseline.width) || !sameNumber(layer.height, baseline.height)
      || !sameNumber(layer.scaleX ?? 1, baseline.scaleX ?? 1) || !sameNumber(layer.scaleY ?? 1, baseline.scaleY ?? 1)
      || !sameNumber(layer.rotation ?? 0, baseline.rotation ?? 0)) {
    return { eligible:false, reason:'resize/scale/rotation требуют согласования Photoshop stroke geometry', metadata:null, vectorMask:null };
  }
  if (layer.styles) return { eligible:false, reason:'layer styles требуют raster preview', metadata:null, vectorMask:null };
  if (hasNonDefaultFilters(layer.filters)) return { eligible:false, reason:'pixel filters требуют raster preview', metadata:null, vectorMask:null };
  const vectorMask = exportPsdShapePathMask(layer);
  if (!vectorMask) return { eligible:false, reason:'path geometry недоступна', metadata:null, vectorMask:null };
  try {
    let blocks = source.blocks.map(block => psdOpaqueBlockFromState(block, { maxBytes:MAX_SHAPE_BLOCK_BYTES })).filter(Boolean);
    const fill=String(layer.fill||'transparent'), stroke=String(layer.stroke||'transparent');
    const strokeWidth=Math.max(0,Number(layer.strokeWidth)||0), fillEnabled=fill!=='transparent';
    const strokeEnabled=stroke!=='transparent'&&strokeWidth>0;
    const styleChanged=fill!==String(baseline.fill||'transparent')||stroke!==String(baseline.stroke||'transparent')||!sameNumber(strokeWidth,baseline.strokeWidth);
    if(styleChanged) blocks=rewritePsdShapeStyle(blocks,{fill,stroke,strokeWidth,fillEnabled,strokeEnabled}).blocks;
    return {
      eligible:true, reason:null,
      metadata:{...source,fill:fillEnabled?fill:source.fill,fillEnabled,stroke:strokeEnabled?stroke:source.stroke,strokeEnabled,strokeWidth,blocks},
      vectorMask,
    };
  } catch(error) {
    return { eligible:false, reason:'shape descriptor rewrite недоступен: '+(error?.message||error), metadata:null, vectorMask:null };
  }
}

export function psdTextNativePlan(layer) {
  const source=layer?.psdText, baseline=source?.baseline;
  if(layer?.type!=='text'||!source?.dataUrl||!baseline)return{eligible:false,reason:'нет imported TySh metadata',block:null};
  if(!sameNumber(layer.width,baseline.width)||!sameNumber(layer.height,baseline.height)
      ||!sameNumber(layer.scaleX??1,baseline.scaleX??1)||!sameNumber(layer.scaleY??1,baseline.scaleY??1)
      ||!sameNumber(layer.rotation??0,baseline.rotation??0)) {
    return{eligible:false,reason:'изменена text-layer geometry/scale/rotation',block:null};
  }
  const styleSame=String(layer.fontFamily||'')===String(baseline.fontFamily||'')
    &&sameNumber(layer.fontSize,baseline.fontSize)
    &&String(layer.fontWeight||'400')===String(baseline.fontWeight||'400')
    &&String(layer.fontStyle||'normal')===String(baseline.fontStyle||'normal')
    &&String(layer.align||'left')===String(baseline.align||'left')
    &&sameNumber(layer.lineHeight,baseline.lineHeight)&&sameNumber(layer.letterSpacing,baseline.letterSpacing)
    &&Boolean(layer.underline)===Boolean(baseline.underline)&&Boolean(layer.strikeThrough)===Boolean(baseline.strikeThrough)
    &&String(layer.color||'')===String(baseline.color||'');
  if(!styleSame)return{eligible:false,reason:'изменена typography; Stage 15b безопасно переписывает text/run lengths, но не style runs',block:null};
  const textChanged=String(layer.text||'')!==String(baseline.text||'');
  if(textChanged&&source.parsed?.typography?.editableSingleStyle!==true) {
    return{eligible:false,reason:'изменён multi-run Photoshop text; безопасный EngineData writeback требует single style/paragraph run',block:null};
  }
  try {
    const raw=dataUrlToBytes(source.dataUrl,{maxBytes:MAX_TEXT_BLOCK_BYTES});
    const rewritten=rewriteTypeToolText(raw,layer.text,{deltaX:Number(layer.x)-Number(baseline.x),deltaY:Number(layer.y)-Number(baseline.y)});
    return {
      eligible:true,reason:null,
      block:{signature:source.signature==='8B64'?'8B64':'8BIM',key:'TySh',data:rewritten.data},
      bounds:{x:Math.round(Number(layer.x)||0),y:Math.round(Number(layer.y)||0),width:Math.max(1,Math.round(Number(baseline.width)||1)),height:Math.max(1,Math.round(Number(baseline.height)||1))},
    };
  } catch(error) {
    return{eligible:false,reason:'TySh metadata не прошли rewrite validation: '+(error?.message||error),block:null};
  }
}

export function psdAdjustmentNativePlan(layer) {
  const source=layer?.psdAdjustment, adjustment=sanitizeAdjustmentModel(layer?.adjustment);
  if(layer?.type!=='adjustment'||!source||!adjustment)return{eligible:false,reason:'нет imported Photoshop adjustment metadata',metadata:null};
  if(source.kind!==adjustment.kind)return{eligible:false,reason:'тип adjustment не совпадает с исходным Photoshop block',metadata:null};
  if(layer.styles)return{eligible:false,reason:'layer styles на adjustment layer требуют composite fallback',metadata:null};
  if(hasNonDefaultFilters(layer.filters))return{eligible:false,reason:'дополнительные ZPE filters не кодируются в Photoshop adjustment record',metadata:null};
  try {
    const blocks=(source.blocks||[]).map(block=>psdOpaqueBlockFromState(block,{maxBytes:MAX_ADJUSTMENT_BLOCK_BYTES})).filter(Boolean);
    const rewritten=rewritePsdAdjustmentBlocks(blocks,adjustment);
    return{eligible:true,reason:null,metadata:{kind:adjustment.kind,blocks:rewritten.blocks,channelIds:Array.isArray(source.channelIds)?source.channelIds.slice(0,16):[]}};
  } catch(error) {
    return{eligible:false,reason:error?.message||String(error),metadata:null};
  }
}

export function psdPreviewFingerprint(dataUrl) {
  const value=String(dataUrl||'');
  let hash=2166136261;
  for(let index=0;index<value.length;index+=1){hash^=value.charCodeAt(index);hash=Math.imul(hash,16777619);}
  return'value:'+value.length+':'+(hash>>>0).toString(16).padStart(8,'0');
}

export function psdEmbeddedDocumentFingerprint(documentValue) {
  if(!documentValue)return null;
  return psdPreviewFingerprint([
    documentValue.name||'',Number(documentValue.width)||0,Number(documentValue.height)||0,
    documentValue.createdAt||'',documentValue.updatedAt||'',
    Array.isArray(documentValue.layers)?documentValue.layers.length:0,
    Array.isArray(documentValue.groups)?documentValue.groups.length:0,
  ].join('|'));
}

function psdSmartObjectLayerUnchanged(layer) {
  const source=layer?.psdSmartObject,baseline=source?.baseline;
  if(layer?.type!=='smart-object'||!source||!baseline||!source.blocks?.length)return false;
  if(!sameNumber(layer.x,baseline.x)||!sameNumber(layer.y,baseline.y)||!sameNumber(layer.width,baseline.width)||!sameNumber(layer.height,baseline.height))return false;
  if(!sameNumber(layer.scaleX??1,baseline.scaleX??1)||!sameNumber(layer.scaleY??1,baseline.scaleY??1)||!sameNumber(layer.rotation??0,baseline.rotation??0))return false;
  if(psdPreviewFingerprint(layer.previewDataUrl)!==baseline.previewFingerprint)return false;
  if((baseline.embeddedFingerprint||null)!==psdEmbeddedDocumentFingerprint(layer.embeddedDocument))return false;
  if(layer.styles||layer.smartFilterMask||(layer.smartFilters?.length||0))return false;
  return !hasNonDefaultFilters(layer.filters);
}

export function psdSmartObjectRoundTripPlan(documentValue) {
  const imported=(documentValue?.layers||[]).filter(layer=>layer?.psdSmartObject);
  const expected=Math.max(0,Math.trunc(Number(documentValue?.psdSmartObjectSourceCount)||0));
  if(!imported.length)return{eligible:false,imported,expected,reason:'нет imported Photoshop Smart Object metadata',linkedLayerBlocks:[]};
  if(expected!==imported.length)return{eligible:false,imported,expected,reason:'изменилось число imported Photoshop Smart Objects',linkedLayerBlocks:[]};
  const changed=imported.find(layer=>!psdSmartObjectLayerUnchanged(layer));
  if(changed)return{eligible:false,imported,expected,reason:'слой «'+(changed.name||'Smart Object')+'» был трансформирован, отфильтрован или его preview изменён',linkedLayerBlocks:[]};
  try {
    const linkedLayerBlocks=(documentValue.psdLinkedLayerBlocks||[]).map(block=>psdOpaqueBlockFromState(block,{maxBytes:MAX_LINKED_LAYER_BLOCK_BYTES})).filter(Boolean);
    return{eligible:true,imported,expected,reason:null,linkedLayerBlocks};
  } catch(error) {
    return{eligible:false,imported,expected,reason:'linked resource metadata повреждены: '+(error?.message||error),linkedLayerBlocks:[]};
  }
}

export function psdSmartObjectMetadataForExport(layer) {
  const source=layer?.psdSmartObject;
  if(!source?.blocks?.length)return null;
  return {
    kind:source.kind,uniqueId:source.uniqueId||null,placedVersion:source.placedVersion??null,
    placedTransform:Array.isArray(source.placedTransform)?source.placedTransform.slice(0,8):null,
    descriptor:source.descriptor?structuredClone(source.descriptor):null,
    asset:source.asset?structuredClone(source.asset):null,
    blocks:source.blocks.map(block=>psdOpaqueBlockFromState(block,{maxBytes:MAX_SMART_OBJECT_BLOCK_BYTES})).filter(Boolean),
  };
}
