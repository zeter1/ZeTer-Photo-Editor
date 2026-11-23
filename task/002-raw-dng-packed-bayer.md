# CAP-RAW-DNG-PACKED-BAYER-PORT — bounded local v1.47.5 (2026-11-20)

**Scope:** перенос существующей реализации f9e8452 в новейший локальный sensor-coordinate RAW stack (SOF3 mixed 1+2+1, BlackLevelRepeatDim, BlackLevelDelta), вместо повторной разработки. **Code commit:** 0630bcdbc40b4fde22dd58401470ea805cba7309; branch feat/raw-dng-packed-bayer-port-20261120. GitHub/main не изменены.

## Реальные изменения
- src/formats/dng.js: TIFF Compression=1 принимает 8/10/12/14/16-bit CFA; MSB-first FillOrder=1, byte-aligned строки, все отдельные StripOffsets или padded TileOffsets; bits==16 читает по II/MM, packed 10/12/14 читает битовые срезы по строкам с нулевым влиянием padding на sensor. TIFF FillOrder unknown type/count/value отклоняется; ByteCounts несжатых blocks строго равен ожидаемым bytes, compressed JPEG парсер не заменён.
- src/core/state.js, src/document/import-controller.js: исходный DNG source bytes, bits/compression provenance, defaultScale, BlackLevelRepeatDim, BlackLevelDeltaH/V и ColorMatrix сохраняются в .zpe, даже когда PNG/PSD/PSB экспортирует только проявленный RGBA. Старые .zpe без bits по-прежнему открываются с bits=null.
- src/main.js: Properties отображает родную глубину Bayer, JPEG vs TIFF uncompressed; exposure/WB re-develop, History Undo/Redo и все прежние координатные преобразования не обходятся.
- tests/dng-packed-bayer.test.mjs: signed II/MM strips 10/12/14, per-scanline padding, native bytes immutable, exact sample bits, padded edge tiles, bad FillOrder/type/count, truncated strips и multi-strip reset. Отдельная тестовая tile fixture сохраняет предыдущую SOF3 runtime.
- Browser file://: настоящий File input 12-bit packed + BlackLevelRepeatDim + signed sensor Delta + ColorMatrix, independent encoded 16-bit synthetic pixel oracle, RAW Properties, .zpe save/reopen и History Undo/Redo. Старые SOF3/PNG/PSD/PSB raster browser проверки остаются в том же прогоне.

## Проверки
- RED до реализации: 10/12/14-bit packed unsupported.
- GREEN: 28/28 focused Node (packed, import, BlackLevelRepeat, Delta, SOF3 mixed); 10/10 targeted tiled JPEG + packed + version consistency. npm run build PASS, git diff --check PASS.
- Настоящий Chromium file:// npm run test:browser:raw-dng PASS, включая packed 12-bit и ранее поддерживаемые SOF3 + BlackLevel.
- Полный Windows npm run check: **FAIL**: 1743 / 1728 PASS / 10 SKIP / 5 FAIL (только Linux-specific /proc/cgroup tests, причина не связана с RAW). Лог: G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-packed-port-final.log.
- **NOT RUN**: Linux core/independent real-photo CI этого commit, PR review, merge, exact-main check; нет независимой camera-authored LibRaw pixel parity.

## Ограничения и продолжение
Декодируются только описанные TIFF CFA layout/bit depths; другие FillOrder, packed predictor, произвольные CFA patterns, ICC/HDR и полной камеры parity нет. Браузерный PNG и PSD/PSB self-round-trip означает export проявленных raster pixels, не native RAW layer parity. User skill zeter-github-workflow требует отдельного push/merge разрешения; PR #397/#398 открыты, последний локальный стек в GitHub не опубликован. Следующий кодовый срез: **CAP-RAW-DNG-FORWARD-MATRIX-PORT** из локального commit 8bfcd0e в эту ветку (не переписывать), затем Highlights/Shadows 3f1d0ad. [NEXT](NEXT.md).
