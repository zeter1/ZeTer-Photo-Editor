# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** — native PSD/PSB isolated group, mask и clipping base.
> **PRIORITY:** P1.
> **STATUS:** **IN PROGRESS** — первый профессиональный raster-clipping срез реализован и прошёл локальную проверку в кандидате 1.47.18. Это НЕ полный Stage 17a и НЕ подтверждённый Photoshop-authored pixel oracle.
> **BASE main SHA (2026-11-23):** `ae42c07fe29728379fb25cd5f55e87b1b02b5e88` — RAW #397/#398/#399 уже MERGED. [Exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45161023638) SUCCESS.
> **DONE IN 1.47.18 CANDIDATE:** `src/core/render.js` накладывает alpha clipping на обычный raster, включая masked base внутри isolated group, до смешивания с backdrop; orphan clipping fail-closed; Properties переключатель с exact-owner/recursive-lock/no-op/history; native .zpe и PSD/PSB clipping/group/mask records сохранены. RED 2/2 → GREEN; focused 26/26 PASS, Photoshop codec 5/5 PASS, real Chromium file:// exact RGBA [255,127,127,255] vs [255,255,255,255], toggle/Undo/Redo/.zpe reopen PASS. Тестовый источник синтетический (не Adobe Photoshop).
> **CHECK LIMITATION:** Windows `npm run check` 1790 tests / 1775 PASS / 10 SKIP / 5 FAIL (ранее известные Linux-only /proc/cgroup harness); отдельный Linux exact PR-head CI требуется. Полному Chromium suite — отдельный результат.
> **NEXT IMPLEMENTATION ACTION:** продолжить Stage 17a: воспроизвести **Photoshop-native raster group mask на folder divider** (не child-layer mask), добавить независимый Photoshop-authored PSD/PSB fixture с лицензией и pixel golden для isolated vs pass-through, реализовать маску группы в schema/PSD import/export и Canvas compositor без flatten, проверить вложенность и clipping chain с реальными 8-bit RGBA пикселями и Undo/Redo/.zpe; затем точный PR-head Linux core + independent browser/real-photo CI, review и merge gates.
> **NOT ACCEPTED YET:** настоящий Photoshop-authored isolated group pixel golden, native folder-group mask semantics, полная поддержка clipping chain в сложных Photoshop documents, PR-head Linux CI и merge кандидата.
> **EXTERNAL BLOCKER:** CAP-RAW-CAMERA-ORACLE — нужен лицензированный camera-authored Bayer DNG + independent LibRaw/RawTherapee oracle; synthetic не подходит, не блокирует Stage 17a.

## Короткая очередь

1. **Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY — P1 IN PROGRESS:** native Photoshop folder group mask + independent authored PSD/PSB pixel oracle; не повторять уже исправленный raster clipping.
2. **CAP-RAW-CAMERA-ORACLE — BLOCKED:** licensed genuine Bayer DNG и независимая RAW пиксельная истина.
3. **Stage 6 Tiled Worker / Stage 8 ICC / Stage 2 Vector Masks — IN PROGRESS:** следующие самостоятельные профессиональные срезы по [матрице](CAPABILITY_MATRIX.md).

[Журнал Stage17a](002-psd-isolated-clipping.md) · [Карта задач](README.md) · [матрица](CAPABILITY_MATRIX.md) · [интеграция RAW](002-raw-dng-stack-integration.md).
