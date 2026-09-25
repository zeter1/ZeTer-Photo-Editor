// Static editor configuration.
// Keep this module free of DOM access and mutable application state so both humans
// and AI agents can find UI/tool policy without scanning the composition root.

export const TOOL_LABELS = {
  move:'Перемещение', marquee:'Выделение', brush:'Кисть', clone:'Штамп',
  heal:'Лечебная кисть', smudge:'Палец / смазывание', dodge:'Осветлитель',
  burn:'Затемнитель', blur:'Кисть размытия', eraser:'Ластик', fill:'Заливка',
  gradient:'Градиент', pen:'Перо / контуры', magnetic:'Магнитное лассо',
  wand:'Волшебная палочка', line:'Линия', text:'Текст', shape:'Фигура',
  crop:'Кадрирование', eyedropper:'Пипетка', hand:'Рука', zoom:'Лупа',
};

export const TOOL_HELP = {
  move:{shortcut:'V',description:'Выбирает и перемещает слои. Тяните рамку для масштаба, круглый маркер — для поворота; Shift ограничивает направление.'},
  marquee:{shortcut:'M / Shift+M',description:'Создаёт прямоугольное, эллиптическое, свободное или многоугольное выделение. Ограничивает рисование и копирование выбранной областью.'},
  brush:{shortcut:'B',description:'Рисует основным цветом на растровом слое. Размер меняется клавишами [ и ], давление пера поддерживается.'},
  clone:{shortcut:'S',description:'Копирует пиксели из одной части изображения в другую. Сначала задайте источник через Alt+клик, затем рисуйте.'},
  heal:{shortcut:'J',description:'Мягко переносит фактуру с выбранного участка для ретуши дефектов. Источник задаётся через Alt+клик.'},
  smudge:{shortcut:'N',description:'Размазывает существующие пиксели по направлению движения кисти. Силу эффекта задаёт отдельный ползунок сверху.'},
  dodge:{shortcut:'O',description:'Осветляет существующие пиксели. Ползунок «Сила осветления» задаёт эффект одного штриха; повторные штрихи усиливают его.'},
  burn:{shortcut:'Shift+O',description:'Затемняет существующие пиксели. Ползунок «Сила затемнения» задаёт эффект одного штриха; повторные штрихи усиливают его.'},
  blur:{shortcut:'R',description:'Локально смягчает детали растрового слоя. Размер задаёт область, а «Сила размытия» — интенсивность одного штриха в процентах.'},
  eraser:{shortcut:'E',description:'Удаляет пиксели с существующего растрового слоя до прозрачности. Активное выделение ограничивает стирание.'},
  fill:{shortcut:'G',description:'Заливает связанную область основным цветом. Ползунок «Допуск» определяет, насколько близкие оттенки захватывать.'},
  gradient:{shortcut:'Shift+G',description:'Создаёт линейный или радиальный переход между двумя цветами на новом слое. Протяните линию по холсту.'},
  pen:{shortcut:'P',description:'Строит редактируемый векторный контур по опорным точкам. Enter или двойной щелчок завершает путь.'},
  magnetic:{shortcut:'A',description:'Создаёт выделение, притягивая поставленные точки к заметным границам изображения. Enter завершает контур.'},
  wand:{shortcut:'W',description:'Одним щелчком выделяет связанную область похожего цвета. Чувствительность регулируется ползунком «Допуск».'},
  line:{shortcut:'L',description:'Рисует линию на текущем растровом слое. Если его нет, создаёт один слой «Линии»; Shift привязывает угол к шагу 45°.'},
  text:{shortcut:'T',description:'Добавляет новый текст или открывает существующий текстовый слой для редактирования.'},
  shape:{shortcut:'U',description:'Создаёт прямоугольник или эллипс на отдельном редактируемом слое. Shift создаёт квадрат или круг.'},
  crop:{shortcut:'C',description:'Обрезает документ по протянутой рамке. Содержимое и размеры холста обновляются одной операцией истории.'},
  eyedropper:{shortcut:'I',description:'Берёт цвет видимого пикселя с холста и делает его основным цветом рисования.'},
  hand:{shortcut:'H / Space',description:'Перемещает область просмотра без изменения слоёв. Пробел временно включает руку из любого инструмента.'},
  zoom:{shortcut:'Z',description:'Увеличивает изображение относительно точки щелчка. Alt+клик уменьшает масштаб.'},
};

