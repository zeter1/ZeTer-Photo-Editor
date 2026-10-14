# 032 / 024D1 — Chromium native selected-pixel byte oracle (Stage 003)

**Статус (2026-10-14):** **слито в `main`**, [PR #216](https://github.com/zeter1/ZeTer-Photo-Editor/pull/216) → `f3d1336`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38538156947), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38538532002). Только test harness. Stage 002/003 открыты.

## Goal / Why now

Реальный Chromium `file://` PSD16/PSB32 Worker/cancel/retry уже проверяет исходные tile payloads и выборочные native samples. Проверка одного пикселя не защищала от незаметной записи в соседний **невыделенный** 16/32-битный пиксель в изменённом тайле.

## Scope

- [x] `tools/browser-native-selection-integrity.mjs`: для v2 native source сравнить все канальные **байты** каждого изменённого тайла против исходника; проверять геометрию, битовую глубину, byte budget и frozen `selectedIndices` фактически отправленные в Worker; отказ при любой записи вне выделения.
- [x] `tools/browser-large-psd16-smoke.mjs`: перехват копии Worker selection, immutable native source baseline сразу после UI import; проверка первой Fill, первого Redo, отмены mid-kernel, повторной Fill, Undo и Redo; без изменений production/editor bundle.
- [x] `tests/browser-native-selection-integrity.test.mjs`: RGB16 и CMYKA32 по байтам, несколько тайлов, соседний неподвыделенный пиксель внутри changed tile, другая область, неверные индексы/топология/payload.
- [x] `npm run check`, CI Chromium `file://` PSD16/PSB32, generated parity, browser JSON verifier, профили и diff hygiene — success ([PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38538156947)).
- [x] [PR #216](https://github.com/zeter1/ZeTer-Photo-Editor/pull/216) слит в `main` (`f3d1336`), [CI exact-code main](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38538532002) — success.

## Contract / limitations

Этот oracle подтверждает только **область** допустимых мутаций native words и историю браузерной операции, а не качество восстановления текстуры: changedSelectedPixels>0 не эквивалентно Photoshop reference image. Сравнение выполняется над сериализованной моделью ZeTer и над селекцией, переданной Worker, но не независимо от Photoshop. Нет заявлений про Worker→PID, real peak RSS, полную PSD/PSB совместимость. Не снижать точность путём сравнения только RGBA8 canvas.

## Next

1. **P0 [002](002-psd-compatibility-corpus.md):** независимо Photoshop-authored, лицензированные PSD RGB16/PSB CMYK32, SHA256, license/provenance и независимые reference composites.
2. **P1 [003](003-tiled-content-aware.md):** измерить quality/latency/RSS на широких connected ROI в настоящем browser file://, разделить CIE/PSNR-style показатели, визуальный сравнительный oracle и observable samples.
3. **P1 [025](025-browser-worker-target-census.md):** только официально проверенный CDP target→PID mapping либо оставить `unknown`.
4. **P2:** PSD round-trip masks/groups/text/adjustments/blend fidelity на реальных сторонних файлах.

**Done gate:** PR + tests + review + merge + exact-main CI, только тогда закрыть проходку 032; общие Stage 002/003 оставить открытыми.
