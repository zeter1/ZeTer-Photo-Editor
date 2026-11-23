# CAP-RAW-DNG-CHROMA-DEMOSAIC — bounded локальная реализация v1.47.12

**2026-11-20 · Stage 9 · P1 · bounded code/UI LOCAL DONE; PR/CI/camera acceptance NOT RUN.**

**Baseline:** локальный `feat/raw-dng-baseline-offset-20261120` @ `064fbc8`, который уже включает готовый `CAP-RAW-DNG-EDGE-GREEN v1.47.11`. Никакие готовые ColorMatrix, DefaultCrop/Scale, SOF3, packed Bayer, ForwardMatrix, AsShotWhiteXY, BlackLevelDelta и EV функции не дублировались. Точный GitHub main при проверке: `ddd90d3be9c20092b043a3ea4761795177f7a94c`.

## Реальное поведение

- `src/formats/dng.js`: дополнительный opt-in `edge-aware-rgb`. Направленный G в красных/синих CFA-точках; восстановление R/B через соседние измеренные **R-G / B-G** остатки (двое по нужной оси в G-сайтах или четыре диагональных в сайтах противоположного цвета), после чего линейный RGB отдаётся существующим DefaultCrop/Scale, camera-color, exposure/tonal и sRGB. На краевой полосе 2 px остаётся bilinear; measured CFA samples сохраняются. Это ограниченный алгоритм, **не** DCB/AHD/LibRaw parity и не полная проверка цветовых краёв/zipper.
- Режимы `bilinear` (default, legacy) и `edge-aware-green` сохраняют прежний output. В `src/main.js` третий реальный selector option, RAW re-develop, точная document/layer/session/lock authority, Undo/Redo/reset; исправлен select default, чтобы RGB-mode не помечал bilinear выбранным.
- `src/core/state.js`: новая строка проходит whitelist в `.zpe`; неизвестный `demosaic` отклоняется, старые проекты без поля остаются bilinear. Исходный native DNG буфер не модифицируется.
- `src/app.bundle.js`, `index.html`, `version.json` собираются стандартным `npm run build`; `package.json`, README, CHANGELOG — локальная 1.47.12.

## Наблюдаемая приёмка

- **RED→GREEN:** новый `tests/dng-edge-aware-chroma.test.mjs` до реализации **0/2 PASS**, после — **2/2 PASS**. Проверены обе TIFF byte orders, все 4 CFA фазы, RGB pixel oracle с постоянными chroma при вертикальном luminance step, source-byte invariance, invalid mode и native `.zpe` sanitize/legacy.
- **GREEN:** пять фокусных suites `node --test tests/dng-edge-aware-chroma.test.mjs tests/dng-edge-aware-green.test.mjs tests/dng-tonal-controls.test.mjs tests/dng.test.mjs tests/dng-color.test.mjs`: **21/21 PASS**.
- **PASS:** `npm run test:browser:raw-dng` — настоящий Chromium `file://` FileInput, UI select mode, полный RGBA pixel oracle, History Undo/Redo, reset и `.zpe` save/reopen с исходными DNG bytes; существующие ForwardMatrix, TIFF SOF3, packed, PNG/PSD/PSB rendered raster регрессии PASS.
- **Overall Windows check FAIL (OS-only):** `npm run check`: **1770 tests / 1755 PASS / 10 SKIP / 5 FAIL**, все 5 — Linux-specific `/proc`/cgroup cases, не связаны с demosaic; version-consistency отдельно **1/1 PASS**. Log: `G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-chroma-demosaic-final.log`. **Не выдавать общую проверку Windows за PASS.**
- **GitHub PR-head Linux core / independent real-photo / exact-main для v1.47.12: NOT RUN.** `#397` head `bf6dd66` CI GREEN + no reviews; `#398` stacked, head `05c48eb`, targeted CI NOT RUN + no reviews. Ветки v1.47.12 нет на GitHub, потому что локальный навык запрещает push/merge без отдельного прямого разрешения.

## Точные незакрытые требования

1. `CAP-RAW-DNG-STACK-RECONCILIATION`: после отдельного разрешения и review выполнить gated интеграцию `#397 → #398 → clean RAW PR` с уже сделанной v1.47.12; Linux CI на точных SHA и exact-main.
2. `CAP-RAW-CAMERA-ORACLE`: законно распространяемый camera-authored DNG + независимый LibRaw/RawTherapee pixel reference, ошибка, цветовые/диагональные edges и слепая фотооценка — **BLOCKED**. Без них Stage 9 остаётся **IN PROGRESS**.
