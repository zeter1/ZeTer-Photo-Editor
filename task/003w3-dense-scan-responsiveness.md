# 003W/3 — Comparative real near-cap selection-freeze responsiveness

**Priority:** P1. **Status:** IN PROGRESS. **Parent:** [003W](003w-browser-selection-freeze-responsiveness.md), Stage 003/Stage 6.
**Dependency:** [003W/2b-2i](003w2b2i-failed-import-worker-completion.md) DONE with PR #319 and verified exact-main CI.

## Goal

Reconcile the currently successful near-2M genuine Chromium native Worker outcomes with the still-open requirement to *measure and, only if needed, improve* main-thread UI selection freeze responsiveness. Avoid further ownership-only permutations until measurable latency gaps and causal attribution are understood.

## Acceptance criteria

1. Fresh, independent Chromium `file://` ZeTer-authored PSD16 and PSB32 actual public-UI runs on 1450×1400 native tiled documents: 1,973,400 selected dense indices, sparse selection, and refusal of >2,000,000 selected indices. Preserve source/preview/History and exact native Undo/Redo, alpha and untouched byte invariants.
2. Identify actual production selection-freeze begin/end and `Worker.postMessage` boundaries using monotonic timestamps. Separate selection counting/freezing, UI command handoff, actual Worker execution and publication where instrumentation permits; do **not** label wall time as CPU time. Record timer interval drift, sampling gaps, truncation and uncertainty.
3. Compare multiple runs per format to prior [003W/1](003w-browser-selection-freeze-responsiveness.md) observational baseline and [003W/2b-2b](003w2b2b-dense-worker-success.md) real dense Worker timings. Never compare different selection sizes as though equivalent, or claim an unobserved RSS peak or Worker→PID mapping.
4. If a reproducible UI main-thread bottleneck is established, make a targeted bounded production optimization preserving 2M cap, cancellation/no stale Worker publication, native 16/32-bit accuracy, `file://` startup and Undo/Redo. If not, document measured non-need for optimization and remaining instrumentation limitations.
5. Add strict independent PSD16/PSB32 receipts and negative tests for missing timing boundary, fake near-cap count, impossible chronology, unmeasured peaks or invalid sample gaps. Complete Node and genuine-browser PR CI, merge, and exact-main verification; only mark DONE with observed evidence.

## Open constraints

P0 independently Photoshop-authored PSB32 [002B/2c](002b2c-photoshop-psb32-provenance.md) remains BLOCKED. [003T](003t-operation-memory-evidence.md) operation-specific RSS/CPU peak and verified Worker→OS PID mapping remain OPEN. Do not infer these from renderer heap/timer observations.

## 2026-10-22 — Промежуточная проходка: измерительные границы UI-сканирования

- **Приоритет:** P1. **Зависимости:** 003W/2b-2i DONE, 003W/3 IN PROGRESS.
- **Реализовано:** opt-in монотонные production-точки `selection-start`, `selection-end`, `worker-run-start` и существующий реальный `Worker.postMessage` через Chromium observer. Observer доступен после старта браузерного редактора и не влияет на расчёты даже при ошибке наблюдателя.
- **Код:** `src/painting/tiled-inpaint-dispatch.js`, `src/painting/controller.js`, `tools/browser-selection-freeze-observer.mjs`, `tests/browser-selection-freeze-observer.test.mjs`, `tests/tiled-inpaint-phase-timing.test.mjs`, generated `src/app.bundle.js`, `index.html`, `version.json`.
- **Тесты:** добавлены Node RGB16/RGB32 timing/cancel/over-cap/observer-failure unit и независимый strict phase-receipt validator с отрицательными проверками. Локальный `npm run check` и Chromium в этой среде не запускались (GitHub-only checkout); PR CI ещё ожидается.
- **CI/PR:** проверка точного PR-head, реальных браузерных PSD16/PSB32 receipt и exact-main после merge ожидается; до подтверждения ни один этап не отмечать DONE.
- **Новые ограничения:** точные monotonic wall-time границы сканирования не означают CPU-время; timer pulses sampling не является полной трассой. RSS пик операции, Worker→PID и независимая Photoshop-authored PSB32 provenance неизвестны.
- **Осталось:** подключить `phaseSnapshot()` к фактическому multi-run near-cap PSD16/PSB32 `file://` dense/sparse/over-cap сценарию, сохранить отдельные проверенные JSON receipts, сопоставить с 003W/1 и 003W/2b-2b на равных размерах, исправлять код только при измеренном bottleneck, получить PR-head и exact-main CI.
- **Следующая задача:** **003W/3b**, P1, внутри незавершённой **003W/3** — многоразовые браузерные измерения, отрицательные JSON-критерии и регрессии точных native/History после Worker; критерии завершения 1–5 выше ещё открыты.
