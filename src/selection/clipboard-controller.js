import { selectionPixelBounds } from '../core/geometry.js';
import { MIME_EXT } from '../ui/tool-config.js';
import { renderDocument, renderLayer } from '../core/render.js';

function canvasToPngBlob(canvas) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Не удалось подготовить PNG для буфера обмена')),'image/png'));
}

export function createSelectionClipboardController({
  getDocument,
  getActiveSessionId,
  getSelectionRect,
  getCopyMode,
  getSelectedLayer,
  isEditableRasterLayer,
  clipContextToDocumentSelection,
  clearSelectionAcrossVisibleLayers,
  clearSelectedPixels,
  clearSelectionState,
  setTool,
  setStatus,
  toast,
  importImages,
  visibleCanvasCenter,
  isImageFile,
  documentTarget=globalThis.document,
  navigatorTarget=globalThis.navigator,
  ClipboardItemClass=globalThis.ClipboardItem,
  FileClass=globalThis.File,
  DateClass=globalThis.Date,
  setTimeoutFn=globalThis.setTimeout,
  clearTimeoutFn=globalThis.clearTimeout,
} = {}) {
  let pasteGeneration=0;
  let pasteFallbackTimer=null;

  async function renderSelectionLayerToPng(layer,bounds) {
    const canvas=documentTarget.createElement('canvas');
    canvas.width=bounds.width;canvas.height=bounds.height;
    const ctx=canvas.getContext('2d',{alpha:true});
    ctx.clearRect(0,0,bounds.width,bounds.height);
    ctx.save();
    ctx.translate(-bounds.x,-bounds.y);
    clipContextToDocumentSelection(ctx);
    const clipboardLayer=structuredClone(layer);
    clipboardLayer.blendMode='source-over';
    await renderLayer(ctx,clipboardLayer);
    ctx.restore();
    return canvasToPngBlob(canvas);
  }

  async function renderSelectionMergedToPng(bounds) {
    const full=documentTarget.createElement('canvas');
    await renderDocument(full,getDocument(),{checker:false});
    const canvas=documentTarget.createElement('canvas');
    canvas.width=bounds.width;canvas.height=bounds.height;
    const ctx=canvas.getContext('2d',{alpha:true});
    ctx.clearRect(0,0,bounds.width,bounds.height);
    ctx.save();
    ctx.translate(-bounds.x,-bounds.y);
    clipContextToDocumentSelection(ctx);
    ctx.drawImage(full,0,0);
    ctx.restore();
    return canvasToPngBlob(canvas);
  }

  function finishSelectionClipboardAction(message) {
    clearSelectionState();
    setTool('move');
    setStatus(message);
  }

  async function copySelectionToClipboard({ cut = false } = {}) {
    const selectionRect=getSelectionRect();
    if(!selectionRect){setStatus('Сначала выделите область инструментом выделения');toast('Нет активного выделения','warn');return false;}
    const layer=getSelectedLayer();
    const copyMode=getCopyMode();
    if(copyMode==='selected'&&!layer){setStatus('Нет выбранного слоя');toast('Выберите слой для копирования','warn');return false;}
    if(cut&&copyMode==='selected'&&!isEditableRasterLayer(layer)){setStatus('Вырезание выбранного слоя доступно только на незаблокированном растровом слое');toast('Для вырезания выберите незаблокированный растровый слой','warn');return false;}
    const documentValue=getDocument();
    const bounds=selectionPixelBounds(selectionRect,documentValue.width,documentValue.height);
    if(!bounds){setStatus('Выделение пустое');return false;}
    if(!navigatorTarget?.clipboard?.write||typeof ClipboardItemClass!=='function'){
      setStatus('Копирование изображения в системный буфер недоступно в этом браузере');
      toast('Браузер не поддерживает запись изображений в буфер обмена','error');
      return false;
    }
    try {
      const pngPromise=copyMode==='merged'
        ? renderSelectionMergedToPng(bounds)
        : renderSelectionLayerToPng(layer,bounds);
      const item=new ClipboardItemClass({'image/png':pngPromise});
      await navigatorTarget.clipboard.write([item]);
      if(cut){
        if(copyMode==='merged'){
          const result=await clearSelectionAcrossVisibleLayers({historyLabel:'Вырезать выделение со всех слоёв'});
          if(!result)return false;
          const details=[];
          if(result.rasterized)details.push(`растрировано слоёв: ${result.rasterized}`);
          if(result.locked)details.push(`заблокировано и не изменено: ${result.locked}`);
          const message=result.cleared
            ? `Вырезано со всех видимых слоёв: ${bounds.width} × ${bounds.height} px${details.length?` • ${details.join(' • ')}`:''}`
            : `Скопировано объединённое выделение: ${bounds.width} × ${bounds.height} px • очищать нечего`;
          finishSelectionClipboardAction(message);
          toast(result.cleared?'Выделение вырезано со всех доступных видимых слоёв':'Объединённое выделение скопировано; доступных слоёв для очистки нет',result.cleared?'success':'warn');
          return true;
        }
        const cleared=await clearSelectedPixels({
          historyLabel:'Вырезать выделение',
          successStatus:`Вырезано в буфер: ${bounds.width} × ${bounds.height} px`,
        });
        if(!cleared){toast('Область скопирована, но удалить пиксели со слоя не удалось','warn');return false;}
        finishSelectionClipboardAction(`Вырезано в буфер: ${bounds.width} × ${bounds.height} px`);
        toast('Выделенная область вырезана в буфер обмена','success');
        return true;
      }
      const sourceLabel=copyMode==='merged'?'со всех видимых слоёв':'с выбранного слоя';
      finishSelectionClipboardAction(`Скопировано ${sourceLabel}: ${bounds.width} × ${bounds.height} px`);
      toast(`Выделенная область скопирована ${sourceLabel}`,'success');
      return true;
    } catch(error) {
      console.warn('Clipboard image write failed',error);
      setStatus(`Не удалось записать выделение в буфер: ${error.message||'доступ запрещён'}`);
      toast('Не удалось скопировать изображение в системный буфер','error');
      return false;
    }
  }

  function copySelection() { return copySelectionToClipboard(); }
  function cutSelection() { return copySelectionToClipboard({cut:true}); }

  async function readClipboardImageFiles() {
    if (!navigatorTarget?.clipboard?.read) return [];
    const clipboardItems=await navigatorTarget.clipboard.read();
    const files=[];
    for (const item of clipboardItems) {
      const type=item.types.find(value=>value.startsWith('image/'));
      if (!type) continue;
      const blob=await item.getType(type);
      const ext=MIME_EXT[type] || type.split('/')[1] || 'png';
      files.push(new FileClass([blob],`Вставка-${DateClass.now()}.${ext}`,{type}));
    }
    return files;
  }

  async function pasteFromClipboard() {
    if (!navigatorTarget?.clipboard?.read) {
      toast('Для вставки используйте Ctrl+V — прямое чтение буфера недоступно браузеру','error');
      return;
    }
    const targetDocument=getDocument();
    const targetSessionId=getActiveSessionId();
    try {
      const files=await readClipboardImageFiles();
      if (!files.length) { toast('В буфере обмена нет изображения','error'); return; }
      if(getDocument()!==targetDocument||getActiveSessionId()!==targetSessionId){
        setStatus('Вставка отменена: активный документ изменился');
        return;
      }
      pasteGeneration+=1;
      await importImages(files,{anchor:visibleCanvasCenter(),source:'Вставка'});
    } catch (error) {
      console.warn('Clipboard read failed',error);
      toast('Браузер не разрешил прямое чтение буфера. Нажмите Ctrl+V','error');
    }
  }

  function armPasteShortcutFallback() {
    const generation=++pasteGeneration;
    const targetDocument=getDocument();
    const targetSessionId=getActiveSessionId();
    setStatus('Вставка из буфера…');
    clearTimeoutFn(pasteFallbackTimer);
    pasteFallbackTimer=setTimeoutFn(()=>{
      if(generation===pasteGeneration&&getDocument()===targetDocument&&getActiveSessionId()===targetSessionId)
        setStatus('Буфер не передал изображение — попробуйте скопировать изображение снова или перетащить файл');
    },900);
    if (!navigatorTarget?.clipboard?.read) return;
    readClipboardImageFiles().then(files=>{
      if(!files.length)return;
      setTimeoutFn(()=>{
        if(generation!==pasteGeneration||getDocument()!==targetDocument||getActiveSessionId()!==targetSessionId)return;
        pasteGeneration+=1;
        clearTimeoutFn(pasteFallbackTimer);
        importImages(files,{anchor:visibleCanvasCenter(),source:'Вставка'}).catch(error=>{
          console.error(error);toast(error.message||'Ошибка вставки','error');
        });
      },80);
    }).catch(error=>{
      console.debug('Clipboard fallback unavailable',error);
    });
  }

  function handleNativePasteEvent(event) {
    const files=[];
    for(const item of [...(event.clipboardData?.items||[])]){
      if(item.kind==='file'&&item.type.startsWith('image/')){
        const file=item.getAsFile();if(file)files.push(file);
      }
    }
    if(!files.length){
      for(const file of [...(event.clipboardData?.files||[])])if(isImageFile(file))files.push(file);
    }
    if(!files.length){
      const hasClipboardPayload=(event.clipboardData?.items?.length||0)>0 || (event.clipboardData?.files?.length||0)>0;
      if(hasClipboardPayload)toast('В буфере есть данные, но браузер не передал их как изображение','error');
      return false;
    }
    event.preventDefault();
    pasteGeneration+=1;
    clearTimeoutFn(pasteFallbackTimer);
    importImages(files,{anchor:visibleCanvasCenter(),source:'Вставка'}).catch(error=>{
      console.error(error);toast(error.message||'Ошибка вставки','error');
    });
    return true;
  }

  return {
    copySelection,
    cutSelection,
    pasteFromClipboard,
    armPasteShortcutFallback,
    handleNativePasteEvent,
    readClipboardImageFiles,
  };
}
