import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDocument, createShapeLayer, sanitizeProject } from '../src/core/state.js';
import { bytesToDataUrl } from '../src/core/io.js';
import { decodePsd, encodePsd, encodePsb } from '../src/adapters/psd.js';

const root=new URL('./fixtures/photoshop-shapes/',import.meta.url);
async function bytes(name){return new Uint8Array(await readFile(new URL(name,root)));}
async function json(name){return JSON.parse(await readFile(new URL(name,root),'utf8'));}
function sha256(value){return createHash('sha256').update(value).digest('hex');}

test('Stage 15c pins a real external Photoshop shape fixture',async()=>{
  const [manifest,fixture]=await Promise.all([json('manifest.json'),bytes('psd-tools-shape-layer.psd')]);
  assert.equal(fixture.byteLength,manifest.fixture.size);
  assert.equal(sha256(fixture),manifest.fixture.sha256);
  assert.equal(manifest.fixture.sourceGitBlob,'5d5b2023d85ddfbad624f30e6406e78788795fca');
  assert.match(manifest.fixture.sourceCommit,/^[0-9a-f]{40}$/);
});

test('Stage 15c decodes solid fill, vector mask and stroke semantics from a real Photoshop Shape Layer',async()=>{
  const fixture=await bytes('psd-tools-shape-layer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:2_000_000,maxLayers:50});
  assert.deepEqual(decoded.warnings,[]);
  assert.equal(decoded.layers.length,1);
  const layer=decoded.layers[0];
  assert.equal(layer.name,'Polygon 1');
  assert.deepEqual([layer.x,layer.y,layer.width,layer.height],[-1,-1,32,32]);
  assert.ok(layer.psdShape);
  assert.equal(layer.psdShape.fillType,'solid');
  assert.equal(layer.psdShape.fill,'#00ffff');
  assert.equal(layer.psdShape.fillEnabled,true);
  assert.equal(layer.psdShape.stroke,'#ff00ff');
  assert.equal(layer.psdShape.strokeEnabled,true);
  assert.equal(layer.psdShape.strokeWidth,1);
  assert.equal(layer.psdShape.sourceContentKey,'vscg');
  assert.deepEqual(layer.psdShape.blocks.map(block=>block.key),['vscg','vstk']);
  assert.equal(layer.psdShape.strokeStyle.opacity,100);
  assert.equal(layer.psdShape.strokeStyle.lineCap,'strokeStyleButtCap');
  assert.equal(layer.psdShape.strokeStyle.lineJoin,'strokeStyleMiterJoin');
  assert.equal(layer.psdShape.strokeStyle.lineAlignment,'strokeStyleAlignInside');
  assert.ok(layer.vectorMask);
  assert.equal(layer.vectorMask.subpaths.length,1);
  assert.equal(layer.vectorMask.subpaths[0].closed,true);
  assert.equal(layer.vectorMask.subpaths[0].operation,'add');
  assert.equal(layer.vectorMask.subpaths[0].points.length,5);
});

test('Stage 15c preserves fill/stroke descriptors while rewriting vector path geometry in PSD and PSB',async()=>{
  const fixture=await bytes('psd-tools-shape-layer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:2_000_000,maxLayers:50});
  const layer=decoded.layers[0];
  const movedMask=structuredClone(layer.vectorMask);
  movedMask.subpaths[0].points[0].x+=2;
  const options={
    width:decoded.width,height:decoded.height,bitsPerChannel:8,colorMode:3,
    layers:[{
      name:layer.name,x:layer.x,y:layer.y,width:layer.width,height:layer.height,
      pixelBuffer:layer.pixelBuffer,opacity:layer.opacity,blendMode:layer.blendMode,visible:layer.visible,
      vectorMask:movedMask,psdShape:layer.psdShape,
    }],
    composite:new Uint8ClampedArray(decoded.width*decoded.height*4),
    iccProfile:decoded.iccProfile?.bytes||null,
  };
  for(const [label,encoded] of [['PSD',encodePsd(options)],['PSB',encodePsb(options)]]){
    const roundTrip=await decodePsd(encoded,{maxPixels:2_000_000,maxLayers:50});
    assert.deepEqual(roundTrip.warnings,[],label+' warnings');
    const shape=roundTrip.layers[0].psdShape;
    assert.equal(shape.fill,'#00ffff',label+' fill');
    assert.equal(shape.stroke,'#ff00ff',label+' stroke');
    assert.equal(shape.strokeWidth,1,label+' stroke width');
    assert.deepEqual(shape.blocks.map(block=>block.data),layer.psdShape.blocks.map(block=>block.data),label+' descriptor bytes');
    const actual=roundTrip.layers[0].vectorMask.subpaths[0].points[0].x;
    const expected=movedMask.subpaths[0].points[0].x;
    assert.ok(Math.abs(actual-expected)<1e-5,label+' moved vector anchor');
  }
});

test('Stage 15c project sanitizer persists bounded allow-listed Photoshop shape metadata',async()=>{
  const fixture=await bytes('psd-tools-shape-layer.psd');
  const decoded=await decodePsd(fixture,{maxPixels:2_000_000,maxLayers:50});
  const source=decoded.layers[0];
  const shape=createShapeLayer({
    name:'Polygon 1',shape:'path',fill:'#00ffff',stroke:'#ff00ff',strokeWidth:1,
    x:-1,y:-1,width:32,height:32,pathClosed:true,pathPoints:[
      {x:27.79827117919922,y:27.805936813354492,handleIn:null,handleOut:null,kind:'corner'},
      {x:10.06949234008789,y:30.61389923095703,handleIn:null,handleOut:null,kind:'corner'},
      {x:1.9204673767089844,y:14.620536804199219,handleIn:null,handleOut:null,kind:'corner'},
    ],
    psdShape:{
      fillType:'solid',fill:'#00ffff',fillEnabled:true,stroke:'#ff00ff',strokeEnabled:true,strokeWidth:1,
      sourceContentKey:'vscg',strokeStyle:{opacity:100,lineCap:'strokeStyleButtCap',lineJoin:'strokeStyleMiterJoin',lineAlignment:'strokeStyleAlignInside'},
      baseline:{fill:'#00ffff',stroke:'#ff00ff',strokeWidth:1,pathClosed:true,width:32,height:32,scaleX:1,scaleY:1,rotation:0},
      blocks:[
        ...source.psdShape.blocks.map(block=>({signature:block.signature,key:block.key,dataUrl:bytesToDataUrl(block.data,'application/octet-stream')})),
        {signature:'8BIM',key:'NOPE',dataUrl:'data:application/octet-stream;base64,AA=='},
      ],
    },
  });
  const doc=createDocument({width:32,height:32});doc.layers=[shape];doc.selectedLayerId=shape.id;
  const safe=sanitizeProject(doc);
  assert.equal(safe.layers[0].psdShape.fillType,'solid');
  assert.deepEqual(safe.layers[0].psdShape.blocks.map(block=>block.key),['vscg','vstk']);
  assert.equal(safe.layers[0].psdShape.baseline.width,32);
  assert.equal(safe.layers[0].psdShape.strokeStyle.lineAlignment,'strokeStyleAlignInside');
});
