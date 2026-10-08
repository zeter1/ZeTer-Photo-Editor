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
      'Создайте новый растровый слой Ctrl+Shift+N, переименуйте его через F2 и продублируйте Ctrl+J.',
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

export const LEARNING_LESSON_GUIDES = Object.freeze({
  "start": {
    "mentalModel": "Редактор — это не набор кнопок, а управляемая история состояний. Масштаб и панорамирование меняют только взгляд на документ, Undo/Redo — состояние документа, а экспорт — формат выдачи результата.",
    "decisionRule": "Если результат ещё будут менять — сохраняйте master .zpe. Если файл нужен для отправки, публикации или печати — делайте отдельный экспорт.",
    "quiz": [
      {
        "question": "Какой вариант лучше всего сохраняет возможность безопасно продолжить редактирование завтра?",
        "options": [
          "Оставить только финальный PNG/JPEG",
          "Сохранить master .zpe и отдельно экспортировать готовую копию",
          "Сделать скриншот холста"
        ],
        "correctIndex": 1,
        "explanation": "Master .zpe хранит редактируемую структуру; экспорт — отдельная финальная копия."
      },
      {
        "question": "Что делает инструмент Рука в отличие от Move (V)?",
        "options": [
          "Рука перемещает viewport, а Move — содержимое слоя",
          "Оба инструмента двигают выбранный слой",
          "Рука отменяет последнюю трансформацию"
        ],
        "correctIndex": 0,
        "explanation": "Рука меняет только положение просмотра; Move работает с объектом/слоем."
      }
    ]
  },
  "layers": {
    "mentalModel": "Слой — отдельная ответственность в документе. Чем яснее назначение слоёв и групп, тем легче сравнивать варианты, откатывать решения и передавать проект другому человеку.",
    "decisionRule": "Если правку нужно независимо скрывать, переставлять, настраивать или удалять — дайте ей отдельный слой или группу.",
    "quiz": [
      {
        "question": "Почему полезно отделять ретушь от исходного изображения?",
        "options": [
          "Чтобы увеличить размер файла",
          "Чтобы правку можно было отдельно отключить, исправить или удалить",
          "Чтобы экспорт всегда был только PNG"
        ],
        "correctIndex": 1,
        "explanation": "Отдельный слой сохраняет исходник и делает ретушь управляемой."
      },
      {
        "question": "Что лучше сделать с десятком слоёв «Новый слой»?",
        "options": [
          "Оставить как есть",
          "Переименовать по назначению и сгруппировать связанные элементы",
          "Слить всё в один слой сразу"
        ],
        "correctIndex": 1,
        "explanation": "Имена и группы уменьшают ошибки выбора слоя и ускоряют дальнейшую работу."
      }
    ]
  },
  "transform": {
    "mentalModel": "Трансформация — это геометрия, а не подгонка на глаз. Рамка задаёт крупное изменение, привязки — отношения между объектами, а стрелки — последний точный шаг.",
    "decisionRule": "Сначала сделайте крупную трансформацию, затем выравнивание/привязку, и только после этого микросдвигайте стрелками.",
    "quiz": [
      {
        "question": "Что использовать, если Smart Snap мешает поставить объект в нужное место?",
        "options": [
          "Удалить слой",
          "Временно отключить привязку модификатором Ctrl во время drag",
          "Увеличить непрозрачность"
        ],
        "correctIndex": 1,
        "explanation": "Привязка — помощник; её можно временно обойти, не ломая весь workflow."
      },
      {
        "question": "Какой подход даёт наиболее контролируемую финальную позицию?",
        "options": [
          "Только мышь на любом масштабе",
          "Трансформация + привязка + точный шаг стрелками",
          "Случайно менять X/Y до похожего результата"
        ],
        "correctIndex": 1,
        "explanation": "Комбинация крупного жеста, привязки и точного шага уменьшает геометрические ошибки."
      }
    ]
  },
  "selection": {
    "mentalModel": "Выделение — временное условие «где разрешена следующая операция». Оно само не обязано менять пиксели, но определяет область копирования, удаления, маскирования и локальной правки.",
    "decisionRule": "Выбирайте способ выделения по типу границы: геометрия — M, сложный край — лассо, близкие цвета — W.",
    "quiz": [
      {
        "question": "Почему кисть иногда неожиданно рисует только внутри части изображения?",
        "options": [
          "Скорее всего осталось активное выделение",
          "Всегда сломан масштаб",
          "Нужно обязательно растрировать слой"
        ],
        "correctIndex": 0,
        "explanation": "Активное выделение ограничивает многие операции; Ctrl+D снимает его."
      },
      {
        "question": "Когда режим копирования «все видимые слои» полезнее «выбранный слой»?",
        "options": [
          "Когда визуальный результат собран из нескольких слоёв",
          "Только при пустом документе",
          "Он всегда хуже"
        ],
        "correctIndex": 0,
        "explanation": "Merged/visible copy нужен, когда вы хотите получить именно видимый композиционный результат."
      }
    ]
  },
  "masks": {
    "mentalModel": "Маска отвечает на вопрос «что видно», не уничтожая исходные данные. Это обратимый шлюз между содержимым слоя и композицией.",
    "decisionRule": "Если есть шанс, что границу ещё будут уточнять, скрывайте маской вместо удаления пикселей.",
    "quiz": [
      {
        "question": "Главное преимущество маски перед ластиком для изоляции объекта?",
        "options": [
          "Маска всегда быстрее",
          "Маска сохраняет скрытые данные и допускает обратимое уточнение",
          "Маска автоматически улучшает резкость"
        ],
        "correctIndex": 1,
        "explanation": "Маска скрывает, а не уничтожает; поэтому границу можно менять позже."
      },
      {
        "question": "Когда векторная маска особенно уместна?",
        "options": [
          "Для чётких управляемых кривых и геометрических границ",
          "Только для размытия",
          "Только для сохранения JPEG"
        ],
        "correctIndex": 0,
        "explanation": "Векторная маска удобна там, где важны чистые редактируемые контуры."
      }
    ]
  },
  "paint-retouch": {
    "mentalModel": "Хорошая ретушь минимальна: исправление решает конкретный дефект, а не стирает фактуру. Источник, размер, сила и отдельный слой дают контроль и возможность сравнения.",
    "decisionRule": "Clone используйте для точного переноса фактуры, Heal — когда фактуру нужно вписать в окружающий тон; силу держите минимально достаточной.",
    "quiz": [
      {
        "question": "Чем Heal концептуально отличается от Clone?",
        "options": [
          "Heal старается согласовать перенесённую фактуру с окружением, Clone копирует её прямее",
          "Clone всегда размывает, Heal всегда повышает резкость",
          "Разницы нет"
        ],
        "correctIndex": 0,
        "explanation": "Clone прямее копирует источник; Heal полезен, когда нужна адаптация к окружению."
      },
      {
        "question": "Как снизить риск «пластиковой» ретуши?",
        "options": [
          "Использовать максимальную силу",
          "Работать короткими локальными правками, умеренной силой и регулярно сравнивать до/после",
          "Сразу слить слои"
        ],
        "correctIndex": 1,
        "explanation": "Умеренность и регулярное сравнение помогают сохранить естественную фактуру."
      }
    ]
  },
  "text-vector": {
    "mentalModel": "Текст, фигуры и Bézier-контуры ценны своей редактируемостью. Растеризация превращает гибкое описание в пиксели и поэтому должна быть осознанной точкой невозврата.",
    "decisionRule": "Пока содержание, форма или типографика могут измениться — сохраняйте элемент векторным/текстовым.",
    "quiz": [
      {
        "question": "Когда лучше растрировать текст?",
        "options": [
          "Сразу после ввода первой буквы",
          "Только когда действительно нужна пиксельная операция и текст уже не требуется редактировать",
          "Перед каждым сохранением"
        ],
        "correctIndex": 1,
        "explanation": "Поздняя растеризация сохраняет возможность менять содержание и типографику."
      },
      {
        "question": "Как обычно получить более управляемый Bézier-контур?",
        "options": [
          "Ставить максимально много узлов",
          "Использовать меньше осмысленных узлов и управлять ручками",
          "Не замыкать контур никогда"
        ],
        "correctIndex": 1,
        "explanation": "Меньшее число хорошо размещённых узлов обычно даёт чище и проще редактируемую кривую."
      }
    ]
  },
  "color-effects": {
    "mentalModel": "Цветовая правка — цепочка причин и следствий. Чем легче отключить отдельный этап и увидеть его вклад, тем проще контролировать результат и не переобработать изображение.",
    "decisionRule": "Для обратимости сначала рассматривайте корректирующий слой или Smart Filter; прямую коррекцию применяйте, когда её разрушительность действительно приемлема.",
    "quiz": [
      {
        "question": "Какой подход лучше всего позволяет позднее перенастроить цвет без переписывания исходного растра?",
        "options": [
          "Корректирующий слой",
          "Случайный режим наложения на исходнике",
          "Экспорт и повторное открытие JPEG"
        ],
        "correctIndex": 0,
        "explanation": "Корректирующий слой хранит настройку отдельно от исходного растра."
      },
      {
        "question": "Зачем регулярно отключать эффект и сравнивать до/после?",
        "options": [
          "Чтобы понять реальный вклад эффекта и не накапливать лишнюю обработку",
          "Чтобы увеличить количество истории",
          "Это нужно только перед печатью"
        ],
        "correctIndex": 0,
        "explanation": "Сравнение помогает отличить полезную коррекцию от накопленного переобрабатывания."
      }
    ]
  },
  "smart-psd": {
    "mentalModel": "Smart Object отделяет экземпляр в композиции от его редактируемого содержимого. PSD/PSB — формат обмена, поэтому после round-trip нужно проверять не только картинку, но и структуру.",
    "decisionRule": "Используйте связанный Smart Object, когда экземпляры должны обновляться вместе; разрывайте связь только когда копия должна стать самостоятельной.",
    "quiz": [
      {
        "question": "Что ожидается от двух связанных экземпляров одного Smart Object?",
        "options": [
          "Изменение общего содержимого должно отражаться на связанных экземплярах",
          "Они всегда должны иметь разные пиксели",
          "Один из них нельзя трансформировать"
        ],
        "correctIndex": 0,
        "explanation": "Связь означает совместно используемое содержимое при независимом размещении экземпляров."
      },
      {
        "question": "Что важно проверить после обмена через PSD/PSB?",
        "options": [
          "Только размер файла",
          "Внешний вид и редактируемую структуру: слои, маски, текст и другие нужные элементы",
          "Только имя документа"
        ],
        "correctIndex": 1,
        "explanation": "Совместимость — это не только визуальное совпадение, но и сохранность нужной структуры."
      }
    ]
  },
  "capstone": {
    "mentalModel": "Профессиональный workflow оценивается не количеством эффектов, а управляемостью результата. Хороший master понятен, обратим и допускает безопасные изменения без повторной сборки с нуля.",
    "decisionRule": "Перед финальным экспортом спросите: другой человек поймёт Layers, ключевые решения обратимы, master сохранён, а финальную копию можно воспроизвести?",
    "quiz": [
      {
        "question": "Какой признак сильнее всего говорит о хорошем итоговом master-проекте?",
        "options": [
          "Максимальное число слоёв",
          "Понятная структура и возможность изменить ключевые решения без разрушения результата",
          "Самый большой размер файла"
        ],
        "correctIndex": 1,
        "explanation": "Главный критерий — понятность и управляемая обратимость, а не объём документа."
      },
      {
        "question": "Что должно существовать после завершения проекта?",
        "options": [
          "Только финальный экспорт",
          "Редактируемый master .zpe и отдельный финальный экспорт",
          "Только временные автосохранения"
        ],
        "correctIndex": 1,
        "explanation": "Master нужен для дальнейших правок, экспорт — для использования результата."
      }
    ]
  }
});

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

