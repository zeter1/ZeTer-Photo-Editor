> **010C — код завершён и слит:** [PR #192](https://github.com/zeter1/ZeTer-Photo-Editor/pull/192), squash `1b504b836ae3bbe28da89080ffa6877be09a2047`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38146702722). Подробности: [012](012-dense-strip-segment-roi.md). [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38146836584) на `46ceafe9fb578af6f285e7ced1e60cfdda747670`; последующие docs-only commits проверяются отдельно; 010D и Stage 003 остаются открытыми.

> **010C (в процессе).** [012](012-dense-strip-segment-roi.md) — добавлен fallback на ограниченные полосы/горизонтальные сегменты для плотных разнесённых выделений, где прежний tile-fragment суммарный ROI budget не проходил. Exact native RGB16/Float32 CMYKA sync/cooperative/Worker regression, atomic failure/cancel. **PR CI + merge + точный main SHA ещё не подтверждены; пункт 010 и Stage 003 не закрыты.** Далее 010D — browser UI lock/session revocation + memory telemetry.

> **010B — браузерная проверка настоящей отмены ядра (слито, PR CI success).** [011](011-browser-mid-kernel-cancellation.md): Chromium file:// и настоящий производственный Worker-controller; тестовое наблюдение после native pixel write, прямой cancel и owner polling во время CPU-bound kernel, успешный новый job. Инструментирование не меняет generated/production код. 010B не закрывает 010C dense ROI и Stage 003 в целом. [PR #191](https://github.com/zeter1/ZeTer-Photo-Editor/pull/191) слит (`e77d65b02fae0e72a6e1e1ad3e3277a1a44f809b`), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38145352146). Отдельно требуется exact-main CI для итогового SHA.

> **010A — проверка настоящей mid-kernel cancellation (слито, CI success).** Добавлены `tests/tiled-inpaint-mid-kernel-cancel.test.mjs` и `tests/fixtures/tiled-inpaint-kernel-probe-worker.mjs`: ядро `inpaintSelectedSamples` исполняется в настоящем Node Worker; SharedArrayBuffer используется **только в тестовом harness** как наблюдатель изменения первого пикселя. После фактического начала заполнения test вызывает `terminate()` (явно и через exact-owner poll), проверяет, что глубокий пиксель не заполняется, ответ не принят и последующий job выполняется. **Это ещё не browser file:// telemetry, не real browser cancellation и не dense ROI planner; Stage 003 открыта.** **Готово в main:** [PR #190](https://github.com/zeter1/ZeTer-Photo-Editor/pull/190), squash [`61dcd260`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/61dcd260973284a8c440361846d9b3747017037c); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38144346522), [точный main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38144433426). **Закрыт только 010A.** Dense grouping и Chromium stress всё ещё нужны.

# 010 — Stage 003 P1: bounded dense ROI / real mid-kernel Worker cancellation

**Статус:** следующая незавершённая инженерная проходка после завершённой [009](009-large-psb32-worker-cancellation.md). Этапы 002 и 003 целиком открыты.

## Почему это следующий шаг

009 доказала настоящий большой PSB32 → Chromium file:// → native v2 Worker → preview/Undo/Redo и отмену **ожидающего ответа**. Текущий алгоритм может безопасно отказать на широком плотном connected ROI (в отличие от разреженных >256 tile cells), а отмена CPU-bound вычисления браузерного Worker всё ещё не проверена.

## Техническая цель

Добавить bounded strip/segment/group planner для плотных/широких connected selections, без аллокации огромного общего bounding box и без нарушения глобального frozen donor exclusion. Отдельно подтвердить отмену во время реально работающего kernel до reply.

## Контракт приёмки

- [ ] Разделить плотное связное выделение на детерминированные небольшие native ROI с halo; не запускать на полнослойном ROI без бюджета. Сохранять пересечения и корректный donor exclusion для **всего исходного выделения**, не подмешивать уже изменённые пиксели как доноров.
- [ ] Перед вычислением проверять aggregate ROI area, max source bytes (48 MiB), max fill pixels и worst-case fragmentation. При превышении безопасный no-op/no-history; никаких частичных dirty tile publications.
- [ ] Полный oracle на RGB16 и Float32 CMYKA: sync/Node Worker/cooperative byte parity для выбранных пикселей, идентичные нетронутые native tiles; проверить семантику overlap и крайние тайлы.
- [ ] Cancel checkpoints в scan/read/kernel/write/serialize плюс реальная `worker.terminate()` **внутри CPU-bound работы** (не просто задержка postMessage/reply). Подтвердить нулевую публикацию и одну активную работу без zombie Worker.
- [ ] Браузерный `file://` стресс-сценарий c UI owner/session/lock revocation, telemetry по этапам и информационным JS-heap + Chromium-process samples; НЕ приравнивать sampled max к peak RSS и проверить закрытие браузерных sampler intervals в finally.
- [ ] Фиксировать ограничения: content-aware quality и Adobe PSD/PSB cross-app parity остаются отдельными задачами Stage 002/003.
- [ ] `npm run check`, `npm run test:browser`, generated artifacts parity, `git diff --check`, PR CI, merge и exact-main CI; документировать реальный SHA/results в этой задаче и NEXT.

## Где изменять

- `src/core/pixel-buffer.js`: только native read/write source/working set primitives.
- `src/core/tiled-inpaint-worker-protocol.js`: shared native ROI planner/worker kernel protocol.
- `src/core/tiled-inpaint-worker-client.js`: только lifecycle; source-owner guard в `src/painting/controller.js`.
- `src/core/inpaint.js`: общая deterministic fill kernel / donor semantics.
- `src/painting/tiled-inpaint-dispatch.js`: bounded frozen selection -> Worker/fallback.
- `tests/tiled-inpaint-connected-roi.test.mjs`, `tests/tiled-inpaint-many-tiles.test.mjs`, `tests/tiled-inpaint-worker-client.test.mjs`, `tools/browser-smoke.mjs`: регрессии.

## Отдельные незакрытые направления

- [002](002-psd-compatibility-corpus.md): независимые Photoshop-authored RGB/CMYK PSD16/PSB32, подтверждённая лицензия, origin/URL/SHA-256, cross-app golden.
- Настоящий browser/Worker GPU/native RSS peak, RAW/DNG, ICC CMYK soft-proof reference, Adobe Smart Object metadata compatibility.
