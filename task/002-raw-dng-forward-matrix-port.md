# CAP-RAW-DNG-FORWARD-MATRIX-PORT — bounded local v1.47.6 (2026-11-20)

**Кодовый коммит:** `776cf47f5c16bb6af5d9faabe5be5d35230065d3` (17 файлов, локальный, чистое рабочее дерево при коммите). **Основа:** локальный `b208f9c57d92` (packed Bayer, source/metadata v1.47.5). **Источник функциональности:** существующий commit `8bfcd0e` из feat/raw-dng-forward-matrix-20261116. **Рабочая ветка:** feat/raw-dng-forward-matrix-port-20261120; не GitHub main и не опубликованный PR.

## Выполненный функциональный перенос

- `src/formats/dng-color.js`: ForwardMatrix1/2 camera reference RGB → XYZ D50 → D65 linear sRGB; AnalogBalance + matching CameraCalibration1/2; fallback ColorMatrix сохраняется; dual-illuminant interpolation ограничен. Без независимого camera-authored pixel oracle не заявляется camera-accurate.
- `src/formats/dng.js`: строгая проверка TIFF SRATIONAL[9] ForwardMatrix/CameraCalibration, RATIONAL[3] AnalogBalance, signature ASCII/BYTE UTF-8 NUL, match/mismatch и связанных ColorMatrix; fail-closed invalid type/count, singular/invalid reference. ForwardMatrix обрабатывает уже проявленные sensor-site pixels после LUT/BlackLevelRepeatDim/Delta, packed Bayer/ SOF3, DefaultCrop/Scale/Orientation. TIFF-байты не мутируются.
- `src/core/state.js` сохраняет `forward-d50-v1` provenance и все новые sensor/packed metadata в `.zpe`; `src/main.js` различает calibrated path в RAW Properties.
- `tests/dng-forward-matrix.test.mjs` и расширенная TIFF fixture проверяют II/MM, actual off-diagonal, dual matrix, AnalogBalance, matching/mismatching signatures, corrupt rational и отсутствие изменений RAW. В `tools/browser-raw-dng-check.mjs` добавлена настоящая Chrome file:// FileInput → actual layer PNG pixels oracle → Exposure/Undo/Redo/History → native source `.zpe` save/reopen.

## Выполненная проверка

- Targeted: `node --test tests/dng-forward-matrix.test.mjs tests/dng-color.test.mjs tests/dng-default-crop.test.mjs tests/dng-blacklevel-repeat.test.mjs tests/dng-blacklevel-delta.test.mjs tests/dng-packed-bayer.test.mjs tests/dng-lossless-jpeg-mixed-scans.test.mjs tests/dng.test.mjs tests/dng-import-controller.test.mjs` — **55 PASS / 0 FAIL / 0 SKIP**.
- `npm run build` — PASS; `npm run test:browser:raw-dng` — PASS в реальном Chromium `file://`, в том числе ForwardMatrix/History/`.zpe`, packed Bayer, BlackLevelRepeatDim/Delta и SOF3. `git diff --check` — PASS.
- **Полный Windows `npm run check`: FAIL — 1748 total / 1733 PASS / 10 SKIP / 5 FAIL; ровно пять `tests/browser-cgroup-delegation-probe.test.mjs` и `tests/browser-chromium-cgroup-control.test.mjs` используют недоступный Windows Linux `/proc`/cgroup. Повторный лог: `G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-forward-matrix-port-final.log`. Общий check НЕ PASS.**. Падения известных Linux-only cgroup/`/proc` тестов нельзя выдавать за PASS. **Remote Linux core CI / real-photo CI / review / merge / exact-main**: NOT RUN для локальной ветки.
- **External oracle**: licensed camera-authored DNG, независимые LibRaw/RawTherapee pixels и error thresholds отсутствуют (BLOCKED); synthetically encoded TIFF — не камерная provenance.

## Точная следующая задача

**CAP-RAW-DNG-TONAL-CONTROLS-PORT**: перенести готовую локальную реализацию Highlights/Shadows `3f1d0ad` в текущую ветку, сохранив sensor-space BlackLevel+Delta, packed/SOF3 и ForwardMatrix; раздельные development controls, History Undo/Redo, `.zpe`, unit и реальный Chrome `file://`. Отдельно — remote review/integration #397→#398 и проверка локальной цепочки, без неразрешённого push/merge.

[Очередь](NEXT.md) · [Матрица](CAPABILITY_MATRIX.md).
