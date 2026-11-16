# CAP-RAW-DNG-CAMERA-COLOR — matrix-to-linear-sRGB (bounded)

**Дата:** 2026-11-16 · **Stage:** 9 · **Приоритет:** P1 · **Версия-кандидат:** 1.46.20 · **Базовый main:** `a81bec7cafabff90b685c41fe4b8242dc8fa1566` (#396 merged) · **Родитель CAP-RAW:** IN PROGRESS.

## Реальная реализация

- `src/formats/dng-color.js`: ColorMatrix (D50 XYZ → unbalanced camera RGB) инвертируется; Bradford адаптирует as-shot white к D50, затем к D65; матричное преобразование в linear sRGB до gamma. Dual illuminant интерполяция по reciprocal Kelvin с ограниченной итерацией; упрощённая CCT-модель и bilinear demosaic, не Adobe parity.
- `src/formats/dng.js`: читаем ColorMatrix1/2 `SRATIONAL[9]`, CalibrationIlluminant1/2 `SHORT`, AsShotNeutral; строго проверяем bounds/shape, den=0, singular, missing illuminant/matrix и явно отвергаем профили, требующие пока неподдерживаемых CameraCalibration/AnalogBalance/ForwardMatrix. Неверный тип calibration tag не может пропасть при сканировании.
- Сохраняется fallback для старых RAW без matrix — **uncalibrated preview**, не «camera accurate». Панель RAW Properties показывает текущую ветку. WB gains после калибровки применяются в camera space, не подменяя as-shot illuminant; exposure до sRGB transfer.
- `src/document/import-controller.js`, `src/core/state.js`: `rawDng.colorPipeline` whitelisted при сохранении/reopen `.zpe`, исходный бинарный dataUrl неизменен; History Undo/Redo и export PNG/PSD/PSB прежние реальные UI workflows.

## Проверки

- **LOCAL PASS:** `node --test tests/dng-color.test.mjs tests/dng.test.mjs tests/dng-import-controller.test.mjs` — 18/18 PASS: матричное преобразование, signed TIFF II/MM, dual illuminant, WB, повреждённый IFD / неправильный SRATIONAL / вырожденность / нулевой знаменатель, old fallback и .zpe sanitization.
- **LOCAL PASS:** `npm run build`; настоящий Chromium `npm run test:browser:raw-dng` — загрузка через file input в `file://`, full renderer pixel oracle, Properties, exposure + WB, Undo/Redo, `.zpe` save/reopen/immutability, PNG/PSD/PSB self-round-trip, старый ActiveArea/Orientation.
- **Windows `npm run check`:** 1664 PASS / 10 SKIP / 5 FAIL (все 5 Linux-only /proc/cgroup probe на Windows); `git diff --check` PASS. **PR-head CI:** NOT RUN до публикации; **exact-main CI для версии 1.46.20:** NOT RUN; **independent workflow на изменениях:** NOT RUN. Отдельно ранее успешный exact-main a81bec7 не доказывает этот diff.

## Границы и продолжение

Это **bounded implementation**, не полноценно калиброванный camera RAW. Синтетическая TIFF/CFA fixture не является фотоснимком, снятым камерой. Нужны DNG с подтверждёнными правами и provenance, independent LibRaw/RawTherapee image oracle, измеримые pixel differences, profile ForwardMatrix/ICC, более точная colour temperature/whitepoint модель и тесты на насыщение/света.

**Следующий независимый срез:** `CAP-RAW-DNG-DEFAULT-CROP`: применять `DefaultCropOrigin` / `DefaultCropSize` относительно ActiveArea, проверять bounds/subpixel rules/Orientation/CFA, тестировать настоящий file:// UI + Undo/Redo + .zpe; external camera-authored corpus параллельно остаётся BLOCKED.
