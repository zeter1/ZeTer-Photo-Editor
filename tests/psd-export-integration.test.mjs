import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
const adapter=await readFile(new URL('../src/adapters/psd.js',import.meta.url),'utf8');

test('PSD Stage 4 and PSB Stage 7a are wired into the export UI',()=>{
  assert.match(main,/import \{ decodePsd, encodePsdBlob, encodePsbBlob, isPsdFile \} from '\.\/adapters\/psd\.js'/);
  assert.match(main,/PSD — RGB\/CMYK слои 8\/16\/32-bit/);
  assert.match(main,/PSB — RGB\/CMYK Large Document 8\/16\/32-bit/);
  assert.match(main,/async function preparePsdExport\(exportDoc\)/);
  assert.match(main,/async function exportPsdDocument\(exportDoc,\{psb=false\}=\{\}\)/);
  assert.match(main,/const encodeBlob=psb\?encodePsbBlob:encodePsdBlob/);
  assert.match(main,/if\(type==='psb'\)\{await exportPsdDocument\(exportDoc,\{psb:true\}\);return;\}/);
  assert.match(main,/downloadBlob\(blob,filename\)/);
  assert.match(main,/image\/vnd\.adobe\.photoshop/);
  assert.match(main,/48_000_000/);
  assert.match(main,/ZPE Composite Preview \(adjustments baked\)/);
});

