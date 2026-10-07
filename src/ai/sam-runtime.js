import { SAM_ARTIFACTS, SAM2_ARTIFACTS } from './sam-assets.js';
import { createLamaEngine } from './lama-runtime.js';
import { createLamaArtifactCache } from './asset-cache.js';

function samWorkerEntry(){
  self.onmessage=async({data})=>{
    let stage='runtime';
    try{
      self.fetch=()=>Promise.reject(new Error('Inference network access disabled'));
      ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
      const moduleUrl=URL.createObjectURL(new Blob([data.mjs],{type:'text/javascript'}));
      ort.env.wasm.wasmPaths={mjs:moduleUrl};ort.env.wasm.wasmBinary=new Uint8Array(data.wasm);
      const providers=data.gpu&&self.navigator?.gpu?['webgpu','wasm']:['wasm'];
      self.postMessage({type:'progress',stage:'initialize',message:'Подготовка нейросети удаления фона…'});
      stage='encoder';
      const square=data.square;
      const names=square?['image_embeddings.0','image_embeddings.1','image_embeddings.2']:['image_embeddings','image_positional_embeddings'];
      const shapes=square?[[1,32,256,256],[1,64,128,128],[1,256,64,64]]:[[1,256,64,64],[1,256,64,64]];
      const external=(path,bytes)=>bytes?{externalData:[{path,data:new Uint8Array(bytes)}]}:{};
      const encoder=await ort.InferenceSession.create(new Uint8Array(data.encoder),{executionProviders:providers,...external('vision_encoder_quantized.onnx_data',data.encoderData)});
      if(encoder.inputNames.join(',')!=='pixel_values'||!names.every(name=>encoder.outputNames.includes(name)))throw new Error('Unexpected SlimSAM encoder contract');
      self.postMessage({type:'progress',stage:'inference',message:'Определение границ объекта…'});
      const encoded=await encoder.run({pixel_values:new ort.Tensor('float32',data.input,[1,3,1024,1024])});
      const embeddings={};
      for(let index=0;index<names.length;index++){const name=names[index],shape=shapes[index];
        const tensor=encoded[name];
        if(tensor.type!=='float32'||tensor.dims.join(',')!==shape.join(','))throw new Error('Unexpected embedding shape');
        embeddings[name]=new ort.Tensor('float32',new Float32Array(tensor.data),shape);
      }
      for(const tensor of Object.values(encoded))tensor.dispose();await encoder.release();
      stage='decoder';
      const decoder=await ort.InferenceSession.create(new Uint8Array(data.decoder),{executionProviders:providers,...external('prompt_encoder_mask_decoder.onnx_data',data.decoderData)});
      if(decoder.inputNames.length!==(square?6:4)||![...names,'input_points','input_labels',...(square?['input_boxes']:[])].every(name=>decoder.inputNames.includes(name)))throw new Error('Unexpected SlimSAM decoder contract');
      const count=data.points.length/2;
      if(!Number.isInteger(count)||count<1||count>32)throw new Error('Unexpected prompts');
      const labels=data.labels||new Int32Array(count).fill(1);
      if(labels.length!==count||!labels.every(v=>v===0||v===1)||!labels.includes(1))throw new Error('Unexpected prompt labels');
      const result=await decoder.run({...embeddings,...(square?{input_boxes:new ort.Tensor('float32',new Float32Array(0),[1,0,4])}:{}),input_points:new ort.Tensor('float32',data.points,[1,1,count,2]),input_labels:new ort.Tensor('int64',BigInt64Array.from(labels,BigInt),[1,1,count])});
      const masks=result.pred_masks,scores=result.iou_scores;
      if(masks.type!=='float32'||masks.dims.join(',')!=='1,1,3,256,256'||scores.type!=='float32'||scores.dims.join(',')!=='1,1,3')throw new Error('Unexpected SlimSAM output');
      const output={masks:new Float32Array(masks.data),scores:new Float32Array(scores.data)};
      for(const tensor of Object.values(result))tensor.dispose();for(const tensor of Object.values(embeddings))tensor.dispose();
      await decoder.release();URL.revokeObjectURL(moduleUrl);
      self.postMessage({type:'result',output},[output.masks.buffer,output.scores.buffer]);
    }catch(error){self.postMessage({type:'error',stage,reason:String(error?.message||'').slice(0,300)});}
  };
}

export function createSamEngine(options={}){
  const square=options.square===true,artifacts=square?SAM2_ARTIFACTS:SAM_ARTIFACTS;
  return createLamaEngine({
    ...options,
    cache:options.cache||createLamaArtifactCache({databaseName:square?'zeter-background-sam2-model-v1':'zeter-background-removal-model-v1',artifacts}),
    artifactList:artifacts,workerEntry:samWorkerEntry,
    makeRequest:({input,points,labels},assets,gpu)=>({payload:{input,points,labels,gpu,square,mjs:assets[1],wasm:assets[2],encoder:assets[3],encoderData:square?assets[4]:null,decoder:assets[square?5:4],decoderData:square?assets[6]:null},transfer:[input.buffer,points.buffer,...(labels?[labels.buffer]:[])]}),
  });
}