function availableLearningStorage() {
  try { return globalThis.localStorage; }
  catch { return null; }
}

function readRawState(storage) {
  try {
    const value=storage?.getItem?.(LEARNING_CENTER_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch { return null; }
}

function writeState(storage, state) {
  try {
    storage?.setItem?.(LEARNING_CENTER_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}

function normalizeChecklistMap(value, field) {
  const source=value && typeof value==='object' ? value : {};
  const result={};
  for(const lesson of LEARNING_LESSONS){
    const max=Array.isArray(lesson[field]) ? lesson[field].length : 0;
    const raw=Array.isArray(source[lesson.id]) ? source[lesson.id] : [];
    const seen=new Set();
    const indexes=[];
    for(const index of raw){
      if(!Number.isInteger(index)||index<0||index>=max||seen.has(index))continue;
      seen.add(index); indexes.push(index);
    }
    indexes.sort((a,b)=>a-b);
    if(indexes.length)result[lesson.id]=indexes;
  }
  return result;
}

function filledChecklistMap(field, lessonIds) {
  const result={};
  for(const id of lessonIds){
    const lesson=LEARNING_LESSONS.find(candidate=>candidate.id===id);
    if(lesson)result[id]=Array.from({length:lesson[field].length},(_,index)=>index);
  }
  return result;
}

export function normalizeLearningState(value) {
  const source=value && typeof value==='object' ? value : {};
  const completed=[]; const completedSeen=new Set();
  for(const id of Array.isArray(source.completed) ? source.completed : []){
    if(typeof id!=='string'||!LESSON_IDS.has(id)||completedSeen.has(id))continue;
    completedSeen.add(id); completed.push(id);
  }
  const lastLessonId=typeof source.lastLessonId==='string'&&LESSON_IDS.has(source.lastLessonId)
    ? source.lastLessonId
    : (LEARNING_LESSONS.find(lesson=>!completedSeen.has(lesson.id))?.id || DEFAULT_LESSON_ID);
  let practice=normalizeChecklistMap(source.practice,'practice');
  let mastery=normalizeChecklistMap(source.mastery,'mastery');
  const quizPassed=[]; const quizSeen=new Set();
  for(const id of Array.isArray(source.quizPassed) ? source.quizPassed : []){
    if(typeof id!=='string'||!LESSON_IDS.has(id)||quizSeen.has(id))continue;
    quizSeen.add(id); quizPassed.push(id);
  }
  if(source.version!==2 && completed.length){
    practice={...practice,...filledChecklistMap('practice',completed)};
    mastery={...mastery,...filledChecklistMap('mastery',completed)};
    for(const id of completed)if(!quizSeen.has(id)){quizSeen.add(id);quizPassed.push(id);}
  }
  return {version:2,completed,lastLessonId,practice,mastery,quizPassed};
}

export function learningProgressSummary(value) {
  const state=normalizeLearningState(value);
  const total=LEARNING_LESSONS.length, completed=state.completed.length;
  return {completed,total,percent:total ? Math.round(completed/total*100) : 0};
}

export function nextLearningLessonId(value) {
  const state=normalizeLearningState(value), completed=new Set(state.completed);
  return LEARNING_LESSONS.find(lesson=>!completed.has(lesson.id))?.id || null;
}

function checklistSummary(state, lesson, field) {
  const total=lesson?.[field]?.length || 0;
  const completed=(state?.[field]?.[lesson?.id] || []).length;
  return {completed,total,done:total===0||completed>=total};
}

export function learningLessonReadiness(value, lessonId) {
  const state=normalizeLearningState(value);
  const lesson=LEARNING_LESSONS.find(candidate=>candidate.id===lessonId);
  if(!lesson)return {practice:{completed:0,total:0,done:false},mastery:{completed:0,total:0,done:false},quizPassed:false,ready:false};
  const practice=checklistSummary(state,lesson,'practice');
  const mastery=checklistSummary(state,lesson,'mastery');
  const quizPassed=state.quizPassed.includes(lesson.id);
  return {practice,mastery,quizPassed,ready:practice.done&&mastery.done&&quizPassed};
}

export function learningLevelProgress(value) {
  const state=normalizeLearningState(value), completed=new Set(state.completed), levels=[];
  for(const lesson of LEARNING_LESSONS){
    let row=levels.find(item=>item.level===lesson.level);
    if(!row){row={level:lesson.level,completed:0,total:0};levels.push(row);}
    row.total+=1; if(completed.has(lesson.id))row.completed+=1;
  }
  return levels;
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
  return '<div class="learning-shortcuts">'+items.map(([key,label])=>'<span class="learning-shortcut"><kbd>'+escapeHtml(key)+'</kbd><span>'+escapeHtml(label)+'</span></span>').join('')+'</div>';
}
function checklistHtml(state, lesson, field, {numbered=false}={}) {
  const selected=new Set(state[field]?.[lesson.id] || []);
  return '<div class="learning-checklist">'+lesson[field].map((item,index)=>{
    const checked=selected.has(index);
    return '<label class="learning-check-row'+(checked?' is-checked':'')+'"><input type="checkbox" data-learning-checklist="'+field+'" data-learning-index="'+index+'"'+(checked?' checked':'')+' />'+
      (numbered?'<span class="learning-check-number">'+(index+1)+'</span>':'<span class="learning-check-mark" aria-hidden="true">✓</span>')+
      '<span class="learning-check-copy">'+escapeHtml(item)+'</span></label>';
  }).join('')+'</div>';
}
function curriculumPracticeSummary(state) {
  let completed=0,total=0;
  for(const lesson of LEARNING_LESSONS){total+=lesson.practice.length;completed+=(state.practice[lesson.id]||[]).length;}
  return {completed,total};
}
function lessonStatus(state, lesson) {
  if(state.completed.includes(lesson.id))return {key:'complete',label:'Освоен'};
  const readiness=learningLessonReadiness(state,lesson.id);
  if(readiness.ready)return {key:'ready',label:'Готов'};
  const touched=readiness.practice.completed>0||readiness.mastery.completed>0||readiness.quizPassed;
  return touched?{key:'progress',label:'В процессе'}:{key:'new',label:''};
}
function navHtml(state, activeId) {
  return LEARNING_LESSONS.map((lesson,index)=>{
    const active=lesson.id===activeId, status=lessonStatus(state,lesson);
    return '<button type="button" class="learning-nav-item is-'+status.key+(active?' is-active':'')+'" data-learning-action="lesson" data-learning-lesson-id="'+escapeHtml(lesson.id)+'"'+(active?' aria-current="step"':'')+'>'+
      '<span class="learning-nav-number">'+(status.key==='complete'?'✓':String(index+1))+'</span><span class="learning-nav-copy"><strong>'+escapeHtml(lesson.title)+'</strong><small>'+
      escapeHtml(lesson.level)+' · ~'+lesson.minutes+' мин'+(status.label?' · '+escapeHtml(status.label):'')+'</small></span></button>';
  }).join('');
}
function quizHtml(state, lesson) {
  const guide=LEARNING_LESSON_GUIDES[lesson.id], passed=state.quizPassed.includes(lesson.id);
  if(passed)return '<section class="learning-card learning-quiz-card" aria-labelledby="learning-quiz-title"><div class="learning-section-heading"><div><h3 id="learning-quiz-title">Проверка знаний</h3><p>Ответы проверены. Вернитесь к вопросам после сброса прогресса, если захотите пройти их заново.</p></div><span class="learning-status-badge is-success">✓ Зачёт</span></div><div class="learning-quiz-passed" tabindex="-1">Вы выполнили действия и подтвердили понимание ключевых решений этого урока.</div></section>';
  return '<section class="learning-card learning-quiz-card" aria-labelledby="learning-quiz-title"><div class="learning-section-heading"><div><h3 id="learning-quiz-title">Проверка знаний</h3><p>Выберите по одному ответу. Ошибка не штрафуется: прочитайте объяснение и попробуйте снова.</p></div><span class="learning-status-badge">'+guide.quiz.length+' вопроса</span></div><div class="learning-quiz-list">'+guide.quiz.map((quiz,questionIndex)=>
    '<fieldset class="learning-quiz-question" data-learning-quiz-question="'+questionIndex+'"><legend>'+(questionIndex+1)+'. '+escapeHtml(quiz.question)+'</legend>'+
    quiz.options.map((option,answerIndex)=>'<label class="learning-quiz-option"><input type="radio" name="learning-quiz-'+escapeHtml(lesson.id)+'-'+questionIndex+'" data-learning-answer-index="'+answerIndex+'" /> <span>'+escapeHtml(option)+'</span></label>').join('')+'</fieldset>'
  ).join('')+'</div><div class="learning-quiz-actions"><button type="button" class="secondary-button" data-learning-action="check-quiz">Проверить ответы</button><div class="learning-quiz-feedback" data-learning-quiz-feedback role="status" aria-live="polite"></div></div></section>';
}
function lessonCompletionHint(readiness, done) {
  if(done)return 'Урок отмечен как освоенный. Можно снять отметку и повторить его.';
  const missing=[];
  if(!readiness.practice.done)missing.push('практика '+readiness.practice.completed+'/'+readiness.practice.total);
  if(!readiness.mastery.done)missing.push('самопроверка '+readiness.mastery.completed+'/'+readiness.mastery.total);
  if(!readiness.quizPassed)missing.push('проверка знаний');
  return missing.length?'Чтобы завершить урок: '+missing.join(' · ')+'.':'Все условия выполнены — можно закрепить урок как освоенный.';
}
function lessonHtml(state, activeId) {
  const index=lessonIndex(activeId), lesson=LEARNING_LESSONS[index], guide=LEARNING_LESSON_GUIDES[lesson.id];
  const done=state.completed.includes(lesson.id), readiness=learningLessonReadiness(state,lesson.id), status=lessonStatus(state,lesson);
  const previous=LEARNING_LESSONS[index-1] || null, next=LEARNING_LESSONS[index+1] || null;
  return '<article class="learning-lesson" aria-labelledby="learning-lesson-title"><div class="learning-lesson-heading"><div><span class="learning-level">'+escapeHtml(lesson.level)+'</span><span class="learning-time">~'+lesson.minutes+' мин</span><span class="learning-status-badge is-'+status.key+'">'+escapeHtml(status.label||'Новый урок')+'</span></div><h2 id="learning-lesson-title" tabindex="-1">'+(index+1)+'. '+escapeHtml(lesson.title)+'</h2><p>'+escapeHtml(lesson.summary)+'</p></div>'+
    '<section class="learning-card learning-concept"><h3>Ментальная модель</h3><p>'+escapeHtml(guide.mentalModel)+'</p><p class="learning-decision"><strong>Правило выбора:</strong> '+escapeHtml(guide.decisionRule)+'</p></section>'+
    '<section class="learning-card"><h3>Что вы освоите</h3>'+listHtml(lesson.skills)+'</section>'+
    '<section class="learning-card learning-practice"><div class="learning-section-heading"><div><h3>Практика на реальном холсте</h3><p>Закройте Центр, выполните действия в редакторе и отмечайте только реально сделанные шаги.</p></div><span class="learning-status-badge">'+readiness.practice.completed+'/'+readiness.practice.total+'</span></div>'+checklistHtml(state,lesson,'practice',{numbered:true})+
    '<p class="learning-callout"><strong>Челлендж:</strong> '+escapeHtml(lesson.challenge.replace(/^Челлендж:\s*/i,'').replace(/^Экзамен:\s*/i,''))+'</p><div class="learning-practice-actions"><button type="button" class="secondary-button" data-learning-action="practice-now">Закрыть Центр и практиковаться</button><small>Текущий урок и отметки сохранятся локально.</small></div></section>'+
    quizHtml(state,lesson)+'<div class="learning-card-grid"><section class="learning-card learning-mastery"><div class="learning-section-heading"><div><h3>Самопроверка мастерства</h3><p>Ставьте галочку только если можете выполнить пункт без подсказки.</p></div><span class="learning-status-badge">'+readiness.mastery.completed+'/'+readiness.mastery.total+'</span></div>'+checklistHtml(state,lesson,'mastery')+'</section><section class="learning-card"><h3>Типичные ошибки</h3>'+listHtml(lesson.mistakes)+'</section></div>'+
    '<section class="learning-card"><h3>Шпаргалка</h3>'+shortcutsHtml(lesson.shortcuts)+'</section><p id="learning-completion-hint" class="learning-completion-hint'+(readiness.ready||done?' is-ready':'')+'">'+escapeHtml(lessonCompletionHint(readiness,done))+'</p>'+
    '<div class="learning-lesson-actions"><button type="button" class="secondary-button" data-learning-action="previous"'+(previous?'':' disabled')+'>← Предыдущий</button><button type="button" class="'+(done?'secondary-button':'primary-button')+'" data-learning-action="toggle-complete" aria-pressed="'+String(done)+'" aria-describedby="learning-completion-hint"'+(!done&&!readiness.ready?' disabled':'')+'>'+(done?'✓ Освоено — отметить для повторения':'Закрепить урок как освоенный')+'</button><button type="button" class="secondary-button" data-learning-action="next"'+(next?'':' disabled')+'>Следующий →</button></div></article>';
}
export function renderLearningCenterHtml(value, activeLessonId=null) {
  const state=normalizeLearningState(value), activeId=LESSON_IDS.has(activeLessonId)?activeLessonId:state.lastLessonId;
  const summary=learningProgressSummary(state), practice=curriculumPracticeSummary(state), levelProgress=learningLevelProgress(state);
  const nextId=nextLearningLessonId(state), nextLesson=LEARNING_LESSONS.find(lesson=>lesson.id===nextId)||LEARNING_LESSONS.at(-1);
  return '<div class="learning-center-shell" data-learning-root><section class="learning-hero"><div class="learning-hero-copy"><span class="learning-eyebrow">Понять → сделать → проверить → закрепить</span><h2>Прокачка ZeTer Photo Editor</h2><p>10 практических уроков с ментальными моделями, реальной практикой, проверкой знаний и самопроверкой мастерства. Центр не выдаёт «зачёт» за чтение — урок завершается после практики и понимания.</p><div class="learning-level-progress">'+levelProgress.map(item=>'<span><strong>'+escapeHtml(item.level)+'</strong><small>'+item.completed+'/'+item.total+'</small></span>').join('')+'</div></div>'+
    '<div class="learning-progress-panel"><div class="learning-progress-row"><strong data-learning-progress-text>'+summary.completed+' / '+summary.total+' уроков</strong><span>'+summary.percent+'%</span></div><div class="learning-progress-bar" role="progressbar" aria-label="Прогресс обучения" aria-valuemin="0" aria-valuemax="'+summary.total+'" aria-valuenow="'+summary.completed+'"><span style="width:'+summary.percent+'%"></span></div><div class="learning-progress-metrics"><span>Практика <strong data-learning-practice-progress>'+practice.completed+'/'+practice.total+'</strong></span><span>Проверки <strong data-learning-quiz-progress>'+state.quizPassed.length+'/'+LEARNING_LESSONS.length+'</strong></span></div><div class="learning-progress-actions"><button type="button" class="primary-button" data-learning-action="continue">'+(nextId?'Продолжить: '+escapeHtml(nextLesson.title):'Повторить итоговый проект')+'</button><button type="button" class="secondary-button" data-learning-action="reset">Сбросить прогресс</button></div><small>Прогресс, практика и зачёты хранятся только локально в этом браузере.</small></div></section><div class="learning-layout"><nav class="learning-nav" aria-label="Уроки центра обучения">'+navHtml(state,activeId)+'</nav><div class="learning-content">'+lessonHtml(state,activeId)+'</div></div></div>';
}
export function createLearningCenterController({showInfoModal,storage,documentTarget=globalThis.document,windowTarget=globalThis.window}={}) {
  if(typeof showInfoModal!=='function')throw new Error('Learning Center requires showInfoModal');
  const storageTarget=storage===undefined ? availableLearningStorage() : storage;
  function show() {
    const helpButton=documentTarget?.querySelector?.('.menu-button[data-menu="help"]'); helpButton?.focus?.();
    let state=normalizeLearningState(readRawState(storageTarget)), activeId=state.lastLessonId||DEFAULT_LESSON_ID;
    showInfoModal('Центр обучения',renderLearningCenterHtml(state,activeId),{
      className:'learning-center-modal',initialFocusSelector:'[data-learning-action="continue"]',
      onMount:({body,close})=>{
        const render=(focusSelector='')=>{body.innerHTML=renderLearningCenterHtml(state,activeId);if(focusSelector)body.querySelector(focusSelector)?.focus?.();};
        const persist=()=>{state=normalizeLearningState({...state,lastLessonId:activeId});writeState(storageTarget,state);};
        const activate=(id,{focus=true}={})=>{if(!LESSON_IDS.has(id))return;activeId=id;persist();render(focus?'#learning-lesson-title':'');};
        const updateChecklist=(field,index,checked)=>{
          const lesson=LEARNING_LESSONS[lessonIndex(activeId)];
          if(!lesson||!['practice','mastery'].includes(field)||!Number.isInteger(index)||index<0||index>=lesson[field].length)return;
          const values=new Set(state[field]?.[activeId]||[]); if(checked)values.add(index);else values.delete(index);
          state=normalizeLearningState({...state,[field]:{...state[field],[activeId]:[...values]},lastLessonId:activeId});writeState(storageTarget,state);
          render('[data-learning-checklist="'+field+'"][data-learning-index="'+index+'"]');
        };
        const checkQuiz=()=>{
          const lesson=LEARNING_LESSONS[lessonIndex(activeId)], guide=LEARNING_LESSON_GUIDES[lesson?.id];
          if(!lesson||!guide)return;
          const feedback=body.querySelector('[data-learning-quiz-feedback]');
          const answers=guide.quiz.map((quiz,questionIndex)=>{const selected=body.querySelector('[data-learning-quiz-question="'+questionIndex+'"] input[type="radio"]:checked');return selected?Number(selected.dataset.learningAnswerIndex):null;});
          if(answers.some(answer=>answer===null)){if(feedback){feedback.textContent='Ответьте на оба вопроса, затем проверьте себя.';feedback.classList.add('is-error');}return;}
          const wrong=[];answers.forEach((answer,index)=>{if(answer!==guide.quiz[index].correctIndex)wrong.push(index);});
          if(wrong.length){if(feedback){feedback.textContent='Пока не зачёт. '+wrong.map(index=>guide.quiz[index].explanation).join(' ');feedback.classList.add('is-error');}return;}
          const passed=new Set(state.quizPassed);passed.add(activeId);
          state=normalizeLearningState({...state,quizPassed:[...passed],lastLessonId:activeId});writeState(storageTarget,state);render('.learning-quiz-passed');
        };
        const onClick=event=>{
          const button=event.target?.closest?.('[data-learning-action]');if(!button||button.disabled)return;
          const action=button.dataset.learningAction;
          if(action==='lesson'){activate(button.dataset.learningLessonId);return;}
          if(action==='continue'){activate(nextLearningLessonId(state)||LEARNING_LESSONS.at(-1)?.id||DEFAULT_LESSON_ID);return;}
          if(action==='previous'||action==='next'){const target=LEARNING_LESSONS[lessonIndex(activeId)+(action==='next'?1:-1)];if(target)activate(target.id);return;}
          if(action==='practice-now'){persist();close();return;}
          if(action==='check-quiz'){checkQuiz();return;}
          if(action==='toggle-complete'){const completed=new Set(state.completed), readiness=learningLessonReadiness(state,activeId);if(completed.has(activeId))completed.delete(activeId);else if(readiness.ready)completed.add(activeId);else return;state=normalizeLearningState({...state,completed:[...completed],lastLessonId:activeId});writeState(storageTarget,state);render('[data-learning-action="toggle-complete"]');return;}
          if(action==='reset'){if(windowTarget?.confirm&&!windowTarget.confirm('Сбросить весь прогресс, практику и зачёты Центра обучения?'))return;state=normalizeLearningState(null);activeId=state.lastLessonId;writeState(storageTarget,state);render('[data-learning-action="continue"]');}
        };
        const onChange=event=>{const input=event.target;if(input?.type!=='checkbox'||!input.dataset.learningChecklist)return;updateChecklist(input.dataset.learningChecklist,Number(input.dataset.learningIndex),Boolean(input.checked));};
        body.addEventListener('click',onClick);body.addEventListener('change',onChange);
        return ()=>{body.removeEventListener('click',onClick);body.removeEventListener('change',onChange);};
      },
    });
  }
  return {show};
}
