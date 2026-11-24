# CAP-RAW-DNG-ASSHOT-WHITE-XY — локальный v1.47.9 (2026-11-20)

**Stage 9, bounded implementation DONE LOCALLY; remote integration IN PROGRESS.**
Локальная ветка `feat/raw-dng-asshot-white-xy-20261120` построена поверх
`477c806` (непубликованная RAW v1.47.8); GitHub main `ddd90d3` и открытые #397/#398 не менялись.

## Реальная реализация

- `src/formats/dng.js`: тег 50729 `AsShotWhiteXY` CIE xy, TIFF unsigned RATIONAL[2] в II/MM.
  В отличие от `AsShotNeutral`, он не является тремя сенсорными коэффициентами: требует
  ColorMatrix. Невалидные тип/count, указатель за файлом, знаменатель 0, невалидный xy,
  одновременные Neutral+WhiteXY или отсутствие camera matrix приводят к явному DNG reject.
- `src/formats/dng-color.js`: xy → XYZ (нормировка Y=1), затем выбранная
  `AnalogBalance × CameraCalibration × ColorMatrix` → cameraNeutral. Используются
  прежние ForwardMatrix либо Bradford/ColorMatrix → линейный sRGB и WB/Exposure,
  после чего действуют Highlights/Shadows и sRGB OETF. Dual-illuminant reciprocal-temperature
  выбор приближённый, внешней camera fidelity не заявлено.
- `src/document/import-controller.js`, `src/core/state.js`, `src/main.js`: новый
  provenance enum `whiteBalanceSource` (`as-shot-white-xy`, `as-shot-neutral`,
  `legacy-unspecified`) виден в RAW Properties и сохраняется в `.zpe`; исходные
  DNG bytes неизменны, старые `.zpe` получают безопасный default. Изменение
  Exposure/Undo/Redo повторно проявляет native source.
- `tests/fixtures/dng-fixture.mjs`: корректный synthetic TIFF без AsShotNeutral
  с тегом 50729 для little/big endian.

## Проверки и пределы

- RED: 0/4 новых `tests/dng-asshot-white-xy.test.mjs` до реализации
  (fixture не поддерживал `neutral:null`, production не имел 50729).
- GREEN: 4/4 новых; совместно с ColorMatrix и BaselineExposure — 14/14 PASS.
  Negative tests включают malformed type/count/xy/denominator/pointer/conflict,
  а также эквивалентное ColorMatrix-представление Neutral и v1/v2 project sanitizer.
- `npm run build`, `node --check tools/browser-raw-dng-check.mjs` — PASS.
- Реальный Chromium `file://` PASS: DNG FileInput, pixel oracle, WB source в Properties,
  editable exposure → History Undo/Redo, `.zpe` byte-identical DNG, save/reopen,
  предыдущие SOF3 JPEG/mixed scans, packed Bayer, ForwardMatrix, tonal и PNG/PSD/PSB
  rendered-raster regressions.
- Общий Windows `npm run check`: **1761 tests / 1746 PASS / 10 SKIP / 5 FAIL**, все пять относятся к Linux-only `/proc`/cgroup; статус полного набора **FAIL**, не PASS. Первая попытка выявила локальный version marker README regression (6 FAIL), исправлено и адресный `tests/version-consistency.test.mjs` PASS; окончательная попытка ровно 5 Linux-only FAIL. Лог: `G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-asshot-white-xy-final-v2.log`.
- Linux PR-head CI и независимый real-photo workflow для этого локального
  кода **NOT RUN**, GitHub PR **NOT CREATED**, merge **NOT RUN**.
  Fixture synthetic: не camera-authored; licensed camera RAW + LibRaw oracle **BLOCKED**.
  Photoshop PSD/PSB self-roundtrip не равен Photoshop-authored interoperability.

## Следующая конкретная задача

**CAP-RAW-DNG-STACK-RECONCILIATION** — получить отдельное разрешение remote writes,
review #397, merge при gates; #398 retarget/main CI/review/merge;
затем один clean feature PR с ещё локальными возможностями вплоть до v1.47.9
(включая AsShotWhiteXY), Linux core+independent real-photo checks на точном head,
review, merge и exact-main readback. Внешний camera oracle остаётся BLOCKED.
[Очередь](NEXT.md) · [матрица](CAPABILITY_MATRIX.md).
