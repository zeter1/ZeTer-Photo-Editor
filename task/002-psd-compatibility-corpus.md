# 002 — PSD/PSB round-trip compatibility corpus

- **Goal:** расширить проверяемую Photoshop PSD/PSB round-trip совместимость на маски, группы и корректирующие слои.
- **Why now / evidence:** PSD import/export в `main` есть, но полное Photoshop-совпадение нельзя заявлять без совместимых реальных fixtures.
- **Scope:** одна категория независимых byte/semantic/preview fixtures за проходку, tests/docs; **non-scope:** proprietary parity без доказательств.
- **Inspect first:** `src/formats/psd.js`, `tests/psd-export-integration.test.mjs`, `src/document/psd-native-metadata-plans.js`.
- **Behavioral contracts:** сохранить native structure, no silent 8-bit/CMYK loss, deterministic fixture generation and attribution.
- **Planned work:** матрица возможностей Photoshop и первый self-generated PSD/PSB fixture with semantic equality assertions.
- **Targeted tests:** cross-group masks, blend and adjustments; fail-closed for unsupported features.
- **Required verification:** `npm run check`, browser smoke if runtime changed, fixture provenance audit.
- **Done gate:** PR merged and green `main` push CI.
- **Risks / handoff:** отделять codec coverage от проверки Photoshop на внешнем приложении.
