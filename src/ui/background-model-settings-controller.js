// Each model owns its installation state; selection belongs to the model catalog.
export function createBackgroundModelSettings({dialog,engine,setStatus=()=>{},onModelState=()=>{},choices=[]}={}) {
  const models=engine.models||[{id:'slimsam',name:'SlimSAM',size:39,prefix:'backgroundModel'}];
  const selectedModel=()=>engine.selectedModel?.()||models[0];
  const controls=[dialog.querySelector('#backgroundModelChoice'),...choices].filter(Boolean);
  const cards=models.map(model=>({model,runtime:engine.getEngine?.(model.id)||engine,q:id=>dialog.querySelector('#'+model.prefix+id),checking:true,installation:null,deleting:false,checked:null}));
  function refresh(){
    const selected=selectedModel();
    for(const choice of controls)choice.value=selected.id;
    for(const card of cards){
      const {model,runtime,q,checking,installation,deleting}=card;
      const ready=runtime.isReady(),busy=checking||Boolean(installation)||deleting||runtime.isBusy();
      q('Description').textContent=`${model.description||'Определяет границы объекта по примерным штрихам кисти.'} ${ready?'Установлена; фото обрабатывается на устройстве.':`Установите эту модель — около ${model.size} МБ. Фото не отправляется в интернет.`}`;
      q('Install').hidden=ready;q('Install').disabled=busy;q('Remove').disabled=busy;
      q('Remove').textContent=deleting?'Удаление…':'Удалить модель';q('Cancel').hidden=!installation;
      q('Status').textContent=checking?'Проверка кэша этой модели…':deleting?'Удаление файлов этой модели…':installation?'Загрузка и проверка этой модели…':ready?(runtime.isStored()?'Готова · сохранена в этом браузере':'Готова для этой страницы · после закрытия может понадобиться загрузка'):'Не установлена';
      q('Title')?.closest?.('.settings-model')?.classList.toggle('settings-model-selected',model.id===selected.id);
    }
    onModelState(engine.isReady(),selected);
  }
  function select(id){if(!models.some(model=>model.id===id))return false;if(engine.select)engine.select(id);refresh();return true;}
  async function install(id=selectedModel().id){
    const card=cards.find(item=>item.model.id===id);if(!card)return;
    await card.checked;
    const {runtime,q,model}=card;
    if(card.installation||card.deleting||runtime.isBusy()||runtime.isReady())return;
    const controller=new AbortController();card.installation=controller;refresh();
    q('Progress').hidden=false;q('Progress').value=0;q('ProgressText').textContent='Подключение…';
    try{
      await runtime.prepare({signal:controller.signal,onProgress:({percent,loaded,total})=>{
        q('Progress').value=percent;q('ProgressText').textContent=`${percent}% · ${(loaded/1024/1024).toFixed(1)} из ${(total/1024/1024).toFixed(1)} МБ`;
      }});
      q('Progress').value=100;q('ProgressText').textContent=`${model.name} готова. Отметьте объект кистью и нажмите «Удалить фон».`;setStatus(`${model.name}: модель удаления фона готова`);
    }catch(error){q('ProgressText').textContent=controller.signal.aborted?'Установка отменена. Можно повторить позже.':`Не удалось установить: ${error.message}`;}
    finally{card.installation=null;refresh();}
  }
  async function remove(card){
    await card.checked;if(card.installation||card.deleting||card.runtime.isBusy())return;
    card.deleting=true;refresh();
    try{await card.runtime.remove();card.q('Progress').hidden=true;card.q('Progress').value=0;card.q('ProgressText').textContent=`${card.model.name} удалена. Фото, проекты и другие модели сохранены.`;setStatus(card.q('ProgressText').textContent);}
    catch(error){card.q('ProgressText').textContent=`Не удалось удалить: ${error.message}`;}
    finally{card.deleting=false;refresh();}
  }
  for(const card of cards){
    card.checked=card.runtime.prepare({cachedOnly:true}).catch(()=>null).finally(()=>{card.checking=false;refresh();});
    card.q('Install').onclick=()=>install(card.model.id);card.q('Cancel').onclick=()=>card.installation?.abort();card.q('Remove').onclick=()=>remove(card);
  }
  for(const choice of controls)choice.onchange=()=>select(choice.value);
  return {install,refresh,select,selectedModel};
}
