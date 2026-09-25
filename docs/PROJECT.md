# Обзор ZeTer Photo Editor

ZeTer Photo Editor — локальный браузерный растровый редактор. Изображения обрабатываются в браузере; внешний сервер для обычной работы не нужен.

## Владельцы кода

- `index.html` и `src/styles.css` — структура и оформление интерфейса.
- `src/main.js` — контроллер UI, инструменты, ввод мыши/клавиатуры, история действий и файловые сценарии.
- `src/core/state.js` — документы, слои, безопасная нормализация проектов и embedded smart-object documents с ограничением вложенности.
- `src/core/render.js` — Canvas 2D-рендер и растровый экспорт.
- `src/core/pixel-worker.js` — bounded worker boundary для тяжёлых per-pixel цветокоррекций; Canvas/document state остаются на main thread.
- `src/core/pixel-buffer.js` — typed RGB/CMYK 8/16/32-bit adapter contract; текущий renderer получает из него только RGBA8 preview, а исходная precision может оставаться в typed buffer на внешней границе.
- `src/adapters/psd.js` — изолированный PSD/PSB adapter: RGB 8/16/32-bit importer и RGB/8-bit writer, version-aware 32/64-bit lengths, импорт/экспорт слоёв, каналов, Unicode-имён и bitmap masks; writer кодирует RLE построчно и собирает крупные sections chunk-wise.
- `src/core/layer-styles.js` — сохранение допустимых значений и Canvas-отрисовка стилей слоя.
- `assets/fonts/*/embedded.css` и `assets/fonts/*/OFL.txt` — локальные свободные шрифты и их лицензии; источники перечислены в [assets/fonts/README.md](../assets/fonts/README.md).
- Остальные `src/core/*.js` — геометрия, пиксельные операции, история, ввод-вывод, цвет и аварийное восстановление.
- `src/app.bundle.js` — генерируемая сборка для прямого запуска через `file://`; источник изменений находится в перечисленных выше файлах.

## Команды

Из корня проекта:

```text
npm run build
npm test
npm run check
npm run test:browser
```

`npm run check` пересобирает bundle, проверяет его синтаксис и запускает все Node regression-тесты. `npm run test:browser` запускает установленный Chrome/Chromium в headless-режиме через DevTools Protocol, открывает реальный `index.html` по `file://` и проверяет старт приложения, DOM-состояние блокировки слоя, guards меню и отсутствие runtime/console errors; при нестандартном расположении браузера можно задать `CHROME_BIN`. Для разработки через HTTP существует `npm run serve`; пользовательский запуск на Windows выполняется через `start.bat` или `index.html`.

## Критические границы

