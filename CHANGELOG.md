# Changelog

## Unreleased

### 2026-09-25 — ICC Metadata Foundation Stage 7f

- Added: PSD/PSB Image Resources parser для корректно padded `8BIM` resource blocks.
- ICC: resource `0x040F / 1039` читается как raw ICC profile bytes с 4 МБ safety cap; resource `0x0410 / 1041` переносит intentionally-untagged flag.
- Header summary: declared profile size, ICC version, device class, color space, PCS и `acsp` signature validation.
- UI: при импорте профилируемого PSD/PSB показывается явное предупреждение, что текущий Canvas preview ещё не делает ICC transform; ZPE не выдаёт unmanaged preview за color-managed результат.
- Regression: synthetic ICC v4 RGB/XYZ profile и untagged resource fixture.

### 2026-09-25 — Select & Mask Foundation Stage 9a

- Added: «Уточнить выделение → маска…» в меню «Выделение» и «Слой».
- Controls: сглаживание, расширение/сжатие края, растушёвка, контраст края и инверсия.
- Core: новый pure helper `refineMaskAlpha()` реализует separable morphology/blur pipeline для 8-bit alpha masks и покрыт unit tests.
- Geometry: параметры в px документа пересчитываются в layer-pixel space для масштабированных слоёв; adjustment layer работает в координатах документа.
- Safety: refinement масок больше 12 МП отклоняется понятной ошибкой вместо потенциальной блокировки вкладки; обычная маска из выделения остаётся без этого дополнительного CPU-heavy этапа.
- Regression: grow/shrink, noise smoothing, soft feather, contrast/invert и UI wiring.

### 2026-09-25 — Group Compositing Stage 8e

- Added: ZPE groups получили `opacity` и `blendMode` с backward-compatible defaults `1` и `pass-through`.
- Render: 100% Pass Through group рендерит children прямо в parent stack; reduced-opacity или non-pass-through group изолируется во временный Canvas и композитится как единое целое.
- Nested semantics: group render plan сохраняет порядок слоёв/подгрупп по исходному layer stack и рекурсивно применяет group hierarchy.
- UI: контекстное меню группы открывает «Параметры группы…» с режимом наложения и непрозрачностью.
- PSD/PSB: folder marker opacity и `lsct` section blend key теперь импортируются в ZPE и возвращаются writer'ом; Pass Through ↔ `pass`, Normal/Multiply/Screen/Overlay/etc. ↔ стандартные PSD blend keys.
- Added: sanitizer, renderer contract, PSD nested-group round-trip и adapter/UI wiring regressions.

### 2026-09-25 — High-depth ZIP Prediction Stage 7e

- Added: PSD/PSB compression=3 (ZIP with prediction) для RGB 16-bit и 32-bit layer/composite channels.
- 16-bit: predictor восстанавливается на уровне big-endian 16-bit samples с modulo-65536 delta decode.
- 32-bit: после byte-level delta decode выполняется Photoshop byte-plane unshuffle обратно в big-endian IEEE-754 samples.
- Safety: ZIP inflate теперь читается chunk-wise с жёстким expected-output ceiling; oversized decompression отклоняется как `PSD_ZIP_LIMIT` до сборки полного результата.
- Regression: high-depth layer fixtures проверяют Raw/RLE/ZIP/ZIP-prediction, отдельно добавлен composite ZIP-prediction round-trip fixture для 16/32-bit.

### 2026-09-25 — Nested Groups UX Stage 8d

- Added: group rows в панели слоёв стали draggable — группу можно вложить в другую группу.
- Added: drop группы на свободную область панели поднимает её обратно на верхний уровень.
- Added: контекстное меню группы содержит «Создать подгруппу».
- Safety: UI использует `moveLayerGroupIntoGroup()`, поэтому self/descendant cycles и ancestor locks нельзя обойти drag-and-drop.
- Fixed: блокировка слоя в context menu теперь учитывает всю цепочку родительских групп, а не только непосредственную папку.
- Added: regression contracts для group drag nesting/root extraction/subgroup action.

### 2026-09-25 — Native Nested Groups Stage 8c

- Added: ZPE group schema получила optional `parentGroupId`; старые проекты без поля остаются совместимыми.
- Inheritance: layer/group visibility и locking теперь учитывают всю ancestor chain, а не только непосредственную группу.
- Safety: sanitizer обнуляет orphan/self/cyclic parent links; попытка программно вложить группу в собственного потомка отклоняется.
- UX: панель слоёв рендерит настоящую group hierarchy с отступами и recursive collapse; ancestor hidden/locked state отображается на дочерних строках.
- Removal: удаление группы сохраняет содержимое — прямые слои и подгруппы поднимаются к её родителю.
- PSD/PSB: import сохраняет adapter `parentKey` как ZPE hierarchy, writer формирует nested `lsct` records по lineage transitions и сохраняет имена групп без `Parent / Child` flatten.
- Added: nested state/sanitizer tests и PSD nested group writer → reader round-trip regression.

### 2026-09-25 — PSD/PSB Group Export Stage 8b

- Added: плоские ZPE groups теперь экспортируются в PSD/PSB как настоящие `lsct` folder + bounding-divider layer records.
- Preserved: Unicode group names, visibility и open/closed (collapsed) state; child visibility пишется отдельно от folder visibility.
- Safety: одна группа должна занимать contiguous run слоёв. Если тот же `groupKey` появляется повторно после посторонних слоёв, writer отклоняет экспорт с `PSD_EXPORT_GROUP_SPLIT` вместо ошибочного захвата чужих слоёв.
- Compatibility: group marker records не создают pixel channels и используют pass-through section blend key; обычный RGB/8-bit layer writer остаётся прежним.
- Added: PSD group export → import round-trip regression и wiring tests для UI → writer.

### 2026-09-25 — PSD/PSB Group Import Stage 8a

- Added: PSD/PSB `lsct` section-divider records теперь восстанавливают folder boundaries вместо полного flatten при импорте.
- Mapping: type 1/2 open/closed folders переносят имя, visibility и collapsed-state; type 3 используется как hidden bounding divider, bitmap layers получают стабильный adapter `groupKey`.
- Nested groups: текущая плоская ZPE group model сохраняет nested context через имя полного пути `Parent / Child`; parent/child group hierarchy пока не заявляется.
- Guardrails: malformed/unmatched group markers, group opacity и неподдерживаемые group blend modes дают явные warnings вместо тихой подмены семантики.
- Added: synthetic nested PSD regression fixture и integration-contract test для adapter → ZPE group mapping.

### 2026-09-25 — RGB 32-bit Float PSD/PSB Import Stage 7d

- Added: RGB 32-bit/channel PSD/PSB layer и composite samples читаются big-endian как IEEE-754 float и сохраняются в `Float32Array` PixelBuffer, включая HDR-значения вне диапазона 0..1.
- Compression: Raw, PackBits/RLE и ZIP без prediction используют общий bytes-per-sample pipeline для 8/16/32-bit.
- Guardrail: ZIP prediction для 16/32-bit остаётся отдельным unsupported path `PSD_ZIP_PREDICTION_DEPTH` вместо неподтверждённого декодирования.
- Preview: текущий Canvas bridge явно остаётся 8-bit display boundary и ограничивает 32-bit preview диапазоном 0..1; HDR tone mapping/exposure и Float32 editing/export пока не заявляются.
- Masks: Float32 mask samples приводятся к 8-bit alpha только на текущей render boundary.
- Added: regression tests для 32-bit Raw PSD, RLE PSB, ZIP PSD, точного Float32 payload и clipped RGBA8 preview.

