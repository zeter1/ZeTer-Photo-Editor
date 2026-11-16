# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 9 / **CAP-RAW-DNG-CAMERA-COLOR** — реальная калиброванная RAW-проявка, ColorMatrix и независимый camera-authored corpus.
> **PRIORITY:** P1 · **STATUS:** TODO (следующая реализация). Калиброванный camera-to-sRGB pipeline в коде ещё отсутствует. Не повторять готовые DNG import, WB/exposure, ActiveArea/Orientation.
> **CURRENT MAIN:** `f45d3336db3d629447da482937391eeebd0ddfe3` — [#395 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/395), версия `1.46.19`. Exact-main [core CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43823529880) / [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43823529920) **PENDING** на момент обновления; сверять по точному SHA.
> **LAST PR EVIDENCE:** #395 final head `611682a9904dc4dbc171ffbc6b21bb53e61335eb`, [Linux core CI attempt 2 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43822770396) после точечного rerun Chromium DevTools endpoint timeout, [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43822770443), 13/13 checks SUCCESS. `verify` включает новый ориентированный DNG Chromium `file://` PASS; первая попытка старого E2E ожидания имела race и исправлена коммитом `611682a`.
> **LOCAL EVIDENCE:** Windows 11 focused Node PASS; `npm run test:browser:raw-dng` повторно PASS 2×; `npm run check`: **1657 PASS / 10 SKIP / 5 FAIL** (все 5 Linux-only cgroup/proc); полный Windows `npm run test:browser` FAIL по CDP `Runtime.evaluate` timeout после Stage 036C, причинность к DNG не доказана. Не выдавать общие Windows тесты за PASS.
> **BOUNDARY:** camera-authored licensed DNG и independent LibRaw/RawTherapee pixel oracle отсутствуют. ColorMatrix1/2 / ICC / DefaultCrop, packed/lossless JPEG RAW и точный HDR pipeline — НЕ поддерживаются полностью; synthetic TIFF fixture не является камерным RAW.
> **NEXT IMPLEMENTATION ACTION:** реализовать **реальное преобразование camera RGB → XYZ D50 → linear sRGB** с безопасным разбором DNG `ColorMatrix1/2`, `AsShotNeutral`, `CalibrationIlluminant1/2`; строго валидировать типы/размерности матриц, вырожденность и отсутствие калибровки, не называть приблизительное изображение camera-accurate. Добавить эталонные матричные unit-тесты, `.zpe` provenance, WB/exposure/Undo/Redo и реальный Chrome `file://` acceptance. Параллельно найти законно распространяемый **camera-authored uncompressed Bayer DNG** с документированным provenance и получить независимые reference pixels; до этого полный Stage 9 IN PROGRESS.
> **ACCEPTANCE GATE:** PR head Linux core+independent real-photo CI, camera reference LibRaw/RawTherapee и pixel error thresholds, ориентированный RAW UI/History/.zpe acceptance, затем exact-main CI. Сжатый DNG — отдельный следующий срез.

## Очередь (не дублировать сделанное)

1. **CAP-RAW-DNG-CAMERA-COLOR:** P1 TODO — код калиброванного цветового конвертера и внешний корпус/сравнение.
2. **CAP-BEZ-MASK-PSD-UI:** external Adobe-authored interoperability corpus BLOCKED, не повторять #392.
3. **Stage 6 / 003X/6c-9:** IN PROGRESS, Worker stale/close/edit native RGB16/CMYKA32 acceptance.
4. **RAW lossless-JPEG, ICC, HDR, расширенная Photoshop-совместимость:** TODO / IN PROGRESS по [матрице](CAPABILITY_MATRIX.md).

[Журнал RAW 1.46.19](002-raw-dng-orientation-activearea.md) · [RAW foundation](002-raw-dng-foundation.md) · [матрица](CAPABILITY_MATRIX.md) · [карта](README.md).
