# 037C — genuine-photo Chromium file:// native Worker / Undo / quality / memory

**Статус: OPEN, следующий приоритет после закрытой 037B2b-3.** Источник и документы: [037B2b-3i](037b2b-3i-genuine-native-psd-psb-ci.md); неизменяемые SHA-256: `tests/fixtures/real-photo/reviewed-manifest.json`, `tests/fixtures/real-photo/reviewed-native-artifacts.json`. PNG-preview/self-codec alone НЕ достаточны.

## Проходка 037C-2 — genuine photo native Worker/Undo/Redo/reopen (2026-10-16)

**PR CI подтверждён (6/6), merge и exact-main ещё ожидаются:** [PR #247](https://github.com/zeter1/ZeTer-Photo-Editor/pull/247), [общий PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38845568478), [genuine-photo PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38845568406). Код и evidence gates: [037C-2](037c2-genuine-photo-worker-evidence.md). До successful PR + exact-main acceptance статус 037C **OPEN**. После этого остаётся 037C-3 — наблюдаемая память с missingness и cancelled/stale/error matrix.

## Проходка 037C-1 — проверка настоящего Chromium импорта (2026-10-16)

**Статус 037C-1: PR #246 слита ([5b3b072](https://github.com/zeter1/ZeTer-Photo-Editor/commit/5b3b07269dae19b025823a811283329df1175d62)); [общий PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38843677964) и [genuine-photo PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38843677938). 6 импортов baseline доказаны, но 037C ОСТАЁТСЯ OPEN.**

- `tools/browser-real-photo-ui-import.mjs` читает только настоящие сохранённые PSD16/PSB32, сверяет SHA-256 файлов против independently frozen `reviewed-native-artifacts.json` до UI.
- Opt-in `ZPE_REAL_PHOTO_BROWSER_DIR` в `tools/browser-smoke.mjs` запускает отдельный чистый `file://` Chromium профиль для каждого вызова, через `#fileInput` импортирует бинарный PSD/PSB.
- Через публичное меню «Сохранить проект» reassemble всех `highDepthSource.tiles` в точном порядке little-endian RGBA, проверяется coverage/overlap/size и native SHA-256 против independently pinned damaged-photo bytes, не против Canvas8.
- Workflow `real-photo-intake.yml` после source/decoder/native independent gate выполняет 3 отдельных Chromium процесса на формат и публикует 6 самостоятельных baseline JSON. `tools/verify-browser-real-photo-import-artifacts.mjs` проверяет полноту/отсутствие дублей и запрещает незаслуженные worker/repair/peak claims. Негативные тесты `tests/browser-real-photo-ui-import.test.mjs`.
- Названия receipt имеют суффикс `-baseline-` и явно `workerVerified:false`. На PR exact-code CI шестикратный baseline успешно проверен. Это **не** подтверждает Worker Fill, Undo/Redo, фотокачество или пиковую память.

**Непосредственно следующие subpasses:**
1. 037C-2: polygon UI 8288/Worker и native snapshot до/после, сравнить `clean` oracle (а не defect input), Undo/Redo, reopen `.zpe` с 3 × на формат.
2. 037C-3: observational timing, renderer heap/CDP/Linux RSS с явными unknown, cancellation/stale document/tab/abort failures.
3. CI verification: 037C полное подтверждение на PR и exact main с ссылками, без этого OPEN.

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
