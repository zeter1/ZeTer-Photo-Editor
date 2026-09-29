# task — очередь небольших инженерных проходок

Эта папка — versioned handoff между короткими ChatGPT/Codex проходками. Она помогает продолжать рефакторинг без повторного чтения всего репозитория.

## Правила

1. Одна будущая задача = один `.md` файл. Имя начинается с приоритета: `001-`, `002-`, …
2. В новой проходке сначала прочитай `AGENTS.md` → `docs/PROJECT.md` → этот README → **только одну** верхнюю релевантную задачу.
3. Task-файл хранит intent/acceptance, но не является source of truth. Текущий код, GitHub, логи, тесты и CI имеют приоритет.
4. Перед изменением всё равно делай INSPECT → DIAGNOSE; не исполняй старый план механически.
5. Одна проходка должна оставаться bounded: один связный owner/root cause, его tests/docs и verification. Не смешивай независимые feature/fix/refactor.
6. Для code change обновляй `CHANGELOG.md`; generated `src/app.bundle.js` меняется только через canonical build graph.
7. После PR: дождись CI, разберись с первым failed step по логам, исправь root cause, затем merge. После merge проверь main CI.
8. **Завершённую задачу удалить из `task/` только после merge + green main CI.** README остаётся.
9. Если задача стала неактуальной из-за нового кода/решения, удали или перепиши её отдельным docs-only изменением; не сохраняй stale queue.
10. Не читай все task-файлы «для контекста»: это снова тратит токены и ухудшает фокус.
11. Перед extraction функции/owner-а проверь не только production callers, но и тесты, которые вырезают/eval-ят source (`runInNewContext`, `vm`, `eval`, `slice/indexOf`, regex/source guards): их explicit harness dependencies нужно обновлять в той же проходке, не маскируя CI runtime-fallback'ами.
12. После удаления/переноса helper/predicate сделай repository-wide reference closure: проверь не только прямые вызовы, но и lazy/runtime callbacks (menu enable predicates, keyboard/context actions, deferred handlers). Source/unit tests могут не выполнить такой путь; canonical browser/runtime smoke обязателен перед merge для UI extraction.
13. Если проходка выявила устойчивую спецификацию/паттерн/инвариант, который следующей AI-сессии дорого заново выводить из кода, обнови или создай узкий документ и свяжи его с `AGENTS.md` / `PROJECT.md` / картой архитектуры. Не плодить дублирующие «простыни»: progressive disclosure важнее количества документации.
14. Для post-merge verification не ограничивайся helper-ом, который может фильтровать только `pull_request` runs. Если exact merge-SHA push run не виден, используй provider-native GET коллекции `actions/runs?head_sha=<merge-sha>` через GitHub fetch и проверь `event=push`, `head_branch=main`, exact `head_sha` и `conclusion=success`; при failure переходи к jobs/logs.
15. При добавлении модуля в canonical `file://` bundle помни, что `tools/build-bundle.mjs` снимает ESM-обёртку и конкатенирует classic-script chunks. Если новый модуль использует импортированные `const`/`let` во время module evaluation, его source-order обязан идти после owner-а этих bindings; добавь architecture guard на порядок, а не полагайся только на корректность ESM imports.

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
