# ZeTer Photo Editor

[![CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/workflows/ci.yml/badge.svg)](https://github.com/zeter1/ZeTer-Photo-Editor/actions/workflows/ci.yml)

**Онлайн-версия:** https://dkl.do.am/servisi/PhotoEditor/index.html  
**GitHub:** https://github.com/zeter1/ZeTer-Photo-Editor

ZeTer Photo Editor — браузерный графический редактор со слоями, историей действий и Canvas 2D-рендером. Он работает как онлайн, так и локально через обычный `index.html`. Редактор вдохновлён рабочим процессом Photopea / Photoshop, но остаётся самостоятельным приложением. Пользовательские изображения обрабатываются в браузере и для обычной работы не требуют загрузки на внешний сервер.

Для текста доступны встроенные шрифты с поддержкой кириллицы, загрузка своего файла шрифта и кнопка показа шрифтов компьютера (если браузер предоставит доступ). В окне текста параметры сразу видны на холсте и в предпросмотре фрагмента изображения; окно можно переместить за заголовок и изменить его размер за угол. Размер малого предпросмотра меняется за его нижний угол. «Отмена» убирает временный результат.

## Что умеет версия 1.35.0

- растровые, текстовые и фигурные слои;
- видимость, блокировка, порядок, дублирование, непрозрачность и режимы наложения;
- девять настраиваемых стилей слоя: обводка, тиснение, внутренние тень и свечение, наложение цвета, градиента и узора, внешнее свечение и тень; окно параметров перемещается за заголовок и показывает изменения до применения;
- перемещение слоёв и числовые трансформации: позиция, размер, масштаб, поворот;
- **умная привязка при перемещении**: края и центры выбранного слоя притягиваются к краям/центру холста и к геометрии других видимых слоёв; чувствительность остаётся визуально стабильной при любом масштабе;
- **Smart Guides** показывают розовые направляющие в момент срабатывания привязки; `Ctrl` во время перетаскивания временно отключает привязку, а `Shift` ограничивает движение одной осью;
- шесть быстрых команд выравнивания выбранного слоя по холсту: слева, по центру X, справа, сверху, по центру Y и снизу — с корректным учётом поворота слоя;
- панель инструментов и основные действия получили единый набор **векторных SVG-иконок** и собственный знак ZeTer вместо платформозависимых emoji-глифов;
- **8 рабочих transform-handles** вокруг выбранного слоя, включая повёрнутые слои; `Shift` при перетаскивании угловой ручки сохраняет пропорции;
- `Alt` при перетаскивании transform-handle масштабирует слой **от центра**; `Alt+Shift` совмещает масштабирование от центра и сохранение пропорций;
- отдельная ручка вращения над рамкой слоя; `Shift` при вращении привязывает угол к шагу 15°;
- слой можно частично увести за пределы холста мышью, как в настольных редакторах;
- **drag-and-drop порядка слоёв** прямо в панели «Слои»;
- **группы слоёв**: новая кнопка папки создаёт группу, слой можно перетащить на заголовок группы; группы сворачиваются/разворачиваются, переименовываются и удаляются без удаления самих слоёв;
- **видимость и блокировка групп**: глаз скрывает/показывает всё содержимое группы, а замок защищает дочерние слои от редактирования, перемещения и структурных изменений; индивидуальная видимость/блокировка слоёв сохраняется;
- **переименование слоёв** доступно через отдельную кнопку `✎`, двойной клик по имени, `F2` и меню «Слой → Переименовать слой»;
- **четыре типа выделения (`M`)**: прямоугольное, эллиптическое, свободное лассо и многоугольное лассо; `Shift+M` переключает типы, `Shift` при прямоугольном/эллиптическом выделении создаёт квадрат/круг, а многоугольное лассо завершается двойным щелчком или `Enter`;
- **`Ctrl+C` / `Ctrl+X` работают с выделением любой формы через системный буфер PNG**: область вне прямоугольника, эллипса или лассо остаётся прозрачной. В параметрах инструмента `M` можно выбрать источник: **«Со всех видимых слоёв»** (по умолчанию, объединённый результат) или **«С выбранного слоя»**. В режиме всех слоёв `Ctrl+X` действительно вырезает область **со всех доступных видимых слоёв**: растровые слои очищаются напрямую, а пересекающиеся редактируемые текстовые/фигурные слои автоматически растрируются и затем очищаются внутри выделения. Заблокированные слои не изменяются; после успешного копирования/вырезания выделение снимается и автоматически включается «Перемещение»;
- кисть, ластик и **кисть размытия (`R`)** учитывают активное выделение и не изменяют пиксели за его пределами;
- кисть размытия работает локально по текущему растровому слою: размер кисти задаёт область, «Сила размытия» — интенсивность одного штриха в процентах; повторные отпечатки внутри одного штриха не усиливают размытие;
- ретушь текущего растрового слоя: **Штамп (`S`)**, **Лечебная кисть (`J`)** и **Палец (`N`)** используют мягкие края, **Осветлитель (`O`)** и **Затемнитель (`Shift+O`)** меняют только RGB существующих пикселей и сохраняют прозрачность; сила осветления и затемнения регулируется отдельно для каждого инструмента и не накапливается от соседних отпечатков одного штриха; источник штампа и лечебной кисти задаётся через `Alt+клик`;
- **Градиент (`Shift+G`)** создаёт линейный или радиальный переход между двумя цветами на отдельном слое и показывает сам переход до отпускания кнопки мыши;
- **Перо (`P`)**, Stage 2b: клик создаёт corner-узел, click+drag — smooth Bézier-узел; у выбранного path-слоя видны anchors/handles, anchor можно перетаскивать вместе с ручками, handle — менять отдельно, `Alt+drag` разрывает симметрию, `Shift+drag` по anchor создаёт smooth handles, `Alt+click` по anchor сбрасывает его в corner; cubic-контуры сохраняются в `.zpe`, старые прямолинейные pathPoints остаются совместимыми; **Магнитное лассо (`A`)** прослеживает границу промежуточными точками между кликами, а **Волшебная палочка (`W`)** выделяет связанную область похожего цвета;
- панель инструментов на широком экране имеет две колонки; у каждого инструмента есть развёрнутая подсказка с назначением и горячей клавишей;
- заливка (`G`) связной области с регулируемым допуском цвета и непрозрачностью;
- инструмент «Линия» (`L`) рисует в текущем растровом слое; при его отсутствии создаётся один переиспользуемый слой «Линии», а `Shift` привязывает направление к шагу 45°;
- инструмент «Лупа» (`Z`) масштабирует относительно точки клика; `Alt+клик` уменьшает масштаб;
- кисть и ластик;
- поддержка давления пера для кисти; `[` / `]` меняют размер кисти, `Shift` даёт крупный шаг;
- видимый контур кисти/ластика/размытия под курсором учитывает масштаб и поворот целевого растрового слоя;
- масштаб до **1600%**, при больших увеличениях включается пиксельное отображение для точной ретуши;
- завершение штриха сохраняется через асинхронный `canvas.toBlob()`, поэтому PNG-кодирование меньше блокирует интерфейс на больших слоях;
- защита от гонки быстрых pointer down/up во время подготовки растрового слоя и от запуска следующего штриха, пока предыдущий ещё сохраняется;
- **ускоренная кисть 1.3:** во время штриха Canvas больше не кодируется в PNG на каждом движении мыши;
- live-preview кисти ограничен частотой кадров браузера (`requestAnimationFrame`), а накопленные pointer events обрабатываются через `getCoalescedEvents()`;
- длинный штрих рисуется по сегментам, без повторной прорисовки всей накопленной траектории;
- история имеет ограничение по памяти, чтобы серия растровых Undo-снимков не раздувала RAM бесконтрольно;
- текст, прямоугольники и эллипсы; `Shift` при рисовании фигуры создаёт квадрат или круг; новые текст/фигуры наследуют текущую непрозрачность инструмента;
- инструмент «Текст» при клике по существующему текстовому слою открывает его редактирование вместо создания лишнего слоя;
- кадрирование, пипетка и панорамирование;
- «Размер изображения» масштабирует документ вместе со слоями и отклоняет преобразование, которое исказило бы повёрнутый слой или изменилось бы после повторного открытия; «Размер холста» меняет рабочую область без скрытого масштабирования содержимого и имеет 9-точечный якорь;
- текстовые и фигурные слои можно **растрировать** для дальнейшей работы кистью и ластиком;
- **неразрушающая цветокоррекция растрового слоя** с живым предпросмотром: экспозиция, яркость, контраст, светлые области, тени, температура, оттенок, насыщенность, красочность (Vibrance), тон и гамма;
- **корректирующие слои (Adjustment Layers), Stage 1**: отдельный слой применяет тот же набор цветовых коррекций и эффектов ко всему нижележащему стеку, не изменяя исходные пиксели;
- **маски слоёв, Stage 1**: к обычному или корректирующему слою можно добавить маску «показать всё» либо создать маску из текущего выделения; маска сохраняется в `.zpe` и участвует в рендере;
- **Select & Mask Foundation Stage 9a**: команда «Уточнить выделение → маска…» строит маску выбранного слоя из любой формы выделения и даёт сглаживание, расширение/сжатие края, растушёвку, контраст края и инверсию; тяжёлая refinement-обработка ограничена 12 МП, чтобы не замораживать вкладку;
- **Select & Mask Preview Stage 9b**: окно уточнения показывает live preview итоговой 8-bit маски до изменения документа. Preview строится в bounded reduced-resolution buffer, пересчитывается через `requestAnimationFrame` при изменении параметров и использует тот же `refineMaskAlpha()`/scale contract, что финальное применение;
- **Select & Mask Edge Detection Stage 9c**: добавлены Radius, Strength и Smart Radius. В полосе вокруг грубой границы маски алгоритм ищет уверенные foreground/background samples и переносит край по сходству RGBA, поэтому тонкие контрастные детали рядом с исходной границей могут возвращаться в маску. Smart Radius уменьшает влияние там, где цветовые классы неразличимы; preview и финальное применение используют один pipeline. Это собственная bounded эвристика ZPE, а не заявление о pixel-identical Photoshop Refine Edge;
- **Select & Mask View Modes Stage 9d**: live preview переключается между «Чёрно-белая маска», «Наложение», «На чёрном» и «На белом». Режим просмотра влияет только на визуализацию preview и не меняет параметры/результат маски; compositor вынесен в pure `composeMaskPreviewRgba()` и покрыт regression tests;
- **Vector Masks Stage 10a + Path Operations Stage 10b**: любой слой может хранить `.zpe` vector mask как набор cubic Bézier subpaths в локальных координатах слоя. Текущее выделение можно превратить в маску, заменить ею маску или добавить как `Add / Subtract / Intersect / Exclude`; прямоугольник остаётся 4 узлами, эллипс сохраняется четырьмя cubic Bézier-сегментами. Vector mask можно включать/выключать, инвертировать и удалять; raster mask и vector mask пересекаются в одном isolated render pipeline;
- **Vector Mask Direct Edit Stage 10c**: команда «Редактировать векторную маску пером» включает отдельный Pen edit mode для всех subpaths выбранной маски. На холсте виден пунктирный контур, anchors и Bézier handles; anchors/handles двигаются теми же gesture-контрактами, что shape path, а история различает изменения mask/path. Клик мимо существующего узла в mask edit mode не создаёт случайный shape-layer;
- **Native PSD/PSB Vector Masks Stage 10d**: adapter читает и пишет Photoshop Additional Layer Info `vmsk`/`vsms` по 26-byte Path Resource records: invert/disable/not-link flags, initial fill, closed/open subpaths, linked/unlinked Bézier knots и `Add / Subtract / Intersect / Exclude`. При экспорте vector mask больше не запекается в layer pixels; source bitmap и native mask сохраняются раздельно;
- **PSD/PSB Saved Paths Stage 10e**: Image Resources `2000..2997` читаются в `document.paths`, сохраняются в `.zpe` и записываются обратно в PSD/PSB. Поддерживаются open/closed cubic paths, fill rule и исходный resource id/name;
- **Paths Panel Stage 10f**: правая панель «Контуры» показывает saved paths независимо от слоёв. Можно сохранить текущий shape path, vector mask или выделение как document path, переименовать/дублировать/удалить его, редактировать anchors/handles инструментом «Перо» прямо в document coordinates и применить выбранный path как векторную маску обычного слоя. Выбор path хранится отдельно для каждой вкладки;
- **все ползунки цветокоррекции вынесены в отдельную правую панель «Цвет и эффекты»**; изменения видны на холсте сразу, без обязательного открытия отдельного окна;
- блоки **«Свойства»**, **«Цвет и эффекты»**, **«Слои»** и **«История»** можно сворачивать; состояние свёртки запоминается между запусками;
- меню «Изображение → Цветокоррекция…» сохранено как альтернативный расширенный способ работы; есть отдельный сброс цветокоррекции и общий сброс фильтров;
- размытие и остальные эффекты слоя находятся в той же отдельной панели «Цвет и эффекты»;
- команды «Центрировать слой на холсте» и «Вписать слой в холст»;
- защитный лимит растровых Canvas-буферов **48 МП**, включая ручное изменение размеров растрового слоя;
- ограниченный decode-cache изображений и устойчивое продолжение рендера при повреждённом embedded raster;
- **Pixel Worker Stage 6a**: крупные advanced color corrections (от 512×512 px) выполняются в bounded Blob Worker с transferable RGBA buffer; при недоступном Worker или ошибке остаётся синхронный fallback. Такой worker работает и при прямом `file://` запуске без сетевой загрузки скрипта;
- Undo / Redo и **кликабельная история действий** с переходом прямо к выбранному состоянию;
- **несколько вкладок документов**: кнопка **«+»** в верхней полосе создаёт сколько угодно независимых вкладок с собственными слоями, историей Undo/Redo, масштабом и признаком несохранённых изменений;
- **Smart Objects Stage 5a**: выбранный raster/text/shape слой можно преобразовать в нативный ZPE smart-object. Исходное содержимое хранится как `embeddedDocument`, отображение — как отдельный `previewDataUrl`; двойной клик по миниатюре открывает содержимое в связанной вкладке, а `Ctrl+S` обновляет preview и создаёт одну запись истории в родительском документе;
- **Smart Filters Stage 11a**: smart-object хранит отдельный ordered stack до 24 неразрушающих фильтров. В Properties можно добавлять, редактировать с live preview, включать/выключать, переставлять и удалять фильтры; визуальный список top-first, а render применяет enabled entries снизу вверх. Каждый entry использует существующие цветовые коррекции + blur, тяжёлые advanced RGBA-преобразования проходят через Pixel Worker, а cache key включает `previewDataUrl + stack signature`, поэтому обновление содержимого или порядка не оставляет stale preview;
- **Smart Filter Masks Stage 11b**: у смарт-объекта появилась отдельная маска стека Smart Filters, независимая от маски самого слоя. Её можно создать как «показать всё» или из текущего выделения, включать/отключать, инвертировать, удалять, а также менять плотность и растушёвку; renderer смешивает исходный smart-object preview с отфильтрованным результатом по маске и учитывает её в cache signature.
- **Linked Smart Objects Stage 11c**: команда «Создать связанную копию смарт-объекта» создаёт несколько экземпляров одного внутрипроектного источника. Все экземпляры сохраняют собственные transform/opacity/blend/masks/Smart Filters, но редактирование содержимого через связанную вкладку и `Ctrl+S` обновляет embedded document + preview сразу у всей группы одной записью истории; «Разорвать связь» превращает выбранный экземпляр в независимый, сохраняя текущее содержимое. Это внутренняя связь внутри `.zpe`; постоянная связь с внешним файлом на диске пока не реализована.
- **High-depth Raster Source Stage 12a**: импортированные RGB 16/32-bit PSD/PSB сохраняют исходный typed PixelBuffer внутри `.zpe` как bounded canonical binary source (до 48 МБ raw на документ) параллельно с RGBA8 preview. Этот foundation используется Stage 12b для high-depth render/color, Stage 12d для базовых typed destructive operations, Stage 12e для native 16/32-bit PSD/PSB export и Stage 12f для typed retouch; Canvas8 остаётся fallback-границей для неподдержанных операций.
- **High-depth Render Bridge Stage 12b**: raster layer с `highDepthSource` рендерится из сохранённого `Uint16Array`/`Float32Array`: exposure, gamma, temperature/tint, vibrance, highlights и shadows считаются до преобразования в 8-bit. Для 32-bit linear HDR используется ACES-style tone mapping + linear→sRGB display conversion, для 16-bit sRGB — high-precision linearized correction с clip display bridge. Декодированный typed source кэшируется bounded-кэшем на 2 слоя; после Stage 12d/12f и базовые pixel tools, и основные retouch tools продолжают изменять typed source, а Canvas8 остаётся display/fallback boundary.
- **HDR Preview Controls Stage 12c**: для каждого high-depth raster layer в Properties доступны **Tone map: Auto / Clip / ACES** и **Display exposure −6…+6 EV**. Они сохраняются в `.zpe`, не меняют исходный `Uint16Array`/`Float32Array` и входят в render-cache signature. `Auto` выбирает Clip для 16-bit и ACES для 32-bit float; display exposure применяется непосредственно перед tone mapping. Stage 12d сохраняет эти настройки и source при поддержанных typed destructive operations; очистка metadata происходит только при переходе на Canvas8 fallback.
- **Native High-depth Editing Foundation Stage 12d**: базовые destructive-операции над high-depth raster работают прямо по `Uint16Array` / `Float32Array`: кисть, ластик, линия, заливка, очистка выделения и cut/clear по видимым слоям используют typed-buffer mutation path. RGB без alpha при необходимости ластика/очистки безопасно расширяется до straight RGBA той же bit depth; 16-bit samples остаются 16-bit, Float32 HDR headroom выше `1.0` сохраняется. Во время штриха renderer получает tone-mapped preview с `skipAdjustments`, а после commit новый high-depth source сериализуется обратно в `.zpe`; Canvas8 fallback остаётся только для неподдержанных границ/операций.
- **Native 16/32-bit PSD/PSB Export Stage 12e**: writer теперь выбирает глубину документа `8 / 16 / 32` и для совместимых high-depth raster layers пишет исходные `Uint16Array` / `Float32Array` samples напрямую в Photoshop channel data без RGBA8 round-trip. 16/32-bit layer records помещаются в document-level `Lr16` / `Lr32` tagged blocks, а PSB использует long `8B64` block lengths; high-depth channels и composite пишутся Raw/big-endian, существующий 8-bit путь сохраняет row-bounded PackBits/RLE. Трансформированные/отфильтрованные/стилизованные high-depth layers честно уходят через 8-bit raster preview с warning; если в документе есть native high-depth слои, такие fallback layers расширяются до общей глубины без ложного восстановления precision. Stage 12g расширяет это до совместимого многослойного merged composite: native high-depth RGB, opacity, blend modes и bitmap masks собираются typed pipeline; Canvas8 остаётся явным fallback только для пока несовместимой семантики.
- **Typed High-depth Retouch Stage 12f**: `Blur`, `Clone Stamp`, `Healing`, `Smudge`, `Dodge` и `Burn` получили native typed path поверх `Uint16Array` / `Float32Array`. Dodge/Burn работают как exposure change в linear working space и поэтому не «ломают» HDR highlights выше `1.0`; blur усредняет linear RGB с alpha weighting и не квантует 16-bit samples; Clone использует immutable typed snapshot + bilinear sampling; Healing переносит texture с локальной color/luminance adaptation; Smudge переносит high-depth samples между соседними областями без Canvas8 round-trip. Selection, stroke coverage и tone-mapped live preview сохранены; commit обновляет `highDepthSource`, поэтому после ретуши такой слой всё ещё может экспортироваться native 16/32-bit через Stage 12e.
- **High-depth Multi-layer Composite / Export Bridge Stage 12g**: совместимые multi-layer RGB 16/32-bit стеки теперь собирают merged composite напрямую в typed PixelBuffer, без промежуточного Canvas8. Pipeline учитывает straight alpha, layer opacity, integer bounds, bitmap masks и режимы Normal/Multiply/Screen/Overlay/Darken/Lighten/Color Dodge/Color Burn; при смешанном 16→32-bit стеке sRGB samples переводятся в linear Float32 working space, поэтому HDR значения выше `1.0` не клипуются. 8-bit rasterized fallback layers могут участвовать в том же typed composite как честно widened source, не понижая precision соседних native слоёв. Pass-through группы с opacity 100% разворачиваются в том же порядке, а isolated groups, vector masks, adjustment layers, нестандартный background или превышение 256 МБ output-budget явно оставляют merged image на старом Canvas8 fallback.
- **CMYK / ICC Preview Foundation Stage 13a**: PSD/PSB importer принимает RGB **и CMYK** 8/16/32-bit/channel, отделяет C/M/Y/K от optional alpha и переводит Photoshop-inverted storage во внутренний ink-space PixelBuffer. Базовый ICC bridge поддерживает `A2B0/A2B1/A2B2` `mft1/mft2`, 4D CLUT и PCS Lab/XYZ → sRGB display; canonical CMYK source сохраняется внутри `.zpe` независимо от 8-bit preview.
- **Advanced ICC + Native CMYK Round-trip Stage 13b**: ICC engine теперь понимает v4 `lutAToBType (mAB )` с `curveType`/`parametricCurveType`, A→CLUT→M→Matrix→B pipeline и float `multiProcessElementsType (mpet)` для поддержанных `clut`/`matf` элементов `D2B0..D2B3`. Документ хранит `renderingIntent` + `displaySpace=sRGB`; intent можно переключать у CMYK-слоя, после чего display previews пересчитываются из canonical source. PSD/PSB writer получил настоящий color mode 4: C/M/Y/K снова инвертируются в Photoshop storage, alpha идёт отдельным каналом, 8/16/32-bit typed samples и ICC resource сохраняются native. Совместимый CMYK stack собирает merged image прямо в 5-channel PixelBuffer с opacity и bitmap masks; при mixed RGB, text/shape, adjustment/vector-mask/isolated-group semantics, non-Normal blend или RGB background экспорт честно остаётся на RGB preview fallback.
- **Native CMYK Editing + Full Proofing Path Stage 13c**: Brush/Eraser/Fill/Clear/Line и typed Blur/Clone/Heal/Smudge/Dodge/Burn работают по canonical CMYK PixelBuffer без RGB raster round-trip; CMYK compositing поддерживает bounded component blend modes. ICC core понимает MPE `cvst/curf`, B2D/B2A и `mBA`, а soft proof выполняет source CMYK → PCS → proof CMYK → PCS → display с BPC.
- **Production Color Proofing & Display Profiles Stage 13d**: `.zpe` хранит независимый RGB display ICC и отдельный proof intent. Preview проходит `CMYK source ICC → PCS → optional proof CMYK/BPC → RGB display ICC`; поддерживаются PCS→RGB LUT/MPE и типичные monitor `rXYZ/gXYZ/bXYZ + rTRC/gTRC/bTRC` matrix/TRC profiles. Gamut Warning строит magenta overlay по proof/display round-trip ΔE без изменения canonical CMYK samples. Выбранный display ICC симулируется внутри preview; физическую калибровку монитора завершает browser/OS compositor.
- **Real ICC / Photoshop Compatibility Corpus Stage 13e**: tests теперь используют закреплённые реальные CC0 CMYK/Display-P3 ICC profiles и MIT PSD/PSB fixtures из внешних проектов, а не только synthetic bytes. Независимый oracle от Pillow 12.3.0 / LittleCMS 2.19 проверяет CMYK→PCS Lab/XYZ, sRGB и Display P3 с bounded tolerance; fixture manifest фиксирует upstream commit/blob, размер и SHA-256. Реальный 4×4 CMYK PSD с ~557 КБ printer ICC проходит native raster/profile round-trip, а внешний layered PSB v2 проверяет groups/vector mask/ICC import.
- **Photoshop-native Smart Objects / Placed Layer Round-trip Stage 14a**: PSD/PSB adapter сохраняет bounded opaque `PlLd`, `SoLd`, `SoLE` и document-level `lnk2/lnkD/lnkE` blocks. Реальный внешний Photoshop Smart Object импортируется как ZPE smart-object preview, а не как обычный raster-layer; пока preview/geometry/filters не изменены, native metadata и linked-resource bytes проходят byte-for-byte PSD/PSB round-trip. После трансформации, фильтра, изменения preview или нарушения исходного набора Smart Objects passthrough автоматически отключается и экспорт честно растрирует слой без stale placed/linked metadata.
- **Smart Object Descriptor & Embedded Asset Extraction Stage 14b**: adapter bounded-разбирает `SoLd/SoLE` ActionDescriptor foundation и typed Linked Layer records (`liFD` embedded data, `liFE` external, alias), связывает их по UUID и определяет payload type по Photoshop filetype + magic bytes. Embedded PNG/JPEG/WebP/GIF/BMP открываются как редактируемый content-tab; embedded PSD/PSB декодируется в bounded nested ZPE document. External links никогда автоматически не читаются по путям из PSD. Пока извлечённое содержимое не изменено, Stage 14a opaque round-trip остаётся byte-for-byte; после редактирования export честно переходит к raster fallback до Stage 14c resource rewrite.
- **Smart Object Embedded Asset Rewrite & Resource Rebuild Stage 14c**: editable Photoshop Smart Object content теперь может вернуться в native `liFD` resource без потери Smart Object identity. Для embedded PNG и bounded embedded PSD/PSB ZPE пересобирает payload, обновляет 64-bit `datasize`, record length/padding и matching `lnk*` block по UUID, не трогая соседние linked records. Несколько Photoshop-экземпляров с одним UUID используют один content-tab/source и обновляются вместе. Placed layer geometry сохраняется отдельно от embedded-document size; если размер content меняется, тип payload unsupported или rewrite не проходит safety gate, native passthrough намеренно отключается и остаётся безопасный raster fallback.
- импорт PNG/JPEG/WebP/GIF/BMP/SVG;
- **PSD Import Stage 3**: локальный offline decoder открывает RGB/8-bit `.psd` как редактируемый стек растровых слоёв, переносит bounds, visibility, opacity, поддерживаемые blend modes и bitmap layer masks; raw/RLE/ZIP channel compression декодируется без CDN и внешнего runtime;
- **PSD Export Stage 4 + Stage 12e/12g + Stage 13b**: экспортирует RGB и совместимый native CMYK `.psd`; CMYK writer пишет color mode 4, C/M/Y/K + alpha и сохраняет 8/16/32-bit typed precision. Несовместимая семантика остаётся явным RGB preview fallback;
- **PSD Writer Stage 6b**: PackBits/RLE channels кодируются построчно с bounded row buffer, без полноразмерных временных channel planes; крупные writer sections собираются chunk-wise без промежуточных full-section копий. Это снижает peak memory и подготавливает streaming/PSB pipeline;
- **PSD Blob Stage 6c**: браузерный экспорт собирает `Blob` прямо из готовых writer chunks вместо обязательного финального `Uint8Array` + второго `Blob`-обёртывания; byte-array API `encodePsd()` сохранён для совместимости и тестов;
- **PSB Stage 7a + Stage 12e + Stage 13b**: импорт/экспорт `.psb` с RGB/CMYK color modes, 64-bit section/channel lengths, 32-bit RLE scanline counts для 8-bit и `8B64` `Lr16/Lr32` для native 16/32-bit channels;
- **PixelBuffer Stage 7b**: adapter boundary получил typed pixel contract для RGB/CMYK и 8/16/32-bit samples (`Uint8ClampedArray` / `Uint16Array` / `Float32Array`). Stage 12a сохраняет RGB high-depth source в `.zpe`, Stage 12b рендерит его, Stage 12d/12f редактируют typed samples, Stage 12e экспортирует layer channels обратно, а Stage 12g собирает совместимый merged composite без Canvas8; финальный экранный Canvas display всё ещё 8-bit;
- **RGB 16-bit Import Stage 7c**: PSD/PSB RGB 16-bit Raw/RLE/ZIP декодируются в `Uint16Array` PixelBuffer; Stage 12a сохраняет source в `.zpe`, Stage 12b применяет advanced color controls, Stage 12d/12f выполняют typed destructive/retouch editing, а Stage 12e экспортирует native 16-bit channels;
- **RGB 32-bit Float Import Stage 7d**: PSD/PSB RGB 32-bit/channel Raw/RLE/ZIP декодируются из big-endian IEEE-754 samples в `Float32Array`, включая значения вне 0..1. Stage 12b делает high-depth exposure/color и ACES-style HDR preview, Stage 12d/12f сохраняют HDR headroom при destructive/retouch editing, Stage 12e экспортирует Float32 channels, а Stage 12g сохраняет HDR precision в совместимом multi-layer merged composite; полноценное ICC color management пока не заявляется;
- **High-depth ZIP Prediction Stage 7e**: compression=3 теперь поддержан для RGB 8/16/32-bit layer и composite channels: 16-bit predictor восстанавливается по big-endian sample words, 32-bit predictor — через Photoshop byte-plane shuffle + delta decode. Inflate поток ограничен ожидаемым размером, чтобы malformed ZIP не мог бесконтрольно раздувать канал;
- **ICC Metadata + Color Management Stage 7f / 13a–13d**: Image Resources сохраняют raw ICC Profile resource `0x040F/1039` и ICC Untagged `0x0410/1041` (bounded до 4 МБ). CMYK source/proof transforms используют `mft1/mft2`, `mAB/mBA`, D2B/B2D MPE + `cvst/curf`; display target поддерживает RGB output LUT/MPE и matrix/TRC profile. Source, proof и display ICC имеют отдельное ownership.
- **ICC Metadata Round-trip Stage 7g**: импортированный ICC profile сохраняется внутри `.zpe` как bounded base64 metadata и при PSD/PSB export возвращается в Image Resources вместе с intentionally-untagged flag. Пиксели при этом всё ещё редактируются в unmanaged Canvas pipeline, поэтому экспорт явно предупреждает: profile preservation ≠ полноценное color management;
- **PSD/PSB Group Import Stage 8a**: `lsct` open/closed-folder и bounding-divider records восстанавливаются в группы ZPE; сохраняются принадлежность слоёв, видимость и collapsed-state. На этом промежуточном этапе nested context временно flatten в `Parent / Child`; Stage 8c ниже заменяет это настоящей `parentGroupId`-иерархией;
- **PSD/PSB Group Export Stage 8b**: базовый writer экспортирует группы как настоящие Photoshop `lsct` folder/bounding records с Unicode-именем, visibility и open/closed state; Stage 8c ниже расширяет этот контракт до nested hierarchy. Индивидуальная видимость дочерних слоёв не теряется при скрытой группе;
- **Nested Groups Stage 8c**: модель `.zpe` получила `parentGroupId`; visibility и lock наследуются через всю цепочку родителей, панель слоёв показывает настоящую иерархию с отступами и recursive collapse. PSD/PSB import сохраняет `parentKey`, а writer строит вложенные `lsct` boundaries по переходам group lineage, поэтому `Outer → Inner` round-trip больше не превращается в имя `Outer / Inner`;
- **Nested Groups UX Stage 8d**: группы теперь можно перетаскивать друг в друга в панели слоёв, вытаскивать обратно на верхний уровень и создавать подгруппу через контекстное меню. Cycle/lock guards работают через state API, поэтому нельзя вложить группу в саму себя или собственного потомка;
- **Group Compositing Stage 8e**: группы получили собственные `opacity` и `blendMode` (`Pass Through`, Normal, Multiply, Screen, Overlay и др.). Pass Through при 100% рендерится прямо в родительский стек, а opacity/non-pass-through группы изолируются во временный Canvas и затем композитятся как единый результат; PSD/PSB `lsct` folder opacity/blend теперь импортируются и экспортируются;
- **перетаскивание изображений с рабочего стола по всему окну редактора**;
- **вставка изображения из буфера обмена через Ctrl+V** (включая скриншоты);
- `Ctrl+V` использует нативную вставку и резервное чтение Clipboard API, когда браузер это разрешает;
- редактор стартует с чистым документом, поэтому первое фото открывается без демонстрационных слоёв под ним;
- открытие `.zpe`, старых `.pixforge` и совместимого JSON перетаскиванием;
- **аварийное автосохранение и восстановление** через IndexedDB: каждое окно хранит отдельную копию своих несохранённых вкладок; при новом запуске можно восстановить найденные документы или отложить решение, сохранив копии; повреждённая копия не открывается без проверки и остаётся в хранилище;
- автосохранение выполняется с задержкой после изменений и сериализует фоновые записи; `Ctrl+S` запускает скачивание `.zpe`, но браузер не подтверждает запись файла на диск, поэтому отметка несохранённых изменений и аварийная копия остаются;
- собственный проект `.zpe` с embedded data URL;
- экспорт PNG/JPEG/WebP, layered PSD Stage 4 и RGB/8-bit PSB Stage 7a;
- полнофункциональное верхнее меню: Файл, Правка, Слой, Изображение, Выделение, Вид, Помощь;
- управление главным меню с клавиатуры: стрелка вниз открывает меню, ↑/↓ перемещают фокус, Esc закрывает;
- горячие клавиши работают по `KeyboardEvent.code`, поэтому основные Ctrl-команды не зависят от русской/английской раскладки;
- стрелки двигают выбранный слой на 1 px, Shift+стрелки — на 10 px;
- Alt+↑ / Alt+↓ переключает выбранный слой;
- `Ctrl+колесо мыши` и `Alt+колесо мыши` масштабируют холст **под курсором**, сохраняя точку просмотра;
- `Ctrl++` / `Ctrl+-` меняют масштаб, `Ctrl+0` вписывает документ в окно, `Ctrl+1` устанавливает 100%;
- `Space+drag` и средняя кнопка мыши временно панорамируют холст без переключения текущего инструмента;
- `Tab` включает режим холста: скрывает левую панель инструментов и правые панели, сохраняя текущую область просмотра;
- панель слоёв поддерживает клавиатуру: `↑/↓`, `Home/End`, `Enter/F2` для переименования и `Delete` для удаления;
- одиночные горячие клавиши больше не перехватывают `Space`, `Delete` и стрелки у кнопок и других интерактивных контролов;
- F11 пытается включить полноэкранный режим;
- изменения фильтров и непрозрачности дают живой preview и фиксируются в истории;
- полный рендер сериализован и коалесцируется: устаревший асинхронный кадр больше не может дорисоваться поверх нового;
- масштабирование растров использует высококачественное Canvas smoothing;
- загрузка `.zpe` жёстче нормализует повреждённые/аномальные параметры слоя, duplicate ID и неподдерживаемые blend mode; неизвестная версия формата отклоняется вместо молчаливого преобразования, а совместимый старый JSON без поля `version` по-прежнему открывается как v1.

## Основные горячие клавиши

- `Ctrl+N` — новый документ;
- `Ctrl+O` — импорт изображения;
- `Ctrl+S` — сохранить `.zpe`; во вкладке содержимого smart-object — обновить родительский smart-object;
- `Ctrl+Shift+S` — экспорт;
- `Ctrl+C` — скопировать активное выделение как PNG из выбранного в инструменте `M` источника: все видимые слои или выбранный слой;
- `Ctrl+X` — вырезать активное выделение в буфер по выбранному режиму; после операции редактор автоматически переключается на «Перемещение»;
- `Ctrl+V` — вставить изображение из буфера;
- `Ctrl+Z` / `Ctrl+Y` — отмена / повтор;
- `M` — инструмент выделения; `Shift+M` — переключить тип выделения;
- `Ctrl+J` — дублировать слой;
- `Ctrl+Shift+N` — новый растровый слой;
- `Delete` — очистить пиксели внутри активного выделения на растровом слое; иначе удалить слой;
- `Ctrl+A` / `Ctrl+D` — выделить весь холст / снять выделение;
- `S` / `J` — штамп / лечебная кисть; `Alt+клик` задаёт источник;
- `N` — палец / смазывание; `O` / `Shift+O` — осветлитель / затемнитель;
- `G` / `Shift+G` — заливка / градиент; `P` — перо; `A` — магнитное лассо; `W` — волшебная палочка;
- `V/M/B/R/E/L/T/U/C/I/H/Z` — остальные инструменты (`R` — кисть размытия);
- `0` — вписать в окно, `1` — 100%;
- `Ctrl++` / `Ctrl+-` — изменить масштаб, `Ctrl+0` — вписать в окно, `Ctrl+1` — 100%;
- `Ctrl+колесо` / `Alt+колесо` — масштаб под курсором;
- `Space+drag` или средняя кнопка мыши — временное панорамирование;
- `Tab` — режим холста без боковых панелей;
- `Arrow keys` — сдвиг слоя, `Shift` ускоряет до 10 px;
- в панели слоёв: `↑/↓`, `Home/End`, `Enter/F2`, `Delete`; слой можно перетащить на заголовок группы, а на свободное место панели — вынести из группы.

## Запуск на Windows

Самый простой вариант: дважды кликните `start.bat` или сразу `index.html`. Версия 1.35.0 специально собрана так, чтобы работать через обычный `file://` запуск — **Python, Node.js и локальный HTTP-сервер для использования редактора больше не нужны**.

Если браузер показывает старую версию после обновления архива, закройте старую вкладку и откройте `index.html` из новой распакованной папки.

## Запуск через HTTP — только при необходимости

Для разработки можно использовать:

```bash
python3 -m http.server 4173
```

Runtime не требует npm-пакетов. Node.js нужен только разработчику для пересборки `src/app.bundle.js` и тестов.

Автовосстановление использует IndexedDB. Если конкретный браузер запрещает локальное хранилище в режиме `file://`, редактор продолжит работать без него; для разработки и максимально предсказуемой browser-storage семантики можно запускать через локальный HTTP.

## Тесты

Нужен Node.js 20+:

```bash
npm test
```

Также рекомендуется browser smoke-проверка меню, drag-and-drop, вставки из буфера, Undo/Redo и экспорта — эти сценарии нельзя надёжно доказать одним чтением JavaScript.

## Диагностика, bug reports и security

Для воспроизводимого бага используйте **[Bug report](https://github.com/zeter1/ZeTer-Photo-Editor/issues/new?template=bug_report.yml)**. Особенно полезны: версия/commit, браузер и ОС, режим запуска (`file://` или HTTP), тип документа, размер изображения, PSD/PSB bit depth/color mode, точные шаги и небольшой фрагмент DevTools Console.

Для import/export проблем по возможности прикладывайте минимальный воспроизводимый файл без приватного содержимого. Не публикуйте реальные рабочие изображения, `.zpe`, PSD/PSB или ICC-профили, если в них есть конфиденциальные данные.

Политика ответственного сообщения об уязвимостях: **[SECURITY.md](SECURITY.md)**.

## Архитектура

- `src/core/state.js` — модель документа и слоёв;
- `src/core/color.js` — попиксельная цветокоррекция, тональный диапазон и проверяемые RGB-преобразования;
- `src/core/render.js` — Canvas 2D renderer, кэш скорректированных растров, live raster override для кисти и экспорт;
- `src/core/history.js` — snapshot-based Undo/Redo с лимитом количества состояний и бюджета памяти;
- `src/core/geometry.js` — геометрия и масштаб;
- `src/core/io.js` — browser I/O helpers;
- `src/core/pixels.js` — пиксельные операции, включая flood fill;
- `src/core/recovery.js` — неблокирующее аварийное автосохранение/восстановление через IndexedDB;
- `src/core/pixel-buffer.js` — typed pixel contract для RGB/CMYK, 8/16/32-bit sample storage и явного RGB→RGBA8 preview bridge; CMYK не подменяется приблизительной конверсией без color management;
- `src/adapters/psd.js` — изолированный PSD/PSB Adapter: binary parser/writer, version-aware 32/64-bit lengths, Raw/RLE/ZIP decode, RLE encode и нормализованный RGB/8-bit raster contract;
- `src/main.js` — исходный UI controller, меню, инструменты, drag/drop, clipboard и shortcuts;
- `src/app.bundle.js` — готовая браузерная сборка для прямого запуска через `file://`;
- `tools/build-bundle.mjs` — воспроизводимая сборка runtime без внешних зависимостей;
- `src/styles.css` — интерфейс редактора.

Документ остаётся source of truth, а canvas — представлением. Это позволяет сохранять проект, восстанавливать историю и постепенно наращивать инструменты без превращения Canvas в скрытое состояние приложения.

## Ограничения относительно Photopea

PSD Import Stage 3 / Export Stage 4 и PSB Stage 7a дают layered round-trip, Stage 12e–12g сохраняют native RGB 16/32-bit typed channels и compatible high-depth composite, Stage 13a–13e закрывают native CMYK/color-management и real-world ICC corpus, а Stage 14a–14c сохраняют Photoshop Smart Object metadata, извлекают supported embedded content и для PNG/PSD/PSB умеют переписывать matching `liFD` resource после редактирования без разрушения UUID/placed-layer identity. Ограничение Smart Objects теперь касается внешних file-linked assets, изменения intrinsic content size и неподдержанных embedded formats — для них экспорт честно остаётся на raster fallback. Также ещё нет native Text/Shape/Adjustment mapping, полной parity isolated groups/vector-mask composites и tiled/streaming pipeline.

Следующий imaging-этап: **Stage 15a — Photoshop-native Text Layer Mapping**: разобрать `TySh`/text descriptors в редактируемые ZPE text layers, сохранить transform/typography/paragraph data и добавить безопасный round-trip writer; после этого — Shape/Vector Fill и Adjustment Layer mapping.