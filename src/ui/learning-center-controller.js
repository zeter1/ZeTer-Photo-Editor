export const LEARNING_CENTER_STORAGE_KEY = 'zeter-photo-editor.learning-center.v1';

export const LEARNING_LESSONS = Object.freeze([
  {
    id: 'start',
    level: 'База',
    title: 'Навигация и безопасный старт',
    minutes: 12,
    summary: 'Научитесь уверенно открывать материалы, двигаться по холсту, менять масштаб, пользоваться историей и различать проект от финального экспорта.',
    skills: [
      'Открытие изображений, PSD/PSB и проекта .zpe без потери исходника.',
      'Навигация: Рука, масштаб под курсором, Вписать в окно, 100% и режим холста.',
      'Undo/Redo, вкладки документов и безопасное сохранение редактируемого проекта.',
    ],
    practice: [
      'Откройте фотографию через Ctrl+O, затем приблизьте мелкую деталь колесом с Ctrl или Alt.',
      'Переместитесь по холсту через Space+drag, вернитесь к «Вписать в окно» и затем к 100%.',
      'Сделайте любое обратимое изменение, выполните Undo и Redo и убедитесь, что понимаете, какое состояние активно.',
      'Сохраните редактируемую версию через Ctrl+S как .zpe, а затем откройте экспорт через Ctrl+Shift+S.',
    ],
    mastery: [
      'Вы перемещаетесь и масштабируете холст без поиска кнопок.',
      'Вы не путаете сохранение проекта .zpe с экспортом готового изображения.',
      'Вы умеете вернуться к предыдущему состоянию через историю, не разрушая документ.',
    ],
    mistakes: [
      'Редактировать единственный экспортированный файл вместо сохранения рабочего .zpe.',
      'Пытаться двигать слой инструментом Рука: Рука двигает viewport, а V — слой.',
    ],
    shortcuts: [['Ctrl+O','Открыть'],['Space','Рука'],['0 / 1','Вписать / 100%'],['Ctrl+Z / Ctrl+Y','Undo / Redo'],['Ctrl+S','Проект .zpe']],
    challenge: 'Челлендж: за 60 секунд откройте изображение, увеличьте конкретную деталь, вернитесь к общему виду, сделайте одно изменение, отмените его и сохраните проект.',
  },
  {
    id: 'layers',
    level: 'База',
    title: 'Слои — фундамент неразрушающей работы',
    minutes: 18,
    summary: 'Освойте слой как отдельный объект: создавайте, дублируйте, группируйте, блокируйте и меняйте порядок вместо правки всего изображения «в один слой».',
    skills: [
      'Растровые и корректирующие слои, группы, переименование и дублирование.',
      'Порядок слоёв, видимость, блокировка, непрозрачность и режимы наложения.',
      'Привычка разделять исходник, ретушь, цвет и текст по разным слоям.',
    ],
    practice: [
      'Создайте новый растровый слой Ctrl+Shift+N, назовите его F2 и продублируйте Ctrl+J.',
      'Поменяйте порядок двух слоёв кнопками «Выше/Ниже» и перетаскиванием в панели.',
      'Создайте группу, поместите в неё два слоя, затем проверьте видимость и блокировку группы/слоя.',
      'Измените непрозрачность и попробуйте несколько режимов наложения, сравнивая результат.',
    ],
    mastery: [
      'Перед каждой правкой вы понимаете, на каком слое она должна жить.',
      'Можете быстро найти слой, переименовать, заблокировать и вернуть нужный порядок.',
      'Не рисуете поверх исходника, если правку разумно вынести на отдельный слой.',
    ],
    mistakes: [
      'Оставлять десятки слоёв с именами «Новый слой».',
      'Случайно редактировать заблокированный/не тот слой и компенсировать это новыми правками.',
    ],
    shortcuts: [['Ctrl+Shift+N','Новый растровый слой'],['F2','Переименовать'],['Ctrl+J','Дублировать'],['Alt+↑ / Alt+↓','Соседний слой']],
    challenge: 'Челлендж: соберите структуру «Исходник / Ретушь / Цвет / Текст» и добейтесь, чтобы по именам и группам было понятно назначение каждого слоя.',
  },
  {
    id: 'transform',
    level: 'База',
    title: 'Трансформации, выравнивание и точность',
    minutes: 16,
    summary: 'Научитесь размещать элементы точно: перемещать, масштабировать и вращать, использовать модификаторы, умную привязку и микросдвиги.',
    skills: [
      'Move/Resize/Rotate через рамку и ручки выбранного слоя.',
      'Shift для пропорций/направления, Alt для масштабирования от центра.',
      'Умная привязка, стрелки 1 px, Shift+стрелки 10 px, центрирование и вписывание.',
    ],
    practice: [
      'Выберите слой V, измените его размер угловой ручкой с Shift, затем повторите с Alt.',
      'Поверните слой и проверьте привязку угла через Shift.',
      'Включите умную привязку и совместите элемент с заметной опорной линией.',
      'Доведите позицию стрелками, затем попробуйте «Центрировать слой на холсте» и «Вписать слой в холст».',
    ],
    mastery: [
      'Вы не подгоняете позицию только мышью, когда нужен точный шаг.',
      'Понимаете разницу между пропорциональным масштабированием и масштабированием от центра.',
      'Умеете временно отключить привязку Ctrl+drag, если она мешает.',
    ],
    mistakes: [
      'Масштабировать на глаз и терять пропорции.',
      'Бороться с умной привязкой вместо временного отключения модификатором.',
    ],
    shortcuts: [['V','Перемещение'],['Shift+ручка','Сохранить пропорции'],['Alt+ручка','От центра'],['Стрелки','1 px'],['Shift+стрелки','10 px']],
    challenge: 'Челлендж: разместите три объекта так, чтобы один был по центру, второй точно выровнен по краю, а третий повёрнут и масштабирован пропорционально.',
  },
  {
    id: 'selection',
    level: 'Уверенно',
    title: 'Выделения — точные локальные правки',
    minutes: 22,
    summary: 'Освойте разные способы выделения и научитесь выбирать подходящий: геометрический, свободный, магнитный или по цвету.',
    skills: [
      'Прямоугольное/эллиптическое и другие режимы M, переключение Shift+M.',
      'Магнитное лассо A и Волшебная палочка W для сложных границ и похожих цветов.',
      'Копирование/вырезание выделения, очистка пикселей, кадрирование и режим копирования со всех видимых/выбранного слоя.',
    ],
    practice: [
      'Сделайте геометрическое выделение M, затем смените тип Shift+M и сравните поведение.',
      'Выделите объект магнитным лассо A, а участок похожего цвета — Волшебной палочкой W.',
      'Скопируйте выделение Ctrl+C и проверьте разницу режимов «все видимые слои» и «выбранный слой».',
      'Попробуйте «Кадрировать по выделению», затем отмените и верните исходный холст.',
    ],
    mastery: [
      'Вы выбираете инструмент выделения по форме границы, а не по привычке.',
      'Понимаете, с каких слоёв копируются пиксели в каждом режиме.',
      'Умеете снять выделение Ctrl+D и не оставляете активную рамку случайно.',
    ],
    mistakes: [
      'Забыть про активное выделение и удивляться, почему кисть работает только внутри области.',
      'Копировать с выбранного слоя, когда визуальный результат собран из нескольких слоёв.',
    ],
    shortcuts: [['M','Выделение'],['Shift+M','Сменить тип'],['A','Магнитное лассо'],['W','Волшебная палочка'],['Ctrl+D','Снять выделение']],
    challenge: 'Челлендж: получите аккуратное выделение одного объекта тремя разными способами и объясните, какой способ дал лучший контроль именно для этого изображения.',
  },
  {
    id: 'masks',
    level: 'Уверенно',
    title: 'Маски и векторные маски — редактирование без удаления',
    minutes: 26,
    summary: 'Перейдите от «стереть пиксели» к обратимому скрытию. Это один из главных навыков профессионального неразрушающего workflow.',
    skills: [
      'Маска слоя «показать всё» и маска из текущего выделения.',
      'Уточнение выделения перед превращением в маску.',
      'Векторная маска из выделения, add/subtract/intersect/exclude и редактирование Пером.',
    ],
    practice: [
      'Создайте выделение объекта и добавьте маску слоя из выделения.',
      'Сравните результат с прямым удалением пикселей: маску можно отключить/удалить и вернуть видимость.',
      'Создайте векторную маску из выделения и добавьте к ней вторую область через boolean-операцию.',
      'Откройте редактирование векторной маски Пером и скорректируйте один узел.',
    ],
    mastery: [
      'Для обратимой изоляции объекта вы предпочитаете маску, а не удаление.',
      'Понимаете, когда растр-маска удобнее, а когда нужна векторная геометрия.',
      'Можете добавить/вычесть область из векторной маски без пересоздания всего контура.',
    ],
    mistakes: [
      'Удалять фон ластиком до того, как понятна финальная граница.',
      'Растеризовать векторный объект раньше, чем это действительно нужно.',
    ],
    shortcuts: [['P','Перо'],['Ctrl+D','Снять выделение'],['Layer → Mask','Маска слоя']],
    challenge: 'Челлендж: вырежьте объект так, чтобы через минуту можно было полностью вернуть фон без Undo — только управлением маской.',
  },
  {
    id: 'paint-retouch',
    level: 'Уверенно',
    title: 'Рисование и ретушь',
    minutes: 28,
    summary: 'Освойте связку кистей и ретуширующих инструментов, чтобы исправлять дефекты локально и контролируемо, не разрушая исходник.',
    skills: [
      'Кисть B, Ластик E, Заливка G, Градиент Shift+G и Линия L.',
      'Штамп S, Лечебная кисть J, Палец N, Размытие R, Осветлитель O и Затемнитель Shift+O.',
      'Размер кисти [ ], непрозрачность, сила инструмента, источник Alt+клик и отдельный ретуширующий слой.',
    ],
    practice: [
      'На отдельном растровом слое сделайте короткую серию штрихов с разным размером и непрозрачностью.',
      'Штампом S задайте источник Alt+кликом и перенесите небольшую фактуру.',
      'Лечебной кистью J удалите небольшой дефект, сравнив результат со Штампом.',
      'Очень умеренно примените Blur/Smudge/Dodge/Burn и сравните до/после через Undo.',
    ],
    mastery: [
      'Вы используете минимально достаточную силу ретуши и регулярно сравниваете до/после.',
      'Умеете задать источник для Clone/Heal и понимаете разницу между копированием фактуры и «лечением».',
      'Ретушь живёт отдельно от исходника, когда это возможно.',
    ],
    mistakes: [
      'Слишком сильный Blur/Smudge, после которого кожа/фактура становится пластиковой.',
      'Длинная серия правок без промежуточного сравнения через Undo/Redo.',
    ],
    shortcuts: [['B / E','Кисть / Ластик'],['S / J','Штамп / Лечение'],['Alt+клик','Источник'],['[ / ]','Размер кисти'],['Shift+G','Градиент']],
    challenge: 'Челлендж: исправьте 3 мелких дефекта тремя разными инструментами так, чтобы правка была заметна только при сравнении «до/после».',
  },
  {
    id: 'text-vector',
    level: 'Уверенно',
    title: 'Текст, фигуры, Перо и сохранённые контуры',
    minutes: 26,
    summary: 'Освойте редактируемые векторные элементы: текст, фигуры и Bézier-контуры. Сохраняйте редактируемость как можно дольше.',
    skills: [
      'Текст T с редактированием содержимого, размера, цвета, шрифта и выравнивания.',
      'Фигуры U, Линия L, Перо P и работа с узлами/ручками Bézier.',
      'Сохранённые контуры, применение их как векторных масок и осознанная растеризация.',
    ],
    practice: [
      'Добавьте заголовок T и отредактируйте его повторным выбором текста.',
      'Создайте фигуру U с Shift, затем линию L с привязкой направления.',
      'Пером P постройте простой замкнутый контур из нескольких узлов и отредактируйте ручки.',
      'Сохраните контур в панели «Контуры» и примените его как векторную маску к слою.',
    ],
    mastery: [
      'Вы сохраняете текст/фигуры редактируемыми до момента, когда растр действительно нужен.',
      'Можете создать гладкий участок Bézier и отдельно угловой узел.',
      'Понимаете, зачем хранить повторно используемый контур отдельно от слоя.',
    ],
    mistakes: [
      'Растеризовать текст до согласования содержания и типографики.',
      'Создавать слишком много узлов Пером вместо меньшего числа хорошо управляемых сегментов.',
    ],
    shortcuts: [['T','Текст'],['U','Фигура'],['P','Перо'],['L','Линия'],['Shift','Ограничение формы/угла']],
    challenge: 'Челлендж: соберите мини-баннер из текста, фигуры и собственного Bézier-контура, сохранив все три элемента редактируемыми.',
  },
  {
    id: 'color-effects',
    level: 'Продвинуто',
    title: 'Цвет, эффекты и корректирующие слои',
    minutes: 30,
    summary: 'Научитесь строить цвет и эффекты как управляемую систему: от локальной цветокоррекции до корректирующих слоёв и Smart Filters.',
    skills: [
      'Цветокоррекция растрового слоя и осознанный сброс фильтров.',
      'Корректирующие слои для правок, которые не переписывают исходный растр.',
      'Smart Filters на смарт-объекте, маска Smart Filters, режимы наложения и непрозрачность.',
    ],
    practice: [
      'Сделайте цветокоррекцию одного растрового слоя и сравните результат до/после.',
      'Создайте корректирующий слой и проверьте, как изменение влияет на композицию без переписывания исходного слоя.',
      'Преобразуйте копию слоя в смарт-объект, добавьте Smart Filter и ограничьте его маской.',
      'Попробуйте режим наложения и непрозрачность как отдельный этап, а не как замену цветокоррекции.',
    ],
    mastery: [
      'Вы выбираете между прямой коррекцией, корректирующим слоем и Smart Filter по задаче и обратимости.',
      'Можете быстро отключить эффект/маску и доказать, что исходные данные не потеряны.',
      'Не «лечите» плохой баланс цвета случайным режимом наложения.',
    ],
    mistakes: [
      'Наслаивать эффекты без понятной цели и терять контроль над причиной результата.',
      'Работать только «на глаз», не сравнивая эффект с отключённым состоянием.',
    ],
    shortcuts: [['Layer','Корректирующий слой / Smart Filter'],['Image','Цветокоррекция'],['Ctrl+Z / Ctrl+Y','Сравнение']],
    challenge: 'Челлендж: получите выразительный цвет двумя разными неразрушающими способами и выберите тот, который проще объяснить и перенастроить.',
  },
  {
    id: 'smart-psd',
    level: 'Продвинуто',
    title: 'Smart Objects, PSD/PSB и сложный обмен',
    minutes: 30,
    summary: 'Освойте умные объекты и обмен с PSD/PSB: редактируйте содержимое отдельно, используйте связанные копии и проверяйте, что сохраняется при переходе между форматами.',
    skills: [
      'Преобразование в смарт-объект, редактирование содержимого в отдельной вкладке, связанные копии и разрыв связи.',
      'Smart Filters как обратимые эффекты содержимого.',
      'Открытие PSD/PSB и осознанный выбор: рабочий master .zpe или совместимый внешний формат.',
    ],
    practice: [
      'Преобразуйте слой в смарт-объект и откройте его содержимое.',
      'Создайте связанную копию, измените содержимое и убедитесь, что понимаете связь экземпляров.',
      'Разорвите связь у одной копии и внесите отличие.',
      'Откройте тестовый PSD/PSB, проверьте слои/маски/текст, а после экспорта сравните структуру и внешний вид.',
    ],
    mastery: [
      'Вы понимаете, когда Smart Object полезнее ранней растеризации.',
      'Можете объяснить разницу между связанной копией и независимым содержимым.',
      'После обмена PSD/PSB проверяете не только картинку, но и редактируемую структуру.',
    ],
    mistakes: [
      'Считать любой внешний формат идеальным переносом всех внутренних возможностей редактора.',
      'Разрывать связь смарт-объекта, не понимая, какие экземпляры должны обновляться вместе.',
    ],
    shortcuts: [['Ctrl+S','Сохранить / обновить smart-object'],['Layer','Smart Object / Smart Filters'],['Ctrl+O','Открыть PSD/PSB']],
    challenge: 'Челлендж: создайте два связанных экземпляра одного смарт-объекта, измените содержимое, затем отделите один экземпляр и сделайте его уникальным.',
  },
  {
    id: 'capstone',
    level: 'Продвинуто',
    title: 'Итоговый проект — профессиональный рабочий цикл',
    minutes: 45,
    summary: 'Соберите всё вместе. Итоговый проект проверяет не количество нажатых кнопок, а управляемость, обратимость и понятную структуру файла.',
    skills: [
      'Планирование структуры слоёв до активной правки.',
      'Выделение + маска, отдельная ретушь, трансформации, текст/вектор и цвет.',
      'Смарт-объект или Smart Filter там, где нужна обратимость, плюс сохранение master .zpe и финальный экспорт.',
    ],
    practice: [
      'Возьмите 2 изображения и соберите композицию минимум из 6 осмысленно названных слоёв в группах.',
      'Изолируйте главный объект через выделение и маску, не удаляя исходный фон.',
      'Добавьте отдельную ретушь, один текстовый/векторный элемент и точное выравнивание.',
      'Сделайте неразрушающую цветовую правку и хотя бы один Smart Object/Smart Filter.',
      'Проверьте Undo/Redo, видимость/блокировки, сохраните master .zpe и экспортируйте готовую копию.',
    ],
    mastery: [
      'Другой человек может открыть Layers и за минуту понять структуру документа.',
      'Ключевые решения можно изменить без возврата к исходному файлу и без разрушения результата.',
      'Вы можете объяснить, почему каждая правка сделана именно этим инструментом и на этом типе слоя.',
    ],
    mistakes: [
      'Красивый результат с хаотичной структурой, который невозможно безопасно доработать.',
      'Финальный экспорт существует, а редактируемый master-проект не сохранён.',
    ],
    shortcuts: [['Ctrl+S','Master .zpe'],['Ctrl+Shift+S','Финальный экспорт'],['Tab','Чистый холст'],['F2','Порядок в слоях']],
    challenge: 'Экзамен: повторите проект через день без подсказок. Если можете быстро найти любой слой, изменить маску/цвет/текст и снова экспортировать — базовый профессиональный workflow закреплён.',
  },
]);