### 2026-09-25 — RGB 16-bit PSD/PSB Import Stage 7c

- Added: RGB 16-bit/channel PSD/PSB layer и composite channels теперь декодируются в precision-preserving `Uint16Array` PixelBuffer.
- Compression: поддержаны Raw, PackBits/RLE и ZIP без prediction; RLE считает scanline в байтах с учётом 2 bytes/sample и сохраняет PSB 32-bit row-length contract.
- Guardrail: 16-bit ZIP prediction пока отклоняется отдельным `PSD_ZIP_PREDICTION_DEPTH`, а 32-bit/HDR и CMYK остаются за capability gate вместо молчаливой потери данных.
- Masks: 16-bit user-mask samples безопасно приводятся к 8-bit alpha только на текущей Canvas mask boundary.
- UI contract: при открытии 16-bit PSD/PSB текущий ZPE/Canvas документ получает 8-bit preview и явно предупреждает, что high-depth precision после импорта пока не сохраняется.
- Added: regression tests для 16-bit Raw PSD, RLE PSB, ZIP PSD, точного Uint16 payload/preview bridge и unsupported-depth/prediction guards.

### 2026-09-25 — PixelBuffer Stage 7b: typed high-depth boundary

- Added: `src/core/pixel-buffer.js` defines a strict typed pixel contract for RGB/CMYK buffers with 8-bit integer, 16-bit integer and 32-bit float samples.
- Added: RGBA8 uses `Uint8ClampedArray`, 16-bit uses `Uint16Array`, 32-bit/HDR uses `Float32Array`; dimensions, channel counts, alpha semantics and data length are validated.
- Integration: PSD/PSB RGB/8-bit decoder now exposes `pixelBuffer` and keeps `pixels` as the same underlying array for compatibility; import UI consumes the PixelBuffer preview bridge.
- Zero-copy: current RGBA8 adapter-to-Canvas path returns the existing `Uint8ClampedArray` without an extra full-frame copy.
- Guardrail: CMYK PixelBuffer can be carried with profile metadata but RGB preview intentionally fails until a real color-management transform exists; no fake device-CMYK conversion is presented as accurate color.
- Added: regression tests cover RGBA8 zero-copy, RGB16 preview, RGB32 float preview/clamping, CMYK carry/guardrails and invalid sample/channel layouts.
- Scope: this is the source-format boundary needed for later 16/32-bit/CMYK work; the ZPE document model and Canvas renderer remain 8-bit at this stage.

### 2026-09-25 — PSB Stage 7a: RGB/8-bit Large Document Format

- Added: `.psb` import/export как Photoshop Large Document Format version 2 в существующем offline PSD adapter.
- Format: Layer and Mask section, Layer Info и per-channel lengths используют PSB 64-bit big-endian length fields; RLE scanline byte counts используют 32-bit fields.
- Compatibility: Color Mode Data и Image Resources сохраняют стандартные 4-byte length fields; PSD version 1 API/format остаётся без изменений.
- Added: `encodePsb()` и chunk-friendly `encodePsbBlob()`; UI принимает `.psb` и предлагает отдельный PSB export.
- Added: независимый synthetic PSB fixture проверяет 64-bit section/channel lengths и 32-bit PackBits row counts без использования production writer; отдельный writer round-trip покрывает Unicode layer name, blend mode и bitmap mask.
- Guardrails: Stage 7a остаётся RGB/8-bit и сохраняет текущие ZPE limits (48 МП import/export buffer budget, 512 МБ input guard, Canvas limits). CMYK/16/32-bit и истинные >2GB/tiled workflows пока не заявляются.
- Spec basis: Adobe Photoshop File Formats Specification — PSB version 2, 8-byte Layer/Mask + Layer Info + channel lengths, 4-byte RLE row byte counts.

### 2026-09-24 — CI reliability: Chromium sandbox on hosted Linux

- Fixed: browser smoke добавляет `--no-sandbox` только для root или Linux GitHub Actions, где hosted runner может запрещать usable Chromium sandbox через user-namespace/AppArmor policy.
- Root cause: post-merge CI Stage 6c завершал Chrome с `SIGABRT` и `No usable sandbox!` до публикации DevTools endpoint; 198/198 Node regression-тестов и generated bundle при этом были зелёными.
- Guardrail: флаг относится только к изолированному CI smoke-browser; production/editor code и локальный обычный browser launch не меняются. Добавлен structural regression на scope этого launch policy.

### 2026-09-24 — Performance Stage 6c: chunked PSD Blob export

- Added: `encodePsdBlob()` создаёт PSD `Blob` напрямую из chunked writer parts, не вызывая финальный `Writer.concat()` в пользовательском browser-export path.
- Compatibility: существующий `encodePsd()` по-прежнему возвращает `Uint8Array` и строится из того же `buildPsdWriter()`, поэтому byte-level API и regression fixtures сохраняются.
- Changed: `src/main.js` экспортирует PSD через `encodePsdBlob()` и передаёт готовый Blob в `downloadBlob()` без промежуточного contiguous byte buffer.
- Added: regression сравнивает `encodePsdBlob()` и `encodePsd()` byte-for-byte и повторно декодирует Blob output.
- Scope: browser memory-path стал chunk-friendly, но это ещё не настоящий WritableStream/file-system streaming и не PSB >2 GB.

### 2026-09-24 — Performance Stage 6b: row-stream PSD writer

- Changed: PSD PackBits/RLE writer больше не создаёт полноразмерные временные channel planes для RGB/alpha/mask/composite; канал строится построчно через bounded row buffer.
- Changed: RLE row lengths измеряются первым проходом, а encoded row chunks пишутся вторым проходом. CPU PackBits немного увеличивается, зато peak memory не включает дополнительный full-plane buffer на каждый канал.
- Changed: внутренний `Writer.append()` переносит chunk references без промежуточного `concat()` для layer records/channel data/layer-and-mask/composite sections; итоговый PSD по-прежнему материализуется один раз на выходе API.
- Added: regression на 260-pixel rows покрывает PackBits literal/repeat boundaries, alpha и bitmap mask round-trip.
- Added: structural regression фиксирует row-chunk seam и запрещает возврат `rgbaPlane`/`compositePlane` staging.
- Test maintenance: mask round-trip теперь использует отдельную white-RGB/alpha fixture, а legacy Stage 4 structural guard проверяет актуальные row-stream primitives (`encodeRleRgbaChannel`, `measureRleRgbaRows`, `appendRleRgbaRows`).
- Scope: публичный `encodePsd()` и RGB/8-bit PSD semantics не меняются; настоящий file streaming, PSB lengths и tiled document storage остаются следующими этапами.

### 2026-09-24 — CI reliability: browser startup budget

- Fixed: `file://` browser smoke теперь даёт Chrome/Chromium до 20 секунд на публикацию DevTools endpoint вместо 10 секунд.
- Root cause: hosted runner дважды показал startup timeout до загрузки приложения, а повторный run того же SHA проходил без изменений кода; Node regression suite и bundle-check во всех случаях были зелёными.
- Guardrail: timeout остаётся bounded; runtime/DOM/Blob Worker assertions не ослаблены и по-прежнему падают отдельно после успешного запуска браузера.

### 2026-09-24 — Performance Stage 6a: bounded pixel worker

