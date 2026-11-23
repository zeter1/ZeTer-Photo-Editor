# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / **CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY** — первая реальная изолированная PSD/PSB группа со смешиванием, маской и clipping base.
> **PRIORITY:** P1.
> **STATUS:** TODO — новая самостоятельная профессиональная возможность. Stage 9 / CAP-RAW-DNG-STACK-RECONCILIATION реализован в ограниченном объёме и [#399 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/399); уже принятую RAW-реализацию не писать заново.
> **BASE MAIN SHA (RAW merge):** `4d480bc5d1993ff14a0242384a383a7b55003839` — [#397 ColorMatrix](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397), [#398 DefaultCrop](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398), [#399 RAW v1.47.17](https://github.com/zeter1/ZeTer-Photo-Editor/pull/399) MERGED. Текущий main после изменения очереди может иметь дополнительный docs-only SHA.
> **LAST VERIFIED:** 2026-11-23. #399 final head `abe925447f67e99715ce39016b82acb6e89bce34`: Linux core 12/12 + independent genuine-photo PSD/PSB candidate 1/1 = **13/13 SUCCESS**; точная Windows Git-копия: `npm run build` и `git diff --exit-code` PASS, Node 32/32 PASS, Chromium `file://` RAW smoke PASS, **полный Chromium browser suite PASS exit 0**. PR checks не заменяют exact-main: [main core run](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45160667398) и [independent real-photo run](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/45160667425) запущены на RAW merge SHA, финальный результат следует читать на точном SHA, не предполагать PASS заранее.
> **NEXT IMPLEMENTATION ACTION:** в Stage 17a воспроизвести ошибку isolated vs pass-through PSD group c clipping base и mask в текущем Canvas renderer; добавить RED pixel-reference unit tests для 8-bit RGBA с alpha/opacity и независимый browser `file://` сценарий на реальном UI, затем минимально исправить композитинг, сохранить Undo/Redo, `.zpe`, native PSD/PSB не flatten, проверить сборку/CI на отдельном PR. Не заменять реализацию планами/профилированием.
> **REMAINING ACCEPTANCE:** для RAW — точный core + independent CI на актуальном `main` после docs-коммита. Для Stage 17a — конкретный pixel oracle и файл с поддерживаемым PSD group subset, native state/History/round-trip, regression against existing blending and masks; Photoshop-authored reference corpus не выдавать за синтетический.
> **BLOCKERS:** **CAP-RAW-CAMERA-ORACLE**: отсутствует лицензированный camera-authored Bayer DNG с independent LibRaw/RawTherapee pixel golden; synthetic TIFF/CFA не являются camera provenance. Этот отдельный внешний gate не блокирует Stage 17a.

## Короткая очередь

1. **Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY — P1 TODO:** минимальная реальная изолированная группа + маска + clipping base, pixel oracle, UI/Undo/Redo/.zpe/PSD acceptance.
2. **CAP-RAW-CAMERA-ORACLE — BLOCKED (внешний источник):** licensed genuine camera Bayer DNG + independent pixel oracle, не фабриковать.
3. **Stage 6 Tiled Worker / Stage 8 ICC / Stage 2 Vector Masks — IN PROGRESS:** последующие независимые вертикальные срезы согласно [матрице](CAPABILITY_MATRIX.md).

[Карта задач](README.md) · [матрица](CAPABILITY_MATRIX.md) · [интеграция RAW](002-raw-dng-stack-integration.md) · [контраст RAW](002-raw-dng-linear-contrast.md).
