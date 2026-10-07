import { createBackgroundModelSettings } from './background-model-settings-controller.js';

export function createEditorSettingsController({dialog,engine,preferences,storage=globalThis.localStorage,setStatus=()=>{},onModelState=()=>{},backgroundEngine=null,onBackgroundModelState=()=>{},backgroundModelChoices=[]}={}) {
  let installing=null,deleting=false,checking=true,mode='auto',brush=24;
  try{const saved=JSON.parse(storage.getItem('zeter-editor-settings-v1')||'{}');if(saved.processing==='cpu')mode='cpu';if(Number.isInteger(saved.brush)&&saved.brush>=1&&saved.brush<=160)brush=saved.brush;}catch{}
  const q=id=>dialog.querySelector('#'+id);
  const persist=()=>{try{storage.setItem('zeter-editor-settings-v1',JSON.stringify({processing:mode,brush}));return true;}catch{q('settingsNotice').textContent='Браузер не разрешил сохранить настройки. Они действуют до закрытия страницы.';return false;}};
  function refresh() {
    const ready=engine.isReady();onModelState(ready);
    q('modelDescription').textContent=ready?'LaMa восстанавливает фон на месте закрашенного объекта. Нейросеть установлена. Фотографии обрабатываются на устройстве.':'LaMa восстанавливает фон на месте закрашенного объекта. Для работы установите модель — около 85 МБ. Фотографии не отправляются в интернет.';
    const busy=Boolean(installing)||deleting||checking||engine.isBusy();
    q('modelInstall').hidden=ready;
    q('modelInstall').disabled=busy;
    q('modelRemove').disabled=busy;
    q('modelRemove').textContent=deleting?'Удаление…':'Удалить нейросеть';
    q('modelInstallCancel').hidden=!installing;
    q('modelStatus').textContent=deleting?'Удаление файлов нейросети…':installing?'Загрузка и проверка модели…':checking?'Проверка установленной модели…':ready?(engine.isStored()?'Готова · сохранена в этом браузере':'Готова для этой страницы · кэш недоступен, после закрытия понадобится загрузка'):'Не установлена · для удаления объектов нужна нейросеть';
  }
  const backgroundModel=backgroundEngine?createBackgroundModelSettings({dialog,engine:backgroundEngine,setStatus,onModelState:onBackgroundModelState,choices:backgroundModelChoices}):null;
  const cacheCheck=engine.prepare({cachedOnly:true}).catch(()=>null).finally(()=>{checking=false;refresh();});
  async function install() {
    await cacheCheck;
    if(installing||deleting||engine.isReady())return;
    const controller=new AbortController();installing=controller;refresh();q('modelProgress').hidden=false;q('modelProgress').value=0;q('modelProgressText').textContent='Подключение…';
    try {
      await engine.prepare({signal:controller.signal,onProgress:({percent,loaded,total})=>{
        q('modelProgress').value=percent;
        q('modelProgressText').textContent=`${percent}% · ${(loaded/1024/1024).toFixed(1)} из ${(total/1024/1024).toFixed(1)} МБ`;
      }});
      q('modelProgress').value=100;q('modelProgressText').textContent='Нейросеть готова. Закройте настройки и нажмите «Удалить объект».';setStatus('Нейросеть удаления объектов готова');
    } catch(error) {
      q('modelProgressText').textContent=controller.signal.aborted?'Установка отменена. Можно продолжить позже.':`Не удалось установить: ${error.message}`;
    } finally {installing=null;refresh();}
  }
  async function remove() {
    await cacheCheck;
    if(installing||deleting)return;
    deleting=true;refresh();
    try {
      await engine.remove();
      q('modelProgress').hidden=true;q('modelProgress').value=0;
      q('modelProgressText').textContent='Нейросеть удалена. Для удаления объектов установите её снова.';
      setStatus('Нейросеть удалена. Фотографии и проекты сохранены.');
    } catch(error) {q('modelProgressText').textContent=`Не удалось удалить нейросеть: ${error.message}`;}
    finally {deleting=false;refresh();}
  }
  q('modelRemove').onclick=remove;
  q('settingsClose').onclick=()=>dialog.close();
  q('modelInstall').onclick=install;
  q('modelInstallCancel').onclick=()=>installing?.abort();
  q('processingMode').value=mode;
  q('processingMode').onchange=()=>{mode=q('processingMode').value==='cpu'?'cpu':'auto';persist();};
  q('defaultBrushSize').value=brush;
  preferences.setBrush(brush);
  q('defaultBrushSize').onchange=()=>{const value=Number(q('defaultBrushSize').value);if(Number.isInteger(value)&&value>=1&&value<=160){brush=value;preferences.setBrush(value);persist();}else q('defaultBrushSize').value=brush;};
  q('settingsSmartSnap').onchange=()=>preferences.setSnap(q('settingsSmartSnap').checked);
  const tabs=Array.from(dialog.querySelectorAll('[data-settings-tab]'));
  function activateTab(tab,focus=false){for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;dialog.querySelector('#'+item.getAttribute('aria-controls')).hidden=!selected;}if(focus)tab.focus();}
  for(const tab of tabs){tab.onclick=()=>activateTab(tab);tab.onkeydown=event=>{let index=tabs.indexOf(tab);if(event.key==='ArrowRight')index=(index+1)%tabs.length;else if(event.key==='ArrowLeft')index=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else return;event.preventDefault();activateTab(tabs[index],true);};}
  function open(section='models'){backgroundModel?.refresh();activateTab(tabs.find(t=>t.dataset.settingsTab===section)||tabs[0]);q('settingsSmartSnap').checked=preferences.getSnap();refresh();if(!dialog.open)dialog.showModal();}
  return {open,refresh:()=>{refresh();backgroundModel?.refresh();},openForBackgroundInstall:()=>{open('models');const model=backgroundModel?.selectedModel();q((model?.prefix||'backgroundModel')+'Install').scrollIntoView?.({block:'nearest'});return backgroundModel?.install();},openForInstall:()=>{open('models');return install();},useGpu:()=>mode==='auto',isInstalling:()=>Boolean(installing)};
}
