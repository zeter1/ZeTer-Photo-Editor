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

export function createRapidDoubleClickTracker({ thresholdMs = 360 } = {}) {
  const threshold = Math.min(1000, Math.max(100, Number(thresholdMs) || 360));
  let previousKey = '';
  let previousAt = -Infinity;

  return {
    register(key, at = Date.now()) {
      const nextKey = String(key ?? '');
      const nextAt = Number(at);
      if (!nextKey || !Number.isFinite(nextAt)) {
        previousKey = '';
        previousAt = -Infinity;
        return false;
      }
      const matched = nextKey === previousKey && nextAt >= previousAt && nextAt - previousAt <= threshold;
      previousKey = matched ? '' : nextKey;
      previousAt = matched ? -Infinity : nextAt;
      return matched;
    },
    reset() {
      previousKey = '';
      previousAt = -Infinity;
    },
  };
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

  function showRecoveryModal(entriesOrRecord, {
    canRestore = true,
    canDiscard = false,
    onLoadProject = null,
  } = {}) {
    return new Promise(resolve => {
      const previousFocus = documentTarget.activeElement;
      const sourceEntries = Array.isArray(entriesOrRecord)
        ? entriesOrRecord
        : [{ key:'latest', record:entriesOrRecord, canRestore, canDiscard, isCurrent:true, invalidCount:0 }];
      const entries = sourceEntries.map((entry, index) => ({
        key: String(entry?.key || `recovery-${index}`),
        record: entry?.record || null,
        canRestore: entry?.canRestore !== false && Boolean(entry?.record),
        canDiscard: entry?.canDiscard === true,
        canRename: entry?.canRename !== false && Boolean(entry?.record?.documents?.length),
        isCurrent: entry?.isCurrent === true,
        invalidCount: Math.max(0, Number(entry?.invalidCount) || 0),
      }));

      const back = documentTarget.createElement('div'); back.className = 'modal-backdrop';
      const modal = documentTarget.createElement('div'); modal.className = 'modal recovery-modal';
      modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'recovery-modal-title');

      const header = documentTarget.createElement('header'); header.id = 'recovery-modal-title'; header.textContent = 'Восстановление проектов';
      const body = documentTarget.createElement('div'); body.className = 'modal-body recovery-modal-body';
      const intro = documentTarget.createElement('p'); intro.className = 'recovery-intro'; intro.tabIndex = -1;
      intro.textContent = 'Найдены автосохранённые проекты на этом устройстве. Выберите проект для восстановления или начните другую работу.';
      body.append(intro);

      const list = documentTarget.createElement('div'); list.className = 'recovery-project-list'; list.setAttribute('role', 'list');
      const rows = [];
      const rapidDoubleClick = createRapidDoubleClickTracker();
      function entryTitle(entry) {
        const docs = entry.record?.documents || [];
        return docs[entry.record?.activeIndex]?.docName || docs[0]?.docName || 'Повреждённая автокопия';
      }
      function formatSavedAt(entry) {
        const value = new Date(entry.record?.savedAt);
        return Number.isNaN(value.getTime()) ? 'Время сохранения неизвестно' : `Сохранено: ${value.toLocaleString('ru-RU')}`;
      }

      const defaultIndex = entries.findIndex(item => item.canRestore);
      entries.forEach((entry, index) => {
        const row = documentTarget.createElement('label'); row.className = 'recovery-project'; row.setAttribute('role', 'listitem');
        const radio = documentTarget.createElement('input'); radio.type = 'radio'; radio.name = 'recovery-project';
        radio.checked = index === (defaultIndex >= 0 ? defaultIndex : 0);
        const content = documentTarget.createElement('span'); content.className = 'recovery-project-content';
        const title = documentTarget.createElement('strong'); title.className = 'recovery-project-title'; title.textContent = entryTitle(entry);
        const meta = documentTarget.createElement('span'); meta.className = 'recovery-project-meta';
        const docCount = entry.record?.documents?.length || 0; meta.textContent = `${formatSavedAt(entry)} · Документов: ${docCount}`;
        const names = documentTarget.createElement('span'); names.className = 'recovery-project-documents';
        const docNames = (entry.record?.documents || []).map(item => item.docName).filter(Boolean);
        names.textContent = docNames.length ? docNames.slice(0, 4).join(' · ') + (docNames.length > 4 ? ` · +${docNames.length - 4}` : '') : 'Содержимое автокопии повреждено или имеет неподдерживаемый формат.';
        content.append(title, meta, names);
        const badges = documentTarget.createElement('span'); badges.className = 'recovery-project-badges';
        const ownership = documentTarget.createElement('span'); ownership.className = 'recovery-badge'; ownership.textContent = entry.isCurrent ? 'Это окно' : 'Другое окно'; badges.append(ownership);
        if (!entry.canRestore || entry.invalidCount > 0) {
          const warning = documentTarget.createElement('span'); warning.className = 'recovery-badge warning';
          warning.textContent = entry.canRestore ? `Повреждено: ${entry.invalidCount}` : 'Повреждена'; badges.append(warning);
        }
        row.append(radio, content, badges);
        row.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          radio.checked = true;
          syncSelection();
          if (!entry.canRestore) {
            rapidDoubleClick.reset();
            return;
          }
          if (!rapidDoubleClick.register(entry.key, Date.now())) return;
          event.preventDefault();
          event.stopPropagation();
          close({ action:'restore', key:entry.key, trigger:'primary-double-click' });
        });
        list.append(row); rows.push({ row, radio, entry });
      });
      body.append(list);

      const footer = documentTarget.createElement('footer'); footer.className = 'recovery-footer';
      const startActions = documentTarget.createElement('div'); startActions.className = 'recovery-footer-start';
      const endActions = documentTarget.createElement('div'); endActions.className = 'recovery-footer-end';
      const makeButton = (textValue, className, attribute) => {
        const button = documentTarget.createElement('button'); button.type = 'button'; button.className = className; button.textContent = textValue; button.setAttribute(attribute, ''); return button;
      };
      const loadButton = makeButton('Загрузить проект', 'secondary-button', 'data-load-project');
      const newButton = makeButton('Начать новый проект', 'secondary-button', 'data-new-project');
      const renameButton = makeButton('Переименовать проект', 'secondary-button', 'data-rename');
      const deleteButton = makeButton('Удалить проект', 'danger-button', 'data-discard');
      const restoreButton = makeButton('Восстановить выбранный', 'primary-button', 'data-restore');
      startActions.append(loadButton, newButton, renameButton); endActions.append(deleteButton, restoreButton); footer.append(startActions, endActions);
      modal.append(header, body, footer); back.append(modal); modalRoot.replaceChildren(back);

      let closed = false;
      const selectedRow = () => rows.find(item => item.radio.checked) || rows[0] || null;
      const close = result => { if (closed) return; closed = true; modalRoot.replaceChildren(); restoreFocus(previousFocus); resolve(result); };
      const syncSelection = () => {
        const selected = selectedRow();
        rows.forEach(item => item.row.classList.toggle('selected', item === selected));
        restoreButton.disabled = !selected?.entry.canRestore;
        renameButton.disabled = !selected?.entry.canRename;
        deleteButton.disabled = !selected?.entry.canDiscard;
      };
      rows.forEach(item => item.radio.addEventListener('change', syncSelection));
      loadButton.addEventListener('click', () => { onLoadProject?.(); close({ action:'load-project', key:selectedRow()?.entry.key || '' }); });
      newButton.addEventListener('click', () => close({ action:'new-project', key:selectedRow()?.entry.key || '' }));
      renameButton.addEventListener('click', () => {
        const selected = selectedRow();
        if (!selected?.entry.canRename || typeof windowTarget.prompt !== 'function') return;
        const proposed = windowTarget.prompt('Новое название проекта', entryTitle(selected.entry));
        if (proposed === null) return;
        const name = String(proposed).trim().slice(0, 240);
        if (!name) {
          toast('Название проекта не может быть пустым', 'warn');
          return;
        }
        close({ action:'rename', key:selected.entry.key, name });
      });
      restoreButton.addEventListener('click', () => { const selected = selectedRow(); if (selected?.entry.canRestore) close({ action:'restore', key:selected.entry.key }); });
      deleteButton.addEventListener('click', () => {
        const selected = selectedRow(); if (!selected?.entry.canDiscard) return;
        const confirmed = typeof windowTarget.confirm === 'function' ? windowTarget.confirm(`Удалить автосохранённый проект «${entryTitle(selected.entry)}»? Отменить это действие нельзя.`) : false;
        if (confirmed) close({ action:'discard', key:selected.entry.key, confirmed:true });
      });
      modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return; }
        if (event.key !== 'Tab') return;
        const tabbable = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')];
        if (!tabbable.length) { event.preventDefault(); return; }
        const first = tabbable[0], last = tabbable[tabbable.length - 1];
        if (event.shiftKey && (!tabbable.includes(documentTarget.activeElement) || documentTarget.activeElement === first)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && documentTarget.activeElement === last) { event.preventDefault(); first.focus(); }
      });
      syncSelection(); intro.focus();
    });
  }

  return { showModal, showInfoModal, showRecoveryModal };
}
