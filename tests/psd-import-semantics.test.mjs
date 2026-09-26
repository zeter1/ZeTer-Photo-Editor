import test from 'node:test';
import assert from 'node:assert/strict';
import { createPsdImportSemantics } from '../src/document/psd-import-semantics.js';
import { psdPreviewFingerprint, psdEmbeddedDocumentFingerprint } from '../src/document/psd-native-metadata-plans.js';

function block(key='TySh') {
  return { signature:'8BIM', key, data:new Uint8Array([1,2,3]) };
}

function makeSemantics(overrides={}) {
  return createPsdImportSemantics({
    importVectorMask:()=>null,
    opaqueBlockToState:value=>value?.key?{key:value.key}:null,
    previewFingerprint:psdPreviewFingerprint,
    embeddedDocumentFingerprint:psdEmbeddedDocumentFingerprint,
    ...overrides,
  });
}

test('solid-shape import eligibility stays limited to one closed additive solid path', () => {
  const semantics=makeSemantics();
  const supported={
    psdShape:{fillType:'solid',fill:'#123456'},
    vectorMask:{subpaths:[{closed:true,operation:'add',points:[{x:0,y:0},{x:1,y:1}]}]},
  };
  assert.equal(semantics.canMapPsdSolidShape(supported),true);
  assert.equal(semantics.canMapPsdSolidShape({...supported,psdShape:{fillType:'gradient',fill:'#123456'}}),false);
  assert.equal(semantics.canMapPsdSolidShape({
    ...supported,
    vectorMask:{subpaths:[supported.vectorMask.subpaths[0],supported.vectorMask.subpaths[0]]},
  }),false);
  assert.equal(semantics.canMapPsdSolidShape({
    ...supported,
    vectorMask:{subpaths:[{...supported.vectorMask.subpaths[0],operation:'subtract'}]},
  }),false);
});

test('shape, text and adjustment metadata snapshot import baselines without sharing mutable source state', () => {
  const semantics=makeSemantics();
  const shape=semantics.importPsdShapeMetadata({
    fillType:'solid',fill:'#112233',fillEnabled:true,stroke:'#445566',strokeEnabled:true,strokeWidth:3,
    sourceContentKey:'SoCo',strokeStyle:{opacity:.75,lineCap:'round',lineJoin:'bevel',lineAlignment:'inside'},
    blocks:[block('SoCo')],
  },{
    fill:'#112233',stroke:'#445566',strokeWidth:3,pathClosed:true,width:80,height:40,scaleX:1.5,scaleY:.75,rotation:12,
  });
  assert.deepEqual(shape.blocks,[{key:'SoCo'}]);
  assert.equal(shape.baseline.rotation,12);
  assert.equal(shape.sourceContentKey,'SoCo');

  const parsed={text:'Hello',style:{font:'Inter'}};
  const text=semantics.importPsdTextMetadata(
    {signature:'8B64',data:new Uint8Array([4,5,6]),parsed},
    {x:9,y:10,width:120,height:40},
    {scaleX:1.2,scaleY:.9,rotation:5,text:'Hello',fontFamily:'Inter',fontSize:32,fontWeight:'700',fontStyle:'italic',align:'center',lineHeight:1.4,letterSpacing:2,underline:true,strikeThrough:false,color:'#abcdef'},
  );
  parsed.style.font='Mutated';
  assert.equal(text.signature,'8B64');
  assert.equal(text.parsed.style.font,'Inter');
  assert.equal(text.baseline.fontSize,32);
  assert.equal(text.baseline.align,'center');

  const adjustment={kind:'brightness-contrast',brightness:999,contrast:-999,legacy:true};
  const metadata=semantics.importPsdAdjustmentMetadata({
    blocks:[block('brit')],
    channelIds:Array.from({length:20},(_,index)=>index),
  },adjustment);
  adjustment.brightness=0;
  assert.deepEqual(metadata.blocks,[{key:'brit'}]);
  assert.equal(metadata.baseline.brightness,150);
  assert.equal(metadata.baseline.contrast,-100);
  assert.equal(metadata.channelIds.length,16);
});