- Added: крупные advanced color corrections (от 512×512 px) выполняются в одном bounded Blob Worker; RGBA buffer передаётся transferable без дополнительного полного clone перед обработкой.
- Reliability: максимум две pending pixel-задачи, timeout 45 секунд, worker reset на runtime/message error и синхронный fallback при недоступном Worker/перегрузке.
- Reliability: если transferred buffer уже detached при worker failure, renderer повторно читает исходные Canvas pixels и применяет тот же sync algorithm вместо потери изображения.
- Fixed: adjusted-color cache для smart-object теперь ключуется по `previewDataUrl`, поэтому обновление содержимого не может оставить stale color-corrected preview.
- Added: regression-тест сравнивает worker algorithm с sync RGBA output; render contract проверяет async path и smart-object cache source token.
- Browser proof: `file://` smoke отдельно проверяет, что Blob Worker реально стартует из локально открытого редактора.
- Scope: это responsiveness foundation; tiled raster storage, PSB streaming и 16/32-bit buffers остаются следующими отдельными этапами.

### 2026-09-24 — Smart Objects Stage 5a: embedded source + linked content tabs

- Added: новый слой `smart-object` хранит `embeddedDocument` как source of truth и `previewDataUrl` как render-cache; схема добавлена обратно совместимо в текущий `.zpe` v1.
- Added: raster/text/shape слой можно преобразовать в smart-object без растрирования исходной семантики внутри embedded document; внешний opacity/blend/group остаются на smart-object layer.
- Added: двойной клик по миниатюре, Properties и Layer menu открывают содержимое smart-object в отдельной связанной document tab.
- Added: `Ctrl+S` внутри content-tab обновляет embedded document и PNG preview родительского слоя, создавая ровно одну запись history в родительской session.
- Reliability: parent tab нельзя закрыть, пока открыты связанные content-tabs; заблокированный smart-object нельзя редактировать или обновлять через дочернюю вкладку.
- Reliability: UI и project sanitizer ограничивают рекурсивную вложенность smart-object тремя уровнями; внешние проекты глубже лимита сохраняют preview, но отбрасывают более глубокий embedded source.
- Added: regression-тесты schema/sanitizer, preview-render и session-link save contract.
- Test maintenance: brush-preview regression теперь проверяет поведенческий raster-override contract после появления smart-object preview path, а save-boundary VM harness учитывает `currentSession()` без ослабления блокировки сохранения во время raster edit.
- Known limitation: Stage 5a поддерживает embedded ZPE smart objects; linked external sources, smart filters/warp и native PSD smart-object round-trip ещё не реализованы.
- Verification: выполняется через PR CI, generated bundle consistency и реальный `file://` browser smoke перед merge.


### 2026-09-24 — PSD pipeline Stage 4: layered RGB/8-bit export

- Added: dependency-free PSD writer в `src/adapters/psd.js` записывает RGB/8-bit PSD version 1 с PackBits/RLE channel data.
- Added: экспортируются отдельные layer records с Unicode `luni` names, opacity, visibility, поддерживаемыми blend modes и merged transparency.
- Added: ZPE bitmap layer masks экспортируются как Photoshop user mask channel `-2`, включая disabled-state.
- Added: writer следует Photoshop 5+ layer flags, 4-byte layer-info/`luni` alignment и merged-image white-matte convention для полупрозрачного composite preview.
- Changed: text/shape layers, transforms, filters и styles сохраняются как raster preview соответствующего PSD layer, при этом PSD opacity/blend остаются отдельными свойствами слоя.
- Changed: если документ содержит видимый ZPE adjustment layer, исходные export layers остаются в PSD скрытыми, а сверху создаётся видимый `ZPE Composite Preview (adjustments baked)`; так визуальный результат не теряется до появления native adjustment mapping.
- Reliability: PSD export ограничен суммарно 48 МП временных RGBA-буферов; writer отклоняет malformed RGBA/mask buffers и файлы за пределами PSD-size guard.
- Added: round-trip regression `encodePsd → decodePsd` проверяет RGB pixels, Unicode name, opacity, multiply, hidden state и user mask.
- Compatibility review: layer flags, `luni` alignment, mask layout и merged-image RLE дополнительно сверены с реализацией writer в `ag-psd`.
- Verification: выполняется через PR CI, generated bundle consistency и реальный `file://` browser smoke перед merge.


### 2026-09-24 — PSD pipeline Stage 3: layered RGB/8-bit import

- Added: отдельный `src/adapters/psd.js` реализует dependency-free PSD binary adapter с жёсткими capability guards и memory/length checks.
- Added: импорт RGB/8-bit PSD version 1 с Raw, PackBits/RLE, ZIP и ZIP-with-prediction channel compression.
- Added: PSD bitmap layers превращаются в редактируемые ZPE raster layers с bounds, visibility, opacity и поддерживаемыми blend modes.
- Added: bitmap user layer mask (channel `-2`) переносится в ZPE layer mask; Unicode layer names читаются из `luni`.
- Added: если layered bitmap-preview отсутствует, adapter использует composite image как fallback.
- Reliability: PSB, CMYK/Lab/Indexed и 16/32-bit на этом этапе отклоняются явной ошибкой вместо скрытого преобразования с потерей данных; PSD больше 512 МБ блокируется до tiled pipeline.
- Reliability: документ заменяется только после полного decode + PNG preparation и проверки, что активная вкладка/история не изменились во время async-импорта.
- Known limitation: PSD groups пока flatten в список; Photoshop text/vector/smart-object semantics импортируются только если в PSD присутствует raster preview.
- Added: regression-тесты синтетического layered PSD, capability guards и file detection.


### 2026-09-24 — Bézier pipeline Stage 2b: direct-edit anchors и handles

- Added: выбранный path-слой в инструменте «Перо» показывает editable anchors и control handles в document coordinates с учётом transform слоя.
- Added: drag anchor перемещает узел вместе с его handles; drag handle редактирует кривую, сохраняя smooth-симметрию.
- Added: `Alt+drag` handle переводит узел в corner и разрывает симметрию; `Shift+drag` anchor создаёт smooth handles даже у старого straight/corner узла; `Alt+click` anchor удаляет handles.
- Added: hit-testing приоритетно выбирает handles, затем anchors; курсор отражает доступность direct-edit.
- Reliability: Escape и pointer cancel восстанавливают исходный node snapshot; история получает один commit только после завершённого изменения.
- Verification: выполняется через PR CI, generated bundle consistency и реальный `file://` browser smoke перед merge.


### 2026-09-24 — Bézier pipeline Stage 2a: cubic-контуры и ручки

- Added: `pathPoints` поддерживает `handleIn`, `handleOut` и тип узла `corner/smooth`; старые точки `{x,y}` автоматически остаются прямолинейными corner-узлами.
- Added: renderer строит смешанные straight/cubic сегменты через `bezierCurveTo()`, включая корректное замыкание последнего сегмента.
- Added: инструмент «Перо»: клик создаёт corner point, drag — smooth point с симметричными handles, `Alt+drag` — corner point с независимой исходящей ручкой.
- Added: live overlay показывает cubic preview, anchors и управляющие ручки; отменённый pointer gesture не оставляет лишний узел.
- Changed: bounds нового path-слоя учитывают не только anchors, но и control handles, поэтому ручки не оказываются за пределами локальной геометрии слоя.
- Added: regression-тесты для backward compatibility старых pathPoints и нового cubic render contract.
- Verification: выполняется через PR CI, generated bundle consistency и browser smoke перед merge в `main`.


