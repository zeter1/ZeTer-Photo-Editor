# ZeTer Photo Editor — матрица возможностей

**Дата базовой ревизии:** 2026-11-04. **Исходная ветка:** main `8dee7d366601fa2531e89545a4fd76ce0a8d1d23`.
**Назначение:** единый, проверяемый указатель функциональной готовности. **Это НЕ заявление о завершённости Photoshop-совместимости.**

## Правила обновления

- Статусы: **TODO** (не подтверждена реализация), **IN PROGRESS** (имеется часть реализации или проверки), **BLOCKED** (названная внешняя зависимость), **DONE** (все явно указанные критерии приняты). Отдельно ведём *покрытие*: код / UI / Undo-Redo / `.zpe` / PSD-PSB / реальная интеграция.
- **Наличие файла или зелёного CI не доказывает полной готовности функции.** Изучить вызывающий код, инструмент в UI, граничные случаи, совместимость. Не проставлять DONE только по этому перечню.
- Каждое изменение строки должно ссылаться на **конкретный тест / PR / commit** с точным head и, где требуется, результатом exact-main CI. Не подменять Photoshop-authored файл синтетическим.
- Не выдумывать проценты, задержки, общее потребление RAM/RSS или отсутствующие показатели. Добавлять новые строки, а не переименовывать старые, когда появляется отдельная функциональность.
- Подробный текущий шаг — [NEXT.md](NEXT.md); техническая история — [003X/6c-9](003x6c9-history-sharing-profile.md); прежние длинные журналы сохранены в [archive](archive/).

## Стратегическая карта (10 направлений)

| Этап | Направление | Статус | Проверенная опора / ограничения | Следующая приёмка |
| --- | --- | --- | --- | --- |
| 1 | Документ, типизированные слои, рендеринг, pixel-buffer, обратная совместимость | **IN PROGRESS** | [state.js](../src/core/state.js), [render.js](../src/core/render.js), [pixel-buffer.js](../src/core/pixel-buffer.js), [проектное IO](../docs/architecture/NATIVE_PROJECT_IO.md). Архитектура существует, полный единый контракт не принят. | Редактируемая структура + группы + native, `.zpe` v1/v2, Undo/Redo и file:// regression. |
| 2 | Маски, корректирующие слои и кубические Bézier | **IN PROGRESS** | [маски](../docs/architecture/LAYER_MASKS.md), [adjustments.js](../src/core/adjustments.js), [paths UI](../src/ui/paths-controller.js). Полное взаимное соответствие контуров/масок/PSD не подтверждено. | Реальная правка узлов и масок на холсте, композитинг, группировка, Undo/Redo и сериализация. |
| 3 | PSD import (текст, группы, маски, adjustments, paths, Smart Objects, native bits) | **IN PROGRESS** | [импорт](../src/document/psd-import-controller.js), [codec](../src/formats/psd.js); synthetic/real фото тесты не равны полному Photoshop-authored корпусу. | Пооперационное сравнение Adobe-файлов без скрытого flatten/loss; unsupported features явно отмечать. |
| 4 | PSD export и round-trip совместимость | **IN PROGRESS** | [экспорт](../src/document/psd-export-controller.js), [native metadata](../src/document/psd-native-metadata-plans.js). | Editable round-trip и внешняя проверка настоящего corpus, отдельные ограничения. |
| 5 | Embedded/linked Smart Objects и nested documents | **IN PROGRESS** | [lifecycle](../docs/architecture/SMART_OBJECT_LIFECYCLE.md), [controller](../src/document/smart-object-controller.js). | Трансформации, обновление preview, relink/edit/save, cross-document и PSD/PSB round-trip. |
| 6 | Tiled raster, Workers, отмена, память, большие PSD/PSB | **IN PROGRESS** | [tiled raster](../docs/architecture/TILED_RASTER.md), [003X/6c-9](003x6c9-history-sharing-profile.md); #376 merged. New Chrome 1025² dual native RGB16/CMYKA32 Float32 real UI generic vs pooled Undo/Redo/IndexedDB v2 original tile exact oracle PASS, current candidate local. Not whole-browser RAM. | Paired real Worker stale/close/cancel and changed-native bits after edit/Undo/Redo/restore, bounded memory limits; PR-head and exact-main gates. |
| 7 | PSB, 16-bit и 32-bit/HDR | **IN PROGRESS** | [pixel-buffer](../src/core/pixel-buffer.js), [PSD codec](../src/formats/psd.js), [native tests](003x6c9-history-sharing-profile.md). Синтетический Float32 oracle **не** Adobe provenance. | Настоящий Photoshop-authored PSB32 с подтверждением битов; tone-mapping и import/edit/export для заявленных типов. |
| 8 | Color Management — ICC, CMYK, wide gamut, soft-proof | **IN PROGRESS** | [color-management.js](../src/core/color-management.js), [color UI](../src/ui/color-management-controller.js); нельзя считать весь цветовой стек принятым. | Эталонные ICC/CMYK преобразования, soft proof, edge-case профили и round-trip без скрытой потери. |
| 9 | RAW decode + неразрушающая проявка | **TODO** | Отдельная end-to-end RAW pipeline реализация и её acceptance не подтверждены этой ревизией. | Поддерживаемый RAW корпус, decoder, white balance/exposure/highlights/shadows, UI, исходные данные и `.zpe`. |
| 10 | Select & Mask, Refine Edge, Content-Aware Fill/Heal, retouch | **IN PROGRESS** | [mask-controller.js](../src/selection/mask-controller.js), [inpaint.js](../src/core/inpaint.js), [retouch](../src/retouch/controller.js), [Content-Aware architecture](../docs/architecture/CONTENT_AWARE_FILL.md). | Реальные изображения, качество результата, исходные слои и alpha, отмена/Undo/Redo, mask refinement и UI. |

