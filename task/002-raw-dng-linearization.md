# CAP-RAW-DNG-LINEARIZATION — реальная таблица сенсорных кодов DNG (bounded v1.46.23)

**Дата:** 2026-11-19 · **Stage:** 9 / P1 · **Status:** IN PROGRESS (локальный verified increment, НЕ в main). **Ветка:** `feat/raw-dng-linearization-20261119` на локальном `dd4456d` DefaultScale, тот на #398 head `05c48eb8398aea57b0470fcaacf50801503c1fa3`, который основан на #397 `bf6dd6628e2934dc39965fb8cf9058919d2dc9af`. Актуальный upstream main `ddd90d3be9c20092b043a3ea4761795177f7a94c`.

## Реальная функциональность

- `src/formats/dng.js`: TIFF DNG tag 50712 `LinearizationTable` теперь декодируется как `SHORT` от 2 до `2**bits` значений, включая inline 2-элементный SHORT и 65536-элементную 16-bit таблицу; II/MM endianness, fail-closed при неправильных type/count/offset. При короткой таблице sensor code индекс clamp к последнему значению (без доступа за границу).
- Действительный sensor code -> LUT производится **до** BlackLevel/WhiteLevel, original Bayer CFA demosaic, DefaultCrop/DefaultScale, ColorMatrix/white balance/exposure и sRGB OETF. Генерация actual RGBA; native RAW `ArrayBuffer` не изменяется.
- `src/document/import-controller.js` + `src/core/state.js`: native DNG source + whitelisted `linearizationTable: true` provenance в `.zpe`; обратная совместимость со старыми проектами (отсутствующий флаг false). `src/main.js` показывает активный LUT в Properties. PSD/PSB по-прежнему экспортирует только проявленную raster, не camera-RAW.
- `tests/fixtures/dng-fixture.mjs`: синтетическая TIFF/DNG fixture (не camera-authored) теперь может хранить реальную SHORT LUT и nonzero BlackLevel. `tests/dng-linearization.test.mjs`: шесть real pixel/negative regression tests. `tools/browser-raw-dng-check.mjs`: actual Chromium `file://` FileInput, инспектор, `.zpe` byte provenance, PNG-preview RGBA oracle, save/reopen, предыдущие RAW UI controls и PSD/PSB raster regression.

## Доказательства

- RED before implementation: 3/3 new tests failed because `LinearizationTable пока не поддерживается`; after implementation **36/36 PASS** in `node --test tests/dng-linearization.test.mjs tests/dng-default-crop.test.mjs tests/dng-color.test.mjs tests/dng.test.mjs tests/dng-import-controller.test.mjs`. Additional RED 1/7 → GREEN 7/7 proves 8-bit stored CFA with 16-bit LUT output, explicit WhiteLevel=40000 and BlackLevel=2000 (both endian orders); without LUT the 8-bit WhiteLevel bound remains enforced. II/MM, 256/65536 SHORT, nonzero BlackLevel, malformed LUT type/count/data bounds, clamp.
- `npm run build` PASS и `npm run test:browser:raw-dng` PASS (actual Chrome `file://`, FileInput, .zpe save/reopen, full RGBA oracle, отдельно LUT re-develop Undo/Redo с byte-identical Undo `.zpe` layer и Redo pixel oracle). Full Windows `npm run check`: **1682 PASS / 10 SKIP / 5 FAIL**, все 5 — Linux-only cgroup/`/proc` tests на Windows, поэтому общий check НЕ PASS; собранный generated version/index bundle parity и `tests/version-consistency.test.mjs` PASS.
- `git diff --check` before final commit; Linux PR-head CI NOT RUN, local branch not published.
- No independently originated camera DNG/LibRaw pixel oracle. Photoshop-authored PSD/PSB, full camera pipeline and compression=7 parity NOT VERIFIED.

## Следующее действие

При отдельном разрешении: разрешить PR #397 -> retarget / verify / integrate #398 -> publish existing DefaultScale and current Linearization changes with actual Linux core+independent workflow and review; exact merged-main verification. After dependencies, implement **CAP-RAW-DNG-LOSSLESS-JPEG** compression=7, bounded Huffman/image decoder and Chrome `file://` RAW UI/.zpe/Undo/Redo; packed 10/12/14 DNG is a separate implementation and must not be mislabeled as JPEG.
