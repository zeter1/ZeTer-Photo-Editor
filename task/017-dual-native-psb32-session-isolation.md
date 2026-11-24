# 017 / 010D-D — две независимые native PSB32 вкладки: Worker, отмена и Undo/Redo

**Статус: реализовано и слито в `main` (2026-10-11).** [PR #198](https://github.com/zeter1/ZeTer-Photo-Editor/pull/198), squash `24d0edb7`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38152587196), [CI кодового main SHA success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38152760057). Продолжение [016](016-psb32-mid-kernel-undo-redo.md) в рамках Stage 003. Главная очередь: [NEXT](NEXT.md).

## Зачем

010D-C проверила PSB32 Float32 1025² и отмену в реальном ядре, но вторая вкладка оставалась обычным 1200×800 документом. Так невозможно доказать точную независимость **двух** native tiled high-depth payloads при отмене, публикации другого Worker job и отдельном Undo/Redo.

## Scope этой проходки

- [x] Добавлен отдельный ZeTer-generated PSB32 Float32 1025² `rgb32psblarge-alt` с *другими* exact Float32 donor/defect bit words и другим именем.
- [x] Browser smoke расширен опцией `secondNativeFixtureKey`; только пара `rgb32psblarge` + `rgb32psblarge-alt`, чтобы избежать ложной двойной проверки одинакового файла.
- [x] Вторая вкладка загружает свою PSB32 через публичный `#fileInput`; first doc не подменяется и сохраняет неизменные tile words.
- [x] Первый Worker пишет настоящий native sample, после чего UI переключается на вторую native-вкладку и отзывает старый job **до завершения ядра**.
- [x] Вторая вкладка запускает свой Worker Fill, проверяет изменённые только внутри выделения native words / неизменные donor, Undo/Redo точными little-endian словами и свою History.
- [x] Повторное переключение в первую native-вкладку и её успешный новый Worker, Undo/Redo проверяются независимо, затем bytes/history второй вкладки должны совпасть с сохранённым oracle.
- [x] Node regression генератора fixtures и реальный Chromium `file://` smoke wired.
- [x] `npm run check` (1164 Node-тестов), generated parity, Chromium `file://` browser smoke, profiles и diff hygiene — **PR CI success** (run 38152587196).
- [x] PR #198 слит в `main` (`24d0edb7`); **CI именно на кодовом merge SHA success** (run 38152760057).

## Приёмочные критерии

- Оба документа остаются разными native PSB32 Float32 1025² / v2 (>8 MiB) с разными исходными sample bits.
- Cancel первого Worker: History и bytes **обеих** вкладок не получают чужой publication.
- Второй Worker и Undo/Redo: только вторая вкладка меняется; exact 32-bit words и layer topology возвращаются и снова воспроизводятся.
- Последующий Worker + Undo/Redo первой вкладки: не изменяют второй документ.
- Любая ошибочная публикация в чужой документ, чтение приватного singleton вместо публичного Save Project и подмена Photoshop-authored fixture синтетикой — FAIL.
- Memory snapshots — только sampled renderer/process, не доказанный browser peak RSS.

## Ограничения и следующая работа

Это **ZeTer-generated transport/isolation regression**, не внешние Adobe Photoshop reference files. Здесь два последовательно запускаемых Worker jobs с проверкой active-tab revocation и отдельных lease; полноценное одновременное редактирование двух вкладок UI намеренно не поддерживает. Для Stage 002 и 003 остаются:

1. **P0 / 002:** независимо Adobe Photoshop-authored лицензированные RGB16/CMYK32 PSD/PSB, provenance, SHA256, reference compositing pixel parity.
2. **P1 / 010E:** bounded complex dense/connected ROI с worst-case performance, precision parity и cancellation.
3. **P1:** реальный browser Worker/process high-water mark и memory methodology; CDP snapshots не пиковая RSS.
4. **P2+**: CMYK ICC/color/RAW reference pipeline и качество Refine/Content-Aware.

## Проверка завершения и handoff

- В merged PR изменены только `tests/`, `tools/`, `task/`; production source / generated bundle / версия не менялись.
- Merge, PR CI и exact-code-main CI проверены по указанным ссылкам; последующая docs-only актуализация статуса проходит свой push CI отдельно.
- Stage 002 и Stage 003 не закрыты: следующая исполнимая P1 — 010E complex/dense connected ROI, параллельно P0 независимый лицензированный Adobe Photoshop-authored corpus.
