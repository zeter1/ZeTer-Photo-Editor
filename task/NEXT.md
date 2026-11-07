# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2 / CAP-ADJ-STACK — корректирующие Levels/Curves в группах, clipping и совместно с масками.
> **PRIORITY:** P1 · **STATUS:** TODO — первый вертикальный срез CAP-ADJ-CREATE принят через #379; этот следующий этап ещё не начат.
> **BASE MAIN SHA:** `275be9475dea4a363dc6474c2c093b0b50fbd52a` — [PR #379 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/379), [PR #378 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/378) ранее `8522b22`.
> **ACTIVE PR:** нет для CAP-ADJ-STACK. Предыдущий [#379](https://github.com/zeter1/ZeTer-Photo-Editor/pull/379) MERGED, проверенный head `56ce6c04f4fb08b6b47becc780cb0fbbba0b4180`.
> **LAST VERIFIED (2026-11-07):** CAP-MASK-VD #378 bounded DONE — head [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42353796878), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42353796954), exact-main `8522b22` [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42363763495), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42363763521). CAP-ADJ-CREATE #379 bounded DONE — exact PR-head `56ce6c04` [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42364582039), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42364582048); local build PASS, **48/48 focused Node PASS**, настоящий Chrome `file://` adjustment and vector-mask PASS, полный Chrome smoke PASS (105.39s), Undo/Redo и Ctrl+S `.zpe` save/reopen PASS. Full Windows `npm run check` ранее FAIL на 5 Linux-only `/proc/cgroup` tests; не считать Windows full green. Exact-merged-main #379 CI для `275be947` и последующего documentation commit проверить отдельно.
> **REMAINING ACCEPTANCE:** CAP-ADJ-STACK требует доказанного pixel compositing Levels/Curves при nested groups, clipping и сочетании с raster/vector masks, правильного порядка, видимости и alpha, History Undo/Redo и `.zpe` v1/v2 round-trip; PSD/PSB editable metadata Photoshop-authored проверить отдельно, без неявного flatten. CAP-ADJ parent IN PROGRESS, несмотря на bounded #379 DONE.
> **NEXT IMPLEMENTATION ACTION:** в `src/core/render.js` и `src/core/adjustments.js` найти первый воспроизводимый stack/group/clipping/mask контрпример на реальных видимых пикселях; написать RED regression, исправить минимальный compositor, провести unit, Chrome `file://` Layer/Properties/Undo/Redo/`.zpe`, PSD round-trip по доказанным типам, создать независимый PR и exact-head CI. Не повторять CAP-ADJ-CREATE, Curves UI и Colorize #379.
> **BLOCKERS:** внешний Adobe Photoshop-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED независимо; Stage 6 native Worker RSS/peak UNKNOWN.

## Краткая очередь

1. **CAP-ADJ-STACK:** вложенные группы, clipping, raster/vector masks + non-destructive Levels/Curves pixel/UI/Undo/`.zpe` regression — CURRENT.
2. **CAP-ADJ-PSD:** сохранить editability Level/Curves и native PSD/PSB round-trip на подтверждённых Adobe-authored файлах, не считать синтетическую parity.
3. **CAP-MASK/CAP-BEZ:** Photoshop-native vector mask controls и пути, full UI / PSD/PSB compatibility IN PROGRESS; предыдущий #378 bounded DONE.
4. **Stage 6 / 003X/6c-9:** targeted Worker stale/close/edit native parity, отдельный Adobe PSB32 provenance BLOCKED.

[Карта](README.md) · [Матрица](CAPABILITY_MATRIX.md) · [CAP-ADJ-CREATE](002-adjustment-layer-creation.md) · [CAP-MASK-VD](002-vector-mask-density-feather.md) · [Архив](archive/2026-11-04-NEXT-legacy.md).
