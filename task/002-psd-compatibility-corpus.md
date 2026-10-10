# 002 — PSD/PSB round-trip compatibility corpus

- **Goal:** расширить проверяемую Photoshop PSD/PSB round-trip совместимость на маски, группы и корректирующие слои.
- **Why now / evidence:** PSD import/export в `main` есть, но полное Photoshop-совпадение нельзя заявлять без совместимых реальных fixtures.
- **Scope:** одна категория независимых byte/semantic/preview fixtures за проходку, tests/docs; **non-scope:** proprietary parity без доказательств.
- **Inspect first:** `src/formats/psd.js`, `tests/psd-export-integration.test.mjs`, `src/document/psd-native-metadata-plans.js`.
- **Behavioral contracts:** сохранить native structure, no silent 8-bit/CMYK loss, deterministic fixture generation and attribution.
- **Progress (2026-10-10, PR candidate):** добавлен memory-generated PSD/PSB fixture с nested-group topology, включёнными/отключёнными raster masks, clipping и реальными MIT adjustment blocks. `tests/psd-masked-group-corpus.test.mjs` сравнивает semantic snapshots после повторного round-trip; provenance/limitations — `tests/fixtures/psd-compatibility/README.md`. Выполнение и CI проверяются отдельно; до merge задачу не закрывать.
- **Progress (2026-10-10, external preview PR candidate):** добавлен отдельный независимый decoder-oracle `tests/psd-external-merged-preview.test.mjs` для pinned external PSD Shape Layer (RGBA), PSB with groups (RGB) и PSD Adjustment Layer with mask (RGB). Из реальных image-data bytes напрямую (без ZPE writer) читается PackBits/RLE merged preview; сверяются source SHA-256, зафиксированный FNV-1a RGBA, пиксельный sample и byte-for-byte результат codec composite decode на отдельной копии файла с удалённой layer section. Оригинальный fixture не изменяется, semantic-layer импорт также выполняется. Проверки CI — после создания PR.
- **Planned work:** независимые reference composites и semantic snapshots для mask/group/clipping boundaries, blend-mode pixels и adjustment *rendering* (не только Photoshop-embedded merged image); внешняя сверка с Adobe Photoshop остаётся обязательной для full parity. Текущие generated round-trip и embedded-preview oracles не доказывают полную Photoshop compatibility.
- **Targeted tests:** cross-group masks, blend and adjustments; fail-closed for unsupported features.
- **Required verification:** `npm run check`, browser smoke if runtime changed, fixture provenance audit.
- **Done gate:** PR merged and green `main` push CI.
- **Risks / handoff:** отделять codec coverage от проверки Photoshop на внешнем приложении.
