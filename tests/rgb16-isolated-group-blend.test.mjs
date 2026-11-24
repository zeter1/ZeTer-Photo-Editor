import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelBuffer, serializePixelBufferSource, compositePixelBufferLayers } from '../src/core/pixel-buffer.js';
import { createPsdExportController } from '../src/document/psd-export-controller.js';
import { encodePsd, encodePsb, decodePsd } from '../src/formats/psd.js';

const layer=(id,values,groupId=null,blendMode='source-over')=>({
  id,name:id,type:'raster',visible:true,groupId,clipping:false,x:0,y:0,width:1,height:1,scaleX:1,scaleY:1,rotation:0,opacity:1,blendMode,filters:{},styles:null,
  highDepthSource:serializePixelBufferSource(createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:Uint16Array.from(values)}))
});
const make=()=>({width:1,height:1,background:'transparent',paths:[],
  groups:[{id:'g',name:'g',blendMode:'source-over',visible:true,opacity:.5}],
  layers:[layer('outer',[20000,20000,20000,65535]),layer('inner',[15000,30000,45000,65535],'g'),layer('light',[60000,10000,10000,65535],'g','luminosity')]
});
const controller=()=>createPsdExportController({vectors:{exportPsdVectorMask:()=>null},rendering:{createCanvas(){throw Error('unexpected Canvas fallback');},renderLayer(){throw Error('unexpected rasterization');},renderDocument(){throw Error('unexpected display composite');}}});
test('isolated normal RGB16 group blends internally, then applies group opacity once',async()=>{
  const doc=make(), before=JSON.stringify(doc);
  const out=await controller().prepareDocument(doc);
  // Internal luminosity [12850,27850,42850]; 50% source-over onto [20000,20000,20000].
  assert.deepEqual([...out.compositePixelBuffer.data],[16425,23925,31425,65535]);
  assert.equal(out.composite,null);assert.equal(out.bitsPerChannel,16);
  assert.equal(out.groups.length,1);assert.equal(out.groups[0].opacity,.5);
  for(const encode of [encodePsd,encodePsb]){
    const data=encode({width:1,height:1,bitsPerChannel:16,colorMode:3,layers:out.layers,groups:out.groups,compositePixelBuffer:out.compositePixelBuffer});
    const bytes=new Uint8Array(data), raw=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-10,10);
    assert.deepEqual([0,2,4,6,8].map(i=>raw.getUint16(i,false)),[0,16425,23925,31425,65535]);
    const parsed=await decodePsd(data,{maxPixels:16,maxLayers:16});
    assert.equal(parsed.bitsPerChannel,16);
    const edited=parsed.layers.find(l=>l.name==='light');
    assert.equal(edited.blendMode,'luminosity');assert.deepEqual([...edited.pixelBuffer.data.slice(0,3)],[60000,10000,10000]);
  }
  assert.equal(JSON.stringify(doc),before);
});
test('isolated group opacity zero and hidden group exclude children',async()=>{
  for(const change of [d=>d.groups[0].opacity=0,d=>d.groups[0].visible=false]){
    const doc=make();change(doc);const out=await controller().prepareDocument(doc);
    assert.deepEqual([...out.compositePixelBuffer.data],[20000,20000,20000,65535]);
  }
});
test('unsupported RGB16 group topology fails closed',async()=>{
  for(const change of [d=>d.groups[0].blendMode='pass-through',d=>d.groups[0].parentGroupId='g',d=>d.layers.push(layer('other',[1,2,3,65535],'unknown')),d=>d.layers.splice(2,0,layer('interleaved',[1,2,3,65535])),d=>d.layers[1].clipping=true]){
    const doc=make();change(doc);const before=JSON.stringify(doc);
    await assert.rejects(controller().prepareDocument(doc),/native high-depth/);
    assert.equal(JSON.stringify(doc),before);
  }
});

