# CAP-RAW-DNG-JPEG-MIXED-SCANS — SOF3 1+2+1 (v1.47.2)

**2026-11-20 · Stage 9 / P1 / IN PROGRESS:** локальный код и Windows/Chromium acceptance DONE; удалённый PR-head CI, review, merge и exact-main CI нового кода NOT RUN.

## Изменение

- **Baseline:** актуальный GitHub main ddd90d3be9c20092b043a3ea4761795177f7a94c, core CI SUCCESS только для main. Базовая локальная ветка v1.47.1 — 087e8a32b56d8060d2b5d797a84904cd433efc52. Feature commit **309ecb7e7853575f0b82acce441fa1891a610fb3**, branch feat/raw-dng-sof3-multiscan-20261120, worktree ZeTer-Photo-Editor-raw-next. Это локальное, не опубликованное продолжение зависимой RAW chain.
- **Production:** src/formats/dng-lossless-jpeg.js принимает disjoint SOS группы из 1 и 2 CFA-компонентов, в том числе 1+2+1; каждый scan восстанавливает свою MCU последовательность с собственными Huffman DC selectors, predictor 1–7, point transform и DRI/RSTn. Все значения записываются по SOF frame component ID в исходную Bayer sensor grid. Полный 4-component interleaved scan остаётся отдельным режимом.
- **Проверки отказа:** неверный SOS count/length, неизвестный/повторный/missing component ID, неправильный RST order, дополнительные данные после EOI и усечённые сканы fail closed; поддержка JPEG sliced CFA/subsampling не заявлена.
- **Tests:** новый tests/dng-lossless-jpeg-mixed-scans.test.mjs с synthetic fixture: precision 8/12/16, predictors 1/4/7, restart 0/1/3/7, PointTransform=2, перестановки ID, TIFF II/MM strips/padded tiles, fractional DefaultCrop и Orientation. CFA/RGBA сравнение с некомпрессированным deterministic TIFF fixture.
- **Browser UI:** tools/browser-raw-dng-check.mjs — реальный Chrome file:// FileInput mixed 1+2+1 tiled+RSTn, RGBA pixels, неизменные native compressed DNG bytes в .zpe, сохранение и повторное открытие, RAW exposure и History Undo/Redo. Уже существующая PNG/PSD/PSB rendered raster export regression не удалена. Generated bundle/index/version обновлены на v1.47.2.

## Точная приёмка

1. **RED→GREEN:** после добавления synthetic mixed-fixture 3 FAIL / 1 PASS из 4 (старый decoder отклонял SOS 1+2+1); исправленный production decoder — **4/4 PASS**.
2. **Node focused:** node --test tests/dng-lossless-jpeg-mixed-scans.test.mjs tests/dng-lossless-jpeg-partial-scans.test.mjs tests/dng-lossless-jpeg-multiscan.test.mjs tests/dng-lossless-jpeg-restart.test.mjs — **16/16 PASS**.
3. **Build:** npm run build PASS; npm run test:browser:raw-dng **PASS**, настоящий Chromium file:// с FileInput, пикселями, .zpe reopen и RAW Undo/Redo. node --check browser script, git diff --check и version-consistency PASS.
4. **Общий Windows npm run check — FAIL:** 1727 tests, 1712 PASS, 10 SKIP, 5 FAIL; именно Linux-specific /proc/cgroup проверки, на Windows недоступны. Лог: G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-mixed-scans-final.log. Называть полный Windows check успешным нельзя.
5. **GitHub:** #397 OPEN head bf6dd662 — core+independent real-photo Linux SUCCESS (13 checks), review 0. #398 OPEN stacked head 05c48eb — checks 0, CI NOT RUN. Для нового локального commit 309ecb7 PR/CI/merge/exact-main NOT RUN. Только старый main ddd90d3 CI SUCCESS.

## Граница и следующая работа

- Synthetic SOF3 fixture не является camera-authored DNG или независимым LibRaw/RawTherapee pixel oracle. Камерные JPEG slices/subsampling, полная DNG profile compatibility, Photoshop-authored PSD/PSB interoperability всё ещё IN PROGRESS/BLOCKED.
- Навык локального GitHub workflow требует отдельного прямого разрешения на push/merge; в этом обращении оно отсутствует. Последовательная интеграция: #397 → #398 (retarget и CI) → локальные DefaultScale/LUT/SOF3 и mixed с отдельными gated PR; без дубликатов.
- **Точная следующая функциональная задача:** CAP-RAW-DNG-BLACKLEVEL-REPEAT: sensor-space разбор BlackLevelRepeatDim и per-CFA-site BlackLevel с TIFF II/MM validation, Bayer phase, UI/.zpe/History и Chrome file:// acceptance.

[Очередь](NEXT.md) · [Матрица](CAPABILITY_MATRIX.md) · [Прошлый шаг](002-raw-dng-jpeg-partial-scans.md).
