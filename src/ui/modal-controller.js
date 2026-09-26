import { clamp } from '../core/geometry.js';

export function normalizeNumberInput(input) {
  const min=input.min==='' ? -Infinity : Number(input.min);
  const max=input.max==='' ? Infinity : Number(input.max);
  let value=input.valueAsNumber;
  if(!Number.isFinite(value))value=Number(input.dataset.initialValue);
  if(!Number.isFinite(value))value=Number.isFinite(min) ? min : 0;
  value=clamp(value,min,max);
  const step=input.step==='' ? 1 : Number(input.step);
  if(input.step!=='any' && Number.isFinite(step) && step>0){
    const base=Number.isFinite(min) ? min : 0;
    const lowest=Number.isFinite(min) ? Math.ceil((min-base)/step) : -Infinity;
    const highest=Number.isFinite(max) ? Math.floor((max-base)/step) : Infinity;
    const index=clamp(Math.round(Number(((value-base)/step).toFixed(10))),lowest,highest);
    value=Number((base+index*step).toFixed(10));
  }
  input.value=String(value);
}

export function makeModalDraggable(modal, {
  windowTarget=globalThis.window,
  ResizeObserverClass=globalThis.ResizeObserver,
} = {}) {
  const margin=12;
  modal.style.left=`${Math.max(margin,Math.round((windowTarget.innerWidth-modal.offsetWidth)/2))}px`;
  modal.style.top=`${Math.max(margin,Math.round((windowTarget.innerHeight-modal.offsetHeight)/2))}px`;
  const header=modal.querySelector('header');
  const keepVisible=()=>{
    if(!modal.isConnected)return;
    modal.style.left=`${clamp(modal.offsetLeft,margin,Math.max(margin,windowTarget.innerWidth-modal.offsetWidth-margin))}px`;
    modal.style.top=`${clamp(modal.offsetTop,margin,Math.max(margin,windowTarget.innerHeight-modal.offsetHeight-margin))}px`;
  };
  const observer=typeof ResizeObserverClass==='function' ? new ResizeObserverClass(keepVisible) : null;
  observer?.observe(modal);
  windowTarget.addEventListener('resize',keepVisible);
  const priorCleanup=modal.previewCleanup;
  modal.previewCleanup=()=>{priorCleanup?.();observer?.disconnect();windowTarget.removeEventListener('resize',keepVisible);};
  let drag=null;
  header.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const bounds=modal.getBoundingClientRect();
    drag={id:event.pointerId,offsetX:event.clientX-bounds.left,offsetY:event.clientY-bounds.top};
    header.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  header.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const maxX=Math.max(margin,windowTarget.innerWidth-modal.offsetWidth-margin);
    const maxY=Math.max(margin,windowTarget.innerHeight-modal.offsetHeight-margin);
    modal.style.left=`${clamp(event.clientX-drag.offsetX,margin,maxX)}px`;
    modal.style.top=`${clamp(event.clientY-drag.offsetY,margin,maxY)}px`;
  });
  const finish=event=>{if(drag?.id===event.pointerId)drag=null;};
  header.addEventListener('pointerup',finish);
  header.addEventListener('pointercancel',finish);
}