### 2026-09-24 — Начат профессиональный imaging pipeline: маски и корректирующие слои

- Added: новый тип слоя `adjustment` применяет неразрушающую цветокоррекцию и Canvas-эффекты ко всему уже собранному нижележащему стеку.
- Added: базовая модель маски слоя с командами «показать всё» и «из выделения»; маска хранится в `.zpe` и ограничивает результат слоя через alpha-композитинг.
- Changed: корректирующие слои исключены из геометрических transform-handles, destructive pixel-операций и отдельной растеризации.
- Changed: новые поля добавлены обратно совместимо без повышения версии проекта; существующие проекты версии 1 продолжают проходить текущий sanitizer.
- Added: regression-тесты для сохранения adjustment/mask state и контрактов нового render pipeline.
- Verification: выполняется GitHub Actions после атомарного commit source + generated bundle.


### 2026-09-24 — Исправлен browser smoke в CI

- Fixed: восстановлен повреждённый хвост `tools/browser-smoke.mjs`, из-за которого CI останавливался с `SyntaxError: Unexpected end of input` до запуска браузера.
- Changed: `npm run check` теперь отдельно проверяет синтаксис browser-smoke harness до Node regression suite; навигационная ошибка Chromium выводится как отдельная причина.
- Fixed: teardown временного Chrome-профиля использует bounded retry для `ENOTEMPTY`/занятых файлов после завершения браузера вместо ложного падения уже прошедшего smoke.
- Verification: hosted Chrome успешно открыл реальный `file://` и прошёл startup/lock DOM assertions; следующий Actions run проверяет исправленный teardown.

### 2026-09-24 — Добавлен настоящий browser smoke для file:// и lock UI

- Added: `tools/browser-smoke.mjs` запускает установленный Chrome/Chromium без npm-зависимостей, подключается через DevTools Protocol и открывает фактический `index.html` по `file://`.
- Added: smoke проверяет чистый startup без runtime/console errors, создание растрового слоя, lock/unlock disabled-state, доступность видимости/разблокировки и guards пунктов меню слоя.
- Changed: CI после Node regression suite и проверки generated bundle выполняет `npm run test:browser`; документация теперь явно разделяет доказанный DOM-contract и остающиеся manual/browser boundaries.

### 2026-09-24 — Заблокированные слои явно отключают недоступные действия

- Fixed: режим наложения, непрозрачность, переименование, дублирование, удаление, изменение порядка и сброс эффектов теперь сразу недоступны для заблокированного слоя или слоя в заблокированной группе вместо визуально активного, но молча игнорируемого управления.
- Changed: пункт разблокировки собственного слоя недоступен, пока блокировка унаследована от группы; показ/скрытие слоя остаётся доступным.
- Added: regression-проверки фиксируют disabled-state и menu guards поверх существующих state-level тестов блокировки.

### 2026-09-24 — Подготовлена публикация исходников на GitHub

- Added: воспроизводимый CI для `npm run check` на Node.js 24 с минимальными `contents: read` permissions.
- Added: `SECURITY.md`, шаблон bug report и `.gitignore` для безопасной публичной разработки.
- Added: скрипт воспроизводимой генерации офлайн-шрифтов из зафиксированного commit `google/fonts`; готовый runtime по-прежнему хранит шрифты локально и не требует сети.
- Changed: README теперь описывает онлайн- и локальный запуск и исправляет устаревшее ограничение про инструмент «Перо».
- Changed: окно «О программе» больше не называет редактор только локальным, потому что приложение также развёрнуто в интернете.

### 2026-09-24T14:37:37+03:00 — Исправлены цвет и числовые поля текста

- Fixed: поле цвета в окне создания и редактирования текста показывает выбранный оттенок всей областью и обновляет его при выборе.
- Fixed: числовые поля диалогов и свойств приводят ввод к ближайшему допустимому шагу и границам; межстрочный интервал и масштаб допускают сотые доли, включая исходные значения.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 170 тестов без ошибок. Цветовое поле видно на присланном пользователем скриншоте; самостоятельная проверка браузера заблокирована политикой доступа к `file://`.

### 2026-09-24T14:18:53+03:00 — Предпросмотр слоя в окне параметров наложения

- Added: в каждой секции параметров наложения показывается фрагмент итогового холста вокруг слоя с фоном и другими слоями; он обновляется после изменения настроек и при изменении размеров окна.
- Changed: окно «Параметры наложения» теперь можно растягивать за нижний правый угол; списки и поля прокручиваются при уменьшении окна.
- Verification: `npm run check` пересобрал bundle и завершил 168 тестов без ошибок. Живое расположение и изменение размера в браузере не проверены: инструмент не допускает локальный `file://` адрес.

### 2026-09-24T14:12:52+03:00 — Расширены стили слоя и улучшены окна редактора

- Added: девять сохраняемых стилей слоя с отдельными переключателями и настройками: обводка, тиснение, внутренние тень и свечение, наложение цвета, градиента и узора, внешнее свечение и тень; добавлена непрозрачность заливки.
- Changed: окно «Параметры наложения» показывает черновик на холсте, отменяет его без изменения истории и записывает применение одним действием Undo/Redo; окно перемещается за заголовок в пределах экрана.
- Changed: открытые окна больше не затемняют холст и панели под ними; рендер стилей ограничивает временные Canvas 16 МП для больших слоёв.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 167 тестов без ошибок. Живое поведение в браузере не проверено из-за блокировки локального `file://` адреса браузерным инструментом.

### 2026-09-24T13:58:21+03:00 — Добавлены контекстные меню вкладок, слоёв и холста

- Added: правый клик по вкладке открывает команды перехода, переименования, копирования, создания и закрытия; закрытие вкладки с изменениями сохраняет подтверждение.
- Added: меню слоя и группы содержит доступные для них действия; на пустой области слоёв можно создать слой или группу, на холсте доступны команды редактирования и масштаба.
- Added: «Параметры наложения» в меню слоя открывают окно режима и непрозрачности с предпросмотром, отменой и одним действием истории при применении.
- Verification: `npm run check` пересобрал bundle и завершил 163 теста без ошибок. Живое поведение в браузере не проверено: браузерный инструмент заблокировал локальный `file://` адрес.

### 2026-09-24T13:46:16+03:00 — Настроена сила осветления, затемнения и размытия

- Fixed: перекрывающиеся отпечатки осветлителя и затемнителя больше не усиливают один штрих до белого или чёрного пятна; отдельные ползунки задают силу каждого инструмента.
- Changed: «Сила размытия» теперь задаёт интенсивность в процентах за штрих, включая слабые значения вроде 2%; повторные отпечатки одного штриха не накапливают эффект. Неиспользуемые цвет и непрозрачность скрыты для этих трёх инструментов.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 160 тестов без ошибок. Пользователь сообщил, что после проверки инструменты работают хорошо; отдельный браузерный тест агента не выполнен из-за блокировки локального `file://` адреса браузерным инструментом.

### 2026-09-24T13:34:16+03:00 — Расширены настройки текста и его предпросмотр

