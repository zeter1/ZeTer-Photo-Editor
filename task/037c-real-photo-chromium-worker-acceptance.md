# 037C — genuine-photo Chromium file:// native Worker / Undo / quality / memory

**Статус: OPEN, следующий приоритет после закрытой 037B2b-3.** Источник и документы: [037B2b-3i](037b2b-3i-genuine-native-psd-psb-ci.md); неизменяемые SHA-256: `tests/fixtures/real-photo/reviewed-manifest.json`, `tests/fixtures/real-photo/reviewed-native-artifacts.json`. PNG-preview/self-codec alone НЕ достаточны.

## Предлагаемый порядок реализации

1. Добавить opt-in Chromium `file://` end-to-end в `tools/browser-smoke.mjs`/подчинённый тестовый owner, используя **подлинные** pinned PSD16 и PSB32 из genuine-photo CI artifact, а не структурный synthetic surrogate. Никаких больших двоичных fixture в Git.
2. Для каждого формата выполнить **3 независимые сессии**: импорт PSD/PSB через UI → polygon selection двух 64×64 islands + 96-pixel diagonal bridge (8288 px) → Content-Aware native Worker → preview → сохранение `.zpe` → Undo → Redo и повторное открытие `.zpe`.
3. Не путать входной **defect native** reference с эталонным **clean native**: измерить до/после relative к frozen clean SHA/native pixel oracle, соблюсти неизменность outside-selection, alpha и depth, не полагаться на RGBA8 render-downsample или сравнение только одинаково-декодированного редактором native.
4. Собирать независимые JSON-артефакты `real-photo-psd16-run-{1..3}.json`, `real-photo-psb32-run-{1..3}.json`: исходные file/native SHA, ROI count, Worker request/protocol result, selected pixel quality MAE/RMSE, no-change controls, Save/Undo/Redo байтовую проверку и временные метки.
5. Для каждого шага сохранять `performance.now` timing, JS heap по доступности, CDP process private memory/RSS и состояние наличия renderer/Worker PID. Пропуски — `unknown`, не 0, `observedSampledRss` не выдавать за peak. Отдельно отрицательные сценарии: abort, tab switch, close document, stale Owner, malformed native bytes, memory cap and late result.
6. CI-приёмка: genuine-source and two-format pins gate → Chromium `file://` **6 независимых запусков** → сохранение и повторная проверка JSON evidence → PR CI + main exact-code CI. Без green gate считать 037C OPEN.

## Критерии закрытия

- [ ] Настоящий per-format импорт и Worker-инпейнтинг реально выполнены в Chromium, не только Node Worker или self-codec.
- [ ] Шесть раздельных успешных сеансов (3×PSD16, 3×PSB32), каждый с Undo/Redo/Save и native layer/ROI evidence.
- [ ] Измерены реальная фототекстура и качество восстановления против clean oracle, frozen outside-selection/alpha и failure cases.
- [ ] Timing и observational memory верифицированы с явными missingness/limits, без ложного claim «пиковая RAM».
- [ ] PR CI, merge, exact-main CI — success; ссылки внесены в `task/NEXT.md`.

**Отдельные незакрытые направления:** [P0 002](002-psd-compatibility-corpus.md) Adobe-authored Photoshop goldens, [Stage 003](003-tiled-content-aware.md) глобальный memory/tile бюджет, calibrated ICC/CMYK, RAW и оставшиеся возможности скриншота. Закрытие 037C не означает полную Photoshop compatibility.
