# Stage 17a — изолированный PSD/PSB raster clipping (1.47.18)

**Дата:** 2026-11-23. **Base GitHub main:** `ae42c07fe29728379fb25cd5f55e87b1b02b5e88`. **Статус:** bounded implementation tested locally; parent CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY = IN PROGRESS.

## Дефект (RED)

В `src/core/render.js:renderLayerEntry` clippingMask передавался только Photoshop adjustment layer. Обычный PSD raster layer с `clipping:true` вызывал `renderLayer` без маски и закрывал пиксели за пределами base. Изолированная группа не исправляла этот дефект. Тесты `tests/isolated-raster-clipping.test.mjs`: исходно 2/2 RED (нет `setClipping` и изоляции clippedCanvas).

## Реализация

- Для clipping raster создаётся отдельный doc-sized RGBA Canvas, слой со всеми собственными raster/vector mask, фильтрами и альфой рисуется с source-over, а alpha непосредственного нижнего base применяется через destination-in. После этого clipped результат компонуется с его оригинальным blendMode поверх настоящего родительского backdrop.
- Clipped raster/adjustment без активной базы не участвует в рендере (fail-closed); base mask, group opacity/blend и нижние слои не уничтожаются.
- Raster Properties получает checkbox clipping, команда `setClipping` применяет exact document identity, layer type, recursive lock, finite/no-op safeguards (boolean validation) и один History commit; `.zpe` сохраняет canonical `clipping` из существующей схемы.
- В PSD/PSB writer не потребовалась новая сериализация: native clipping flag и layer mask/channel records сохранялись. Добавлен regression fixture, проверяющий двукратный codec round-trip для обоих форматов.

## Локальная проверка и происхождение oracle

- RED: 2 FAIL → GREEN: 26/26 в focused render + property suite.
- `node --test tests/isolated-raster-clipping.test.mjs tests/psd-masked-group-corpus.test.mjs`: 5/5 PASS; native PSD и PSB оба сохраняют group multiply opacity, base mask alpha [255,255,0,0] и child clipping.
- `npm run test:browser:psd-isolated`: PASS, настоящий Chromium на production `file://`, .zpe импорт через File input. Синтетический 4×2 fixture: mask left half у blue base, red clipped raster, multiply group opacity .5 поверх white. Pixel INSIDE [255,127,127,255], OUTSIDE [255,255,255,255], снятие clipping распространяет pink на outside. Checked реальные UI checkbox / Undo / Redo / Undo / Save Project Blob / reopen .zpe с exact RGBA и same schema.
- `npm run check`: FAIL, всего 1790 тестов / 1775 PASS / 10 SKIP / 5 FAIL. Все 5 относятся к существующим Linux-only `/proc`/cgroup tests, несовместимым с Windows. Chromium broad smoke и exact GitHub head будут проверены отдельно; не выдавать их за PASS без результата.
- Никакого Adobe-authored pixel golden в этом срезе нет; `tests/psd-masked-group-corpus.test.mjs` включает сторонние MIT-adjustment bytes, но не независимую Photoshop group-mask пиксельную истину.

## Что осталось

**Следующий точный профессиональный шаг:** поддержка настоящей **Photoshop folder/group raster mask** из layer-section divider на импорт/экспорт в `src/formats/psd.js`, `src/document/psd-import-semantics.js`, `src/core/state.js` и `src/core/render.js`; отрицательный RED pixel-test с независимой Photoshop-authored PSD/PSB fixture, проверка nested isolated/pass-through/clipped и History/.zpe/PSD round-trip в Chromium. Не смешивать существующую child raster mask с Photoshop group mask. Родительская Stage 17a остаётся IN PROGRESS до независимой приёмки.
