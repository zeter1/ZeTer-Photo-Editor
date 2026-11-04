# 006 — Stage 003: >256 occupied native tiles (2026-10-11)

## Задача

После PR #185 разреженное, но широкое связное выделение могло пройти global ROI limit и всё же отвергаться **только** из-за фиксированного порога 256 занятых tile cells. Сложность старого pairwise halo-merge растёт слишком быстро при простом снятии порога.

## Реализация — PR #186 (слито)

- [x] Сохраняется прежний алгоритм halo-disjoint merge для **до 256** занятых cells (старые семантика/детерминизм).
- [x] Для **>256** cells объединение квадратичной сложности пропускается. Выбираются ограниченные per-cell фрагменты с линейным распределением frozen selectedIndices.
- [x] Источник ограничен общим `MAX_PIXEL_BUFFER_SOURCE_TILES = 8192`, затем **до ROI decode** проверяется суммарный `maxLayerPixels`; нет бесконтрольного разрастания RAM.
- [x] Global frozen-selection bitmap исключает доноров/контекст из других фрагментов; private writes и атомарная serialization/cancellation не меняются.
- [x] Регрессии: 512 занятых tiles, RGB16 sync/cooperative/real Node Worker native byte parity; Float32 CMYKA sync/cooperative parity; отказ при 12,799 px aggregate budget; cancel после private work; иммутабельность исходных tiles.
- [x] Детерминированно пересобраны `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js`, `index.html`, `version.json`. Проверен старый hash `526852b5dd5a2dc8`, новый `ab8f4214d38ce41e`.
- [x] [PR #186 CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38136465952) — **success**: `npm run check`, `npm run test:browser` (`file://`), generated parity, native profiles, diff hygiene.
- [x] Review и [PR #186](https://github.com/zeter1/ZeTer-Photo-Editor/pull/186) squash-merge `6204003f26f43b3babfa370508565f6ea86225e9`; [CI точного merge SHA](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38136526958) — **success**.

## Статус

Этот узкий P1-подэтап **завершён в main** с зелёным CI точного merge SHA. Stage 002 и Stage 003 в целом **не завершены**.

## Границы

Это не общий Stage 003. При >256 cells применяется намеренно консервативная per-cell стратегия; плотные/большие выделения могут законно не уложиться в агрегатный 8 MP budget и отвергнуться **без частичного изменения**. Нет гарантии профиля peak RAM в реальном браузере и подтверждённого Adobe-authored pixel-golden. Для 16/32-bit точности используется собственный native codec и синтетические fixtures.

## Дальше

1. Подтвердить CI и regression на точной ветке, затем merge с exact-main CI.
2. Развить adaptive strip/segment grouping для dense connected ROI, но с непреложной проверкой aggregate area, max tiles и отмены.
3. Chromium `file://` реальный PSD16/PSB32 import → detached Worker → preview → Undo/Redo/cancel плюс CDP sampled renderer/process RAM и timing.
4. Stage 002: только лицензированные независимо Photoshop-authored high-depth fixtures + SHA/provenance + внешние reference pixels.