test('isolated RGB16 group applies the prepared raster mask once and preserves its metadata',async()=>{
  // Mask renderer is a white single-pixel canvas; invert makes its alpha zero.
  const maskController=createPsdExportController({vectors:{exportPsdVectorMask:()=>null},rendering:{
    createCanvas(){return {getContext(){return {fillRect(){},getImageData(){return {data:Uint8ClampedArray.of(255,255,255,255)};}};}};},
    renderLayer(){throw Error('unexpected rasterization');},renderDocument(){throw Error('unexpected display composite');}
  }});
  for(const [enabled,density,expected,maskAlpha] of [[true,1,[20000,20000,20000,65535],0],[false,1,[16425,23925,31425,65535],0],[true,.5,[18205,21970,25735,65535],128]]){
    const doc=make();doc.groups[0].mask={enabled,invert:true,density};
    const before=JSON.stringify(doc);
    const out=await maskController.prepareDocument(doc);
    assert.deepEqual([...out.compositePixelBuffer.data],expected);
    assert.equal(out.groups[0].mask.disabled,!enabled);
    assert.equal(out.groups[0].mask.pixels[3],maskAlpha);
    assert.equal(JSON.stringify(doc),before);
  }
});
test('isolated RGB16 group remains behind the following root raster',async()=>{
  const doc=make();doc.layers.push(layer('above',[12345,23456,34567,65535]));
  const out=await controller().prepareDocument(doc);
  assert.deepEqual([...out.compositePixelBuffer.data],[12345,23456,34567,65535]);
});

