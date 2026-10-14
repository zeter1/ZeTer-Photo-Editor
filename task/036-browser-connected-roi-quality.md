# 036 — реальный Chromium quality/latency/RSS для широкого связного Content-Aware ROI

**Статус: ОТКРЫТО (P1, Stage 003).**
**Основание:** после закрытия [035](035-browser-recovery-modal-flake.md), [034](034-complex-roi-native-quality.md) по-прежнему доказывает native connected ROI только в Node Worker. Реальный Chromium проверяет небольшой 5×5 дефект ([033](033-browser-synthetic-native-quality.md)), но не широкий сложный ROI.

## Проходка 036A — точный native evidence-контракт (2026-10-14, СЛИТО, main CI success)

- **Gate 036A:** [PR #220](https://github.com/zeter1/ZeTer-Photo-Editor/pull/220) → squash [`94633e9`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/94633e9e333aceb961241487853a92ea2531ed48); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38566438939) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38566790704): `npm run check`, real Chromium file:// smoke, operation JSON verification, профили и diff hygiene. Это gate **только 036A**, не wide-browser 036B/C.
- [x] Добавлен самостоятельный test-only oracle `tools/browser-wide-connected-native-evidence.mjs`: 8288 пикселей (два острова 64×64 и диагональ 96), проверка точных индексов, оригинальных native tile bytes вне выделения, alpha, MAE/RMSE относительно ZeTer-generated фона, полная байтовая идентичность Undo и Redo.
- [x] `tests/browser-wide-connected-native-evidence.test.mjs`: RGB16/Float32 + подменённая форма ROI, missing/overlapping/corrupt tiles, NaN, соседний пиксель/alpha, Undo/Redo и недоказанные memory samples/peaks.
- [x] Встроен fail-closed контракт временных меток и coverage, требующий `workerPidMapping='unknown'` и `operationPeakRssBytes=null`. Ни snapshot, ни CDP target не объявляются настоящим Worker RSS.
- [ ] **036B (код в PR, CI gate ожидается):** подключить этот oracle к реальному Chromium `file://` UI импорт/широкая связная selection/Worker/preview/Undo/Redo для PSD16 и PSB32. Сохранять полный источник через публичный Save Project, а не читать приватный state; сравнить реальные `selectedIndices` со shape oracle.
- [ ] **036C:** собирать реальные observation timestamps и RSS/CDP gaps в сериализованный versioned JSON с повторной CI-валидацией, затем выполнить `npm run check`, `test:browser`, два JSON artifact, профиль, review/merge и exact-main CI. До этого 036 **не закрыта**.
- **Граница:** 036A — тестовый фундамент, **не** доказательство выполненного браузерного Fill или Photoshop-compatible reference.

## Следующая самостоятельная проходка

- [ ] Взять текущий ZeTer-generated RGB16/PSB32 high-depth fixture и сложную **связанную** ROI: два плотных острова + диагональный коридор, занимающие достаточно tile cells для bounded planner. Не подменять тест маленьким прямоугольником и не создавать Photoshop golden из собственного writer.
- [ ] Через штатный `file://` UI: импорт → native Worker Fill → preview → Undo/Redo; зафиксировать выбранные индексы и проверить неизменность исходных native words **вне** выделения, alpha и donor source. Использовать известный чистый фон для независимых MAE/RMSE до и после Fill. Перепроверить Cancel/Retry или явно вынести это в следующую проходку, если не умещается.
- [ ] Измерить wall-clock этапы импорта, планирования, Worker, preview, Undo/Redo. Собрать наблюдаемые CDP renderer privateMemory и Linux process RSS/PID starttime с snapshot coverage; не выдавать sample за истинный пик процесса, отсутствие PID за exit или Worker target за PID без доказательств. Сравнить с [024](024-browser-operation-memory.md), [025](025-browser-worker-target-census.md).
- [ ] Добавить unit негативные cases для false quality evidence / changed-native bytes / некорректных ROI / неполного sampling; fail closed для неверных цифровых заявлений в JSON.
- [ ] Gate: `npm run check`, Chromium `file://` smoke, два browser operation artifacts и существующие benchmark-профили, зелёный PR CI, merge и зелёный exact-code main CI. Записать provenance ссылок в [NEXT](NEXT.md), [003](003-tiled-content-aware.md) и здесь.

## Вне этой проходки

- [002](002-psd-compatibility-corpus.md): independently Photoshop-authored и законно распространяемые PSD16/CMYK32 PSB goldens, external rendering и semantic parity — **P0 остаётся открытой**, не заменять синтетикой.
- Полный real-image quality / accurate operation peak RAM / GPU, AI, RAW/DNG, CMYK и Photoshop feature parity не считаются решёнными одним benchmark.
- Сначала проверить `task/NEXT.md` на свежий статус перед выполнением. Тестовые новые вспомогательные файлы размещать в `tools/`, `tests/`; не менять generated `src/app.bundle.js` вручную.

## Реализация 036B — PR ветка `feat/036b-wide-connected-chromium` (2026-10-14)

- Добавлен `tools/browser-wide-connected-ui-polygon.mjs`: **десять вершин** для настоящего polygon UI gesture; subpixel диагональный коридор выбирает ровно 96 pixel centres между 64×64 островами, включая 8288 целевых точек и исключая соседние. `tests/browser-wide-connected-ui-polygon.test.mjs` сравнивает production `pointInSelection` со строгим 036A pixel oracle в трёх геометриях и при offset.
- Добавлены wide ZeTer-generated PSD16/PSB32 fixtures 1025² (обязательно native tiled source v2) и `tools/browser-wide-connected-ui-smoke.mjs`: public File Input → настоящее polygon clicking/Enter → Content-Aware Fill native Worker → публичный Save Project ×4 → native MAE/RMSE и exact Undo/Redo/outside selection/alpha; оба формата включены в `tools/browser-smoke.mjs`.
- Строгий 036A tile decoder адаптирован к стандартному `atob`/`btoa` и может исполняться в настоящем Chromium без private app state; остальные проверки неизменны. Тестовый код и fixtures **не Photoshop-authored** и не меняют production рендерер.
- **До зелёного браузерного CI считать 036B незакрытой.** Даже при успехе 036C: независимая versioned JSON запись sampled latency/RSS/CDP gap + fail-closed verify/review/main gate. Stage 003 остаётся открытой.
