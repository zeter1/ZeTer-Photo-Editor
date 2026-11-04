# NEXT — актуальная работа ZeTer Photo Editor

> **CURRENT TASK:** [003X/6c-9 — real large History pooling memory/latency profile](003x6c9-history-sharing-profile.md)  
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS · **DEPENDENCY:** 003X/6c-8 DONE  
> **BASE MAIN SHA:** [PR #375 merge `7b2a0cd581ceab8f5f15ab7c87d928576e010036`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7b2a0cd581ceab8f5f15ab7c87d928576e010036) (post-merge documentation may advance HEAD; recheck before new work).
> **ACTIVE PR:** none for 003X/6c-9. [#375](https://github.com/zeter1/ZeTer-Photo-Editor/pull/375) **MERGED** as `7b2a0cd` from final head [`754b9a4`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/754b9a4f7364e569a227bef11256deb08cc3fe5b). Exact PR-head [Linux core #41818060991](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41818060991) SUCCESS 12/12; [independent real-photo #41818061101](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41818061101) SUCCESS. Exact merged-main CI must be checked separately; it was not observed immediately after connector merge.
> **LAST VERIFIED:** 2026-11-04 Windows: PNG rejection/replaced-canvas RED 2/7→GREEN 11/11; delayed PNG reject after tab switch RED 7/8→GREEN 8/8, combined RGB16/CMYKA32 Float32 + RGBA8 12/12 PASS. `npm run check`: 1595 tests / 1580 PASS / 10 SKIP / 5 known Linux-only `/proc`/cgroup FAIL (overall FAIL). Real Chrome `file://` smoke PASS (exit 0); no injected browser PNG-failure scenario. Generated build `ad655b3dffd19fca`.
> **REMAINING ACCEPTANCE:** bounded genuine Chrome `file://` **same-action** generic-vs-pooled History comparison for two native 1025×1025 RGB16/CMYKA32 Float32 tabs, Undo/Redo/native byte oracle, IndexedDB v2 restore, actual UI Worker cancellation/stale/tab close and carefully distinguished memory observations; exact-main CI after #375 merge separately verify. Stage 6 / 10 remain IN PROGRESS.
> **NEXT IMPLEMENTATION ACTION:** extend the existing `tools/profile-history-sharing-chrome.mjs` opt-in UI harness for **identical** user action sequences in generic and pooled History across two genuine 1025×1025 native sessions (RGB16 and CMYKA32 Float32); check originals + changed native bits at every Undo/Redo/IDB v2 restore, use real UI Content-Aware Worker cancel/stale/tab-close and record phase timings/available renderer heap/OS metrics. Once bit-level equivalence is proven and remaining Worker PID/RSS/peak limitations are documented, close only the bounded profiling increment and implement Stage 2 raster/vector mask or adjustment UX vertical slice; no repeated speculative profiling.
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