## Контроль отдельных возможностей со скриншота

| ID | Возможность | Статус | Какой пробел до DONE |
| --- | --- | --- | --- |
| CAP-MASK | Raster/vector Layer Masks: preview/link/invert/feather/density | IN PROGRESS | **Bounded CAP-MASK-VD DONE:** [PR #378 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/378), main `8522b22`, exact PR-head [core CI PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42353796878), [real-photo PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42353796954), exact-main [core PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42363763495), [real-photo PASS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42363763521); real Chrome alpha UI/Undo/Redo/.zpe PASS. PSD/PSB native editable density/feather, full Photoshop parity remain IN PROGRESS. |
| CAP-ADJ | Adjustment Layers: Levels/Curves/Exposure/Hue-Saturation | IN PROGRESS | **Bounded CAP-ADJ-CREATE DONE:** [PR #379 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/379), main `275be947`; exact head `56ce6c04` [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42364582039), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42364582048), 48/48 focused unit PASS, genuine Chrome file:// Layers menu, editable Master/RGB Curves, Hue/Saturation Colorize, real RGB composite, History/Undo/Redo, Ctrl+S `.zpe` reopen PASS. Exact merged-main CI separately pending. **CAP-ADJ-STACK local bounded candidate:** real Chrome file:// RED→GREEN hidden clipping base, nested pass-through/isolated group clipping alpha, Levels→channel Curves stack, raster+vector masks, actual Properties/History/Undo/Redo/.zpe saved/reopen PASS; focused Node 46/46 PASS. PR-head CI / merge / exact-main PENDING; Photoshop-authored editable PSD/PSB round-trip still unverified. [Журнал](002-adjustment-stack.md). [Журнал](002-adjustment-layer-creation.md). |
| CAP-BEZ | Полные cubic Bézier paths, anchors, handles | IN PROGRESS | **Bounded DONE:** Alt+Shift corner→smooth Shape, Vector Mask, Saved Paths: [PR #125 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/125) [main b3ff1d1](https://github.com/zeter1/ZeTer-Photo-Editor/commit/b3ff1d1449a7215274d322a2788c11c6496b0cd1), exact head da75a878 [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42351522449), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42351522536); real Chromium file:// Shape gesture + .zpe save/reopen + Undo/Redo PASS. [#126 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/126) click-to-close. Parent IN PROGRESS: Vector Mask/Saved Path direct UI E2E, editable PSD/PSB full parity. |
| CAP-PSD-IN | Layered PSD import | IN PROGRESS | Настоящий набор Photoshop-authored файлов; текст, группы, masks, blend, native/ICC. |
| CAP-PSD-OUT | Layered PSD export | IN PROGRESS | Editable PSD, внешняя проверка и import-edit-export-import. |
| CAP-PSB | Большие PSB | IN PROGRESS | Streaming/lazy больших реальных файлов; отличать поддержку формата от unrestricted размерности. |
| CAP-SO | Smart Objects embedded/linked | IN PROGRESS | Nested edit/save/relink/preview + Photoshop round-trip. |
| CAP-16 | 16-bit native | IN PROGRESS | Фактические операции без тихой 8-bit деградации и экспорт. |
| CAP-32 | 32-bit/HDR | IN PROGRESS | Tone mapping/Float32 сохранность, настоящий Adobe PSB32. |
| CAP-ICC | ICC, CMYK, soft proof, wide gamut | IN PROGRESS | Эталонное цветовое сравнение и профильные export round-trips. |
| CAP-RAW | RAW pipeline | TODO | Подтверждённая работа end-to-end от RAW декодера до проекта. |
| CAP-REFINE | Select & Mask / Refine Edge | IN PROGRESS | Edge-aware качество, feather/decontamination на реальных сложных данных. |
| CAP-INPAINT | Content-Aware Fill/Heal / PatchMatch | IN PROGRESS | [PR #375](https://github.com/zeter1/ZeTer-Photo-Editor/pull/375) merged native/RGBA8 cooperative cancellation; [PR #376](https://github.com/zeter1/ZeTer-Photo-Editor/pull/376) merged `744bcb1` accessible UI cancel (owner-safe), real Chrome Worker button mid-kernel/Undo/Redo PASS, head [core CI 12/12](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41825455853), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/41825455743). Still requires paired UI Worker stale/close, quality and native changed-bit oracle before DONE. |
| CAP-RET | Другие инструменты ретуши | IN PROGRESS | Functional visual/Undo/Redo/quality gates для инструментария. |
| CAP-COMPAT | Полная Photoshop compatibility | TODO | Открытая долгосрочная цель без утверждения о полном соответствии. |

## Текущий блокер и следующий вертикальный срез

- **CURRENT P1:** [CAP-ADJ-STACK](NEXT.md) — теперь настоящая pixel/render integration nested groups, clipping и mask composition с Undo/Redo/`.zpe`; [CAP-ADJ-CREATE #379](002-adjustment-layer-creation.md) bounded MERGED `275be947`, exact PR-head CI SUCCESS; [CAP-MASK-VD #378](002-vector-mask-density-feather.md) bounded MERGED `8522b22`, exact-main CI SUCCESS. Stage 6/003X/6c-9 отдельно IN PROGRESS.
- **Отдельный BLOCKED gate:** [002B/2c Adobe-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md). Синтетические тесты не закрывают этот gate.
- После завершения CAP-MASK-VD выбрать следующий конкретный незакрытый CAP-ADJ или Vector Mask UI gate по реальному коду; не ограничиваться профилированием.

## Условия изменения статуса

Каждая строка DONE только после реального функционального теста (если имеет UI), обратной совместимости, relevant `.zpe`, Undo/Redo и применимого PSD/PSB round-trip; привязать конкретные PR-head и exact-main результаты. Условия, заблокированные внешними файлами, остаются BLOCKED и не блокируют независимую реализацию другого этапа.