test('RGB16 isolated group modes blend the finished group against the parent, not each child',async()=>{
  const cases=[
    ['color',[26950,11950,26950,65535]],
    ['hue',[20500,15500,25500,65535]],
    ['saturation',[5950,20950,35950,65535]],
    ['luminosity',[13050,23050,33050,65535]],
  ];
  for(const [mode,expected] of cases){
    const doc=make();
    doc.groups[0].blendMode=mode;
    doc.layers=[layer('outer',[10000,20000,30000,65535]),layer('inner',[1000,2000,3000,65535],'g'),layer('top',[50000,10000,30000,65535],'g')];
    const before=JSON.stringify(doc);
    const out=await controller().prepareDocument(doc);
    assert.equal(out.composite,null,mode);
    assert.deepEqual([...out.compositePixelBuffer.data],expected,mode);
    assert.equal(out.groups[0].blendMode,mode);
    for(const encode of [encodePsd,encodePsb]){
      const bytes=new Uint8Array(encode({width:1,height:1,bitsPerChannel:16,colorMode:3,layers:out.layers,groups:out.groups,compositePixelBuffer:out.compositePixelBuffer}));
      const raw=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-10,10);
      assert.deepEqual([0,2,4,6,8].map(i=>raw.getUint16(i,false)),[0,...expected],mode);
      const parsed=await decodePsd(bytes,{maxPixels:16,maxLayers:16});
      assert.equal(parsed.bitsPerChannel,16);
      assert.equal(parsed.groups[0].blendMode,mode);
      assert.equal(parsed.layers.find(l=>l.name==='top').groupKey,parsed.groups[0].key);
      assert.deepEqual([...parsed.layers.find(l=>l.name==='top').pixelBuffer.data],[50000,10000,30000,65535]);
    }
    assert.equal(JSON.stringify(doc),before);
  }
});
test('non-separable group opacity and prepared mask multiply coverage exactly once',async()=>{
  const maskController=createPsdExportController({vectors:{exportPsdVectorMask:()=>null},rendering:{
    createCanvas(){return {getContext(){return {fillRect(){},getImageData(){return {data:Uint8ClampedArray.of(255,255,255,255)};}};}};},
    renderLayer(){throw Error('unexpected rasterization');},renderDocument(){throw Error('unexpected display composite');}
  }});
  for(const [enabled,density,expected] of [[true,1,[10000,20000,30000,65535]],[false,1,[13050,23050,33050,65535]],[true,.5,[11531,21531,31531,65535]]]){
    const doc=make();
    doc.groups[0].blendMode='luminosity';doc.groups[0].mask={enabled,invert:true,density};
    doc.layers=[layer('outer',[10000,20000,30000,65535]),layer('top',[50000,10000,30000,65535],'g')];
    const before=JSON.stringify(doc);
    const out=await maskController.prepareDocument(doc);
    assert.deepEqual([...out.compositePixelBuffer.data],expected);
    assert.equal(JSON.stringify(doc),before);
  }
});
test('isolated group with partial source alpha and transparent parent preserves native straight alpha',async()=>{
  const doc=make();doc.groups[0].blendMode='hue';
  doc.layers=[layer('top',[50000,10000,30000,32768],'g')];
  const out=await controller().prepareDocument(doc);
  assert.deepEqual([...out.compositePixelBuffer.data],[50000,10000,30000,16384]);
});
test('isolated RGB16 Multiply and Screen use the finished folder as source, with exact PSD/PSB words',async()=>{
  for(const mode of ['multiply','screen']){
    for(const backdropAlpha of [0,32768,65535]){
      const doc=make();
      doc.groups[0].blendMode=mode;
      const b=[10001,20003,30007,backdropAlpha], f=[50009,10011,30013,40015];
      doc.layers=[layer('outer',b),layer('top',f,'g')];
      const before=JSON.stringify(doc);
      // Independent normalized straight-alpha Porter-Duff source-over oracle.
      const ab=b[3]/65535, as=f[3]/65535*.5, ao=as+ab*(1-as);
      const expected=b.slice(0,3).map((v,i)=>{
        const cb=v/65535,cs=f[i]/65535;
        const blend=mode==='multiply'?cb*cs:1-(1-cb)*(1-cs);
        return Math.round(65535*((1-as)*ab*cb+(1-ab)*as*cs+ab*as*blend)/ao);
      }).concat(Math.round(ao*65535));
      const out=await controller().prepareDocument(doc);
      assert.equal(out.composite,null,mode);
      assert.deepEqual([...out.compositePixelBuffer.data],expected,mode);
      for(const encode of [encodePsd,encodePsb]){
        const bytes=new Uint8Array(encode({width:1,height:1,bitsPerChannel:16,colorMode:3,layers:out.layers,groups:out.groups,compositePixelBuffer:out.compositePixelBuffer}));
        const raw=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-10,10);
        // PSD merged RGB channels use a white matte for partial alpha; editable
        // layer channels remain straight. Compute the file words independently.
        const alpha=expected[3]/65535;
        const matte=expected.slice(0,3).map(v=>alpha>0&&alpha<1?Math.round(v*alpha+65535*(1-alpha)):v);
        assert.deepEqual([0,2,4,6,8].map(i=>raw.getUint16(i,false)),[0,...matte,expected[3]]);
        const parsed=await decodePsd(bytes,{maxPixels:16,maxLayers:16});
        assert.equal(parsed.groups[0].blendMode,mode);
        assert.deepEqual([...parsed.layers.find(l=>l.name==='top').pixelBuffer.data],f);
      }
      assert.equal(JSON.stringify(doc),before);
    }
  }
});
test('native separable folder rejects unsupported topology without Canvas fallback or mutation',async()=>{
  for(const change of [d=>d.groups[0].parentGroupId='g',d=>d.layers[1].clipping=true,d=>d.layers[1].scaleX=2,d=>delete d.layers[1].highDepthSource]){
    const doc=make();doc.groups[0].blendMode='multiply';doc.layers[2].blendMode='source-over';change(doc);
    const before=JSON.stringify(doc);
    await assert.rejects(controller().prepareDocument(doc),/native high-depth/);
    assert.equal(JSON.stringify(doc),before);
  }
});