test('PSD Stage 4 writer exposes Photoshop-compatible layered export primitives',()=>{
  assert.match(adapter,/export function encodePsd\(/);
  assert.match(adapter,/export function encodePsdBlob\(/);
  assert.match(adapter,/export function encodePsb\(/);
  assert.match(adapter,/export function encodePsbBlob\(/);
  assert.match(adapter,/const PSD_BLEND_KEYS/);
  assert.match(adapter,/writeUnicodeLayerName/);
  assert.match(adapter,/encodeRleRgbaChannel/);
  assert.match(adapter,/measureRleRgbaRows/);
  assert.match(adapter,/appendRleRgbaRows/);
  assert.match(adapter,/writeLayerMaskExtra/);
  assert.match(adapter,/const flags = 0x08/);
  assert.match(adapter,/while \(layerInfo\.length % 4\)/);
  assert.match(adapter,/function encodeCompositeRle/);
  assert.doesNotMatch(adapter,/function rgbaPlane/);
  assert.doesNotMatch(adapter,/function compositePlane/);
});


test('PSB Stage 7a import surface accepts .psb and strips either Photoshop extension',()=>{
  assert.match(main,/replace\(\/\\\.ps\[db\]\$\/i,''\)/);
  assert.match(adapter,/\/\\\.ps\[db\]\$\/i/);
});


test('PixelBuffer Stage 7b is the PSD/PSB adapter-to-UI raster boundary',()=>{
  assert.match(adapter,/createRgba8PixelBuffer/);
  assert.match(adapter,/pixelBuffer,/);
  assert.match(main,/pixelBufferToRgba8Preview/);
  assert.match(main,/sourceLayer\.pixelBuffer/);
  assert.match(main,/parsed\.compositePixelBuffer/);
});


test('PSD Group Import Stage 8a maps adapter group keys into ZPE layer groups',()=>{
  assert.match(adapter,/function reconstructPsdGroups\(/);
  assert.match(adapter,/groupKey: record\.groupKey \|\| null/);
  assert.match(adapter,/layers,\s*groups,\s*composite,\s*compositePixelBuffer,\s*iccProfile:/);
  assert.match(main,/const usedGroupKeys=new Set\(parsed\.layers\.map\(layer=>layer\.groupKey\)/);
  assert.match(main,/createLayerGroup\(\{/);
  assert.match(main,/groupId:sourceLayer\.groupKey\?/);
  assert.match(main,/next\.groups=importedGroups/);
});


test('PSD Group Export Stage 8b wires ZPE flat groups into the PSD/PSB writer',()=>{
  assert.match(adapter,/function expandExportLayerGroups\(/);
  assert.match(adapter,/writeSectionDividerExtra\(extra, layer\)/);
  assert.match(adapter,/groups = \[\]/);
  assert.match(main,/const exportGroups=\(exportDoc\.groups\|\|\[\]\)/);
  assert.match(main,/groupKey:layer\.groupId/);
  assert.match(main,/return\{layers:\[\.\.\.prepared\]\.reverse\(\),groups:exportGroups,paths:structuredClone\(exportDoc\.paths\|\|\[\]\),linkedLayerBlocks:/);
  assert.match(main,/layers:prepared\.layers,groups:prepared\.groups,paths:prepared\.paths,linkedLayerBlocks:prepared\.linkedLayerBlocks,composite:prepared\.composite/);
});


test('PSD Group Stage 8c carries native parent relationships through ZPE and writer',()=>{
  assert.match(adapter,/parentKey: group\.parent\?\.key \?\? null/);
  assert.match(adapter,/function exportGroupLineage\(/);
  assert.match(main,/group\.parentGroupId=sourceGroup\.parentKey/);
  assert.match(main,/parentKey:group\.parentGroupId/);
  assert.match(main,/isGroupVisible\(doc, group\)/);
  assert.match(main,/isGroupLocked\(doc, group\)/);
});


test('PSD Group Stage 8e maps opacity and blend mode through ZPE and lsct folder records',()=>{
  assert.match(adapter,/function groupBlendModeFor\(/);
  assert.match(adapter,/opacity: group\.opacity/);
  assert.match(adapter,/blendMode: groupBlendModeFor/);
  assert.match(adapter,/opacity: folder \? group\.opacity : 1/);
  assert.match(main,/opacity:clamp\(Number\(sourceGroup\.opacity\?\?1\),0,1\)/);
  assert.match(main,/blendMode:sourceGroup\.blendMode\|\|'pass-through'/);
  assert.match(main,/opacity:clamp\(Number\(group\.opacity\?\?1\),0,1\)/);
});


test('PSD Color Management Stage 7f surfaces ICC metadata without pretending to color-convert',()=>{
  assert.match(adapter,/function parseImageResources\(/);
  assert.match(adapter,/id === 1039/);
  assert.match(adapter,/id === 1041/);
  assert.match(adapter,/iccProfile: imageResources\.iccProfile/);
  assert.match(main,/ICC profile обнаружен/);
  assert.match(main,/RGB Canvas preview пока не выполняет явное ICC-преобразование/);
});


test('PSD Color Management Stage 7g persists ICC bytes in ZPE and passes them back to writer',()=>{
  assert.match(adapter,/function buildImageResources\(/);
  assert.match(adapter,/writeImageResourceBlock\(resources, 1039/);
  assert.match(main,/bytesToDataUrl\(parsed\.iccProfile\.bytes,'application\/vnd\.iccprofile'\)/);
  assert.match(main,/dataUrlToBytes\(profile\.dataUrl,\{maxBytes:4\*1024\*1024\}\)/);
  assert.match(main,/iccProfile,iccUntagged:Boolean\(profile\?\.untagged\)/);
});

test('PSD Vector/Path Stage 10d-10e wires native masks and saved paths through UI and adapter',()=>{
  assert.match(adapter,/parsePhotoshopPathRecords/);
  assert.match(adapter,/key === 'vmsk' \|\| key === 'vsms'/);
  assert.match(adapter,/writeVectorMaskExtra\(extra, layer, documentWidth, documentHeight\)/);
  assert.match(adapter,/id >= 2000 && id <= 2997/);
  assert.match(adapter,/writeSavedPathResources/);
  assert.match(main,/importedLayer\.vectorMask=importPsdVectorMask\(sourceLayer\.vectorMask,importedLayer\)/);
  assert.match(main,/next\.paths=structuredClone\(parsed\.paths\|\|\[\]\)/);
  assert.match(main,/vectorMask:exportPsdVectorMask\(layer\)/);
  assert.match(main,/paths:prepared\.paths/);
});


test('PSD/PSB Stage 12e routes native 16/32-bit PixelBuffers into Lr16/Lr32 writer structures',()=>{
  assert.match(adapter,/function encodeRawExportChannel\(/);
  assert.match(adapter,/function appendHighDepthLayerInfoBlock\(/);
  assert.match(adapter,/bitsPerChannel === 16 \? 'Lr16' : bitsPerChannel === 32 \? 'Lr32'/);
  assert.match(adapter,/version === PSB_VERSION \? '8B64' : '8BIM'/);
  assert.match(adapter,/out\.u16\(mode===PSD_COLOR_MODE_CMYK\?5:4\)\.u32\(documentHeight\)\.u32\(documentWidth\)\.u16\(depth\)\.u16\(mode\)/);
  assert.match(adapter,/compositePixelBuffer = null, bitsPerChannel = 8/);
  assert.match(main,/function nativeHighDepthPsdSource\(/);
  assert.match(main,/nativePixelBuffer\?nativePsdBounds/);
  assert.match(main,/const bitsPerChannel=nativeDepths\.includes\(32\)\?32:nativeDepths\.includes\(16\)\?16:8/);
  assert.match(main,/if\(nativePixelBuffer\)item\.pixelBuffer=nativePixelBuffer/);
  assert.match(main,/compositePixelBuffer:prepared\.compositePixelBuffer,bitsPerChannel:prepared\.bitsPerChannel,colorMode:prepared\.colorMode/);
});

test('Stage 12e keeps honest fallback semantics for transformed or effect-bearing high-depth layers',()=>{
  assert.match(main,/layerNeedsSemanticRasterWarning\(layer\)/);
  assert.match(main,/downgradedHighDepth/);
  assert.match(main,/экспортированы через 8-bit raster preview/);
});

test('Stage 12g routes compatible multi-layer merged composites through typed PixelBuffers',()=>{
  assert.match(main,/function highDepthCompositePlan\(/);
  assert.match(main,/function buildHighDepthComposite\(/);
  assert.match(main,/compositePixelBufferLayers\(exportDoc\.width,exportDoc\.height,layers/);
  assert.match(main,/createRgba8PixelBuffer\(exported\.width,exported\.height,exported\.pixels/);
  assert.match(main,/MAX_HIGH_DEPTH_COMPOSITE_BYTES/);
  assert.match(main,/merged composite использует 8-bit Canvas fallback/);
  assert.doesNotMatch(main,/function exactHighDepthCompositeCandidate\(/);
});

test('Stage 13a wires CMYK PSD decode, ICC preview transform and bounded source preservation',()=>{
  assert.match(adapter,/const PSD_COLOR_MODE_CMYK = 4/);
  assert.match(adapter,/function composeCmykPixelBuffer\(/);
  assert.match(adapter,/invertCmykPlaneSample/);
  assert.match(main,/createCmykToSrgbTransform/);
  assert.match(main,/cmykPixelBufferToRgba8Preview/);
  assert.match(main,/sourceLayer\.pixelBuffer\.model==='cmyk'/);
  assert.match(main,/sourceLayer\.pixelBuffer\.model==='cmyk'/);
  assert.match(main,/decoded\.model!=='rgb'/);
});


test('Stage 13b wires advanced ICC policy and native CMYK PSD/PSB export',()=>{
  assert.match(main,/sanitizeColorManagement/);
  assert.match(main,/data-cmyk-rendering-intent/);
  assert.match(main,/updateDocumentRenderingIntent/);
  assert.match(main,/createCmykToSrgbTransform\(sourceProfileBytes,\{intent:colorPolicy\.renderingIntent,displaySpace:colorPolicy\.displaySpace,displayProfileBytes/);
  assert.match(main,/function cmykNativeExportEligibility\(/);
  assert.match(main,/function buildNativeCmykComposite\(/);
  assert.match(main,/compositeCmykPixelBufferLayers\(/);
  assert.match(main,/const colorMode=cmykEligibility\.eligible\?'cmyk':'rgb'/);
  assert.match(main,/colorMode:prepared\.colorMode/);
  assert.match(adapter,/colorMode = PSD_COLOR_MODE_RGB/);
  assert.match(adapter,/mode===PSD_COLOR_MODE_CMYK\?5:4/);
  assert.match(adapter,/expectedModel === 'cmyk' \? \[4,5\] : \[3,4\]/);
  assert.match(adapter,/\{ id:3, data:encodeExportChannel/);
  assert.match(adapter,/invert:true,matte:0/);
});

test('Stage 13d wires independent display ICC, proof intent and gamut warning into CMYK preview',()=>{
  assert.match(main,/inspectDisplayIccProfile/);
  assert.match(main,/data-cmyk-display-file/);
  assert.match(main,/data-cmyk-proof-intent/);
  assert.match(main,/data-cmyk-gamut-warning/);
  assert.match(main,/gamutWarningThreshold/);
  assert.match(main,/displayProfileBytes/);
  assert.match(main,/cmykPixelBufferToRgba8Preview\(buffer,transform,\{gamutWarning:policy\.gamutWarningEnabled\}\)/);
});

test('Stage 14a wires Photoshop Smart Object / Placed Layer opaque metadata through import and export',()=>{
  assert.match(adapter,/PSD_SMART_OBJECT_LAYER_KEYS = new Set\(\['PlLd','SoLd','SoLE'\]\)/);
  assert.match(adapter,/PSD_LINKED_LAYER_KEYS = new Set\(\['lnk2','lnkD','lnkE'\]\)/);
  assert.match(adapter,/appendSmartObjectLayerBlock/);
  assert.match(adapter,/psdSmartObject: record\.psdSmartObject/);
  assert.match(adapter,/linkedLayerBlocks/);
  assert.match(adapter,/writeSmartObjectLayerExtras\(extra, layer, version\)/);
  assert.match(adapter,/writeLinkedLayerBlocks\(layerAndMask,linkedLayerBlocks,version\)/);
  assert.match(main,/importPsdSmartObjectMetadata/);
  assert.match(main,/createSmartObjectLayer\(\{/);
  assert.match(main,/psdSmartObjectRoundTripPlan/);
  assert.match(main,/psdSmartObject:psdSmartPlan\.eligible/);
  assert.match(main,/next\.psdLinkedLayerBlocks=/);
  assert.match(main,/next\.psdSmartObjectSourceCount=/);
  assert.match(main,/linkedLayerBlocks:prepared\.linkedLayerBlocks/);
  assert.match(main,/Photoshop Smart Object native passthrough отключён/);
});

