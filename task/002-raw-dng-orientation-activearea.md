# CAP-RAW-DNG-ACTIVE-ORIENTATION — пиксельная ориентация и ActiveArea

**2026-11-16 · P1 · IN PROGRESS (pending Linux PR-head CI/merge).** Версия `1.46.19`; исходный `main` `b2a3d254d8fe078ae5654753b06a905c36255f69` (foundation [#394 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/394)). Ветка `feat/raw-dng-orientation-activearea-20261116`. Зависимости: ранее принятый uncompressed Bayer DNG pipeline, History/.zpe/browser import.

## Настоящая функциональная реализация

- `src/formats/dng.js`: bounded TIFF tag `ActiveArea` (50829, четыре координаты [top,left,bottom,right], нижние/правые границы exclusive) и `Orientation` (274, полные значения 1–8). Теги читаются из raw CFA IFD/первого IFD; reject для выходящих за границы/пустых ActiveArea и неизвестной ориентации. Нет молчаливого fallback при повреждённых тегах.
- Bayer demosaic выполняется **в исходных координатах сенсора**, сохраняя CFA phase и соседние сенсорные пиксели на границе crop. Затем реализованы реальные crop + поворот/зеркальное отражение RGBA8, включая перестановку ширины/высоты для ориентаций 5–8. Не заменяется только CSS/EXIF-флаг.
- `src/document/import-controller.js`: display preview и слой используют `pixels.width/height`, тогда как `rawDng.width/height` и исходный `rawDng.dataUrl` остаются сенсорными; документация и state serializer сохраняют исходную provenance.
- `src/main.js`: повторная неразрушающая проявка проверяет отдельно неизменность sensor dimensions и oriented preview geometry. Поддерживаются прежние WB/exposure, selected-owner/session/lock guards, History Undo/Redo, .zpe reopen.

## Реальные проверки и ограничения

- `tests/fixtures/dng-fixture.mjs`: byte-accurate II/MM classic TIFF/DNG fixture с условными ActiveArea/Orientation и различными сенсорными размерами.
- `tests/dng.test.mjs`: all 8 orientations pixel-by-pixel against independently indexed full-sensor demosaic, off-center ActiveArea, 3×4 orientation output, immutable input bytes; fail-closed malformed ActiveArea/Orientation.
- `tests/dng-import-controller.test.mjs`: preview 3×4 vs original sensor 6×4 + .zpe state.
- `tools/browser-raw-dng-check.mjs`: реальный Chromium `file://` FileInput oriented Bayer DNG; browser-decoded PNG pixel oracle, .zpe native sensor bytes/dims, UI exposure re-develop. Старый Chrome end-to-end WB/Undo/Redo/reopen/PNG/PSD/PSB сохраняется.
- Локально (Windows): `node --test tests/dng.test.mjs tests/dng-import-controller.test.mjs` **11 PASS / 0 FAIL**; `npm run build` PASS; `npm run test:browser:raw-dng` **PASS**; `git diff --check` PASS. Full Windows `npm run check` не заявляется успешным (исторически 5 Linux-only /proc/cgroup FAIL). Linux PR-head/exact-main и independent real-photo CI для ЭТОГО коммита ещё NOT VERIFIED.
- **Важная граница:** synthetic binary fixture, не камера; ActiveArea — только crop (без DefaultCropOrigin/Size), нет ColorMatrix1/2, ICC, lossless JPEG DNG, camera-authored pixel parity. Orientation может быть в IFD0 или Bayer IFD; полный внешний RAW corpus пока отсутствует. Развёрнутые PSD/PSB экспорты содержат проявленный RGB, а не оригинальный RAW.

## Следующая задача

**CAP-RAW-DNG-CAMERA-COLOR, P1:** найти подлинный легально распространяемый uncompressed Bayer DNG (с provenance); добавить корректную интерпретацию ColorMatrix1/2/AsShotNeutral в linear XYZ/D50 и display sRGB, с отказом для невозможной/вырожденной калибровки, сравнением с LibRaw/RawTherapee и реальным браузерным импортом. Статус Stage 9 остаётся IN PROGRESS.

**Общий Windows Chromium regression (отдельно от целевого RAW E2E): FAIL.** `npm run test:browser` после успешных этапов Stage 003/036B/036C завершился через 83.68s с `Timed out waiting for DevTools response: Runtime.evaluate` (`tools/browser-smoke.mjs:192`). Связь с DNG изменениями НЕ УСТАНОВЛЕНА; нет baseline reproduction, поэтому не маркировать ни PASS, ни подтверждённым регрессом. Linux PR-head CI — обязательный gate. Не профилировать эту отдельную трассу бесконечно вместо продолжения RAW.

**Публикация:** [PR #395](https://github.com/zeter1/ZeTer-Photo-Editor/pull/395) OPEN, первая версия head `886e2450dac36cec41ca8ab9f6ec95cf0f6f917c`; проверить финальный head/CI после документационного обновления. Не объявлять SUCCESS до GitHub readback.