test('Smart Object metadata keeps bounded asset identity and stable baseline fingerprints', () => {
  const semantics=makeSemantics();
  const descriptor={name:'Placed'};
  const embedded={width:30,height:20,layers:[],groups:[],paths:[]};
  const source={
    kind:'embedded',uniqueId:'uuid-1',placedVersion:3,
    placedTransform:[0,0,30,0,30,20,0,20,999],
    descriptor,
    asset:{sourceKey:'liFD',kind:'data',uuid:'uuid-1',filename:'inside.psd',filetype:'8BPS',detectedFileType:'psd',dataSize:123,fileSize:456},
    blocks:[block('SoLd')],
  };
  const metadata=semantics.importPsdSmartObjectMetadata(source,{x:4,y:5,width:30,height:20},'data:image/png;base64,AAAA',embedded);
  descriptor.name='Changed';
  assert.equal(metadata.kind,'embedded');
  assert.equal(metadata.asset.filename,'inside.psd');
  assert.equal(metadata.placedTransform.length,8);
  assert.equal(metadata.descriptor.name,'Placed');
  assert.equal(metadata.baseline.embeddedWidth,30);
  assert.equal(metadata.baseline.embeddedHeight,20);
  assert.equal(typeof metadata.baseline.previewFingerprint,'string');
  assert.equal(typeof metadata.baseline.embeddedFingerprint,'string');
  assert.deepEqual(metadata.blocks,[{key:'SoLd'}]);
});

test('embedded raster assets become editable one-layer documents and preserve failure fallback warnings', async () => {
  let dimensionsCalls=0;
  const semantics=makeSemantics({
    dimensionsFromDataUrl:async dataUrl=>{
      dimensionsCalls+=1;
      assert.match(dataUrl,/^data:image\/png;base64,/);
      return {width:7,height:5};
    },
  });
  const warnings=[];
  const embedded=await semantics.importPsdEmbeddedAssetDocument({
    asset:{kind:'data',data:new Uint8Array([137,80,78,71]),detectedFileType:'png',filename:'asset.png'},
  },'Smart',warnings);
  assert.equal(dimensionsCalls,1);
  assert.equal(embedded.width,7);
  assert.equal(embedded.height,5);
  assert.equal(embedded.layers.length,1);
  assert.equal(embedded.layers[0].name,'asset.png');
  assert.equal(warnings.length,0);

  const broken=makeSemantics({
    dimensionsFromDataUrl:async()=>{throw new Error('decode failed');},
  });
  const failureWarnings=[];
  const fallback=await broken.importPsdEmbeddedAssetDocument({
    asset:{kind:'data',data:new Uint8Array([1]),detectedFileType:'png',filename:'broken.png'},
  },'Broken',failureWarnings);
  assert.equal(fallback,null);
  assert.equal(failureWarnings.length,1);
  assert.match(failureWarnings[0],/opaque round-trip сохранён/);
});

test('nested PSD embedded assets preserve group mapping and use bounded codec options', async () => {
  const decodeCalls=[];
  const semantics=makeSemantics({
    decodePsd:async(data,options)=>{
      decodeCalls.push({data,options});
      return {
        width:2,height:1,colorMode:3,iccProfile:null,iccUntagged:false,
        groups:[{key:'g1',parentKey:null,name:'Nested',visible:true,collapsed:false,opacity:.5,blendMode:'pass-through'}],
        layers:[{
          name:'Pixels',visible:true,opacity:.8,blendMode:'source-over',
          x:0,y:0,width:2,height:1,groupKey:'g1',
          pixels:new Uint8Array([255,0,0,255,0,255,0,255]),
          mask:null,vectorMask:null,psdSmartObject:null,
        }],
        composite:null,compositePixelBuffer:null,
      };
    },
    rgbaPixelsToDataUrl:async(width,height,pixels,label)=>{
      assert.equal(width,2);assert.equal(height,1);assert.equal(pixels.length,8);
      assert.equal(label,'Embedded PSD layer');
      return 'data:image/png;base64,AAAA';
    },
  });
  const bytes=new Uint8Array([8,66,80,83]);
  const warnings=[];
  const embedded=await semantics.importPsdEmbeddedAssetDocument({
    asset:{kind:'data',data:bytes,detectedFileType:'psd',filename:'nested.psd'},
  },'Nested Smart Object',warnings);
  assert.equal(decodeCalls.length,1);
  assert.equal(decodeCalls[0].data,bytes);
  assert.deepEqual(decodeCalls[0].options,{maxPixels:12_000_000,maxLayers:200});
  assert.equal(embedded.name,'nested');
  assert.equal(embedded.groups.length,1);
  assert.equal(embedded.groups[0].opacity,.5);
  assert.equal(embedded.layers.length,1);
  assert.equal(embedded.layers[0].groupId,embedded.groups[0].id);
  assert.equal(warnings.length,0);
});