- Added: 12 локальных семейств шрифтов с кириллицей и лицензиями, выбор шрифта при создании и в свойствах, загрузка собственного WOFF/WOFF2/TTF/OTF и запрос списка шрифтов компьютера через браузер.
- Added: жирность, курсив, выравнивание, межстрочный и межбуквенный интервалы, подчёркивание, зачёркивание и ширина текстового блока; параметры сохраняются в проекте.
- Changed: диалог текста перемещается за заголовок и меняет размер; предпросмотр показывает фрагмент изображения в месте текста, а изменения временно видны на холсте до применения. «Отмена» убирает черновик, включая случай позднего завершения чтения шрифта.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 156 тестов без ошибок. Живое поведение в браузере не проверено из-за запрета браузерного инструмента на локальный `file://` адрес.

### 2026-09-24T10:52:57+03:00 — Сохранены копии документов и исправлено изменение размера

- Fixed: автовосстановление хранит документы окна вместе и разделяет копии разных окон; чтение старого формата и повреждённых записей не удаляет соседние копии.
- Fixed: начатое скачивание больше не считается подтверждённым сохранением и не очищает восстановление; «Позже», восстановление и удаление копии не перезаписывают копию другого окна.
- Fixed: изменение размера изображения проверяет допустимость преобразований до изменения слоёв, отклоняет неодинаковое масштабирование повёрнутого слоя; изменение размера изображения и холста не прерывает незавершённое редактирование и сбрасывает устаревшее выделение.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 150 тестов без ошибок. Живой браузер и реальный IndexedDB не проверены.

### 2026-09-24T10:17:30+03:00 — Асинхронные операции сохраняют исходный документ

- Fixed: позднее завершение импорта изображений, чтения буфера обмена и открытия проекта больше не переносит результат в другую вкладку.
- Fixed: открытие проекта отменяется, если исходный документ изменился во время чтения файла, включая правки ползунком до записи в историю; создание нового документа не оставляет окно переключения вкладки при очистке автовосстановления.
- Fixed: растеризация проверяет исходный выбранный слой перед заменой и защищает незавершённую операцию от смены документа.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 139 тестов без ошибок. Живой браузер не проверен.

### 2026-09-24T09:02:15+03:00 — Сохранение ожидает завершения редактирования

- Fixed: сохранение проекта, экспорт, переход по истории, Undo/Redo, смена вкладки и удаление слоя больше не прерывают незавершённый жест или асинхронную растровую операцию; команда просит повторить её после завершения.
- Fixed: заливка защищает документ уже во время декодирования слоя, а градиент — до завершения кодирования Canvas.
- Changed: экспорт использует отдельный снимок документа, поэтому правки после запуска не меняют экспортируемое изображение.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 130 тестов без ошибок. Живой браузер не проверен.

### 2026-09-24T08:48:05+03:00 — Исправлены конечные точки жестов и ограничение фигуры

- Fixed: перемещение, изменение размера и поворот слоя учитывают точку отпускания указателя без последнего события движения; щелчок без движения не создаёт лишнее действие истории.
- Fixed: инструмент «Рука» учитывает конечную точку панорамирования, а фигура остаётся квадратной или круглой, если Shift нажат при отпускании.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 126 тестов без ошибок. Живые жесты в браузере не проверены.

### 2026-09-24T08:29:37+03:00 — Исправлено завершение жестов инструментов

- Fixed: кисть, линия, фигура, кадрирование, градиент и выделение учитывают точку отпускания указателя, даже если перед ним не пришло отдельное событие движения.
- Fixed: второй указатель больше не двигает и не завершает активный жест первого указателя.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 122 теста без ошибок. Живое взаимодействие в браузере не проверено.

### 2026-09-21T21:08:58+03:00 — Улучшено качество существующих инструментов

- Changed: осветлитель и затемнитель теперь плавно меняют RGB существующих пикселей, сохраняют alpha и не рисуют белой или чёрной краской по прозрачному фону.
- Changed: штамп, лечебная кисть, палец и кисть размытия получили растушёванные края без заметной цепочки круглых отпечатков.
- Fixed: разрушающие растровые инструменты остаются на выбранном видимом растровом слое и больше не переключаются молча на другой слой под курсором; выбор источника штампа через `Alt+клик` по-прежнему находит растровый слой под точкой.
- Changed: магнитное лассо прослеживает контрастную границу промежуточными точками между кликами, градиент показывает цветной предпросмотр, а кадрирование — сетку третей.
- Fixed: подсказка инструмента «Линия» и README теперь описывают фактическое рисование в текущий растровый слой.
- Verification: `npm run check` пересобрал `src/app.bundle.js`; 119 regression-тестов прошли.
- Verification: отдельный Chrome через Playwright при прямом `file://` активировал все 22 инструмента и выполнил операции градиента, штампа, лечебной кисти, пальца, осветлителя, затемнителя, размытия, ластика, кисти, пера, магнитного лассо, волшебной палочки, заливки, линии, фигуры, перемещения, выделения, пипетки, текста, руки, масштаба и кадрирования без ошибок страницы или консоли.

### 2026-09-21T20:33:34+03:00 — Расширены инструменты ретуши и панель инструментов

- Added: рабочие инструменты «Штамп», «Лечебная кисть», «Палец», «Осветлитель», «Затемнитель», «Градиент», «Перо», «Магнитное лассо» и «Волшебная палочка» с горячими клавишами, параметрами и SVG-иконками.
- Changed: панель инструментов на широком экране показывает две колонки и развёрнутые доступные подсказки; на узком экране сохраняется компактная одна колонка.
- Added: в окно «О программе» добавлены имя разработчика, почта и безопасная ссылка на Telegram.
- Fixed: инструмент «Линия» рисует в текущий растровый слой; если слоя ещё нет, создаётся один слой «Линии», который переиспользуется следующими штрихами.
- Added: выбранный в панели слой постоянно отмечается на холсте контрастной рамкой, угловыми маркерами и подписью с именем; индикатор не попадает в экспорт.
- Changed: векторные контуры сохраняются в `.zpe`, рендерятся и проходят нормализацию при открытии проекта.
- Verification: выполнена команда `npm run check`; bundle пересобран, синтаксис проверен, 114 regression-тестов прошли.
- Verification: живой Chromium smoke не завершён — тестовый браузер закрывается до создания страницы; ручная проверка интерфейса и pointer-сценариев остаётся обязательной.

## 1.19.1
- Исправлен `Ctrl+X` в режиме **«Со всех видимых слоёв»**: текстовые и фигурные слои больше не остаются нетронутыми после того, как их изображение попало в буфер обмена.
- При merged-cut пересекающиеся незаблокированные текстовые/фигурные слои автоматически растрируются в том же визуальном виде, после чего выделенная область удаляется из них вместе с растровыми слоями.
- Заблокированные слои по-прежнему не изменяются и явно учитываются в статусе операции. Копирование в системный буфер всё так же выполняется **до** изменения документа.
- Общая логика растеризации переиспользуется обычной командой «Растеризовать слой» и merged-cut; добавлен regression-тест, запрещающий снова пропускать non-raster слои при `Ctrl+X`.

## 1.19.0
- Инструмент `M` теперь поддерживает **четыре типа выделения**: прямоугольное, эллиптическое, свободное лассо и многоугольное лассо.
- Тип выбирается в верхней панели параметров; `Shift+M` циклически переключает варианты.
- `Shift` при рисовании прямоугольного/эллиптического выделения ограничивает форму до квадрата/круга.
- Многоугольное лассо строится кликами; двойной щелчок или `Enter` завершает контур, `Esc` отменяет построение и восстанавливает предыдущее выделение.
- Копирование, вырезание, очистка, кисть, ластик, размытие и заливка теперь учитывают **реальную форму** выделения, а не только его bounding box.
- Для PNG в буфере область вне эллипса/лассо остаётся прозрачной. Добавлены regression-тесты геометрии и wiring новых типов выделения.

