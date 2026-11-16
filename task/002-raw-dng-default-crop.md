# CAP-RAW-DNG-DEFAULT-CROP — нативная геометрия DNG (bounded)

**Дата:** 2026-11-16 · **Stage:** 9 / P1 · **Версия-кандидат:** 1.46.21 · **База:** main `a81bec7` + PR #397 head `bf6dd662` · **Ветка:** `feat/raw-dng-default-crop-20261116` ([PR #398 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398), stacked на #397). Родитель RAW pipeline остаётся IN PROGRESS.

## Реальный код

- `src/formats/dng.js`: теги 50719 (`DefaultCropOrigin`) и 50720 (`DefaultCropSize`), точный TIFF тип `SHORT[2]` / `LONG[2]` / `RATIONAL[2]` и bounds. Origin H/V задаётся относительно верхнего левого угла ActiveArea, размер — в raw sensor coordinates. Missing origin/size имеют fallback (0,0 / размеры ActiveArea).
- CFA, black/white calibration, demosaic берутся из **полных координат сенсора**; дробные origin/size интерполируются в линейном camera RGB до ColorMatrix, экспозиции и sRGB OETF. Preview width/height округляются один раз; Orientation 1–8 после crop. Целочисленный crop идёт быстрым путём.
- `DefaultScale` (RATIONAL[2]) валидируется: 1×1 принимается, иначе явный отказ, чтобы не показывать неверный aspect ratio.
- `src/main.js`: Properties сообщает размер исходного сенсора и проявленного кадра. `src/document/import-controller.js` / `src/core/state.js` продолжают хранить оригинальные DNG bytes, native dims, development/provenance в `.zpe`; повторная проявка после reopen пересчитывает DefaultCrop из исходника. PSD/PSB содержат только rendered raster, не native RAW.

## Локальная проверка

- `node --test tests/dng-default-crop.test.mjs tests/dng.test.mjs tests/dng-color.test.mjs tests/dng-import-controller.test.mjs` — **26/26 PASS**: II/MM, SHORT/LONG/RATIONAL, ActiveArea, CFA phase, целочисленные pixel oracle, fractional origin и size, Orientation 1–8, corrupt type/arity/zero denominator/out-of-bounds, DefaultScale, ColorMatrix и native-byte immutability.
- Дополнительный RED→GREEN: неизвестный TIFF type и oversized count в DefaultScale/DefaultCropOrigin/DefaultCropSize раньше тихо пропускались при чтении IFD, теперь импорт отвергает испорченные теги; 6 негативных вариантов.
- `npm run build` — PASS; `npm run test:browser:raw-dng` — **PASS настоящий Chromium file://**: FileInput → fractional DefaultCrop+ColorMatrix+Orientation → реальные RGBA, Properties, Undo/Redo, `.zpe` save/reopen/redevelop, native bytes, PNG/PSD/PSB rendered export regression. Это synthetic TIFF, а не независимый camera-authored oracle.
- Полный Windows `npm run check`: **1672 PASS / 10 SKIP / 5 FAIL** (все пять FAIL — Linux-only `/proc`/cgroup probes на Windows); generated bundle/version parity и `git diff --check` PASS. Linux PR-head и independent real-photo CI #398 — NOT RUN: workflow `pull_request.branches` принимает только `main`, а stacked PR #398 пока на #397; exact-main CI — NOT RUN для версии 1.46.21. Предыдущий #397 exact-head `bf6dd662` core+real-photo SUCCESS, но эти статусы не относятся к новому diff.

## Ограничения и дальнейшая реализация

- Только classic TIFF/DNG uncompressed 8/16-bit Bayer strips; билинейное субпиксельное ресэмплирование с округлённой выходной сеткой, не Adobe parity.
- Неединичный DefaultScale fail-closed; BestQualityScale, compression, ICC/ForwardMatrix, camera-authored compare/LibRaw остаются незавершёнными.
- После CI/review/merge — **CAP-RAW-DNG-LOSSLESS-JPEG:** реальная безопасная декомпрессия DNG compression=7 strips/tiles, независимый byte/pixel oracle и Chrome `file://` import/.zpe/E2E. External provenance вести отдельно.
