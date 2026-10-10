# task — очередь небольших инженерных проходок

Эта папка — versioned handoff между короткими ChatGPT/Codex проходками. Она помогает продолжать рефакторинг без повторного чтения всего репозитория.

## Правила

1. Одна будущая задача = один `.md` файл. Имя начинается с приоритета: `001-`, `002-`, …
2. В новой проходке сначала прочитай `AGENTS.md` → `docs/PROJECT.md` → этот README → **только одну** верхнюю релевантную задачу.
3. Task-файл хранит intent/acceptance, но не является source of truth. Текущий код, GitHub, логи, тесты и CI имеют приоритет.
4. Перед изменением всё равно делай INSPECT → DIAGNOSE; не исполняй старый план механически.
5. Одна проходка должна оставаться bounded: один связный owner/root cause, его tests/docs и verification. Не смешивай независимые feature/fix/refactor.
6. Для code change обновляй `CHANGELOG.md`; для production/runtime change с изменением пользовательского поведения одновременно делай SemVer bump по `docs/development/CHANGELOG_GUIDE.md`; `package.json` — источник версии, а `index.html`/`version.json` синхронизируются canonical build. Generated `src/app.bundle.js` вручную не редактировать.
7. После PR: дождись CI, разберись с первым failed step по логам, исправь root cause, затем merge. После merge проверь main CI.
8. **Завершённую задачу удалить из `task/` только после merge + green main CI.** README остаётся.
9. Если задача стала неактуальной из-за нового кода/решения, удали или перепиши её отдельным docs-only изменением; не сохраняй stale queue.
10. Не читай все task-файлы «для контекста»: это снова тратит токены и ухудшает фокус.
11. Перед extraction функции/owner-а проверь не только production callers, но и тесты, которые вырезают/eval-ят source (`runInNewContext`, `vm`, `eval`, `slice/indexOf`, regex/source guards): их explicit harness dependencies нужно обновлять в той же проходке, не маскируя CI runtime-fallback'ами.
12. После удаления/переноса helper/predicate сделай repository-wide reference closure: проверь не только прямые вызовы, но и lazy/runtime callbacks (menu enable predicates, keyboard/context actions, deferred handlers). Source/unit tests могут не выполнить такой путь; canonical browser/runtime smoke обязателен перед merge для UI extraction.
13. Если проходка выявила устойчивую спецификацию/паттерн/инвариант, который следующей AI-сессии дорого заново выводить из кода, обнови или создай узкий документ и свяжи его с `AGENTS.md` / `PROJECT.md` / картой архитектуры. Не плодить дублирующие «простыни»: progressive disclosure важнее количества документации.
14. Для post-merge verification не ограничивайся helper-ом, который может фильтровать только `pull_request` runs. Если exact merge-SHA push run не виден, используй provider-native GET коллекции `actions/runs?head_sha=<merge-sha>` через GitHub fetch и проверь `event=push`, `head_branch=main`, exact `head_sha` и `conclusion=success`; при failure переходи к jobs/logs.
15. При добавлении модуля в canonical `file://` bundle помни, что `tools/build-bundle.mjs` снимает ESM-обёртку и конкатенирует classic-script chunks. Если новый модуль использует импортированные `const`/`let` во время module evaluation, его source-order обязан идти после owner-а этих bindings; добавь architecture guard на порядок, а не полагайся только на корректность ESM imports.

## Приоритеты по плану на скриншотах

