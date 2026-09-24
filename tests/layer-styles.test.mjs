import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createRasterLayer, addLayer, snapshotDocument, restoreDocument, sanitizeProject } from '../src/core/state.js';
import { LAYER_STYLE_FIELDS, createLayerStyles, sanitizeLayerStyles, hasLayerStyles, layerStyleOutset, renderLayerStyles } from '../src/core/layer-styles.js';

test('nine layer styles have independent defaults and round-trip through project data', () => {
  assert.equal(Object.keys(LAYER_STYLE_FIELDS).length,9);
  const styles=createLayerStyles();
  assert.equal(hasLayerStyles(styles),false);
  styles.dropShadow.enabled=true;
  styles.dropShadow.blur=22;
  styles.gradientOverlay.enabled=true;
  styles.fillOpacity=35;
  assert.equal(hasLayerStyles(styles),true);
  assert.ok(layerStyleOutset(styles)>=styles.dropShadow.blur*2+styles.dropShadow.distance);
  const doc=createDocument({width:100,height:80});
  addLayer(doc,createRasterLayer({width:100,height:80,styles}));
  const reopened=sanitizeProject(JSON.parse(snapshotDocument(doc)));
  assert.equal(reopened.layers[0].styles.dropShadow.blur,22);
  assert.equal(reopened.layers[0].styles.gradientOverlay.enabled,true);
  assert.equal(reopened.layers[0].styles.fillOpacity,35);
  assert.equal(restoreDocument(snapshotDocument(reopened)).layers[0].styles.fillOpacity,35);
});

test('imported style values are bounded and unknown fields do not survive', () => {
  const safe=sanitizeLayerStyles({
    fillOpacity:-50,
    stroke:{enabled:true,size:500,color:'url(javascript:alert(1))',opacity:200,extra:'ignored'},
    dropShadow:{enabled:true,distance:10000,blur:999,angle:-1000,color:'#123abc'},
    patternOverlay:{enabled:true,pattern:'remote-url',scale:1000},
    unknownStyle:{enabled:true},
  });
  assert.equal(safe.fillOpacity,0);
  assert.equal(safe.stroke.size,24);
  assert.equal(safe.stroke.opacity,100);
  assert.equal(safe.stroke.color,'#4f8cff');
  assert.equal(safe.dropShadow.distance,80);
  assert.equal(safe.dropShadow.blur,40);
  assert.equal(safe.dropShadow.angle,0);
  assert.equal(safe.dropShadow.color,'#123abc');
  assert.equal(safe.patternOverlay.pattern,'stripes');
  assert.equal(safe.patternOverlay.scale,48);
  assert.equal('unknownStyle' in safe,false);
  assert.equal('extra' in safe.stroke,false);
  assert.equal(sanitizeLayerStyles(null),null);
  assert.equal(layerStyleOutset(null),0);
});

test('all enabled styles render in one bounded temporary group', async () => {
  const allocations=[];
  const context=()=>({
    scale(){},translate(){},setTransform(){},clearRect(){},drawImage(){},fillRect(){},
    beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},closePath(){},
    createLinearGradient(){return {addColorStop(){}};},createPattern(){return {};},
  });
  const priorDocument=globalThis.document;
  globalThis.document={createElement:tag=>{
    assert.equal(tag,'canvas');
    const item={width:0,height:0,getContext:context};
    allocations.push(item);
    return item;
  }};
  try {
    const styles=createLayerStyles();
    for(const key of Object.keys(LAYER_STYLE_FIELDS))styles[key].enabled=true;
    let paints=0;
    const result=await renderLayerStyles(styles,12000,4000,async()=>{paints++;});
    assert.equal(paints,1);
    assert.ok(Number.isFinite(result.x) && Number.isFinite(result.width));
    assert.ok(allocations.length>=4);
    assert.ok(allocations.every(item=>item.width*item.height<=16_100_000));
  } finally {
    globalThis.document=priorDocument;
  }
});