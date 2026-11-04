# 010B — Chromium file:// native Worker mid-kernel cancellation

**Статус:** код слит в `main`: [PR #191](https://github.com/zeter1/ZeTer-Photo-Editor/pull/191), squash `e77d65b02fae0e72a6e1e1ad3e3277a1a44f809b`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38145352146). Итоговый exact-main CI проверяется отдельно. Продолжение [010](010-dense-roi-worker-mid-kernel-cancel.md), не закрывает целиком Stage 003.

## Что добавлено

- Инструмент tools/browser-inpaint-mid-kernel-smoke.mjs: реальный Chromium file:// сценарий с производственным browser Worker controller и generated classic Worker supplier. Только в **изолированном тестовом Blob** точка наблюдения вставляется **после** трёх операций записи пикселя и увеличения счётчика native inpaintSelectedSamplesSteps. При первом фактическом изменённом 16-bit пикселе тестовый Worker переходит в ограниченный CPU spin (6 с), чтобы отличить mid-kernel termination от ранее доказанной post-reply cancellation. Тестовый код не меняет production bundle, инжекция fail-closed при изменении якоря.
- tools/browser-smoke.mjs: browser smoke gate после production Worker-controller: (1) явный cancel **после** kernel write, (2) отзыв isCurrent/owner во время CPU-bound ядра с настоящим polling, (3) успешный следующий RGB16 job. Ровно три Worker instances/terminations и только один успешный reply; исходные native байты immutable, descriptor supplier восстанавливается в finally.
- tests/browser-inpaint-mid-kernel-smoke.test.mjs: unit guard якоря, fail-closed для дубликата/дрейфа, гарантия, что instrumentation есть только в тестовой копии.
- В браузере нет зависимости от SharedArrayBuffer и test hooks в production редакторе; регрессия не является замером истинного browser peak RSS или cross-app Photoshop parity.

## Команды/gates

- [x] npm run check — Node suite + build generated artifacts.
- [x] npm run test:browser — Chromium file:// с marker реального kernel write, двумя отменами и успешным новым job.
- [x] node tools/build-tiled-inpaint-worker.mjs --check / generated parity.
- [x] PR #191 CI success и squash merge в main.
- [ ] exact-main CI success на итоговом документационном SHA (проверить после записи этих статусов).

## После 010B: следующие незавершённые проходки

1. **010C: bounded dense/connected ROI segment + strip planner** с global frozen donor exclusion, aggregate ROI cap и maxFillPixels/48 MiB ceilings. Per-tile fallback сейчас на некоторых плотных/сложных выделениях требует слишком много halo-пикселей. RGB16 + Float32 CMYKA sync/Worker/cooperative byte oracle и cancellation каждого этапа.
2. Browser UI owner/session/lock revocation **с настоящим документом и изменением lock** во время kernel и samples процессной памяти. 010B проверяет реальный Chromium Worker-контроллер, но не изменение состояния UI.
3. Stage 002 P0: лицензированные **независимо Adobe Photoshop-authored** RGB/CMYK PSD16/PSB32 + render references и SHA-256. ZeTer-generated fixture не подменяет внешний oracle.
4. Измерения JS-heap и Chromium process memory на нескольких больших PSD/PSB; различать sampled maximum и true peak RSS.