- Растровые кисти работают только с безопасно выделенным Canvas-буфером и публикуют результат в слой после завершения действия.
- Пока жест редактирования или асинхронная растровая операция не завершены, сохранение, экспорт, смена вкладки, замена документа и Undo/Redo отклоняются с просьбой повторить команду; экспорт использует отдельный снимок документа.
- Smart Objects Stage 5a: `embeddedDocument` является source of truth, `previewDataUrl` — только кэш отображения. Вкладка содержимого хранит `smartObjectLink` на родительскую session/layer; `Ctrl+S` обновляет embedded document + preview и добавляет одну запись в history родителя. Закрытие родительской вкладки блокируется, пока открыты дочерние content-tabs; lock родителя нельзя обойти через content-tab. UI и sanitizer ограничивают вложенность smart-object тремя уровнями.
- Pixel Worker Stage 6a: крупный advanced-color RGBA loop может выполняться вне main thread через Blob Worker. Очередь bounded, buffer transferable, ошибки/timeout сбрасывают worker; renderer перечитывает Canvas и использует sync fallback, если transferred buffer уже detached. Worker не владеет document/Canvas state и не загружает внешний script, поэтому `file://` остаётся поддерживаемым.
- PSD Stage 4 — ограниченный RGB/8-bit round-trip: text/shape/transforms/filters/styles растрируются в per-layer preview, groups flatten, bitmap masks сохраняются отдельным user-mask channel. При видимых adjustment layers экспорт добавляет верхний composite preview и скрывает исходные PSD layers, чтобы при открытии сохранить итоговый вид без ложной native Photoshop adjustment-семантики.
- PSD Writer Stage 6b не создаёт full-size channel planes: RLE lengths измеряются по строкам и rows повторно кодируются прямо в chunked writer. Это сознательный memory-first trade-off перед streaming/PSB.
- PSD Blob Stage 6c: UI использует `encodePsdBlob()` и строит Blob прямо из writer chunks; `encodePsd()` остаётся byte-array compatibility API. Это убирает обязательную финальную contiguous-копию в browser download path.
- PSB Stage 7a: adapter принимает version 2 и пишет/читает PSB 64-bit Layer/Mask, Layer Info и channel lengths плюс 32-bit RLE row counts. UI принимает `.psb` и экспортирует через `encodePsbBlob()`. При этом текущие 48 МП/512 МБ/Canvas safety limits сохраняются; `WritableStream`, >2GB workflows, high-depth export/document editing, HDR tone mapping и CMYK не заявляются.
- PixelBuffer Stage 7b: PSD/PSB adapter возвращает `pixelBuffer` как typed raster payload и совместимый `pixels` alias на тот же RGBA8 buffer. RGB 8/16/32-bit может быть безопасно приведён к RGBA8 preview; CMYK хранится типизированно, но preview отклоняется до появления явного color-management adapter. `.zpe` schema и Canvas document source-of-truth пока не мигрированы на high-depth buffers.
- RGB 16-bit Import Stage 7c: PSD/PSB layer/composite channels с глубиной 16-bit декодируются как big-endian samples в `Uint16Array` и сохраняются в PixelBuffer до UI bridge. Raw, PackBits/RLE и ZIP без prediction поддержаны; 16-bit ZIP prediction отклоняется отдельной диагностикой вместо рискованного неверного декодирования. 16-bit layer masks приводятся к 8-bit alpha только на текущей mask/render boundary. После открытия ZPE-документ пока хранит только 8-bit preview, поэтому исходная 16-bit precision после импорта не считается сохранённой.
- RGB 32-bit Float Import Stage 7d: PSD/PSB 32-bit/channel samples читаются big-endian как IEEE-754 `Float32Array`; Raw, RLE и ZIP без prediction поддержаны для layer/composite channels. Значения вне 0..1 сохраняются в PixelBuffer на adapter boundary, но текущий Canvas bridge показывает только clipped 0..1 preview. High-depth ZIP prediction остаётся явным unsupported path; HDR tone mapping/exposure, ICC и сохранение Float32 в `.zpe` требуют следующих этапов.
- PSD/PSB Group Import Stage 8a: adapter интерпретирует `lsct` type 1/2 как open/closed folder и type 3 как hidden bounding divider, собирает group path стеком в порядке layer records и передаёт `groupKey` на bitmap layers. UI создаёт ZPE groups только для реально импортированных слоёв, переносит visibility/collapsed-state; nested paths временно flatten в отдельные группы с именем `Parent / Child`, потому что текущая ZPE group schema не имеет `parentGroupId`. Group opacity и нестандартный group blend mode не подменяются — выдаётся warning.
- Стили слоя хранятся отдельно от исходных пикселей в `.zpe`; окно «Параметры наложения» показывает черновик, отмена восстанавливает прежние значения, применение создаёт одно действие истории. Временные Canvas для стилей ограничены 16 МП; на очень больших слоях предпросмотр и экспорт стилей используют пропорциональное уменьшение для защиты памяти.
- В окне «Параметры наложения» для общих настроек и каждого стиля виден фрагмент итогового холста вокруг слоя. Он копируется после завершённой отрисовки и меняет размер вместе с окном; окно растягивается за нижний правый угол.
- После асинхронного чтения изображения, проекта или буфера обмена операция проверяет исходную вкладку и документ; результат не переносится в другую вкладку. Открытие проекта также отменяется, если за время чтения изменился текущий документ, даже до записи правки в историю. Растеризация дополнительно проверяет, что выбранный слой не изменился до публикации результата.
- Разрушающие растровые инструменты редактируют только текущий выбранный, видимый и незаблокированный растровый слой; они не должны молча переключаться на другой слой под курсором.
- Штамп и лечебная кисть берут неизменяемый снимок источника на начало штриха, чтобы результат не копировал сам себя.
- Осветлитель и затемнитель меняют RGB существующих пикселей с мягким спадом силы, не создают пиксели на прозрачном фоне и не меняют alpha. Сила каждого инструмента задаётся отдельным ползунком; повторные отпечатки в одном штрихе ограничены максимальным воздействием на пиксель.
- Штамп, лечебная кисть, смазывание и локальное размытие используют растушёванный край; сила локального размытия задаётся процентами за штрих и также не накапливается от перекрывающихся отпечатков. Магнитное лассо уточняет промежуточные точки между кликами.
- Волшебная палочка ограничена документами до 8 МП для предсказуемого расхода памяти.
- Состояние проекта хранится в `.zpe`; загрузчик принимает текущую версию v1 и совместимый legacy JSON без поля `version`, но отклоняет неизвестные версии вместо их молчаливого преобразования. Аварийное восстановление использует IndexedDB: каждое окно хранит отдельный снимок всех своих несохранённых вкладок, а при запуске доступны все копии, включая старый одиночный формат. «Позже» оставляет найденные копии без удаления. Скачивание `.zpe` через браузер не подтверждает, что файл появился на диске; до проверки файла вкладка остаётся помеченной несохранённой.
- «Размер изображения» проверяет преобразования всех слоёв до изменения документа и отклоняет размер, при котором повторное открытие `.zpe` обрезало бы координаты или масштаб слоя.
- Node-тесты не доказывают внешний вид, реальные pointer-события или Clipboard API. Автоматический browser smoke теперь доказывает базовый Chromium `file://` startup и критический lock/unlock DOM-contract, но визуальная геометрия, pointer/drag-жесты, Clipboard API и другие browser-specific flows по-прежнему требуют отдельного browser/manual proof.
- Текстовый диалог показывает черновик на холсте через отдельный render-документ; малый предпросмотр копирует тот же фрагмент холста в месте текста, включая фон изображения. До «Добавить»/«Применить» исходный документ, история и восстановление не меняются; «Отмена» убирает черновик. Окно перетаскивается за заголовок, размер окна и малого предпросмотра меняется за угол.
- Встроенные WOFF2-шрифты подключаются локально при выборе. Свой WOFF/WOFF2/TTF/OTF до 5 МБ встраивается в `.zpe`; список шрифтов компьютера запрашивается кнопкой через Local Font Access API и зависит от браузера и разрешения пользователя.