## 1.18.0
- Инструмент «Перемещение» получил **умную привязку** к краям и центру холста, а также к краям/центрам остальных видимых слоёв.
- При срабатывании привязки поверх холста отображаются временные **Smart Guides**; порог вычисляется в экранных пикселях, поэтому ощущение привязки не меняется при масштабировании документа.
- `Ctrl` во время перетаскивания временно отключает привязку, а `Shift` ограничивает движение выбранного слоя горизонталью или вертикалью.
- В параметры «Перемещения» добавлены шесть команд выравнивания слоя относительно холста: левый/правый/верхний/нижний край и оба центра; расчёт учитывает поворот слоя.
- Настройка умной привязки сохраняется локально между запусками редактора.
- Emoji/текстовые пиктограммы основных инструментов и действий заменены единым набором **SVG-иконок**; добавлен собственный векторный знак ZeTer в `assets/`.
- Геометрия привязки и выравнивания вынесена в pure-core и покрыта regression-тестами, включая повёрнутые слои и ограничение порога привязки.

## 1.17.0
- Группы слоёв получили собственную **видимость**: глаз на заголовке группы скрывает/показывает всё её содержимое в Canvas и экспортном render pipeline, не меняя индивидуальные флаги видимости дочерних слоёв.
- Добавлена **блокировка группы**: замок защищает дочерние слои от рисования, трансформаций, фильтров, удаления, переименования, изменения порядка и перетаскивания между группами.
- Состояния группы наследуются дочерними слоями в интерфейсе: скрытая группа приглушает строки, заблокированная группа показывает у дочерних слоёв наследованный замок.
- Заблокированную группу нельзя переименовать, удалить или использовать как цель drag-and-drop до разблокировки; сворачивание и переключение видимости остаются доступными.
- Формат `.zpe` расширен обратно совместимо: старые группы без новых полей открываются как видимые и разблокированные.
- Добавлены regression-тесты на наследование видимости/блокировки, сохранение этих состояний и защиту структуры группы.

## 1.16.0
- Добавлены группы слоёв в панели «Слои»: создание отдельной кнопкой, сворачивание/разворачивание и переименование группы двойным кликом.
- Слои можно перетаскивать прямо на заголовок группы; при перетаскивании между слоями сохраняется порядок и автоматически меняется принадлежность к группе.
- Перетаскивание слоя на свободное место панели выносит его из группы и помещает наверх стека.
- Удаление группы не удаляет её содержимое: слои остаются в документе и становятся обычными верхнеуровневыми слоями.
- Переименование выбранного слоя стало заметнее: добавлена кнопка `✎` и команда «Слой → Переименовать слой» в дополнение к двойному клику и `F2`.
- Формат `.zpe` расширен совместимо: добавлены `groups` и `groupId`, старые проекты продолжают открываться без миграции вручную.

## 1.15.0
- Инструмент прямоугольного выделения получил выбор источника Ctrl+C/Ctrl+X: все видимые слои или только выбранный слой.
- Режим «все видимые слои» копирует объединённый результат; Ctrl+X очищает выделение на всех доступных видимых растровых слоях.
- После успешного Ctrl+C/Ctrl+X выделение снимается и автоматически включается «Перемещение», чтобы Ctrl+V можно было сразу позиционировать.

## 1.14.0

- Добавлено копирование активной прямоугольной области в **системный буфер обмена** через `Ctrl+C`; в буфер записывается PNG выбранного слоя с учётом его положения, масштаба, поворота, непрозрачности и эффектов.
- Добавлено вырезание через `Ctrl+X`: сначала PNG гарантированно записывается в буфер, затем пиксели внутри выделения удаляются с незаблокированного растрового слоя одной исторической операцией «Вырезать выделение».
- Команды «Копировать выделение» и «Вырезать выделение» добавлены в меню «Правка» и «Выделение»; поддержаны также нативные browser-события `copy`/`cut`.
- Clipboard write стартует с `ClipboardItem(Promise<Blob>)`, чтобы не терять user activation во время асинхронного рендера PNG.
- Добавлена проверяемая геометрия округления/обрезки выделения до пиксельных границ и regression-тесты горячих клавиш, порядка copy-before-cut и clipboard wiring.

## 1.13.1

- Кнопка **«+»** создания документа теперь располагается **сразу после последней вкладки**, а не у правого края всей полосы.
- Полоса вкладок занимает только необходимую ширину до доступного предела; при большом числе документов включается горизонтальная прокрутка без разрыва между вкладками и кнопкой добавления.
- Добавлен regression-тест на расположение кнопки новой вкладки относительно контейнера вкладок.

## 1.13.0

- Добавлена **полноценная полоса вкладок документов** в верхней части холста. Рядом с вкладками появилась кнопка **«+»** для создания неограниченного числа новых рабочих документов.
- Каждая вкладка хранит **собственный документ, историю Undo/Redo, масштаб, выделение, кадрирование и dirty-state**, поэтому можно переключаться между несколькими изображениями без потери контекста редактирования.
- Вкладки можно **переключать кликом** и **закрывать крестиком**; при закрытии вкладки с несохранёнными изменениями редактор запрашивает подтверждение.
- Индикатор несохранённых изменений теперь отображается **на каждой вкладке отдельно**, а предупреждение при закрытии браузера учитывает dirty-состояние всех открытых вкладок.
- Добавлены regression-тесты на новую структуру document-tabs и независимые session-state вкладок.

## 1.12.1

- Блок **«Цвет и эффекты»** вынесен из секции свойств в **отдельную правую панель** со своим собственным заголовком и разворачиванием.
- Теперь панель **«Цвет и эффекты»** ведёт себя так же, как **«Слои»** и **«История»**: это самостоятельная карточка правой колонки, а не вложенная часть «Свойств».
- Состояние старой вложенной секции мигрируется в новый panel-state: если раньше у пользователя был свёрнут блок «Цвет и эффекты», теперь автоматически сворачивается новая панель.
- Добавлены regression-тесты на отдельную карточку **«Цвет и эффекты»** и совместимость состояния сворачивания.

## 1.12.0

- Все ползунки цветокоррекции растрового слоя перенесены в постоянный блок **«Свойства → Цвет и эффекты»**: экспозиция, яркость, контраст, светлые области, тени, температура, оттенок, насыщенность, красочность, тон и гамма.
- Размытие также находится в общем блоке эффектов; рядом добавлен быстрый **«Сброс»** для текущего блока.
- Правые панели **«Свойства»**, **«Слои»** и **«История»** получили сворачиваемые заголовки; вложенный блок **«Цвет и эффекты»** сворачивается независимо.
- Состояние свёрнутых панелей хранится локально в браузере и восстанавливается при следующем запуске.
- Заголовки сворачивания доступны с клавиатуры и обновляют `aria-expanded`; иконка показывает текущее состояние.
- Добавлены regression-тесты размещения всех контролов цветокоррекции и сворачиваемых панелей; полный набор — 75 тестов.

## 1.11.0

