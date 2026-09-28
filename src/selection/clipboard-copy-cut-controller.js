import { selectionBounds, selectionPixelBounds } from '../core/geometry.js';
import { renderDocument, renderLayer } from '../core/render.js';

function canvasToPngBlob(canvas) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось подготовить PNG для буфера обмена')),'image/png'));
}

export function createSelectionClipboardCopyCutController({
  getDocument,
  getActiveSessionId,
  getSelectionShape,
  captureSelectionSnapshot,
  getCopyMode,
  getSelectedLayer,
  getCurrentTool,
  isEditableRasterLayer,
  clipContextToDocumentSelection,
  clearSelectionAcrossVisibleLayers,
  clearSelectedPixels,
  clearSelectionState,
  setTool,
  setStatus,
  toast,
  documentTarget=globalThis.document,
  navigatorTarget=globalThis.navigator,
  ClipboardItemClass=globalThis.ClipboardItem,
  renderDocumentFn=renderDocument,
  renderLayerFn=renderLayer,
  canvasToPngBlobFn=canvasToPngBlob,
} = {}) {
  let clipboardCommandGeneration=0;

  async function renderSelectionLayerToPng(layer,bounds,selectionSnapshot) {
    const canvas=documentTarget.createElement('canvas');
    canvas.width=bounds.width;canvas.height=bounds.height;
    const ctx=canvas.getContext('2d',{alpha:true});
    ctx.clearRect(0,0,bounds.width,bounds.height);
    ctx.save();
    ctx.translate(-bounds.x,-bounds.y);
    clipContextToDocumentSelection(ctx,selectionSnapshot);
    const clipboardLayer=structuredClone(layer);
    clipboardLayer.blendMode='source-over';
    await renderLayerFn(ctx,clipboardLayer);
    ctx.restore();
    return canvasToPngBlobFn(canvas);
  }

  async function renderSelectionMergedToPng(documentValue,bounds,selectionSnapshot) {
    const full=documentTarget.createElement('canvas');
    await renderDocumentFn(full,documentValue,{checker:false});
    const canvas=documentTarget.createElement('canvas');
    canvas.width=bounds.width;canvas.height=bounds.height;
    const ctx=canvas.getContext('2d',{alpha:true});
    ctx.clearRect(0,0,bounds.width,bounds.height);
    ctx.save();
    ctx.translate(-bounds.x,-bounds.y);
    clipContextToDocumentSelection(ctx,selectionSnapshot);
    ctx.drawImage(full,0,0);
    ctx.restore();
    return canvasToPngBlobFn(canvas);
  }

  function isClipboardContextCurrent(context) {
    if(getDocument()!==context.documentValue||getActiveSessionId()!==context.sessionId)return false;
    if(context.copyMode==='selected'){
      if(getSelectedLayer()!==context.layer)return false;
      if(!Array.isArray(context.documentValue.layers)||!context.documentValue.layers.includes(context.layer))return false;
    }
    return true;
  }

  function isClipboardCommandCurrent(context) {
    return context.commandGeneration===clipboardCommandGeneration;
  }

  function isClipboardContinuationCurrent(context) {
    return isClipboardCommandCurrent(context)&&isClipboardContextCurrent(context);
  }

  function finishSelectionClipboardAction(context,message) {
    if(!isClipboardCommandCurrent(context))return false;
    const stillOwnsTransientUi=
      isClipboardContextCurrent(context)&&
      getSelectionShape()===context.selectionIdentity&&
      getCurrentTool()===context.tool;
    if(stillOwnsTransientUi){
      clearSelectionState();
      setTool('move');
    }
    setStatus(message);
    return true;
  }

  function rejectStaleCut(context) {
    if(!isClipboardCommandCurrent(context))return false;
    setStatus('Область скопирована, но вырезание отменено: активный документ или слой изменился');
    toast('Область скопирована; вырезание отменено из-за изменения документа или слоя','warn');
    return false;
  }

  async function copySelectionToClipboard({ cut = false } = {}) {
    const commandGeneration=++clipboardCommandGeneration;
    const selectionIdentity=getSelectionShape();
    const selectionSnapshot=captureSelectionSnapshot();
    if(!selectionIdentity||!selectionSnapshot){setStatus('Сначала выделите область инструментом выделения');toast('Нет активного выделения','warn');return false;}
    const documentValue=getDocument();
    const sessionId=getActiveSessionId();
    const copyMode=getCopyMode();
    const layer=getSelectedLayer();
    if(copyMode==='selected'&&!layer){setStatus('Нет выбранного слоя');toast('Выберите слой для копирования','warn');return false;}
    if(cut&&copyMode==='selected'&&!isEditableRasterLayer(layer)){setStatus('Вырезание выбранного слоя доступно только на незаблокированном растровом слое');toast('Для вырезания выберите незаблокированный растровый слой','warn');return false;}
    const selectionRect=selectionBounds(selectionSnapshot);
    const bounds=selectionPixelBounds(selectionRect,documentValue.width,documentValue.height);
    if(!bounds){setStatus('Выделение пустое');return false;}
    if(!navigatorTarget?.clipboard?.write||typeof ClipboardItemClass!=='function'){
      setStatus('Копирование изображения в системный буфер недоступно в этом браузере');
      toast('Браузер не поддерживает запись изображений в буфер обмена','error');
      return false;
    }
    const context={commandGeneration,documentValue,sessionId,selectionIdentity,selectionSnapshot,bounds,copyMode,layer,tool:getCurrentTool()};
    try {
      const pngBlob=await (copyMode==='merged'
        ? renderSelectionMergedToPng(documentValue,bounds,selectionSnapshot)
        : renderSelectionLayerToPng(layer,bounds,selectionSnapshot));
      if(!isClipboardCommandCurrent(context))return false;
      if(!isClipboardContextCurrent(context)){setStatus('Копирование отменено: активный документ или слой изменился');return false;}
      const item=new ClipboardItemClass({'image/png':pngBlob});
      await navigatorTarget.clipboard.write([item]);
      if(!isClipboardCommandCurrent(context))return false;
      if(!isClipboardContextCurrent(context)){
        if(cut)return rejectStaleCut(context);
        setStatus('Область скопирована, но завершение команды отменено: активный документ или слой изменился');
        return false;
      }
      if(cut){
        if(copyMode==='merged'){
          const result=await clearSelectionAcrossVisibleLayers({
            historyLabel:'Вырезать выделение со всех слоёв',
            ownerDocument:documentValue,
            ownerSessionId:sessionId,
            selectionSnapshot,
            isContinuationCurrent:()=>isClipboardContinuationCurrent(context),
          });
          if(!result)return false;
          if(!isClipboardContinuationCurrent(context))return false;
          const details=[];
          if(result.rasterized)details.push(`растрировано слоёв: ${result.rasterized}`);
          if(result.locked)details.push(`заблокировано и не изменено: ${result.locked}`);
          const message=result.cleared
            ? `Вырезано со всех видимых слоёв: ${bounds.width} × ${bounds.height} px${details.length?` • ${details.join(' • ')}`:''}`
            : `Скопировано объединённое выделение: ${bounds.width} × ${bounds.height} px • очищать нечего`;
          if(!finishSelectionClipboardAction(context,message))return false;
          toast(result.cleared?'Выделение вырезано со всех доступных видимых слоёв':'Объединённое выделение скопировано; доступных слоёв для очистки нет',result.cleared?'success':'warn');
          return true;
        }
        if(!isEditableRasterLayer(layer))return rejectStaleCut(context);
        const cleared=await clearSelectedPixels({
          historyLabel:'Вырезать выделение',
          successStatus:`Вырезано в буфер: ${bounds.width} × ${bounds.height} px`,
          ownerDocument:documentValue,
          targetLayer:layer,
          selectionSnapshot,
          isContinuationCurrent:()=>isClipboardContinuationCurrent(context),
        });
        if(!cleared){if(isClipboardCommandCurrent(context))toast('Область скопирована, но удалить пиксели со слоя не удалось','warn');return false;}
        if(!isClipboardContinuationCurrent(context))return false;
        if(!finishSelectionClipboardAction(context,`Вырезано в буфер: ${bounds.width} × ${bounds.height} px`))return false;
        toast('Выделенная область вырезана в буфер обмена','success');
        return true;
      }
      const sourceLabel=copyMode==='merged'?'со всех видимых слоёв':'с выбранного слоя';
      if(!finishSelectionClipboardAction(context,`Скопировано ${sourceLabel}: ${bounds.width} × ${bounds.height} px`))return false;
      toast(`Выделенная область скопирована ${sourceLabel}`,'success');
      return true;
    } catch(error) {
      console.warn('Clipboard image write failed',error);
      if(!isClipboardCommandCurrent(context))return false;
      setStatus(`Не удалось записать выделение в буфер: ${error.message||'доступ запрещён'}`);
      toast('Не удалось скопировать изображение в системный буфер','error');
      return false;
    }
  }

  function copySelection() { return copySelectionToClipboard(); }
  function cutSelection() { return copySelectionToClipboard({cut:true}); }

  return { copySelection, cutSelection };
}
