import { clamp } from '../core/geometry.js';
import { readFileAsDataURL } from '../core/io.js';
import { ensureTextFont } from '../core/render.js';

export const TEXT_WEIGHT_OPTIONS = [['400', 'Обычный'], ['700', 'Жирный']];
export const TEXT_STYLE_OPTIONS = [['normal', 'Прямой'], ['italic', 'Курсив']];
export const TEXT_ALIGN_OPTIONS = [['left', 'Слева'], ['center', 'По центру'], ['right', 'Справа']];

const TEXT_SETTINGS_MAX_LOCAL_FONTS = 1000;
const TEXT_SETTINGS_MAX_CUSTOM_FONT_BYTES = 5_000_000;
const CUSTOM_FONT_FILE_ERROR = 'Выберите файл WOFF, WOFF2, TTF или OTF размером до 5 МБ';
const LOCAL_FONTS_UNAVAILABLE_ERROR = 'Этот браузер не показывает список шрифтов компьютера. Можно загрузить файл шрифта ниже.';
const LOCAL_FONTS_PERMISSION_ERROR = 'Браузер не разрешил доступ к шрифтам компьютера. Разрешите доступ или загрузите файл шрифта.';

export function createTextSettingsController({
  fontFamilyControl = null,
  fontSizeControl = null,
  primaryColorControl = null,
  windowTarget = globalThis.window,
  documentRef = globalThis.document,
  FileClass = globalThis.File,
  readFile = readFileAsDataURL,
  loadFont = ensureTextFont,
  createFontFamily = () => `ZPE-font-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
} = {}) {
  let discoveredFonts = [];
  const manualFonts = new Map();
  const customFontReads = new WeakMap();

  function localFontOptions() {
    const options = [];
    const seen = new Set();
    for (const source of [manualFonts, discoveredFonts]) {
      for (const [value, label] of source) {
        if (seen.has(value)) continue;
        seen.add(value);
        options.push([value, label]);
        if (options.length >= TEXT_SETTINGS_MAX_LOCAL_FONTS) return options;
      }
    }
    return options;
  }

  function fontOptions(value, label = '') {
    const options = [];
    const seen = new Set();
    const add = (font, name) => {
      if (!font || seen.has(font)) return;
      seen.add(font);
      options.push([font, name]);
    };
    for (const option of fontFamilyControl?.options ?? []) add(option.value, option.textContent);
    for (const [font, name] of localFontOptions()) add(font, name);
    if (value && !seen.has(value)) add(value, label ? `Свой: ${label}` : value.replace(/^"(.*)"$/, '$1'));
    return options;
  }

  function registerSystemFont(name) {
    const label = String(name || '').trim().slice(0, 120);
    if (!label) return '';
    const value = JSON.stringify(label);
    if (manualFonts.has(value)) manualFonts.delete(value);
    manualFonts.set(value, label);
    while (manualFonts.size > TEXT_SETTINGS_MAX_LOCAL_FONTS) {
      manualFonts.delete(manualFonts.keys().next().value);
    }
    return value;
  }

  async function loadComputerFonts(select) {
    const queryLocalFonts = windowTarget?.queryLocalFonts;
    if (typeof queryLocalFonts !== 'function') throw new Error(LOCAL_FONTS_UNAVAILABLE_ERROR);
    let faces;
    try {
      faces = await queryLocalFonts.call(windowTarget);
    } catch {
      throw new Error(LOCAL_FONTS_PERMISSION_ERROR);
    }
    const names = [...new Set(faces
      .map(face => face.family)
      .filter(name => typeof name === 'string' && name.trim() && name.length <= 160))];
    names.sort((a, b) => a.localeCompare(b, 'ru'));
    discoveredFonts = names.slice(0, TEXT_SETTINGS_MAX_LOCAL_FONTS).map(name => [JSON.stringify(name), name]);

    if (select) {
      const current = select.value;
      for (const [value, name] of localFontOptions()) {
        if ([...select.options].some(option => option.value === value)) continue;
        const option = documentRef.createElement('option');
        option.value = value;
        option.textContent = name;
        select.append(option);
      }
      select.value = current;
    }
    return discoveredFonts.length;
  }

  async function loadCustomFont(file) {
    const extension = file.name.toLowerCase().match(/\.(woff2?|ttf|otf)$/)?.[1];
    if (!extension || !file.size || file.size > TEXT_SETTINGS_MAX_CUSTOM_FONT_BYTES) {
      throw new Error(CUSTOM_FONT_FILE_ERROR);
    }
    const fontData = (await readFile(file)).replace(/^data:[^,]*,/, `data:font/${extension};base64,`);
    const fontFamily = createFontFamily();
    try {
      await loadFont(fontFamily, fontData);
    } catch {
      throw new Error('Не удалось открыть файл шрифта');
    }
    return { fontFamily, fontData, fontLabel: file.name.slice(0, 160) };
  }

  async function readCustomFont(file) {
    if (typeof FileClass !== 'function' || !(file instanceof FileClass) || !file.name) return null;
    if (customFontReads.has(file)) return customFontReads.get(file);
    const loading = loadCustomFont(file).catch(error => {
      customFontReads.delete(file);
      throw error;
    });
    customFontReads.set(file, loading);
    return loading;
  }

  function modalFields(layer, width) {
    const fontFamily = layer?.fontFamily || fontFamilyControl?.value;
    return [
      {name:'text',label:'Текст',type:'textarea',value:layer?.text || 'Текст'},
      {name:'fontFamily',label:'Шрифт',type:'select',value:fontFamily,options:fontOptions(fontFamily, layer?.fontLabel)},
      {name:'computerFonts',label:'Шрифты ПК',type:'fontPicker'},
      {name:'systemFontName',label:'Или имя шрифта ПК',type:'text',value:'',placeholder:'Например, Segoe UI'},
      {name:'fontFile',label:'Свой шрифт',type:'file',accept:'.woff,.woff2,.ttf,.otf'},
      {name:'fontSize',label:'Размер, px',type:'number',value:layer?.fontSize || fontSizeControl?.value,min:'6',max:'500'},
      {name:'fontWeight',label:'Начертание',type:'select',value:layer?.fontWeight || '400',options:TEXT_WEIGHT_OPTIONS},
      {name:'fontStyle',label:'Стиль',type:'select',value:layer?.fontStyle || 'normal',options:TEXT_STYLE_OPTIONS},
      {name:'align',label:'Выравнивание',type:'select',value:layer?.align || 'left',options:TEXT_ALIGN_OPTIONS},
      {name:'lineHeight',label:'Межстрочный',type:'number',value:layer?.lineHeight ?? 1.18,min:'0.8',max:'3',step:'0.01'},
      {name:'letterSpacing',label:'Межбуквенный, px',type:'number',value:layer?.letterSpacing ?? 0,min:'-5',max:'20',step:'0.5'},
      {name:'underline',label:'Подчёркивание',type:'select',value:layer?.underline ? 'yes' : 'no',options:[['no','Нет'],['yes','Да']]},
      {name:'strikeThrough',label:'Зачёркивание',type:'select',value:layer?.strikeThrough ? 'yes' : 'no',options:[['no','Нет'],['yes','Да']]},
      {name:'width',label:'Ширина блока, px',type:'number',value:width,min:'1',max:'12000'},
      {name:'color',label:'Цвет',type:'color',value:layer?.color || primaryColorControl?.value},
    ];
  }

  async function settingsFromForm(values, layer = null) {
    const custom = await readCustomFont(values.fontFile);
    const systemName = String(values.systemFontName || '').trim().slice(0, 120);
    const systemFont = !custom && systemName ? registerSystemFont(systemName) : '';
    const fontFamily = custom?.fontFamily || systemFont || values.fontFamily;
    return {
      text:values.text || 'Текст',
      fontFamily,
      fontData:custom?.fontData || (fontFamily === layer?.fontFamily ? layer.fontData : null),
      fontLabel:custom?.fontLabel || (fontFamily === layer?.fontFamily ? layer.fontLabel : ''),
      fontSize:clamp(Number(values.fontSize) || 48, 6, 500),
      fontWeight:TEXT_WEIGHT_OPTIONS.some(([option]) => option === values.fontWeight) ? values.fontWeight : '400',
      fontStyle:values.fontStyle === 'italic' ? 'italic' : 'normal',
      align:TEXT_ALIGN_OPTIONS.some(([option]) => option === values.align) ? values.align : 'left',
      lineHeight:clamp(Number(values.lineHeight) || 1.18, 0.8, 3),
      letterSpacing:clamp(Number(values.letterSpacing) || 0, -5, 20),
      underline:values.underline === 'yes',
      strikeThrough:values.strikeThrough === 'yes',
      width:clamp(Number(values.width) || layer?.width || 240, 1, 12000),
      color:values.color || layer?.color || primaryColorControl?.value,
    };
  }

  return {
    fontOptions,
    loadComputerFonts,
    registerSystemFont,
    readCustomFont,
    modalFields,
    settingsFromForm,
    isWeight: value => TEXT_WEIGHT_OPTIONS.some(([option]) => option === value),
    isStyle: value => TEXT_STYLE_OPTIONS.some(([option]) => option === value),
    isAlign: value => TEXT_ALIGN_OPTIONS.some(([option]) => option === value),
  };
}
