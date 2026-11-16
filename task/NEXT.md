# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 9 / **CAP-RAW-DNG-CAMERA-COLOR** — последний непубликованный bounded matrix pipeline; завершить проверку diff, PR-head Linux core+independent real-photo CI и интеграцию.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS (локальный код готов и прошёл targeted acceptance, ещё НЕ в main).
> **BASE MAIN SHA:** `a81bec7cafabff90b685c41fe4b8242dc8fa1566` — [#396 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/396), версия 1.46.19. Exact-main [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43824536034) для старого main, не для нового diff.
> **ACTIVE PR:** none (на момент локальной проверки). **LAST VERIFIED:** 2026-11-16 — чистый исходный Windows `ZeTer-Photo-Editor-raw` + bounded v1.46.20 edits.
> **LOCAL EVIDENCE:** 18/18 focused Node PASS, `npm run build` PASS, настоящий Chromium `npm run test:browser:raw-dng` PASS (calibrated ColorMatrix pixel oracle, Properties, exposure/WB, Undo/Redo, .zpe save/reopen и PNG/PSD/PSB self-export). Full Windows `npm run check`: **1664 PASS / 10 SKIP / 5 FAIL** (Linux-only /proc/cgroup probes на Windows); `git diff --check` PASS. Linux PR CI пока NOT RUN.
> **REMAINING ACCEPTANCE:** GitHub PR-head Linux CI core/independent; exact-main после merge. Camera-authored lawful Bayer DNG + независимый LibRaw/RawTherapee pixel oracle и точные пороги остаются **BLOCKED (external evidence)** — не препятствие независимому DefaultCrop. Двухисточниковый CCT, Photoshop/ICC/ForwardMatrix не full parity.
> **NEXT IMPLEMENTATION ACTION:** после code/CI приемки переходить к **CAP-RAW-DNG-DEFAULT-CROP** — читать DefaultCropOrigin/Size относительно ActiveArea, валидировать sensor-phase, дробные координаты/Orientation/Undo/Redo/.zpe и Chrome file:// raster pixels; больше не реализовывать ColorMatrix заново.
> **BLOCKERS:** нет независимого подтверждённого camera-authored reference и oracle; текущая матричная реализация пока локальная, не CI-verified.

## Короткая очередь

1. **CAP-RAW-DNG-DEFAULT-CROP:** P1 TODO — следующий пользовательский RAW срез после приёмки текущего PR.
2. **CAP-RAW-CAMERA-ORACLE:** BLOCKED — licensed camera-authored DNG, LibRaw/RawTherapee calibrated pixel comparisons.
3. **CAP-BEZ-MASK-PSD-UI:** BLOCKED external Adobe-authored corpus; не повторять уже merged bounded.
4. **Stage 6 / 003X/6c-9:** IN PROGRESS — Worker stale/close/edit native RGB16/CMYKA32.
5. **RAW lossless-JPEG/packed, ICC/ForwardMatrix, HDR:** TODO/IN PROGRESS по [матрице](CAPABILITY_MATRIX.md).

[ColorMatrix journal](002-raw-dng-camera-color.md) · [Orientation journal](002-raw-dng-orientation-activearea.md) · [матрица](CAPABILITY_MATRIX.md) · [карта](README.md).
