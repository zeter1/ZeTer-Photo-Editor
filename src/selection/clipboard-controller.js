import { MIME_EXT } from '../ui/tool-config.js';
import { createSelectionClipboardCopyCutController } from './clipboard-copy-cut-controller.js';

export function createSelectionClipboardController({
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
  importImages,
  visibleCanvasCenter,
  isImageFile,
  documentTarget=globalThis.document,
  navigatorTarget=globalThis.navigator,
  ClipboardItemClass=globalThis.ClipboardItem,
  FileClass=globalThis.File,
  DateClass=globalThis.Date,
  renderDocumentFn,
  renderLayerFn,
  canvasToPngBlobFn,
  setTimeoutFn=globalThis.setTimeout,
  clearTimeoutFn=globalThis.clearTimeout,
} = {}) {
  const { copySelection, cutSelection }=createSelectionClipboardCopyCutController({
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
    documentTarget,
    navigatorTarget,
    ClipboardItemClass,
    renderDocumentFn,
    renderLayerFn,
    canvasToPngBlobFn,
  });

  let pasteGeneration=0;
  let pasteFallbackTimer=null;

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
