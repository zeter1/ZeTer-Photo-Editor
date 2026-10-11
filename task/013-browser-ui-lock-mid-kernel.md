# 010D — реальная UI-отмена native Worker после первой записи ядра

**Статус:** **010D-A завершена и слита в main**: [PR #193](https://github.com/zeter1/ZeTer-Photo-Editor/pull/193), squash `3b7e684ddeb50fdf60354efc4e0fc871b6fe5f45`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38147932831), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38148022098). Смена активного документа/session mid-kernel — **отдельная оставшаяся 010D-B**. Stage 003/002 в целом не завершены.

## Предпосылки и отличие от 010B/009

- 009: большой PSB32, реальная команда UI, но ответ Worker удерживался **после** вычисления.
- 010B: отмена после native pixel write во время CPU-bound ядра, но controller/synthetic fixture без живого редакторского документа.
- **010D:** заново загружаем production `file://` UI, через настоящий `#fileInput` импортируем ZeTer-generated 1025×1025 **PSD16** (>8 MiB, tiled v2), формируем marquee через CDP pointer events, запускаем **Edit → Контент-заливка выделения**. Только в изолированном браузерном тесте подменяем supplier на инструментированную копию исходного generated classic Worker; production bundle/source не меняются.
- Test-only probe срабатывает строго **после первой реальной записи native ядра** и запускает bounded 6s CPU stall. После probe нажатие настоящего `.layer-lock` должно отозвать право публикации, polling остановить CPU-bound Worker, сохранить исходный preview/native 16-bit sample и не добавить History. После Unlock — новая UI-команда должна реально завершиться, обновить preview/native sample и опубликовать ровно одну History запись.
- Browser CDP `Performance.getMetrics` + опциональная агрегированная `SystemInfo.getProcessInfo/privateMemory`: sample maximum **не** истинный Worker RSS/peak и не bound на native/VRAM. Не сравнивать с лицензированным Photoshop.

## Изменения

- `tools/browser-ui-lock-mid-kernel-smoke.mjs` — отдельная процедура настоящего UI / PSD16 file:// теста, использует документ/слой без доступа к приватному состоянию приложения; сохранённый `.zpe` — оракул native samples.
- `tools/browser-smoke.mjs` — запускает её **в конце** существующих сценариев после reload страницы, когда lazy app Worker controller ещё не закэшировал supplier, и до завершения browser test process.
- `tools/browser-inpaint-mid-kernel-smoke.mjs` — переиспользуется существующий строго привязанный инструментатор 010B; изменяется лишь его тестовая in-memory копия.
- Внедрение не должно менять `src/app.bundle.js`, `src/core/tiled-inpaint-worker-source.js` и прочие generated production artifacts.

## Acceptance gates

- [x] Написан тестовый file:// UI сценарий для lock-after-first-kernel-write → real terminate → unchanged native/history → unlock/successor.
- [x] Внедрение ограничено isolated in-memory supplier и финальной reload-фазой smoke.
- [x] `npm run check`, `npm run test:browser`, generated parity, profiles и diff hygiene — PR #193 CI success.
- [x] PR #193 squash-merged, exact-main CI success (merge SHA выше).
- [ ] Вторая часть 010D: активная document/session switch **во время** настоящего CPU-bound Worker с проверкой обеих вкладок и stale target rejection.
- [ ] Две большие глубины PSD16 **и** PSB32, sampled Worker/process memory на повторных итерациях, latency variability и настоящие peak/limits — отдельные acceptance gates.

## Следующая проходка

1. 010D-B: session switch/new document mid-kernel (actual UI tab), stale owner cancel + next-job recovery; желательно на PSB32.
2. 010E: complex dense ROI planning: horizontal runs/connected segments, aggregate caps, independent byte profiles.
3. P0 Stage 002: независимо Adobe Photoshop-authored и распространяемые RGB/CMYK PSD16/PSB32 + лицензия, SHA-256, external render references.
4. Реальный memory HWM/pressure, repeated large-file Undo/Redo и cross-app/pixel parity; затем остальные пункты [NEXT](NEXT.md).