- [002 — PSD/PSB compatibility corpus](002-psd-compatibility-corpus.md) — в работе: generated nested masks/groups/adjustments corpus; pinned external PSD/PSB merged-preview RLE oracle реализован и слит ([#130](https://github.com/zeter1/ZeTer-Photo-Editor/pull/130), зелёный main CI). Далее — Adobe/reference rendering semantics и cross-group mask fixtures. Не удалять до merge + green main CI.
  - Слитый подэтап 002: независимый raw-wire oracle PSD/PSB mask channels и `lsct` boundaries ([PR #132](https://github.com/zeter1/ZeTer-Photo-Editor/pull/132), [зелёный main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38046682118)). **Следующий шаг:** Adobe/reference compositing и независимые Photoshop-authored cross-group masks/adjustment fixtures; весь пункт 002 ещё открыт.
- [003 — tiled Content-Aware Fill](003-tiled-content-aware.md) — ROI-подэтап [PR #134](https://github.com/zeter1/ZeTer-Photo-Editor/pull/134) слит, [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38047465391). **Задача остаётся открытой:** профилирование RAM/latency, worker/cancellation и широкие/разрозненные выделения. Подэтап single-evaluation frozen selection — [PR #136](https://github.com/zeter1/ZeTer-Photo-Editor/pull/136) merged, [PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38048127653) + [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38048171147). **003 остаётся открытой:** profiling, worker/cancellation, wide/disconnected masks.

Очередь отражает незакрытые направления; реализацию не дублировать с параллельными PR. Следующую задачу брать только после сверки с кодом и статусами CI.

## Минимальный шаблон задачи

- Goal
- Why now / evidence
- Scope / non-scope
- Inspect first
- Behavioral contracts to preserve
- Planned extraction/fix
- Targeted tests
- Required verification
- Done gate
- Risks / handoff notes

Практика основана на repository-local execution plans и progressive disclosure: OpenAI Harness Engineering (2026-02-11) и принципе Google Small CLs — одна self-contained change с related tests.

### Подэтап 003 — 2026-10-10 ([PR #138](https://github.com/zeter1/ZeTer-Photo-Editor/pull/138), слито)

- Реализована tiled Content-Aware Fill для удалённых halo-disjoint островков ([PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38049643830), [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38049694526), squash `e7188ac9ec021e8dd23fdf769430e1f5d5febb0b`). Остались memory/latency profiling, worker/cancellation и широкие связные маски. **003 не закрывать**.

### Подэтап 003 — профиль 8/24/48 MiB (2026-10-10, [PR #139](https://github.com/zeter1/ZeTer-Photo-Editor/pull/139))

- Добавлен воспроизводимый `tools/profile-tiled-inpaint.mjs` с isolated process RSS/latency и regression test. Полный запуск прикреплён к CI как **информационное измерение**, без числового pass/fail порога. См. [003](003-tiled-content-aware.md) и `docs/architecture/TILED_RASTER.md`.
- [PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38051881786); [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38052035982); merge PR #139 squash `11932992f3213447b8cae9c183eaf80cb2ec6f06`. Benchmark-подэтап завершён после PR+main CI, но реальный PSD/PSB/UI profile остаётся незакрытым. Worker/cancellation, wide connected masks и реальный PSD/PSB + UI memory profile остаются в очереди. **003 открыта**.

### Подэтап 003 — cooperative scan (2026-10-10, [PR #141](https://github.com/zeter1/ZeTer-Photo-Editor/pull/141), слито)

- Реализуется chunked, cancellable scan frozen selection с exact-owner abort в `src/core/pixel-buffer.js` / `src/painting/controller.js`, регрессии в `tests/tiled-inpaint-cooperative.test.mjs`. [PR CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38053077787), [main push CI green](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38053128507), exact merge SHA `74d2e14c0901c4088322c5fc3bb982f1528fe5d4`; scan-подэтап закрыт, но **не удалять 003**. Следующие проходки: Worker execution/kernel cancellation, wide connected selection и реальные PSD/PSB UI memory profiles.

### Подэтап 003 — external PSD/PSB decode/profile (2026-10-10, [PR #143](https://github.com/zeter1/ZeTer-Photo-Editor/pull/143), merged + main CI green)

- Добавлен отдельный informational benchmark реальных upstream PSD CMYK и layered PSB (`tools/profile-real-psd-inpaint.mjs`) со сверкой исходных SHA-256, раздельными стадиями decode→tiles→inpaint и process-wide RSS. Тест проверяет sync/cooperative parity и отмену ещё до ROI decode на *внешнем* корпусе. Это тестово-измерительная проходка без production logic / version bump.
- **Gate внешних 8-bit PSD/PSB fixtures закрыт:** [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38054015772), [exact main push CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38054094819), squash SHA `36236c0c17584bf46669fc93a32bc90a7bec10b5`; 1046 Node tests + browser/file:// smoke. **Открыто:** большие реальные 16/32-bit PSD/PSB + browser UI profile, worker-owned kernel/true cancellation и широкий связный ROI. **003 не удалять**.

### Подэтап 003 — Worker protocol probe (2026-10-10, ожидает CI/merge)

- Создан узкий Node `worker_threads` proof-of-contract для frozen selection → tiled inpaint compute → structured-clone result с sync parity и отрицательными тестами. Это **не** браузерная Worker-интеграция и **не** mid-kernel cancellation. Подробности в [003](003-tiled-content-aware.md). Никаких выводов о `file://` Worker или об устранении main-thread latency пока не делать; 003 открыта.