- Добавлена **неразрушающая цветокоррекция** выбранного растрового слоя с живым предпросмотром и одной записью Undo/Redo при подтверждении.
- Новый диалог «Изображение → Цветокоррекция…» содержит экспозицию, яркость, контраст, светлые области, тени, температуру, оттенок, насыщенность, красочность (Vibrance), тон и гамму.
- Отмена/Escape восстанавливают исходные параметры; отдельная команда сбрасывает только цветокоррекцию, не затрагивая размытие и другие эффекты.
- Базовые слайдеры панели свойств получили числовые значения и быстрый переход в расширенную цветокоррекцию.
- Формат `.zpe` расширен совместимо со старыми проектами: новые параметры имеют безопасные defaults и проходят нормализацию диапазонов при открытии.
- Попиксельные коррекции применяются через отдельный `src/core/color.js`; нейтральные настройки не трогают пиксели, а alpha-канал сохраняется.
- Добавлен ограниченный кэш скорректированных растров; внутренний pixel-loop не создаёт временные массивы на каждый пиксель.
- Canvas CSS-filter дополнен `hue-rotate`, поэтому регулировка тона работает и в общем render/export pipeline.
- Добавлены regression-тесты цветокоррекции, signed range sanitization, backward compatibility старых проектов и UI/render wiring; полный набор — 72 теста.

## 1.10.0

- Добавлено аварийное автосохранение проекта в **IndexedDB**: после изменений снимок сохраняется с debounce, не блокируя каждый pointer event синхронной записью в `localStorage`.
- При следующем запуске найденная аварийная копия проходит `sanitizeProject()` и предлагается к восстановлению; восстановленный документ остаётся несохранённым до явного `Ctrl+S`.
- Очистка автокопии при `Ctrl+S`, открытии другого проекта или создании нового документа сериализована после уже начатых фоновых записей, поэтому старая запись не может «вернуться» из race-condition.
- Добавлен timeout открытия IndexedDB и graceful degradation: проблемы browser storage не должны блокировать запуск самого редактора.
- Значение «Непрозр.» инструмента теперь применяется не только к кисти/ластикам/заливке/линии, но и к новым фигурам и текстовым слоям; preview фигуры показывает ту же непрозрачность.
- Добавлен отдельный визуальный стиль предупреждающих toast-сообщений.
- Добавлены regression-тесты формата recovery-record, wiring автосохранения, сериализации очистки, sanitization recovery и единой непрозрачности; suite расширена до 66 тестов.

## 1.9.0

- Добавлен отдельный инструмент **«Кисть размытия» (`R`)** для локальной ретуши растровых слоёв.
- Размер кисти задаёт область воздействия, новый параметр «Сила размытия» регулирует радиус blur, а «Непрозр.» — интенсивность смешивания эффекта.
- Размытие использует локальный scratch-buffer вокруг мазка вместо обработки всего слоя на каждом pointer move.
- Непрерывный мазок строится серией перекрывающихся blur-dab, поэтому при быстром движении курсора не остаются непромазанные разрывы.
- Кисть размытия работает только по существующему незаблокированному растровому слою и не создаёт скрытые слои автоматически.
- Размытие учитывает активное прямоугольное выделение, трансформацию растрового слоя, давление пера на размер кисти, live preview и Undo/Redo.
- Добавлены regression-тесты wiring инструмента, запрета автосоздания слоя и локального blur pipeline.

## 1.8.0

- Добавлен инструмент прямоугольного выделения (`M`) с «бегущей» рамкой, `Ctrl+A`, `Ctrl+D`, очисткой пикселей и кадрированием по выделению.
- Активное выделение теперь реально ограничивает кисть, ластик и заливку, включая повёрнутые и масштабированные растровые слои.
- Добавлена заливка (`G`) связной области с регулируемым допуском цвета и непрозрачностью; операция защищена от перекрывающихся асинхронных сохранений.
- Добавлен инструмент линии (`L`) как редактируемого фигурного слоя; `Shift` привязывает направление к шагу 45°.
- Добавлена лупа (`Z`): клик увеличивает масштаб относительно курсора, `Alt+клик` уменьшает.
- Верхнее меню получило отдельный раздел «Выделение».
- `Delete` при активном выделении на редактируемом растровом слое очищает пиксели, а без такого контекста сохраняет старое удаление слоя.
- Добавлен модуль `src/core/pixels.js` и regression-тесты flood fill, selection clipping, line hit-testing/snap и wiring новых горячих клавиш.

## 1.7.0

- Навигация холста стала ближе к профессиональным редакторам: `Space+drag` и средняя кнопка мыши панорамируют без переключения инструмента.
- Масштабирование теперь поддерживает `Alt+колесо` наряду с `Ctrl+колесо`, а также `Ctrl++`, `Ctrl+-`, `Ctrl+0` и `Ctrl+1`.
- `Tab` теперь включает полноценный режим холста: скрывает левую панель инструментов и правые панели, сохраняя текущую точку просмотра вместо принудительного `fitToView()`.
- Исправлено перехватывание одиночных горячих клавиш интерактивными элементами: Space/Delete/стрелки больше не ломают нативную клавиатурную работу кнопок и контролов.
- Исправлен «залипший Space» после Alt+Tab/потери фокуса окна: временный режим руки сбрасывается на `window.blur`.
- Панель слоёв получила roving focus и клавиатурную навигацию: `↑/↓`, `Home/End`, `Enter/F2` для переименования, `Delete` для удаления.
- Добавлен явный `:focus-visible` для строк слоёв.
- Добавлены regression-тесты для навигации холста, canvas-only режима, zoom-shortcuts и клавиатурной доступности слоёв.

## 1.6.0

- Добавлен безопасный лимит растровых Canvas-буферов: не более 48 МП; лимит применяется при создании документа, открытии проекта, импорте, растеризации, ручном изменении размеров растрового слоя и перед выделением Canvas для кисти.
- Пустые растровые слои остаются sparse (`dataUrl: null`) до первого реального штриха и больше не кодируются в полноразмерный PNG заранее.
- Кисть поддерживает давление пера через `PointerEvent.pressure`; мышь сохраняет стабильную ширину.
- Добавлены стандартные горячие клавиши `[` / `]` для изменения размера кисти, `Shift+[` / `Shift+]` — крупный шаг.
- Масштаб увеличен до 1600%; при больших увеличениях холст переключается на `image-rendering: pixelated` для пиксельной ретуши.
- Добавлен видимый контур размера кисти/ластика под курсором; исправлено соответствие контура реально выбранному растровому слою при перекрывающихся слоях.
- Пипетка больше не считывает визуальный checkerboard прозрачности как цвет и корректно сообщает о прозрачном пикселе.
- Decode-cache растров ограничен по размеру; повреждённое embedded-изображение больше не обрушает весь render pipeline.
- Добавлены команды «Центрировать слой на холсте» и «Вписать слой в холст».
- Ручка вращения прижимается внутрь интерактивной области, если обычная позиция выходит за край холста, поэтому её можно схватить даже у верхней/боковой границы.
- Исправлен обход pixel-budget через поля ширины/высоты растрового слоя.
- Убраны дублирующий toast при ошибке сохранения штриха и лишнее двойное обновление `modifiedAt` при перестановке слоя.
- Набор regression-тестов расширен до 46 сценариев.

## 1.5.0

