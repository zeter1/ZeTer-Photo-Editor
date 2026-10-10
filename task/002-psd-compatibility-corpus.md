# 002 — PSD/PSB round-trip compatibility corpus

## Проходка 2026-10-10 — защита pinned PSD/PSB-аудита от замены файла

- Закреплён один file descriptor для проверки identity и последующего потокового SHA-256/заголовка: `O_NOFOLLOW` для последнего symlink-компонента (если поддерживается), сравнение метаданных файла до открытия/после чтения и гарантированное закрытие descriptor. Размер проверяется по фактическому потоку. Это закрывает промежуток `lstat(path) → createReadStream(path)`, когда pathname мог указывать уже на другой объект.
- Регрессии проверяют symlink с **идентичными хешем и размером** и повторную проверку после повреждённого payload. Нельзя трактовать это как проверку реального Photoshop-документа или доказательство ограничения process RSS.
- **Открыто P0:** законно распространяемые Photoshop-authored PSD16 и PSB32 с первоисточником/лицензией/хешами, проверка настоящего decode, browser UI Worker, preview/Undo/Redo, sampled RAM/latency; затем Stage 003 wide ROI и interruptible fallback.


## Проходка 2026-10-10 — потоковый аудит больших внешних fixtures (Stage 002 P0)

- Исправлена пиковая память preflight: `tools/audit-external-high-depth-corpus.mjs` больше не загружает PSD/PSB (до 512 MiB) целиком ради хеширования, а читает фиксированными 64 KiB блоками. Для проверки заголовка держит только первые 27 байт; сравнивает число прочитанных байт с manifest после чтения, включая возможное изменение файла после `lstat`.
- Regression: PSD16 и PSB32 header-only mocks с многоблочными payloads, фиксированными SHA-256 и повреждением последнего байта. Это **не** реальные Photoshop PSD/PSB, и тест сам по себе не является измерением пикового RSS.
- **Дальше:** добыть законно распространяемые независимо Photoshop-authored 16-bit PSD / 32-bit PSB, зафиксировать ссылки/лицензию/hash и проверить настоящий decode → browser file:// UI Worker → preview/Undo/Redo + memory. Задача 002 остаётся открытой; связанная 003 тоже.


## P0 handoff: audited external high-depth fixtures (2026-10-10)

- Добавлен проверяющий CLI: `node tools/audit-external-high-depth-corpus.mjs --manifest /path/to/manifest.json`, отдельно от редакторского PSD writer/decoder. Он принимает schema `zpe-external-high-depth-psd-psb-v1` и **ровно два** entries `psd16` и `psb32`.
- Каждый entry: `id, file, size, sha256, width, height, channels, colorMode, sourceUrl, sourceApplication, license, licenseUrl, provenanceNotes`. `file` — локальный basename PSD/PSB в каталоге manifest; `sourceApplication` должно быть `Adobe Photoshop`. Поля авторства и лицензии — **заявления**, их необходимо доказать по внешнему первоисточнику; тестовый mock не является внешним Photoshop fixture.
- Аудит проверяет SHA-256 содержимого, размер, symlink/path traversal, сигнатуру `8BPS`, reserved bytes, PSD v1/PSB v2, 16/32-bit, RGB/CMYK, размеры и число каналов. Никакого автоматического скачивания/публикации неизвестно лицензированных файлов.
- **Не закрыто:** реальная independently authored пара high-depth PSD/PSB; Photoshop/render reference, полноценный decode и browser Worker/preview/memory. После получения валидных files добавить отдельный codec→tiles→browser тест и реальный provenance review. Эта CLI-проверка **только preflight**.


- **Goal:** расширить проверяемую Photoshop PSD/PSB round-trip совместимость на маски, группы и корректирующие слои.
- **Why now / evidence:** PSD import/export в `main` есть, но полное Photoshop-совпадение нельзя заявлять без совместимых реальных fixtures.
- **Scope:** одна категория независимых byte/semantic/preview fixtures за проходку, tests/docs; **non-scope:** proprietary parity без доказательств.
- **Inspect first:** `src/formats/psd.js`, `tests/psd-export-integration.test.mjs`, `src/document/psd-native-metadata-plans.js`.
- **Behavioral contracts:** сохранить native structure, no silent 8-bit/CMYK loss, deterministic fixture generation and attribution.
- **Progress (2026-10-10, PR candidate):** добавлен memory-generated PSD/PSB fixture с nested-group topology, включёнными/отключёнными raster masks, clipping и реальными MIT adjustment blocks. `tests/psd-masked-group-corpus.test.mjs` сравнивает semantic snapshots после повторного round-trip; provenance/limitations — `tests/fixtures/psd-compatibility/README.md`. Выполнение и CI проверяются отдельно; до merge задачу не закрывать.
- **Progress (2026-10-10, external preview merged in [PR #130](https://github.com/zeter1/ZeTer-Photo-Editor/pull/130)):** добавлен отдельный независимый decoder-oracle `tests/psd-external-merged-preview.test.mjs` для pinned external PSD Shape Layer (RGBA), PSB with groups (RGB) и PSD Adjustment Layer with mask (RGB). Из реальных image-data bytes напрямую (без ZPE writer) читается PackBits/RLE merged preview; сверяются source SHA-256, зафиксированный FNV-1a RGBA, пиксельный sample и byte-for-byte результат codec composite decode на отдельной копии файла с удалённой layer section. Оригинальный fixture не изменяется, semantic-layer импорт также выполняется. [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38046064138) и [merge/main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38046117059) завершились зелёным на merge commit `39226d48dce3893885ecfecfc926c08389140e8a`.
- **Progress (2026-10-10, native-mask wire oracle; [PR #132](https://github.com/zeter1/ZeTer-Photo-Editor/pull/132) merged, [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38046682118)):** `tests/psd-masked-group-corpus.test.mjs` directly parses raw PSD v1 / PSB v2 layer records and PackBits `-2` mask channel bytes without invoking `decodePsd` for this oracle. It verifies nested `lsct` folder/boundary markers, adjustment clipping, group opacity/visibility, enabled/disabled mask flags and exact mask alpha samples against fixed fixture expectations. This guards against matching writer+reader mistakes; still generated by ZPE, so Adobe/reference rendering and externally authored cross-group masks remain **open**.
- **Planned work:** независимые reference composites и semantic snapshots для mask/group/clipping boundaries, blend-mode pixels и adjustment *rendering* (не только Photoshop-embedded merged image); внешняя сверка с Adobe Photoshop остаётся обязательной для full parity. Текущие generated round-trip и embedded-preview oracles не доказывают полную Photoshop compatibility.
- **Targeted tests:** cross-group masks, blend and adjustments; fail-closed for unsupported features.
- **Required verification:** `npm run check`, browser smoke if runtime changed, fixture provenance audit.
- **Done gate:** не закрывать весь 002, пока нет доказанного external Photoshop/reference render + semantic coverage по заявленным cross-group masks/blend/adjustments; для каждого законченного подэтапа отдельно требуются PR merged и green `main` push CI.
- **Risks / handoff:** отделять codec coverage от проверки Photoshop на внешнем приложении.
