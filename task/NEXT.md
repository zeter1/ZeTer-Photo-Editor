# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2 / CAP-MASK-VD — density/feather векторной маски.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS — реализация и локальный Chromium приняты; PR-head CI/merge ещё предстоят.
> **BASE MAIN SHA:** `9fa6a7d90477bc4c36534daeaec3a7e71153c6ec` (после CAP-BEZ #125).
> **ACTIVE PR:** ветка `feat/vector-mask-density-feather-20261107`; PR создать после локальных проверок.
> **LAST VERIFIED (2026-11-07):** 25/25 focused Windows unit PASS; `npm run build`, `git diff --check` PASS; Chromium `file://` `npm run test:browser:vector-mask` PASS (alpha density/feather, UI Layer menu, History, Undo/Redo, real Ctrl+S .zpe Blob/reopen); полный `npm run test:browser` также PASS на Windows Chrome. Полный Windows `npm run check`: 1609 tests, 1594 PASS, 10 SKIP, **5 FAIL** (известные Linux-only /proc/cgroup fixtures). Остальные тесты, включая исправленный контекст меню и версию, PASS. Remote PR-head CI NOT RUN, candidate exact-main CI NOT RUN.
> **REMAINING ACCEPTANCE:** Linux PR-head `npm run check`, browser file://, generated parity; independent real-photo CI, review/merge по gates, exact-merged-main CI. PSD/PSB editable vector-mask density/feather **не** входит в bounded increment.
> **NEXT IMPLEMENTATION ACTION:** пройти head CI и интеграцию CAP-MASK-VD; затем CAP-ADJ editable Levels/Curves end-to-end, без профилирования ради профилирования.
> **BLOCKERS:** внешний Photoshop-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED, не блокирует этот срез; Stage 6 native Worker RSS UNKNOWN.

## Краткая очередь

1. **CAP-MASK-VD:** довести текущий PR до head CI/review/exact-main verification; bounded DONE лишь после gates.
2. **CAP-ADJ:** Levels/Curves edit, compositing, Undo/Redo, .zpe и PSD editable round-trip по подтверждённым типам.
3. **CAP-BEZ:** Vector Mask / Saved Paths direct UI E2E и Photoshop-authored PSD/PSB paths parity; bounded smooth anchors #125 MERGED.
4. **Stage 6 / 003X/6c-9:** native Worker stale/close/edit parity; Adobe PSB32 provenance отдельно BLOCKED.

[Карта](README.md) · [Матрица](CAPABILITY_MATRIX.md) · [CAP-MASK-VD](002-vector-mask-density-feather.md) · [CAP-BEZ](002-bezier-smooth-anchor.md) · [Stage 6](003x6c9-history-sharing-profile.md) · [Архив](archive/2026-11-04-NEXT-legacy.md).