- Добавлена ручка вращения выбранного слоя прямо на холсте; `Shift` привязывает угол к шагу 15°.
- Transform-handles получили `Alt`-масштабирование от центра; `Alt+Shift` одновременно сохраняет центр и пропорции.
- `Shift` при рисовании прямоугольника/эллипса создаёт квадрат/круг во всех направлениях перетаскивания.
- Инструмент «Текст» при клике по существующему текстовому слою открывает редактирование текста, размера и цвета вместо создания нового слоя.
- История действий стала кликабельной: можно переходить прямо к любому сохранённому состоянию.
- «Размер холста» получил 9-точечный якорь для контролируемого расширения и обрезки относительно содержимого.
- Перетаскивание слоёв в панели теперь меняет их порядок напрямую.
- Добавлены regression-тесты трансформации от центра, сохранения пропорций, rotation snapping и Shift-ограничения фигуры.


## 1.4.0

- Исправлена гонка асинхронного рендера: полный Canvas-рендер теперь сериализуется и коалесцируется через промежуточный буфер; устаревший кадр не попадает на экран.
- Добавлены реальные 8 transform-handles для изменения размера выбранного слоя, включая корректную работу на повёрнутых слоях.
- `Shift` при угловом resize сохраняет пропорции; вычисление каждого pointer move идёт от исходного transform, поэтому ручки не дрейфуют.
- Перемещение/resize слоя мышью может выходить за границы холста; pointer capture удерживает непрерывный drag.
- Добавлена перестановка слоёв drag-and-drop в панели «Слои».
- Ctrl+колесо масштабирует холст относительно позиции курсора.
- Добавлена команда «Размер изображения», масштабируемая вместе со слоями, и усилена валидация «Размер холста».
- Добавлена команда «Растеризовать слой» для текста и фигур, после чего по ним можно работать кистью/ластиком.
- PNG-кодирование завершённого штриха переведено с синхронного `toDataURL()` на асинхронный `toBlob()` + FileReader, что уменьшает блокировку UI на больших слоях.
- Добавлена защита от гонки быстрого `pointerdown → pointerup` во время асинхронной подготовки кисти и запрет старта следующего штриха, пока предыдущий ещё сохраняется.
- Исправлено восстановление состояния при `pointercancel` для resize/move/crop и добавлена отмена активной трансформации через Esc.
- При замене документа очищается image decode cache и сбрасывается временное состояние кисти, чтобы старый проект не мог протечь в новый.
- Растровое масштабирование использует high-quality image smoothing.
- Усилен sanitizer `.zpe`: ограничиваются числовые параметры, фильтры, duplicate layer ID и неподдерживаемые blend mode.
- Добавлены regression-тесты render pipeline, async brush persistence, pointer-race, rotated hit-testing/resize, reordering и sanitizer.

## 1.3.1

- Исправлен ластик: он больше не создаёт новый слой "Рисование" вместо стирания.
- Ластик теперь работает только по существующему растровому слою: выбранному слою с изображением/рисунком или верхнему растровому слою под курсором.
- Если под курсором нет подходящего растрового слоя, показывается понятное сообщение вместо скрытого создания нового слоя.
- Кисть и ластик теперь корректно рисуют/стирают в координатах самого слоя, поэтому работают не только по полноразмерному слою на весь документ, но и по обычным импортированным растровым изображениям.
- Добавлены regression-тесты, запрещающие автосоздание слоя ластиком и закрепляющие преобразование координат документа в пиксели слоя.

## 1.3.0

- Исправлена главная причина зависаний кисти: удалено `canvas.toDataURL('image/png')` из каждого `pointermove`. PNG-кодирование выполняется только при завершении штриха.
- Live-preview кисти теперь рендерит активный растровый слой прямо из Canvas через `rasterOverrides`, без Base64 encode/decode цикла.
- Перерисовка live-preview ограничена `requestAnimationFrame`, поэтому очередь pointer-событий не запускает бесконтрольное количество полных рендеров.
- Исправлена алгоритмическая проблема длинных штрихов: каждый новый сегмент получает отдельный `beginPath()`, вместо повторного `stroke()` всей растущей траектории.
- Добавлена обработка `getCoalescedEvents()` для более плавного ввода мышью/пером при высокой частоте событий.
- Первый штрих по уже открытой растровой картинке повторно использует декодированное изображение из render-cache вместо лишнего decode.
- Во время live-preview больше не переинициализируется overlay-canvas на каждом кадре.
- Checkerboard прозрачности переведён с тысяч `fillRect` на повторяющийся Canvas pattern.
- Добавлена обработка `pointercancel`, чтобы незавершённый штрих не оставлял инструмент в сломанном состоянии.
- История Undo/Redo получила бюджет памяти 128 MiB: старые тяжёлые raster snapshots автоматически удаляются, вместо бесконтрольного роста RAM.
- Добавлены regression-тесты, которые запрещают возвращать PNG-кодирование и полную перерисовку прямо в `paintTo`.
- Browser smoke: длинный штрих на документе 1919×922, кисть → ластик → Undo → Redo, без JavaScript errors.

## 1.2.0

- Исправлена корневая причина неработающего интерфейса при запуске двойным кликом по `index.html`: runtime больше не зависит от ES-модулей и HTTP-сервера.
- Добавлена браузерная сборка `src/app.bundle.js`, которая работает через обычный `file://` запуск.
- `start.bat` теперь просто открывает `index.html`; Python для запуска редактора больше не требуется.
- Усилен drag-and-drop из Windows Explorer: обработчики перенесены на capture-уровень `window`, чтобы браузер не перехватывал файл как навигацию.
- Определение drag-файлов теперь проверяет `DataTransfer.files`, `items` и `types`, а не только строку `Files`.
- Вставка через `Ctrl+V` продолжает использовать нативный `paste` и показывает диагностику, если браузер передал буфер без изображения.
- Добавлен boot-marker и понятное сообщение при критической ошибке запуска.
- Стартовый документ теперь чистый: без демонстрационных слоёв; первое импортированное изображение задаёт размеры документа.
- `Ctrl+V` получил двойной путь: нативный `paste` + Clipboard API fallback без двойной вставки.
- Добавлены regression-тесты, запрещающие возврат `type=module` в прямой Windows-запуск.

## 1.1.0

- Исправлено и расширено верхнее меню: Файл, Правка, Слой, Изображение, Вид, Помощь.
- Добавлено открытие меню и навигация по нему с клавиатуры.
- Добавлен глобальный drag-and-drop изображений с рабочего стола.
- Добавлено открытие `.zpe`, `.pixforge` и JSON-проекта перетаскиванием.
- Добавлена вставка изображений и скриншотов через `Ctrl+V`.
- Добавлена команда вставки изображения из Clipboard API с безопасным fallback на `Ctrl+V`.
- Горячие клавиши переведены на `KeyboardEvent.code`, чтобы Ctrl-команды работали при русской раскладке.
- Добавлен Ctrl+Shift+S для экспорта и Ctrl+Shift+N для нового растрового слоя.
- Добавлен сдвиг выбранного слоя стрелками, Shift+стрелки — шаг 10 px.
- Добавлен выбор соседнего слоя через Alt+↑ / Alt+↓.
- Добавлен Ctrl+колесо для масштабирования холста.
- Добавлено скрытие правой панели через Tab и fullscreen через F11.
- Добавлены уведомления об импорте/ошибках и полноэкранная подсказка при перетаскивании файлов.
- Изменение фильтров и непрозрачности теперь имеет live preview и корректно попадает в Undo/Redo.
- Добавлено предупреждение перед заменой документа с несохранёнными изменениями.
- Добавлены справка по горячим клавишам и окно «О программе».
- Логотип в шапке изменён с PF на ZP.