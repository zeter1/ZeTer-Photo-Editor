# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 9 / **CAP-RAW-DNG-STACK-RECONCILIATION**, текущий локальный bounded **CAP-RAW-DNG-LINEAR-CONTRAST v1.47.17**.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS — 37 локальных RAW-коммитов реализованы до v1.47.17, перенесены в ветку `feat/raw-stack-reconcile-20261123`; Linux PR-head CI ещё НЕ подтверждён, main этого стека не содержит.
> **BASE MAIN SHA:** `207692f34dec227ca7e660473c34ecfc5a2b5821` — [#397 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397) и [#398 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398); #398 head `c0ff1643b42ae1d23dbd1738e0b897edbc403049` 13/13 SUCCESS. Exact-main core/real-photo проверяются отдельно.
> **ACTIVE PR:** [PR #397 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397), [PR #398 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398); новая кандидатная ветка `feat/raw-stack-reconcile-20261123` на основе #398, PR / CI подготавливаются.
> **LAST VERIFIED:** 2026-11-23. Локальная ветка `feat/raw-linear-contrast-20261123` от `b429175`, реализующий коммит `c04990f1a3978ad5eeb73a4f49e80ca6d19e5b6a`: реальная scene-linear luminance contrast S-curve, RAW Properties, History/Undo/Redo, `.zpe`, backward-compatible preset JSON; RED→GREEN 4 новых контракта, 15/15 focused Node PASS, `npm run build` PASS, реальный Chromium `file://` RAW/pixels/History/.zpe PASS. Windows `npm run check`: **1787 / 1772 PASS / 10 SKIP / 5 FAIL**, все 5 прежние Linux-only cgroup/proc; общий check FAIL. Полный Windows Chromium `npm run test:browser` на v1.47.17 **PASS exit 0** (detached PowerShell execution with explicit exit file, log `raw-browser-20261123-contrast-detached.log`). Linux PR-head CI этого локального кода NOT RUN.
> **REMAINING ACCEPTANCE:** сверить 77 Git blob SHA с локальным коммитом, Linux core + independent real-photo exact-head CI для нового PR, техническое review/merge, exact-main. Licensed camera-authored DNG и независимый LibRaw/RawTherapee oracle остаются BLOCKED.
> **NEXT IMPLEMENTATION ACTION:** создать PR со всем уже реализованным RAW-стеком SOF3/packed/ForwardMatrix/tonal/demosaic/presets/contrast, проверить точный head и устранить только реальные regressions; после merge получить exact-main CI. Далее camera-authored RAW oracle, при блокировке — независимый Stage 6/8 vertical slice.
> **BLOCKERS:** лицензированный camera-authored Bayer DNG с независимыми reference pixels отсутствует; synthetic fixtures не считаются настоящими камерами. #397/#398 были слиты по выполненным gate, 0 требуемых review и отсутствие branch protection подтверждены GitHub.

## Короткая очередь

1. **CAP-RAW-DNG-STACK-RECONCILIATION — P1 IN PROGRESS:** #397/#398 MERGED, полный v1.47.17 RAW PR/CI/merge далее.
2. **CAP-RAW-DNG-LINEAR-CONTRAST — local bounded ready, remote IN PROGRESS:** [журнал](002-raw-dng-linear-contrast.md).
3. **CAP-RAW-CAMERA-ORACLE — BLOCKED:** лицензированный camera-authored Bayer DNG, независимые reference pixels.
4. **Stage 6 Worker / Stage 8 ICC / Stage 2 Mask** — последующие самостоятельные вертикальные срезы по [матрице](CAPABILITY_MATRIX.md).

[Карта](README.md) · [матрица](CAPABILITY_MATRIX.md) · [журнал интеграции](002-raw-dng-stack-integration.md).