const LESSON_IDS = new Set(LEARNING_LESSONS.map(lesson => lesson.id));
const DEFAULT_LESSON_ID = LEARNING_LESSONS[0]?.id || '';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function readRawState(storage) {
  try {
    const value=storage?.getItem?.(LEARNING_CENTER_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeState(storage, state) {
  try {
    storage?.setItem?.(LEARNING_CENTER_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function normalizeLearningState(value) {
  const source=value && typeof value==='object' ? value : {};
  const completed=[];
  const seen=new Set();
  for(const id of Array.isArray(source.completed) ? source.completed : []){
    if(typeof id!=='string'||!LESSON_IDS.has(id)||seen.has(id))continue;
    seen.add(id);
    completed.push(id);
  }
  const lastLessonId=typeof source.lastLessonId==='string'&&LESSON_IDS.has(source.lastLessonId)
    ? source.lastLessonId
    : (LEARNING_LESSONS.find(lesson=>!seen.has(lesson.id))?.id || DEFAULT_LESSON_ID);
  return {version:1,completed,lastLessonId};
}

export function learningProgressSummary(value) {
  const state=normalizeLearningState(value);
  const total=LEARNING_LESSONS.length;
  const completed=state.completed.length;
  return {completed,total,percent:total ? Math.round(completed/total*100) : 0};
}

export function nextLearningLessonId(value) {
  const state=normalizeLearningState(value);
  const completed=new Set(state.completed);
  return LEARNING_LESSONS.find(lesson=>!completed.has(lesson.id))?.id || null;
}

function lessonIndex(id) {
  const index=LEARNING_LESSONS.findIndex(lesson=>lesson.id===id);
  return index>=0 ? index : 0;
}

function listHtml(items, ordered=false) {
  const tag=ordered?'ol':'ul';
  return '<'+tag+'>'+items.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</'+tag+'>';
}

function shortcutsHtml(items) {
  return '<div class="learning-shortcuts">'+items.map(([key,label])=>
    '<span class="learning-shortcut"><kbd>'+escapeHtml(key)+'</kbd><span>'+escapeHtml(label)+'</span></span>'
  ).join('')+'</div>';
}

function navHtml(state, activeId) {
  const completed=new Set(state.completed);
  return LEARNING_LESSONS.map((lesson,index)=>{
    const done=completed.has(lesson.id);
    const active=lesson.id===activeId;
    return '<button type="button" class="learning-nav-item'+(done?' is-complete':'')+(active?' is-active':'')+'" data-learning-action="lesson" data-learning-lesson-id="'+escapeHtml(lesson.id)+'"'+(active?' aria-current="step"':'')+'>'+
      '<span class="learning-nav-number">'+(done?'✓':String(index+1))+'</span>'+
      '<span class="learning-nav-copy"><strong>'+escapeHtml(lesson.title)+'</strong><small>'+escapeHtml(lesson.level)+' · ~'+lesson.minutes+' мин</small></span>'+
    '</button>';
  }).join('');
}

function lessonHtml(state, activeId) {
  const index=lessonIndex(activeId);
  const lesson=LEARNING_LESSONS[index];
  const completed=new Set(state.completed);
  const done=completed.has(lesson.id);
  const previous=LEARNING_LESSONS[index-1] || null;
  const next=LEARNING_LESSONS[index+1] || null;
  return '<article class="learning-lesson" aria-labelledby="learning-lesson-title">'+
    '<div class="learning-lesson-heading">'+
      '<div><span class="learning-level">'+escapeHtml(lesson.level)+'</span><span class="learning-time">~'+lesson.minutes+' мин</span></div>'+
      '<h2 id="learning-lesson-title" tabindex="-1">'+(index+1)+'. '+escapeHtml(lesson.title)+'</h2>'+
      '<p>'+escapeHtml(lesson.summary)+'</p>'+
    '</div>'+
    '<section class="learning-card"><h3>Что вы освоите</h3>'+listHtml(lesson.skills)+'</section>'+
    '<section class="learning-card learning-practice"><h3>Практика в редакторе</h3>'+listHtml(lesson.practice,true)+'<p class="learning-callout"><strong>Задание:</strong> '+escapeHtml(lesson.challenge)+'</p></section>'+
    '<div class="learning-card-grid">'+
      '<section class="learning-card"><h3>Критерий мастерства</h3>'+listHtml(lesson.mastery)+'</section>'+
      '<section class="learning-card"><h3>Типичные ошибки</h3>'+listHtml(lesson.mistakes)+'</section>'+
    '</div>'+
    '<section class="learning-card"><h3>Шпаргалка</h3>'+shortcutsHtml(lesson.shortcuts)+'</section>'+
    '<div class="learning-lesson-actions">'+
      '<button type="button" class="secondary-button" data-learning-action="previous"'+(previous?'':' disabled')+'>← Предыдущий</button>'+
      '<button type="button" class="'+(done?'secondary-button':'primary-button')+'" data-learning-action="toggle-complete" aria-pressed="'+String(done)+'">'+(done?'✓ Урок пройден — отметить непройденным':'Отметить урок пройденным')+'</button>'+
      '<button type="button" class="secondary-button" data-learning-action="next"'+(next?'':' disabled')+'>Следующий →</button>'+
    '</div>'+
  '</article>';
}

export function renderLearningCenterHtml(value, activeLessonId=null) {
  const state=normalizeLearningState(value);
  const activeId=LESSON_IDS.has(activeLessonId) ? activeLessonId : state.lastLessonId;
  const summary=learningProgressSummary(state);
  const nextId=nextLearningLessonId(state);
  const nextLesson=LEARNING_LESSONS.find(lesson=>lesson.id===nextId) || LEARNING_LESSONS.at(-1);
  return '<div class="learning-center-shell" data-learning-root>'+
    '<section class="learning-hero">'+
      '<div class="learning-hero-copy"><span class="learning-eyebrow">От первых шагов до уверенного workflow</span><h2>Прокачка ZeTer Photo Editor</h2><p>10 практических уроков. Закройте Центр, выполните упражнение на реальном холсте, затем вернитесь и отметьте этап пройденным.</p></div>'+
      '<div class="learning-progress-panel">'+
        '<div class="learning-progress-row"><strong data-learning-progress-text>'+summary.completed+' / '+summary.total+' уроков</strong><span>'+summary.percent+'%</span></div>'+
        '<div class="learning-progress-bar" role="progressbar" aria-label="Прогресс обучения" aria-valuemin="0" aria-valuemax="'+summary.total+'" aria-valuenow="'+summary.completed+'"><span style="width:'+summary.percent+'%"></span></div>'+
        '<div class="learning-progress-actions"><button type="button" class="primary-button" data-learning-action="continue">'+(nextId?'Продолжить: '+escapeHtml(nextLesson.title):'Повторить итоговый проект')+'</button><button type="button" class="secondary-button" data-learning-action="reset">Сбросить прогресс</button></div>'+
        '<small>Прогресс хранится только локально в этом браузере.</small>'+
      '</div>'+
    '</section>'+
    '<div class="learning-layout">'+
      '<nav class="learning-nav" aria-label="Уроки центра обучения">'+navHtml(state,activeId)+'</nav>'+
      '<div class="learning-content">'+lessonHtml(state,activeId)+'</div>'+
    '</div>'+
  '</div>';
}

export function createLearningCenterController({
  showInfoModal,
  storage=globalThis.localStorage,
  documentTarget=globalThis.document,
  windowTarget=globalThis.window,
}={}) {
  if(typeof showInfoModal!=='function')throw new Error('Learning Center requires showInfoModal');

  function show() {
    const helpButton=documentTarget?.querySelector?.('.menu-button[data-menu="help"]');
    helpButton?.focus?.();
    let state=normalizeLearningState(readRawState(storage));
    let activeId=state.lastLessonId || DEFAULT_LESSON_ID;

    showInfoModal('Центр обучения',renderLearningCenterHtml(state,activeId),{
      className:'learning-center-modal',
      initialFocusSelector:'[data-learning-action="continue"]',
      onMount:({body})=>{
        const render=(focusSelector='')=>{
          body.innerHTML=renderLearningCenterHtml(state,activeId);
          if(focusSelector)body.querySelector(focusSelector)?.focus?.();
        };
        const persist=()=>{
          state=normalizeLearningState({...state,lastLessonId:activeId});
          writeState(storage,state);
        };
        const activate=(id,{focus=true}={})=>{
          if(!LESSON_IDS.has(id))return;
          activeId=id;
          persist();
          render(focus?'#learning-lesson-title':'');
        };
        const onClick=event=>{
          const button=event.target?.closest?.('[data-learning-action]');
          if(!button||button.disabled)return;
          const action=button.dataset.learningAction;
          if(action==='lesson'){activate(button.dataset.learningLessonId);return;}
          if(action==='continue'){activate(nextLearningLessonId(state) || LEARNING_LESSONS.at(-1)?.id || DEFAULT_LESSON_ID);return;}
          if(action==='previous'||action==='next'){
            const index=lessonIndex(activeId)+(action==='next'?1:-1);
            const target=LEARNING_LESSONS[index];
            if(target)activate(target.id);
            return;
          }
          if(action==='toggle-complete'){
            const completed=new Set(state.completed);
            if(completed.has(activeId))completed.delete(activeId);
            else completed.add(activeId);
            state=normalizeLearningState({...state,completed:[...completed],lastLessonId:activeId});
            writeState(storage,state);
            render('[data-learning-action="toggle-complete"]');
            return;
          }
          if(action==='reset'){
            if(windowTarget?.confirm&&!windowTarget.confirm('Сбросить весь прогресс Центра обучения?'))return;
            state=normalizeLearningState(null);
            activeId=state.lastLessonId;
            writeState(storage,state);
            render('[data-learning-action="continue"]');
          }
        };
        body.addEventListener('click',onClick);
        return ()=>body.removeEventListener('click',onClick);
      },
    });
  }

  return {show};
}