test('Multiply/Screen folder uses group mask once and keeps a mixed native child blend editable',async()=>{
  const maskController=createPsdExportController({vectors:{exportPsdVectorMask:()=>null},rendering:{
    createCanvas(){return {getContext(){return {fillRect(){},getImageData(){return {data:Uint8ClampedArray.of(255,255,255,255)};}};}};},
    renderLayer(){throw Error('unexpected rasterization');},renderDocument(){throw Error('unexpected display composite');}
  }});
  for(const mode of ['multiply','screen']){
    const doc=make();
    doc.groups[0].blendMode=mode;
    doc.groups[0].mask={enabled:true,invert:true,density:.5};
    const b=[10001,20003,30007], inner=[31001,22003,19007], top=[50009,10011,30013];
    doc.layers=[layer('outer',[...b,65535]),layer('inner',[...inner,65535],'g'),layer('top',[...top,65535],'g','multiply')];
    const isolated=inner.map((v,i)=>Math.round(v*top[i]/65535));
    const coverage=.5*128/255;
    const expected=b.map((v,i)=>Math.round(v*(1-coverage)+coverage*(mode==='multiply'?v*isolated[i]/65535:v+isolated[i]-v*isolated[i]/65535))).concat(65535);
    const before=JSON.stringify(doc);
    const out=await maskController.prepareDocument(doc);
    assert.deepEqual([...out.compositePixelBuffer.data],expected);
    assert.equal(out.groups[0].mask.pixels[3],128);
    assert.equal(out.layers.find(l=>l.name==='top').blendMode,'multiply');
    assert.equal(JSON.stringify(doc),before);
  }
});

test('Overlay and Hard Light native folder: both threshold branches, partial alpha and exact editable PSD/PSB words',async()=>{
  for(const mode of ['overlay','hard-light']){
    for(const backdropAlpha of [0,32768,65535]){
      const doc=make();
      doc.groups[0].blendMode=mode;
      const b=[10001,40003,32768,backdropAlpha], f=[50009,10011,32767,40015];
      doc.layers=[layer('outer',b),layer('top',f,'g')];
      const before=JSON.stringify(doc);
      // Overlay branches on backdrop; Hard Light branches on source.
      const ab=b[3]/65535, as=f[3]/65535*.5, ao=as+ab*(1-as);
      const expected=b.slice(0,3).map((v,i)=>{
        const cb=v/65535,cs=f[i]/65535;
        const pivot=mode==='overlay'?cb:cs;
        const blended=pivot<=.5?2*cb*cs:1-2*(1-cb)*(1-cs);
        return Math.round(65535*((1-as)*ab*cb+(1-ab)*as*cs+ab*as*blended)/ao);
      }).concat(Math.round(ao*65535));
      const out=await controller().prepareDocument(doc);
      assert.equal(out.composite,null,mode);
      assert.deepEqual([...out.compositePixelBuffer.data],expected,mode);
      for(const encode of [encodePsd,encodePsb]){
        const bytes=new Uint8Array(encode({width:1,height:1,bitsPerChannel:16,colorMode:3,layers:out.layers,groups:out.groups,compositePixelBuffer:out.compositePixelBuffer}));
        const raw=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-10,10);
        const alpha=expected[3]/65535;
        const matte=expected.slice(0,3).map(v=>alpha>0&&alpha<1?Math.round(v*alpha+65535*(1-alpha)):v);
        assert.deepEqual([0,2,4,6,8].map(i=>raw.getUint16(i,false)),[0,...matte,expected[3]]);
        const parsed=await decodePsd(bytes,{maxPixels:16,maxLayers:16});
        assert.equal(parsed.groups[0].blendMode,mode);
        assert.deepEqual([...parsed.layers.find(l=>l.name==='top').pixelBuffer.data],f);
      }
      assert.equal(JSON.stringify(doc),before);
    }
  }
});
test('Overlay and Hard Light reject unsupported native topology before rasterization',async()=>{
  for(const mode of ['overlay','hard-light']){
    for(const change of [d=>d.groups[0].parentGroupId='g',d=>d.layers[1].clipping=true,d=>d.layers[1].scaleX=2,d=>delete d.layers[1].highDepthSource]){
      const doc=make();doc.groups[0].blendMode=mode;doc.layers[2].blendMode='source-over';change(doc);
      const before=JSON.stringify(doc);
      await assert.rejects(controller().prepareDocument(doc),/native high-depth/);
      assert.equal(JSON.stringify(doc),before);
    }
  }
});
test('Overlay and Hard Light apply prepared mask once after native child compositing',async()=>{
  const maskController=createPsdExportController({vectors:{exportPsdVectorMask:()=>null},rendering:{
    createCanvas(){return {getContext(){return {fillRect(){},getImageData(){return {data:Uint8ClampedArray.of(255,255,255,255)};}};}};},
    renderLayer(){throw Error('unexpected rasterization');},renderDocument(){throw Error('unexpected display composite');}
  }});
  for(const mode of ['overlay','hard-light']){
    const doc=make();doc.groups[0].blendMode=mode;doc.groups[0].mask={enabled:true,invert:true,density:.5};
    const b=[10001,40003,50007], inner=[31001,22003,59007], top=[50009,10011,60013];
    doc.layers=[layer('outer',[...b,65535]),layer('inner',[...inner,65535],'g'),layer('top',[...top,65535],'g','multiply')];
    const isolated=inner.map((v,i)=>Math.round(v*top[i]/65535));
    const coverage=.5*128/255;
    const expected=b.map((v,i)=>{
      const cb=v/65535,cs=isolated[i]/65535,pivot=mode==='overlay'?cb:cs;
      const blended=pivot<=.5?2*cb*cs:1-2*(1-cb)*(1-cs);
      return Math.round(v*(1-coverage)+coverage*65535*blended);
    }).concat(65535);
    const before=JSON.stringify(doc);
    const out=await maskController.prepareDocument(doc);
    assert.deepEqual([...out.compositePixelBuffer.data],expected);
    assert.equal(out.groups[0].mask.pixels[3],128);
    assert.equal(out.layers.find(l=>l.name==='top').blendMode,'multiply');
    assert.equal(JSON.stringify(doc),before);
  }
});

