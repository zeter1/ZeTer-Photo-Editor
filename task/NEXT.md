# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 9 / **CAP-RAW-DNG-FOUNDATION — независимая проверка camera-authored DNG + калиброванная проявка**.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS. Базовый рабочий срез `1.46.18` реализован локально в `feat/raw-dng-foundation-20261116`, но ещё нет внешней camera-authored RAW acceptance и PR-head Linux CI.
> **BASE MAIN SHA:** `7ab905fb5640d0e99b14c25c198cc6ff5207deb3` — [#393 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/393), [CI main SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43813016042).
> **ACTIVE PR:** публикация локальной ветки запланирована; URL и статус после GitHub readback.
> **LOCAL VERIFIED:** 8 focused Node tests PASS; реальный Windows Chromium `file://` DNG input → Bayer RGBA → WB/exposure controls → History Undo/Redo → оригинальные DNG bytes в `.zpe` → reopen → PNG/PSD/PSB UI self-export PASS. Это синтетический, но валидный TIFF/DNG binary fixture; **не** camera-authored корпус. Linux-only Windows `/proc/cgroup` не трактовать как полный PASS.
> **KNOWN LIMITS:** classic TIFF, несжатые 8/16-bit Bayer strips, 2×2 CFA, 48 МиБ/16 MP; bilinear camera RGB лишь приближённый sRGB без ColorMatrix/ICC. Не поддерживаются packed RAW, lossless-JPEG DNG, highlights/shadows, ActiveArea, calibrated color, полная Adobe совместимость.
> **NEXT IMPLEMENTATION ACTION:** получить проверяемый легально распространяемый **camera-authored uncompressed Bayer DNG** с CFA/black-white/AsShotNeutral/ColorMatrix, сравнить матрицу пикселей и orientation/active-area с независимым RAW-декодером (LibRaw/RawTherapee). Исправить реальные отклонения и добавить camera-to-sRGB ColorMatrix + orientation/active-area в Chrome E2E. Сжатый DNG — отдельный следующий срез.

## Приоритетная очередь

1. **CAP-RAW-DNG-FOUNDATION:** IN PROGRESS — независимый camera-authored DNG/ColorMatrix/ActiveArea acceptance; 1.46.18 уже поддерживает ограниченный synthetic + Chrome вертикальный срез.
2. **CAP-BEZ-MASK-PSD-UI:** BLOCKED только внешний Adobe-authored interoperability corpus; не повторять принятый bounded node edit [#392](https://github.com/zeter1/ZeTer-Photo-Editor/pull/392).
3. **Stage 6 / 003X/6c-9:** IN PROGRESS — Worker stale/close/edit native RGB16/CMYKA32 acceptance.
4. **Более широкие RAW форматы / ICC / native HDR / full Photoshop interoperability:** TODO/IN PROGRESS по [матрице](CAPABILITY_MATRIX.md).

**Технический журнал:** [002-raw-dng-foundation.md](002-raw-dng-foundation.md) · [матрица](CAPABILITY_MATRIX.md) · [карта](README.md). Статус PR/CI и точного head сверять с GitHub.
