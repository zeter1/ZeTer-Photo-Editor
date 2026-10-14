# 029 / 024C4 — Проверяемый порядок событий Chromium PSD16/PSB32

**Статус (2026-10-14):** реализация отправлена в PR; до green PR CI, merge и green exact-code main CI проходка считается открытой.

## Проблема

Отчёт native Content-Aware Worker содержал нужные имена событий, но не требовал их строгой последовательности. JSON с recovery до проверки исходных байтов мог быть принят как подтверждение атомарной отмены; значения atMs и sincePreviousMs тоже могли противоречить друг другу.

## Проходка 029: критерии

- [x] Один pure validator успешного Chromium `file://` сценария: input→preview→native source→selection→Fill→History→Undo→Redo.
- [x] При отмене дополнительно: cancel invocation→наблюдаемый native kernel write→owner revoked→неизменность байтов→retry invoked→History→native Undo→native Redo; запрещён неверный порядок, даже если все имена присутствуют.
- [x] Проверяем конечные неотрицательные/неубывающие atMs, согласованные sincePreviousMs, observedWindowMs и уникальность имен; небольшой допуск только к ошибке вычитания double.
- [x] Общий контракт в timeline.finish и buildBrowserOperationArtifact; CI verifier повторно проверяет сохранённый JSON, а не доверяет только набору названий.
- [x] Regression tests: chronology swap, duplicate, wrong delta, time past finish, absent final redo, поддельный JSON.
- [ ] GitHub gate: Node/npm run check, настоящий Chromium `file://` PSD16 и PSB32 mid-kernel→retry, JSON artifacts, PR CI success, merge, exact-main SHA CI success.

## Ограничения и дальнейшие задачи

Это валидация **последовательности наблюдений harness**, не независимое доказательство Adobe byte/render compatibility или Worker→PID. RSS / HWM — sampled/process-lifetime, не true peak. Production-функциональность редактора этой проходкой не меняется, поэтому version bump не нужен.

**P0:** [002](002-psd-compatibility-corpus.md) — лицензированные независимо Adobe Photoshop-authored RGB16 PSD / CMYK32 PSB с SHA-256, источниками и reference renders. Не подменять синтетикой.

**P1:** [025](025-browser-worker-target-census.md) — проверяемая документацией Chromium target→PID привязка либо `unknown`; [003](003-tiled-content-aware.md) — quality/performance больших связных ROI в реальном Chromium и внешние oracle.