export const RASTER_BRUSH_TOOLS = new Set(['brush','clone','heal','smudge','dodge','burn','blur','eraser']);

export const SELECTION_TYPE_LABELS = {
  rect:'Прямоугольное выделение',
  ellipse:'Эллиптическое выделение',
  lasso:'Свободное лассо',
  polygon:'Многоугольное лассо',
};
export const SELECTION_TYPES = Object.keys(SELECTION_TYPE_LABELS);

export const MIME_EXT = {
  'image/png':'png',
  'image/jpeg':'jpg',
  'image/webp':'webp',
  'image/vnd.adobe.photoshop':'psd',
};

export const COLOR_CORRECTION_CONTROLS = [
  { key:'exposure', label:'Экспозиция', min:-2, max:2, step:.05, unit:' EV', group:'Свет' },
  { key:'brightness', label:'Яркость', min:0, max:200, step:1, unit:'%', group:'Свет' },
  { key:'contrast', label:'Контраст', min:0, max:200, step:1, unit:'%', group:'Свет' },
  { key:'highlights', label:'Светлые области', min:-100, max:100, step:1, unit:'', group:'Свет' },
  { key:'shadows', label:'Тени', min:-100, max:100, step:1, unit:'', group:'Свет' },
  { key:'temperature', label:'Температура', min:-100, max:100, step:1, unit:'', group:'Цвет' },
  { key:'tint', label:'Оттенок', min:-100, max:100, step:1, unit:'', group:'Цвет' },
  { key:'saturate', label:'Насыщенность', min:0, max:200, step:1, unit:'%', group:'Цвет' },
  { key:'vibrance', label:'Красочность', min:-100, max:100, step:1, unit:'', group:'Цвет' },
  { key:'hue', label:'Тон', min:-180, max:180, step:1, unit:'°', group:'Цвет' },
  { key:'gamma', label:'Гамма', min:.2, max:3, step:.05, unit:'', group:'Тональный диапазон' },
];
export const COLOR_CORRECTION_KEYS = new Set(COLOR_CORRECTION_CONTROLS.map(item => item.key));

export const BASIC_EFFECT_CONTROLS = [
  { key:'brightness', label:'Яркость', min:0, max:200, step:1, group:'Цвет и эффекты' },
  { key:'contrast', label:'Контраст', min:0, max:200, step:1, group:'Цвет и эффекты' },
  { key:'saturate', label:'Насыщенность', min:0, max:200, step:1, group:'Цвет и эффекты' },
  { key:'hue', label:'Тон', min:-180, max:180, step:1, group:'Цвет и эффекты' },
  { key:'blur', label:'Размытие', min:0, max:30, step:1, group:'Эффекты' },
];

export const RASTER_EFFECT_CONTROLS = [
  ...COLOR_CORRECTION_CONTROLS,
  { key:'blur', label:'Размытие', min:0, max:30, step:1, unit:' px', group:'Эффекты' },
];

export const UI_COLLAPSE_STORAGE_KEY = 'zeter-photo-editor.ui-collapse.v1';
export const SMART_SNAP_STORAGE_KEY = 'zeter-photo-editor.smart-snap.v1';
export const TOOL_ORDER_STORAGE_KEY = 'zeter-photo-editor.tool-order.v1';

export const NATIVE_HIGH_DEPTH_PAINT_TOOLS = new Set(['brush','eraser','blur','clone','heal','smudge','dodge','burn']);
export const NATIVE_CMYK_PAINT_TOOLS = new Set(['brush','eraser','blur','clone','heal','smudge','dodge','burn']);
