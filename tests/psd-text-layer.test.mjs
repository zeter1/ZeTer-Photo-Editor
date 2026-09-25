import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDocument, createTextLayer, sanitizeProject } from '../src/core/state.js';
import { bytesToDataUrl } from '../src/core/io.js';
import { decodePsd, encodePsd, encodePsb, rewriteTypeToolText } from '../src/formats/psd.js';

const root=new URL('./fixtures/photoshop-text/',import.meta.url);
async function bytes(name){return new Uint8Array(await readFile(new URL(name,root)));}
async function json(name){return JSON.parse(await readFile(new URL(name,root),'utf8'));}
function sha256(value){return createHash('sha256').update(value).digest('hex');}

test('Stage 15a pins a real external Photoshop TySh fixture',async()=>{
  const [manifest,fixture]=await Promise.all([json('manifest.json'),bytes('psd-tools-type-layer.psd')]);
  assert.equal(fixture.byteLength,manifest.fixture.size);
  assert.equal(sha256(fixture),manifest.fixture.sha256);
  assert.equal(manifest.fixture.sourceGitBlob,'d920df70baf977c2fc04d5e47147ef831d5c53e6');
  assert.match(manifest.fixture.sourceCommit,/^[0-9a-f]{40}$/);
});

test('Stage 15a decodes Photoshop TypeToolObjectSetting into typed text semantics',async()=>{
  const fixture=await bytes('psd-tools-type-layer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:2_000_000,maxLayers:50});
  assert.deepEqual(decoded.warnings,[]);
  assert.equal(decoded.layers.length,1);
  const layer=decoded.layers[0];
  assert.equal(layer.name,'A');
  assert.equal(layer.x,5);assert.equal(layer.y,5);assert.equal(layer.width,22);assert.equal(layer.height,23);
  assert.ok(layer.psdText);
  assert.equal(layer.psdText.key,'TySh');
  assert.equal(layer.psdText.parsed.version,1);
  assert.equal(layer.psdText.parsed.textVersion,50);
  assert.equal(layer.psdText.parsed.warpVersion,1);
  assert.equal(layer.psdText.parsed.text,'A');
  assert.equal(layer.psdText.parsed.orientation,'Hrzn');
  assert.equal(layer.psdText.parsed.antiAlias,'AnSt');
  assert.equal(layer.psdText.parsed.descriptorClass,'TxLr');
  assert.ok(layer.psdText.parsed.descriptorKeys.includes('EngineData'));
  assert.deepEqual(layer.psdText.parsed.transform,[1.0000000000000002,0,0,1,0,4.978787878787878]);
  assert.deepEqual(layer.psdText.parsed.typography,{
    engineText:'A',
    fontName:'ArialMT',
    fontFamily:'Arial, sans-serif',
    fontSize:30,
    fontWeight:'400',
    fontStyle:'normal',
    color:'#ff0000',
    align:'center',
    lineHeight:1.75,
    tracking:15,
    letterSpacing:.45,
    underline:false,
    strikeThrough:false,
    justification:2,
    styleRunLengths:[2],
    paragraphRunLengths:[2],
    editableSingleStyle:true,
    fontCount:4,
  });
});

test('Stage 15a preserves TySh through PSD/PSB and rewrites affine translation without touching the text descriptor',async()=>{
  const fixture=await bytes('psd-tools-type-layer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:2_000_000,maxLayers:50});
  const layer=decoded.layers[0];
  const rewritten=rewriteTypeToolText(layer.psdText.data,layer.psdText.parsed.text,{deltaX:7,deltaY:-3});
  const options={
    width:decoded.width,height:decoded.height,bitsPerChannel:8,colorMode:3,
    layers:[{
      name:layer.name,x:layer.x+7,y:layer.y-3,width:layer.width,height:layer.height,
      pixelBuffer:layer.pixelBuffer,opacity:layer.opacity,blendMode:layer.blendMode,visible:layer.visible,
      psdText:{signature:layer.psdText.signature,key:'TySh',data:rewritten.data},
    }],
    composite:new Uint8ClampedArray(decoded.width*decoded.height*4),
    iccProfile:decoded.iccProfile?.bytes||null,
  };
  for(const [label,encoded] of [['PSD',encodePsd(options)],['PSB',encodePsb(options)]]){
    const roundTrip=await decodePsd(encoded,{maxPixels:2_000_000,maxLayers:50});
    const text=roundTrip.layers[0].psdText?.parsed;
    assert.ok(text,label+' TySh');
    assert.equal(text.text,'A',label+' text');
    assert.equal(text.transform[4],7,label+' tx');
    assert.ok(Math.abs(text.transform[5]-1.9787878787878777)<1e-12,label+' ty');
    assert.equal(text.orientation,'Hrzn',label+' orientation');
  }
});

test('Stage 15a project sanitizer persists only bounded allow-listed TySh metadata',async()=>{
  const fixture=await bytes('psd-tools-type-layer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:2_000_000,maxLayers:50});
  const source=decoded.layers[0];
  const text=createTextLayer({
    name:'A',text:'A',x:5,y:5,width:22,height:23,fontFamily:'Arial, sans-serif',fontSize:18,color:'#000000',
    psdText:{
      signature:'8BIM',key:'TySh',dataUrl:bytesToDataUrl(source.psdText.data,'application/octet-stream'),
      parsed:source.psdText.parsed,
      baseline:{x:5,y:5,width:22,height:23,scaleX:1,scaleY:1,rotation:0,text:'A',fontFamily:'Arial, sans-serif',fontSize:18,fontWeight:'400',fontStyle:'normal',align:'left',lineHeight:1.18,letterSpacing:0,underline:false,strikeThrough:false,color:'#000000'},
    },
  });
  const doc=createDocument({width:32,height:32});doc.layers=[text];doc.selectedLayerId=text.id;
  const safe=sanitizeProject(doc);
  assert.equal(safe.layers[0].psdText.key,'TySh');
  assert.equal(safe.layers[0].psdText.parsed.text,'A');
  assert.equal(safe.layers[0].psdText.baseline.fontSize,18);
  assert.equal(safe.layers[0].psdText.parsed.typography.fontName,'ArialMT');
  assert.deepEqual(safe.layers[0].psdText.parsed.typography.styleRunLengths,[2]);
  assert.equal(safe.layers[0].psdText.parsed.typography.editableSingleStyle,true);
  safe.layers[0].psdText.key='NOPE';
  assert.equal(sanitizeProject(safe).layers[0].psdText,null);
});

test('Stage 15b rewrites Txt + EngineData Editor.Text and compatible run lengths for editable single-style text',async()=>{
  const fixture=await bytes('psd-tools-type-layer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:2_000_000,maxLayers:50});
  const layer=decoded.layers[0];
  const rewritten=rewriteTypeToolText(layer.psdText.data,'Hello\nWorld',{deltaX:7,deltaY:-3});
  assert.equal(rewritten.engineUpdated,true);
  assert.equal(rewritten.runLength,12);

  const options={
    width:decoded.width,height:decoded.height,bitsPerChannel:8,colorMode:3,
    layers:[{
      name:layer.name,x:layer.x+7,y:layer.y-3,width:layer.width,height:layer.height,
      pixelBuffer:layer.pixelBuffer,opacity:layer.opacity,blendMode:layer.blendMode,visible:layer.visible,
      psdText:{signature:layer.psdText.signature,key:'TySh',data:rewritten.data},
    }],
    composite:new Uint8ClampedArray(decoded.width*decoded.height*4),
    iccProfile:decoded.iccProfile?.bytes||null,
  };

  for(const [label,encoded] of [['PSD',encodePsd(options)],['PSB',encodePsb(options)]]){
    const roundTrip=await decodePsd(encoded,{maxPixels:2_000_000,maxLayers:50});
    assert.deepEqual(roundTrip.warnings,[],label+' warnings');
    const text=roundTrip.layers[0].psdText?.parsed;
    assert.ok(text,label+' TySh');
    assert.equal(text.text,'Hello\nWorld',label+' descriptor text');
    assert.equal(text.typography.engineText,'Hello\nWorld',label+' EngineData text');
    assert.deepEqual(text.typography.styleRunLengths,[12],label+' style run length');
    assert.deepEqual(text.typography.paragraphRunLengths,[12],label+' paragraph run length');
    assert.equal(text.typography.fontName,'ArialMT',label+' font');
    assert.equal(text.typography.fontSize,30,label+' font size');
    assert.equal(text.typography.color,'#ff0000',label+' color');
    assert.equal(text.typography.align,'center',label+' paragraph alignment');
    assert.equal(text.transform[4],7,label+' tx');
    assert.ok(Math.abs(text.transform[5]-1.9787878787878777)<1e-12,label+' ty');
  }
});

