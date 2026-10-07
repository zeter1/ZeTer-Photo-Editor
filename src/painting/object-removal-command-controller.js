import { prepareLamaInput, mergeLamaOutput } from '../ai/lama-preprocess.js';

// AI owns no document state. Only this transaction can publish its result.
export function createObjectRemovalCommandController({state,rasterEdit,engine,ui}={}) {
  async function remove({ownerDocument,ownerLayer,mask,isCurrent,signal}={}) {
    const current=()=>!signal?.aborted && state.getDocument()===ownerDocument && ownerDocument?.layers.includes(ownerLayer) && isCurrent();
    if(!current())return false;
    if(ownerLayer.highDepthSource){ui?.setStatus?.('Нейросетевое удаление доступно для RGB 8 бит. Исходный high-depth/CMYK слой сохранён.');return false;}
    if(!state.beginPersist())return false;
    try {
      const prepared=await rasterEdit.ensureRasterBuffer(ownerDocument,ownerLayer);
      if(!prepared||!current())return false;
      const width=prepared.canvas.width,height=prepared.canvas.height;
      if(mask?.width!==width||mask?.height!==height)throw new Error('Размер маски изменился');
      const image=prepared.ctx.getImageData(0,0,width,height),source={width,height,data:image.data,mask:mask.data};
      const input=prepareLamaInput(source);
      const output=await engine.run(input.input,{signal,onProgress:update=>{if(current()){ui?.setStatus?.(typeof update==='string'?update:update.message);ui?.progress?.(update);}}});
      if(!current())return false;
      ui?.progress?.({stage:'save',message:'Сохранение результата…'});
      image.data.set(mergeLamaOutput(source,input,output));
      if(!current())return false;
      prepared.ctx.putImageData(image,0,0);
      if(!await rasterEdit.persistPaintLayer(ownerDocument,ownerLayer,{isContinuationCurrent:current}))return false;
      ui?.commit?.('Удалить объект');
      return true;
    } catch(error) {
      if(signal?.aborted)ui?.setStatus?.('Удаление отменено · выделенная область сохранена');
      else if(current())ui?.setStatus?.(`Не удалось удалить объект: ${error.message}`);
      return false;
    } finally {
      rasterEdit.clearBrushBuffer();state.endPersist();ui?.render?.();
    }
  }
  return {remove};
}
