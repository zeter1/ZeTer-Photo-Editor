# task — карта задач и развития ZeTer Photo Editor

**Актуальный источник решения, что делать дальше:** [NEXT.md](NEXT.md).  
**Единая матрица функциональности:** [CAPABILITY_MATRIX.md](CAPABILITY_MATRIX.md).  
**Не выдавай наличие кода за готовность функции:** статусы требуют acceptance evidence.

## Сейчас (2026-11-07)

- **CURRENT:** Stage 2 / CAP-BEZ — P1 IN PROGRESS: [PR #125](https://github.com/zeter1/ZeTer-Photo-Editor/pull/125) OPEN (head 9a547f2, base 2d02391). [Core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41851946246) и [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41851946082) только для старого head. В новой локальной проходке настоящий Chrome file:// Alt+Shift Shape, Undo/Redo, реальный .zpe Ctrl+S Blob и reopen PASS, 37/37 unit PASS, build PASS. Общий Windows npm test ранее FAIL на пяти Linux-only /proc fixtures. Новый head/CI пока NOT RUN до публикации. [Журнал](002-bezier-smooth-anchor.md).
- **Bounded DONE:** [PR #373](https://github.com/zeter1/ZeTer-Photo-Editor/pull/373) merged [main `7e37b2f`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7e37b2feb67ff8de66816f8af5a39a2f5d416122); [PR core CI 12/12](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41792886405), [exact-main core CI 12/12](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41795185119).
- **Документирование:** [PR #374](https://github.com/zeter1/ZeTer-Photo-Editor/pull/374) merged `8dee7d3`; exact-main [CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41801227578).
- **Accepted bounded code:** [PR #375](https://github.com/zeter1/ZeTer-Photo-Editor/pull/375) **MERGED** `7b2a0cd` from exact head `754b9a4`: native RGB16/CMYKA32 Float32 and RGBA8 cooperative cancellation, owner-safe PNG rejection/tab-switch cleanup; Linux [core CI SUCCESS 12/12](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41818060991), independent [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41818061101). Windows Chrome `file://` PASS, focused 12/12; Windows full check 5 Linux-only FAIL. Exact-main CI separate. Stage 6 and 10 **IN PROGRESS**. [Журнал](003x6c9-history-sharing-profile.md).
- **Bounded DONE:** visible Content-Aware Fill cancel from [PR #376](https://github.com/zeter1/ZeTer-Photo-Editor/pull/376) merged `744bcb1`; 15/15 focused, genuine UI button click during Worker, head CI 12/12, real-photo SUCCESS. Stage 6/10 remain IN PROGRESS.
- **Отдельный BLOCKED:** [002B/2c Photoshop-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md). Измерения и synthetic не подменяют авторское происхождение.
- **Not run:** отдельный real-photo CI для PR #373 не запустился из-за path filters; это не PASS.

## Карта десяти направлений

| Stage | Направление | Текущий уровень доказательства |
| --- | --- | --- |
| 1 | Типизированная модель слоёв, document/render, pixel buffers, `.zpe` | IN PROGRESS — реализованы компоненты, полный контракт пока не принят |
| 2 | Растровые/векторные маски, adjustment layers, Bézier paths | IN PROGRESS — необходимо проверить полные пользовательские workflows |
| 3 | PSD import | IN PROGRESS — только подтверждённые Photoshop-authored features признавать совместимыми |
| 4 | PSD export | IN PROGRESS — нужна целевая editability/round-trip matrix |
| 5 | Smart Objects | IN PROGRESS — embedded/linked/nested паритет ещё открыт |
| 6 | Производительность, tiles, Worker, память | IN PROGRESS — активная задача 003X/6c-9 |
| 7 | PSB, 16-bit, 32-bit/HDR | IN PROGRESS — отдельная Adobe PSB32 provenance BLOCKED |
| 8 | ICC, CMYK, wide gamut, soft proof | IN PROGRESS — требуется цветовая интеграционная приёмка |
| 9 | RAW pipeline | TODO — функциональная end-to-end готовность не подтверждена |
| 10 | Select & Mask, Refine Edge, Content-Aware Fill/Heal, retouch | IN PROGRESS — расширение и UX/quality/Worker приёмка |

Подробные критерии, владельцы кода и текущие пробелы — в [CAPABILITY_MATRIX.md](CAPABILITY_MATRIX.md).

## Обязательная процедура проходки

1. Сверить точный `main` SHA, незакрытые PR и CI; читать [NEXT.md](NEXT.md) и актуальную задачу.
2. Применять изменения к **одному** приоритетному вертикальному срезу: реальная работающая функция > новые отчёты. Исключения: критический баг, необходимая приёмка.
3. Реальные code changes + подходящие unit/integration/browser/E2E, Undo/Redo, `.zpe`, PSD/PSB. Не называть skipped/NOT RUN успешным.
4. PR-head проверки → review/merge по разрешённым правилам → exact-main CI; фиксировать реальные ссылки и статусы.
5. Обновить матрицу, [NEXT.md](NEXT.md) и технический журнал. Записывать **один** CURRENT с непротиворечивым состоянием, не добавлять историю сверху сотнями блоков.
6. Если внешняя provenance или OS metric BLOCKED, явно назвать ограничения и продолжить независимую задачу.

## История и архив

- Унаследованные полные журналы: [NEXT, 2026-11-04](archive/2026-11-04-NEXT-legacy.md) и [README, 2026-11-04](archive/2026-11-04-README-legacy.md). Архивы сохранены без потери предыдущих ссылок, успешных этапов и ограничений.
- Продолжительные исследовательские записи остаются в отдельных `task/*.md`; не копировать их в краткие CURRENT и README.
- Десять Stage статусов — карта направления, **не** проценты готовности. DONE только после полного приёмочного контракта.
