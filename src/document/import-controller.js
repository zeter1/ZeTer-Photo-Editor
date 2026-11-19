export function createDocumentImportController({
  getDocument,
  getActiveSessionId,
  isPsdFile,
  readFileAsDataURL,
  dimensionsFromDataUrl,
  inspectDng,
  developDng,
  rgbaPixelsToDataUrl,
  bytesToDataUrl,
  checkedCanvasSize,
  createRasterLayer,
  addLayer,
  blockPendingDocumentEdit,
  commit,
  setStatus,
  toast,
  fitToView,
  visibleCanvasCenter,
  openPsd,
  openProject,
  resetBrushBuffer=()=>{},
  DateClass=globalThis.Date,
} = {}) {
  function isDngFile(file) {
    return Boolean(file) && (/\.dng$/i.test(file.name || '') || /^(image\/x-adobe-dng|image\/dng)$/i.test(file.type || ''));
  }

  function isImageFile(file) {
    return Boolean(file) && !isPsdFile(file) &&
      (isDngFile(file) || String(file.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name || ''));
  }

  function isProjectFile(file) {
    return Boolean(file) && /\.(zpe|pixforge|json)$/i.test(file.name || '');
  }

  async function importImages(files, { anchor = null, source = 'Импорт' } = {}) {
    const images=[...files].filter(isImageFile);
    if(!images.length)return 0;
    const targetDocument=getDocument();
    const targetSessionId=getActiveSessionId();
    setStatus(`${source}: чтение изображений…`);

    const prepared=[];
    for(const file of images){
      if(isDngFile(file)){
        try {
          const raw=await file.arrayBuffer();
          const source=inspectDng(raw);
          checkedCanvasSize(source.width,source.height,`RAW «${file.name || 'Без имени'}»`);
          const pixels=developDng(source);
          const dataUrl=await rgbaPixelsToDataUrl(pixels.width,pixels.height,pixels.rgba,'DNG RAW');
          const rawDng={dataUrl:bytesToDataUrl(raw,'application/x-adobe-dng'),
            development:pixels.development,colorPipeline:pixels.colorPipeline,
            width:source.width,height:source.height};
          prepared.push({file,dataUrl,width:pixels.width,height:pixels.height,rawDng});
        } catch(error) {
          setStatus('Ошибка DNG: ' + error.message);
          toast('DNG не импортирован: ' + error.message,'error');
          return 0;
        }
      } else {
        const dataUrl=await readFileAsDataURL(file);
        const dimensions=await dimensionsFromDataUrl(dataUrl);
        checkedCanvasSize(dimensions.width,dimensions.height,`Изображение «${file.name || 'Без имени'}»`);
        prepared.push({file,dataUrl,width:dimensions.width,height:dimensions.height});
      }
    }

    if(getDocument()!==targetDocument||getActiveSessionId()!==targetSessionId){
      setStatus('Импорт отменён: активный документ изменился');
      toast('Повторите импорт в нужной вкладке','warn');
      return 0;
    }
    if(blockPendingDocumentEdit())return 0;

    const documentValue=getDocument();
    const emptyDocument=documentValue.layers.length===0 && documentValue.name==='Без имени';
    if(emptyDocument){
      const first=prepared[0];
      documentValue.width=first.width;
      documentValue.height=first.height;
      documentValue.name=(first.file.name || 'Изображение').replace(/\.[^.]+$/,'');
    }

    let offset=0;
    for(const item of prepared){
      const target=emptyDocument
        ? {x:documentValue.width/2,y:documentValue.height/2}
        : (anchor || visibleCanvasCenter());
      addLayer(documentValue,createRasterLayer({
        name:item.file.name || `Вставка ${new DateClass().toLocaleTimeString('ru-RU')}`,
        x:target.x-item.width/2+offset,
        y:target.y-item.height/2+offset,
        width:item.width,
        height:item.height,
        dataUrl:item.dataUrl,
        ...(item.rawDng ? {rawDng:item.rawDng} : {}),
      }));
      offset+=18;
    }

    resetBrushBuffer();
    commit(images.length===1?`${source} изображения`:`${source}: ${images.length} изображений`);
    if(emptyDocument)fitToView();
    setStatus(`${source} завершён`);
    toast(images.length===1?'Изображение добавлено как слой':`Добавлено слоёв: ${images.length}`,'success');
    return images.length;
  }

  async function handleIncomingFiles(files, anchor = null, source = 'Импорт') {
    const incoming=[...files];
    const psdFiles=incoming.filter(isPsdFile);
    const project=incoming.find(isProjectFile);
    const images=incoming.filter(isImageFile);

    if(psdFiles.length){
      if(psdFiles.length!==1||incoming.length!==1){
        toast('PSD/PSB открывается как отдельный документ: выберите один Photoshop-файл за раз','warn');
        setStatus('Выберите один PSD/PSB-файл');
        return;
      }
      await openPsd(psdFiles[0]);
      return;
    }
    if(project && images.length===0){await openProject(project);return;}
    if(images.length){await importImages(images,{anchor,source});return;}
    if(project){await openProject(project);return;}
    toast('Формат файла не поддерживается','error');
    setStatus('Неподдерживаемый файл');
  }

  return { isImageFile, isProjectFile, importImages, handleIncomingFiles };
}
