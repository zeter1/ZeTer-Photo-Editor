# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2 / CAP-MASK-VD — неразрушающие плотность и растушёвка для векторной маски (следующий профессиональный вертикальный срез).
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS (CAP-MASK родитель частично реализован; плотность/растушёвка vector mask — TODO, реализация ещё не начата).
> **BASE MAIN SHA:** b3ff1d1449a7215274d322a2788c11c6496b0cd1 — [PR #125](https://github.com/zeter1/ZeTer-Photo-Editor/pull/125) MERGED.
> **ACTIVE PR:** нет для CAP-MASK-VD; новый PR создавать только после реализации реального кода/тестов. Предыдущий #125 MERGED, exact head da75a8788862fae1447ad2a78d27e6bfef92d979.
> **LAST VERIFIED (2026-11-07):** #125 — 37/37 focused Windows unit PASS, реальный Chromium file:// Alt+Shift Shape, Undo/Redo, Ctrl+S .zpe Blob, reopen PASS; Linux [core CI #42351522449](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42351522449) SUCCESS, [independent real-photo #42351522536](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42351522536) SUCCESS; [merge b3ff1d1](https://github.com/zeter1/ZeTer-Photo-Editor/commit/b3ff1d1449a7215274d322a2788c11c6496b0cd1). Exact merged-main [core #42351915017](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42351915017), [real-photo #42351915024](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42351915024) PENDING на момент записи. Полный Windows npm test FAIL на Linux-only /proc/cgroup проверках; не считать общим green.
> **REMAINING ACCEPTANCE:** для CAP-MASK-VD нет реализации. Model createVectorMask/sanitizeVectorMask не хранят density/feather, renderVectorMaskBitmap не применяет их, векторная маска имеет edit/invert/toggle, но не эти controls. Нужны изменения visible composite alpha, доступные UI controls/preview, ровно одна History-запись на commit, Undo/Redo, сохранение/reopen .zpe и тесты на реальных Shape/Vector Mask в Chrome file://. PSD/PSB совместимость проверять отдельно; full Photoshop parity не заявлять.
> **NEXT IMPLEMENTATION ACTION:** создать bounded CAP-MASK-VD код: src/core/state.js createVectorMask/sanitizeVectorMask density[0..1], feather[0..250]; src/core/render.js применить alpha controls к vector bitmap в обоих путях compositing; src/selection/vector-mask-controller.js и inspector UI для редактирования; tests unit + реальный Chromium file:// edit/render/Undo/.zpe. После green открыть отдельный PR и проверить CI.
> **BLOCKERS:** внешний Photoshop-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED, не блокирует .zpe/vector-mask feature. Stage 6 native Worker peak RSS UNKNOWN и самостоятельная задача.

## Краткая очередь

1. **CAP-MASK-VD:** векторная маска — плотность/растушёвка, UI + render + Undo + .zpe — CURRENT.
2. **CAP-ADJ:** редактируемые корректирующие слои, композитинг и PSD editability.
3. **CAP-BEZ:** полный UI E2E Vector Mask / Saved Paths, Photoshop-authored PSD/PSB round-trip — родитель IN PROGRESS, сглаживание bounded DONE via #125.
4. **Stage 6 / 003X/6c-9:** targeted native worker stale/close/edit parity; Adobe PSB32 provenance отдельно BLOCKED.

[Карта](README.md) · [Матрица](CAPABILITY_MATRIX.md) · [Принятый CAP-BEZ](002-bezier-smooth-anchor.md) · [Stage 6](003x6c9-history-sharing-profile.md) · [Архив](archive/2026-11-04-NEXT-legacy.md).
