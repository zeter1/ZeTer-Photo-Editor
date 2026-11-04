# NEXT — актуальная работа ZeTer Photo Editor

> **CURRENT TASK:** [003X/6c-9 — real large History pooling memory/latency profile](003x6c9-history-sharing-profile.md)  
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS · **DEPENDENCY:** 003X/6c-8 DONE  
> **BASELINE:** main [`8dee7d3`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/8dee7d366601fa2531e89545a4fd76ce0a8d1d23) (2026-11-04; [exact-main core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41801227578); проверить HEAD перед записью)
> **RECENT DOCUMENTATION PR:** [#374](https://github.com/zeter1/ZeTer-Photo-Editor/pull/374) MERGED `8dee7d3`, documentation only.
> **LAST ACCEPTED INCREMENT:** [#373](https://github.com/zeter1/ZeTer-Photo-Editor/pull/373) `e05763e`, merged `7e37b2f`; PR core [#41792886405](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41792886405) **SUCCESS 12/12**; exact-main [#41795185119](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41795185119) **SUCCESS 12/12 attempt 1**. Separate real-photo workflow **NOT RUN** (path filters).  
> **LAST SCOPE:** real Chrome `file://` native RGB16/CMYKA32 Float32 Worker byte oracle + bounded History A/B. Production/bundle/schema не менялись. **Parent Stage 6 IN PROGRESS.**

## Активный кодовый инкремент 2026-11-04

Обнаружен RED дефект в нетайловой native 16/32-bit Content-Aware Fill: отменённый fill мог опубликовать поздний результат после асинхронного preview; синхронная обработка могла сохранить результат после отмены во время сканирования. На ветке `feat/003x6c9-flat-native-inpaint-cancel-20261104` внедрён cooperative native kernel и continuation guard на preview/persist, без смены формата `.zpe`. RED 2/4 → GREEN 4/4; связанные тесты 25/25; Windows `npm run check` 1572 PASS/10 SKIP/5 известных Linux-only `/proc`/cgroup FAIL. **GitHub PR/CI/merge оцениваются отдельно; в main это не считать до фактического merge.** Полные реальные UI pooled-vs-generic A/B остаются открыты.

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
