# 030 / 024C5 — Итоговые длительности Chromium подтверждаются milestone

**Статус (2026-10-14):** **слито в `main`**, [PR #214](https://github.com/zeter1/ZeTer-Photo-Editor/pull/214) → squash `98ea308`. [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38531032892) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38531246576): Node, generated parity, Chromium `file://` PSD16/PSB32, проверка JSON/profiles, diff hygiene — success. Закрыта **только проходка 030**; Stage 002/003 открыты.

## Выявленный пробел

После 029 сохранялся machine-readable хронологический список `atMs` / `sincePreviousMs`, но сводные `durationsMs` не проходили независимый пересчёт при чтении JSON. Файл с честными milestone и подменённым `cancelledRetryObservation` мог пройти проверку. Это компрометирует только достоверность тестовых отчётов, не production Content-Aware алгоритм.

## Узкая реализация / контракт

- [x] Один набор пяти канонических пар событий для `importInputToPreview`, `fillCommandToHistoryPreview`, `undoToRedo`, `cancelledRetryObservation`, `recoveredRetryToRedo`.
- [x] `validateBrowserOperationEvidence` отклоняет отсутствующие/лишние ключи, `NaN`, `Infinity`, отрицательные, выходящие за `observedWindowMs`, нечисловые и несовпадающие с `end.atMs - start.atMs` значения. Отсутствие пары означает **строго** `null`, а присутствующая пара допускает нулевую длительность.
- [x] Валидатор используется в `timeline.finish`, `buildBrowserOperationArtifact` и финальной проверке сохранённых CI JSON — нельзя обойти через сериализацию.
- [x] Тесты на подменённый итог отмены, удалённые поля, лишний ключ, неверные типы, `null` при существующих событиях и синтетический таймлайн с нулевой длительностью. Малый допуск `1e-6 ms` только на погрешность double.
- [x] `npm run check`, generated parity, реальный Chromium `file://` PSD16/PSB32, оба JSON artifact и CI verifier: PR CI success (ссылка выше).
- [x] PR слит squash `98ea308`; CI точного `main` SHA success (ссылка выше).

## Границы и следующие проходки

Это проверка **согласованности сведений test harness**, а не независимое измерение времени ядра Worker, реальное подтверждение target→PID или точный RAM peak. Код приложения/версия не менялись.

1. **P0 — [002](002-psd-compatibility-corpus.md):** доказуемо лицензированные, независимо Photoshop-authored PSD16 RGB и PSB32 CMYK Float32 с `sha256`, provenance/source/license и reference renders. Нельзя приписывать авторство Photoshop синтетике ZeTer.
2. **P1 — [025B](025-browser-worker-target-census.md):** документированный CDP способ `targetId→PID` с тестовым доказательством либо оставить `workerPidMapping:'unknown'`; не применять time-based heuristic.
3. **P1 — [003](003-tiled-content-aware.md):** качество и wall-clock latency на широких connected ROI и независимых high-depth goldens; browser `file://` worker cancellation/retry, sampled RSS/HWM, atomic native Undo/Redo без ложного true-peak утверждения.
4. **P2:** внешние round-trip орacles для Photoshop groups, masks, blend, adjustments, text со списком известных несовпадений.
