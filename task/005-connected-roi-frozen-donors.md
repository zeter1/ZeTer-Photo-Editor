# 005 — Stage 003: bounded connected ROI + frozen global donors (2026-10-11)

## Контекст

Глобальный bounding rectangle мог превышать `maxLayerPixels` даже при узкой связной диагонали. Раньше halo-intersecting соседние tiles всегда объединялись транзитивно, а единственную большую группу нельзя было выполнить. Независимые tile chunks без глобально исключённых доноров использовать **нельзя**: ранее заполненные selected-пиксели становятся ложным источником текстуры.

## Срез реализации — PR #185

- [x] Сначала попытаться использовать прежние halo-disjoint groups, не меняя обычный small-ROI path.
- [x] Если группы избыточны, планировать фрагменты по занятым tile cells, с повторной проверкой суммарной площади `maxLayerPixels` **до** чтения.
- [x] Однократная глобальная frozen bitmap (1 бит/пиксель) поверх `selectedIndices`: не допускать выбранные пиксели других чанков ни в boundary donors, ни в PatchMatch contexts, даже после приватной записи соседнего ROI.
- [x] Использовать общий kernel для sync / frozen-index / Worker / cooperative; не сканировать selection predicate повторно.
- [x] Все изменения приватные до успешной общей сериализации, прежние checkpoint и отмена сохраняются.
- [x] Добавить RGB16 connected-diagonal parity тесты, actual Node Worker, invalid caps, cancel и прямую проверку запрещённого донора.
- [x] `npm run check` и `npm run test:browser` — PASS в [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38135146345).
- [x] Проверены сгенерированные `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js`, `index.html`, `version.json` (включая версию 1.46.0).
- [x] Diff review, [PR #185](https://github.com/zeter1/ZeTer-Photo-Editor/pull/185) merged (squash `1d18f525d62b03eb6734b883e94a8cc5642ca6a1`) и [exact-main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38135223279) — success.

## Статус

Эта малая проходка **завершена**, общие Stage 002 и Stage 003 — **нет**.

## Ограничения

Это **подэтап**, не общий Stage 003 completion: не каждый connected ROI укладывается в 8 MP sum, >256 occupied tiles всё ещё безопасно отклоняются, а стиль заполнения может отличаться от единого глобального ROI. Node Worker fixture синтетический, не external Photoshop goldens. Browser peak RAM, реальный 16/32-bit PSD/PSB UI Worker → preview → Undo/Redo/cancel и Stage 002 независимый Adobe corpus всё ещё не реализованы/не верифицированы.

## Следующие проходки

1. Для слишком большого количества занятых tiles спроектировать adaptive strip/segment grouping, не нарушая aggregate budget и donor authority; добавить worst-case bound profile на 16/32-bit.
2. Chromium `file://` end-to-end import PSD16/PSB32 → detached Worker → preview → Undo/Redo, cancellation и CDP sampled renderer/process memory; различать sampled usage и true peak.
3. Stage 002: проверенные Photoshop-authored исходники RGB16/CMYK PSD16 + PSB32 с лицензией, SHA-256, независимыми render goldens, без сомнительных бинарных assets.
