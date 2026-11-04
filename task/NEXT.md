# NEXT — актуальная работа ZeTer Photo Editor

> **CURRENT TASK:** [003X/6c-9 — real large History pooling memory/latency profile](003x6c9-history-sharing-profile.md)  
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS · **DEPENDENCY:** 003X/6c-8 DONE  
> **BASE MAIN SHA:** `689ea141a920e807abe4c18e4d80bd62646fc03c` (after #375 merge and documentation update); exact-main [CI #41819462321](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41819462321) **SUCCESS 12/12**. Recheck head before publishing.
> **ACTIVE PR:** [#376 — visible Content-Aware cancel](https://github.com/zeter1/ZeTer-Photo-Editor/pull/376), **OPEN**, base `689ea14`, code head [`26dffd0`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/26dffd034d57d055acadd3029818a84fd56ea43d). Exact PR-head [Linux core #41823913575](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41823913575) and [independent real-photo #41823913580](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41823913580) **IN PROGRESS** as observed, NOT yet green; documentation updates may advance head. [#375](https://github.com/zeter1/ZeTer-Photo-Editor/pull/375) previously **MERGED** `7b2a0cd` with final-head core/real-photo SUCCESS.
> **LAST VERIFIED:** 2026-11-04 visible Content-Aware cancel panel, owner-scoped pending notifications: 3 new tests RED→GREEN; native+RGBA8 15/15 PASS. Windows `npm run check`: 1598 tests / 1583 PASS / 10 SKIP / 5 Linux-only `/proc`/cgroup FAIL (**overall FAIL**); `git diff --check` PASS. Current bundle `9e37f36e4dbc7462`. **Real Chrome `file://` `npm run test:browser` PASS (exit 0)**: actual tiled RGB16 UI Worker Fill shows/hides pending panel, pixel/Undo/Redo regressions pass. Dedicated click-to-cancel in real browser still not proven.
> **REMAINING ACCEPTANCE:** genuine Chrome `file://` **same-action** generic-vs-pooled History comparison for two native 1025×1025 RGB16/CMYKA32 Float32 tabs, Undo/Redo/native bytes, IndexedDB v2 restore, actual *click-to-cancel* UI Worker/stale/tab close and distinguished memory observations. Existing exact-main pre-change CI `689ea14` verified 12/12; new PR-head and merged-main need separate checks. Stage 6/10 still IN PROGRESS.
> **NEXT IMPLEMENTATION ACTION:** verify exact final-head Linux core 12 jobs and independent real-photo CI for [PR #376](https://github.com/zeter1/ZeTer-Photo-Editor/pull/376); review/merge only when allowed and green, verify exact-main separately. Dedicated real-browser click-to-cancel remains to prove. Then extend `tools/profile-history-sharing-chrome.mjs` for **identical** UI actions in generic vs pooled History on two genuine 1025×1025 RGB16 and CMYKA32 Float32 documents, including button cancellation/stale/tab-close, native Undo/Redo bit oracle and IDB v2 restore. Stop once bounded equivalence/unknown Worker PID-RSS limitations are documented, then switch to Stage 2 mask/adjustment UX; do not prolong pure profiling.
> **BLOCKERS:** Adobe-authored PSB32 provenance independently BLOCKED; unavailable Worker PID/true RSS peak must remain UNKNOWN, not an infinite profiling loop
> **RECENT DOCUMENTATION PR:** [#374](https://github.com/zeter1/ZeTer-Photo-Editor/pull/374) MERGED `8dee7d3`, documentation only.
> **LAST ACCEPTED INCREMENT:** [PR #375](https://github.com/zeter1/ZeTer-Photo-Editor/pull/375) **MERGED** `7b2a0cd` with real Content-Aware cancellation / owner-safe PNG publication, final-head core [12/12 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41818060991), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41818061101). No `.zpe`/PSD/PSB schema changes. Prior bounded PR #373 acceptance retained in detailed task log. **Parent Stage 6 IN PROGRESS.**

## Активный кодовый инкремент 2026-11-04

Обнаружен RED дефект в нетайловой native 16/32-bit Content-Aware Fill: отменённый fill мог опубликовать поздний результат после асинхронного preview; синхронная обработка могла сохранить результат после отмены во время сканирования. На ветке `feat/003x6c9-flat-native-inpaint-cancel-20261104` внедрён cooperative native kernel и continuation guard на preview/persist, без смены формата `.zpe`. RED 2/4 → GREEN 4/4; связанные тесты 25/25; Windows `npm run check` 1572 PASS/10 SKIP/5 известных Linux-only `/proc`/cgroup FAIL. **PR #375 объединён в main `7b2a0cd` после green final-head core + real-photo CI.** Полные реальные UI pooled-vs-generic A/B остаются открыты.

## Следующее конкретное действие — продолжить 003X/6c-9

Реализовать **совместный live UI same-action generic/pooled A/B** на больших 1025×1025 RGB16 / CMYKA32 Float32 нативных `.zpe`:
1. Два реальных документа / вкладки, одинаковые пользовательские операции, native input/output bit oracle, Undo/Redo, IndexedDB v2 restore.
2. Настоящий UI Content-Aware Worker cancel, stale response, tab switch/close и полная защита от поздней публикации, не подменять direct Blob Worker terminate.
3. Измерить время UI/Worker и память при фактических фазах, указать что наблюдается (renderer heap, Worker isolate, Windows private commit, RSS, peak) и что остаётся неизвестным. Не требовать недоступный PID/RSS как повод бесконечно не завершать ограниченную задачу; документировать accepted limitation.
4. Два порядка A/B, воспроизводимые fixture/команды, регрессии, deterministic build, PR-head core + отдельный real-photo workflow при применимости, merge только после разрешённых обязательных gates и exact-main CI.

**Stop criterion:** если совпадение функциональности/bit oracle доказано, а дальнейшее разделение Worker PID невозможно или не даёт полезного изменения, явно зафиксировать ограничение и закрыть *bounded* profiling increment; **не зацикливаться на профилировании без нового дефекта**.

## После приёмки

- Повторно прочитать [матрицу возможностей](CAPABILITY_MATRIX.md), выбрать самый важный неполный **функциональный вертикальный срез** (приоритет: mask/adjustment/Bézier/PSD), проверить dependencies и создать задачу без дубля.
- [002B/2c независимая Adobe-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md) остаётся **BLOCKED**; не объявлять Photoshop совместимость проверенной по синтетическим фикстурам.
- В любой новой проходке: проверить HEAD main, открытые PR/CI и [этот файл](NEXT.md) перед созданием ветки.

## Навигация

- [Общая карта](README.md) · [Матрица возможностей](CAPABILITY_MATRIX.md) · [Детальная задача](003x6c9-history-sharing-profile.md).
- Предыдущий большой NEXT сохранён в [archive/2026-11-04-NEXT-legacy.md](archive/2026-11-04-NEXT-legacy.md); полная история не удалена.