export function createModalController({
  modalRoot,
  escapeHtml,
  setStatus=()=>{},
  toast=()=>{},
  loadComputerFonts=null,
  documentTarget=globalThis.document,
  windowTarget=globalThis.window,
  ResizeObserverClass=globalThis.ResizeObserver,
  HTMLElementClass=globalThis.HTMLElement,
  FormDataClass=globalThis.FormData,
} = {}) {
  if(!modalRoot)throw new Error('Modal controller requires a modal root');
  if(typeof escapeHtml!=='function')throw new Error('Modal controller requires escapeHtml');

  const restoreFocus=previousFocus=>{
    if(HTMLElementClass && previousFocus instanceof HTMLElementClass)previousFocus.focus();
  };

  function showModal({title,className='',fields=[],submitLabel='OK',onSubmit,onMount=null,onClose=null}) {
    const previousFocus=documentTarget.activeElement;
    const back=documentTarget.createElement('div'); back.className='modal-backdrop';
    const modal=documentTarget.createElement('form'); modal.className=`modal ${className}`;modal.noValidate=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',title);
    modal.innerHTML=`<header>${escapeHtml(title)}</header><div class="modal-body"></div><footer><button type="button" class="secondary-button" data-cancel>Отмена</button><button type="submit" class="primary-button">${escapeHtml(submitLabel)}</button></footer>`;
    const body=modal.querySelector('.modal-body');
    for(const field of fields){
      const row=documentTarget.createElement(field.type==='fontPicker'?'div':'label');row.className='modal-row';
      const label=documentTarget.createElement('span');label.textContent=field.label;
      let input;
      if(field.type==='fontPicker'){
        input=documentTarget.createElement('button');input.type='button';input.className='secondary-button';input.textContent='Показать список';
        input.addEventListener('click',async()=>{
          input.disabled=true;
          try{
            if(typeof loadComputerFonts!=='function')throw new Error('Загрузка системных шрифтов недоступна');
            const count=await loadComputerFonts(modal.elements.fontFamily);
            setStatus(`Доступно шрифтов компьютера: ${count}`);
          }catch(error){
            toast(error.message,'warn');setStatus(error.message);
          }finally{input.disabled=false;}
        });
      }else if(field.type==='textarea'){
        input=documentTarget.createElement('textarea');input.value=field.value??'';
      }else if(field.type==='select'){
        input=documentTarget.createElement('select');
        for(const [value,text] of field.options){
          const option=documentTarget.createElement('option');option.value=value;option.textContent=text;input.append(option);
        }
        input.value=field.value??'';
      }else{
        input=documentTarget.createElement('input');input.type=field.type||'text';
        if(field.type!=='file')input.value=field.value??'';
        if(field.accept)input.accept=field.accept;
        if(field.placeholder)input.placeholder=field.placeholder;
        if(field.min!=null)input.min=field.min;
        if(field.max!=null)input.max=field.max;
        if(field.step!=null)input.step=field.step;
      }
      if(field.type!=='fontPicker')input.name=field.name;
      if(field.required)input.required=true;
      if(field.type==='number')input.dataset.initialValue=input.value;
      if(field.type==='color'){
        const syncColor=()=>{input.style.backgroundColor=input.value;input.title=input.value.toUpperCase();};
        input.addEventListener('input',syncColor);
        input.addEventListener('change',syncColor);
        syncColor();
      }
      row.append(label,input);body.append(row);
    }

    let closed=false;
    const close=()=>{
      if(closed)return;
      closed=true;
      modal.previewCleanup?.();
      onClose?.({modal});
      modalRoot.replaceChildren();
      restoreFocus(previousFocus);
    };

    back.append(modal);modalRoot.replaceChildren(back);
    try{onMount?.({modal,body,back,close});}
    catch(error){console.error(error);toast(error?.message||'Ошибка предпросмотра','error');}

    modal.addEventListener('change',event=>{
      if(event.target.matches('input[type="number"]'))normalizeNumberInput(event.target);
    });
    if(className==='text-modal'){
      back.classList.add('text-modal-backdrop');
      makeModalDraggable(modal,{windowTarget,ResizeObserverClass});
    }
    modal.querySelector('[data-cancel]').onclick=close;
    back.addEventListener('mousedown',event=>{if(event.target===back)close();});
    modal.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    });
    modal.addEventListener('submit',async event=>{
      event.preventDefault();
      modal.querySelectorAll('input[type="number"]').forEach(normalizeNumberInput);
      if(!modal.checkValidity()){modal.reportValidity();return;}
      const submit=modal.querySelector('button[type="submit"]');
      const data=Object.fromEntries(new FormDataClass(modal));
      submit.disabled=true;
      try{
        const result=await onSubmit?.(data,()=>!closed&&modal.isConnected);
        if(result!==false)close();else submit.disabled=false;
      }catch(error){
        console.error(error);submit.disabled=false;toast(error?.message||'Ошибка команды','error');setStatus(error?.message||'Ошибка команды');
      }
    });
    modal.querySelector('input,textarea,select')?.focus();
  }

  function showInfoModal(title, html) {
    const previousFocus=documentTarget.activeElement;
    const back=documentTarget.createElement('div');back.className='modal-backdrop';
    const modal=documentTarget.createElement('div');modal.className='modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',title);
    modal.innerHTML=`<header>${escapeHtml(title)}</header><div class="modal-body info-modal">${html}</div><footer><button type="button" class="primary-button" data-close>Закрыть</button></footer>`;
    back.append(modal);modalRoot.replaceChildren(back);
    const close=()=>{modalRoot.replaceChildren();restoreFocus(previousFocus);};
    modal.querySelector('[data-close]').onclick=close;
    back.addEventListener('mousedown',event=>{if(event.target===back)close();});
    modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
    modal.querySelector('[data-close]').focus();
  }

  function showRecoveryModal(record, { canRestore = true, canDiscard = false } = {}) {
    return new Promise(resolve => {
      const back=documentTarget.createElement('div');back.className='modal-backdrop';
      const modal=documentTarget.createElement('div');modal.className='modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Восстановление проекта');
      const savedAt=new Date(record.savedAt);
      const time=Number.isNaN(savedAt.getTime())?'неизвестно':savedAt.toLocaleString('ru-RU');
      const names=record.documents.map(item=>escapeHtml(item.docName)).join(', ');
      modal.innerHTML=`<header>Восстановление проекта</header><div class="modal-body info-modal"><p>Найдены автоматически сохранённые документы: <b>${names}</b>.</p><p>Последняя копия: ${escapeHtml(time)}.</p><p class="muted">Копия может относиться к другому открытому окну редактора. «Позже» оставит её в хранилище. ${canRestore?'Восстановленные документы останутся несохранёнными до подтверждения файла на диске.':'Копия повреждена и не может быть открыта.'}</p></div><footer>${canDiscard?'<button type="button" class="danger-button" data-discard>Удалить копию</button>':''}<button type="button" data-later>Позже</button>${canRestore?'<button type="button" class="primary-button" data-restore>Восстановить</button>':''}</footer>`;
      back.append(modal);modalRoot.replaceChildren(back);
      const close=action=>{modalRoot.replaceChildren();resolve(action);};
      if(canDiscard)modal.querySelector('[data-discard]').onclick=()=>close('discard');
      modal.querySelector('[data-later]').onclick=()=>close('later');
      if(canRestore)modal.querySelector('[data-restore]').onclick=()=>close('restore');
      modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close('later');}});
      modal.querySelector(canRestore?'[data-restore]':'[data-later]').focus();
    });
  }

  return { showModal, showInfoModal, showRecoveryModal };
}