const remainingSeparableModes=['darken','lighten','difference','exclusion','soft-light','color-dodge','color-burn'];
// Independent word-domain oracle; soft light uses the W3C polynomial below 1/4.
function remainingBlendWord(mode,b,s){
  const max=65535;
  switch(mode){
    case 'darken':return Math.min(b,s);
    case 'lighten':return Math.max(b,s);
    case 'difference':return Math.abs(b-s);
    case 'exclusion':return b+s-2*b*s/max;
    case 'color-dodge':return b===0?0:s===max?max:Math.min(max,max*b/(max-s));
    case 'color-burn':return b===max?max:s===0?0:Math.max(0,max-max*(max-b)/s);
    case 'soft-light':{
      const x=b/max,y=s/max;
      const d=x<=.25?16*x*x*x-12*x*x+4*x:Math.sqrt(x);
      return max*(y<=.5?x+(2*y-1)*x*(1-x):x+(2*y-1)*(d-x));
    }
    default:throw Error('unknown oracle mode');
  }
}
test('remaining separable RGB16 groups preserve exact PSD/PSB samples across branch and alpha edges',async()=>{
  for(const mode of remainingSeparableModes){
    for(const [b,f] of [
      [[10001,40003,32768,32768],[50009,10011,32767,40015]],
      [[0,16383,16384,65535],[65535,32768,50001,65535]],
      [[65535,12345,0,0],[0,65535,32768,40015]],
      [[0,65535,32767,65535],[0,65535,32768,65535]],
      [[0,65535,1,65535],[65535,0,65534,65535]],
      [[65534,1,40000,32768],[1,65534,10000,40015]],
    ]){
      const doc=make();doc.groups[0].blendMode=mode;
      doc.layers=[layer('outer',b),layer('top',f,'g')];
      const before=JSON.stringify(doc);
      const ab=b[3]/65535,as=f[3]/65535*.5,ao=as+ab*(1-as);
      const expected=b.slice(0,3).map((v,i)=>Math.round(((1-as)*ab*v+(1-ab)*as*f[i]+ab*as*remainingBlendWord(mode,v,f[i]))/ao)).concat(Math.round(65535*ao));
      const out=await controller().prepareDocument(doc);
      assert.equal(out.composite,null,mode);assert.deepEqual([...out.compositePixelBuffer.data],expected,mode);
      for(const encode of [encodePsd,encodePsb]){
        const bytes=new Uint8Array(encode({width:1,height:1,bitsPerChannel:16,colorMode:3,layers:out.layers,groups:out.groups,compositePixelBuffer:out.compositePixelBuffer}));
        const raw=new DataView(bytes.buffer,bytes.byteOffset+bytes.byteLength-10,10),alpha=expected[3]/65535;
        const matte=expected.slice(0,3).map(v=>alpha>0&&alpha<1?Math.round(v*alpha+65535*(1-alpha)):v);
        assert.deepEqual([0,2,4,6,8].map(i=>raw.getUint16(i,false)),[0,...matte,expected[3]],mode);
        const parsed=await decodePsd(bytes,{maxPixels:16,maxLayers:16});
        assert.equal(parsed.groups[0].blendMode,mode);
        assert.deepEqual([...parsed.layers.find(l=>l.name==='top').pixelBuffer.data],f,mode);
      }
      assert.equal(JSON.stringify(doc),before);
    }
  }
});
test('remaining separable group modes apply prepared mask once to finished native child pixels',async()=>{
  const maskController=createPsdExportController({vectors:{exportPsdVectorMask:()=>null},rendering:{
    createCanvas(){return {getContext(){return {fillRect(){},getImageData(){return {data:Uint8ClampedArray.of(255,255,255,255)};}};}};},
    renderLayer(){throw Error('unexpected rasterization');},renderDocument(){throw Error('unexpected display composite');}
  }});
  for(const mode of remainingSeparableModes){
    const doc=make();doc.groups[0].blendMode=mode;doc.groups[0].mask={enabled:true,invert:true,density:.5};
    const b=[10001,40003,50007],inner=[31001,22003,59007],top=[50009,10011,60013];
    doc.layers=[layer('outer',[...b,65535]),layer('inner',[...inner,65535],'g'),layer('top',[...top,65535],'g','difference')];
    const isolated=inner.map((v,i)=>Math.abs(v-top[i])),coverage=.5*128/255;
    const expected=b.map((v,i)=>Math.round(v*(1-coverage)+coverage*remainingBlendWord(mode,v,isolated[i]))).concat(65535);
    const before=JSON.stringify(doc),out=await maskController.prepareDocument(doc);
    assert.deepEqual([...out.compositePixelBuffer.data],expected,mode);
    assert.equal(out.groups[0].mask.pixels[3],128);assert.equal(JSON.stringify(doc),before);
  }
});
test('remaining separable folder modes reject unsupported topology and precision without mutation',async()=>{
  for(const mode of remainingSeparableModes){
    for(const change of [d=>d.groups[0].parentGroupId='g',d=>d.layers[1].clipping=true,d=>d.layers[1].scaleX=2,d=>delete d.layers[1].highDepthSource]){
      const doc=make();doc.groups[0].blendMode=mode;doc.layers[2].blendMode='source-over';change(doc);
      const before=JSON.stringify(doc);
      await assert.rejects(controller().prepareDocument(doc),/native high-depth/);
      assert.equal(JSON.stringify(doc),before);
    }
  }
});


test('typed Color Dodge and Burn preserve extreme backdrop before source singularity (W3C 10.1.7-8)',()=>{
  const buffer=values=>createPixelBuffer({width:1,height:1,model:'rgb',channels:4,bitsPerChannel:16,colorSpace:'srgb',data:Uint16Array.from(values)});
  const cases=[
    ['color-dodge',[0,1,32000,65535],[65535,65534,0,65535],[0,65535,32000,65535]],
    ['color-burn',[65535,65534,32000,65535],[0,1,65535,65535],[65535,0,32000,65535]]
  ];
  for(const [blendMode,b,s,expected] of cases){
    const base=buffer(b), source=buffer(s);
    const out=compositePixelBufferLayers(1,1,[{buffer:base},{buffer:source,blendMode}],{bitsPerChannel:16});
    assert.deepEqual([...out.data],expected,blendMode);
    assert.deepEqual([...base.data],b);assert.deepEqual([...source.data],s);
  }
});
