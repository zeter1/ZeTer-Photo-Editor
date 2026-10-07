import { prepareSamImage, prepareSamPrompts, mergeSamMask } from '../ai/sam-preprocess.js';

// Publishes alpha only, through the existing guarded raster persistence owner.
export function createBackgroundRemovalCommandController({state,rasterEdit,engine,ui,getOptions=()=>({feather:1}),documentRef=globalThis.document}={}){
  async function remove({ownerDocument,ownerLayer,mask,isCurrent,signal}={}){
    const current=()=>!signal?.aborted&&state.getDocument()===ownerDocument&&ownerDocument?.layers.includes(ownerLayer)&&isCurrent();
    if(!current())return false;
    if(ownerLayer.highDepthSource){ui?.setStatus?.('Удаление фона доступно для RGB 8 бит. Исходный high-depth/CMYK слой сохранён.');return false;}
    if(!state.beginPersist())return false;
    try{
      const captured=engine.capture?.()||{engine,model:{square:false}},options={...getOptions()};
      const prepared=await rasterEdit.ensureRasterBuffer(ownerDocument,ownerLayer);
      if(!prepared||!current())return false;
      const {width,height}=prepared.canvas;
      if(mask?.width!==width||mask?.height!==height||width*height>8_000_000)throw new Error('Размер слоя или подсказки изменился');
      const image=prepared.ctx.getImageData(0,0,width,height);
      const prompts=prepareSamPrompts({width,height,data:image.data,mask:mask.data},captured.model);
      const resized=documentRef.createElement('canvas');resized.width=prompts.resizedWidth;resized.height=prompts.resizedHeight;
      const ctx=resized.getContext('2d');ctx.drawImage(prepared.canvas,0,0,resized.width,resized.height);
      const input=prepareSamImage(ctx.getImageData(0,0,resized.width,resized.height).data,resized.width,resized.height);
      const output=await captured.engine.run({input,points:prompts.points,labels:prompts.labels},{signal,onProgress:update=>{if(current()){ui?.setStatus?.(update.message);ui?.progress?.(update);}}});
      if(!current())return false;
      const result=mergeSamMask({width,height,data:image.data,mask:mask.data},prompts,output,options);
      if(!current())return false;
      if(result.every((value,i)=>value===image.data[i])){ui?.setStatus?.('Фон уже прозрачный · изменений нет');return false;}
      ui?.progress?.({stage:'save',message:'Сохранение прозрачного фона…'});
      image.data.set(result);prepared.ctx.putImageData(image,0,0);
      if(!await rasterEdit.persistPaintLayer(ownerDocument,ownerLayer,{isContinuationCurrent:current}))return false;
      ui?.commit?.('Удалить фон');return true;
    }catch(error){
      if(signal?.aborted)ui?.setStatus?.('Удаление фона отменено · подсказка сохранена');
      else if(current())ui?.setStatus?.(`Не удалось удалить фон: ${error.message}`);
      return false;
    }finally{rasterEdit.clearBrushBuffer();state.endPersist();ui?.render?.();}
  }
  return {remove};
}
