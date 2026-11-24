# 035 — поздняя recovery-modal при последовательных browser file:// reload

**Статус: ЗАКРЫТО (P1, test-only reliability, 2026-10-14).**

## Наблюдение 2026-10-14

- [PR #218 CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545340603) завершился success. Первая попытка [main CI 38545678383](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545678383) упала в `tools/browser-ui-lock-mid-kernel-smoke.mjs` (010D, real Chromium `file://`): `document.elementFromPoint` обнаружил `.recovery-modal` вместо `#overlayCanvas`, хотя импорт native PSD16 и проверки состоялись.
- Повторная попытка **того же** CI стала success. Это нестабильность сценария, а не доказанная регрессия Content-Aware Fill и не доказанное production-исправление.
- До этой проходки тест делал `Page.reload`, ожидал всего 400 мс и нажимал `[data-new-project]`, только если recovery prompt уже появился. Асинхронный IndexedDB recovery startup может показать окно **позже**, после `waitFor(!recovery-modal)` и во время PSB32/PSD16 теста.

## Следующая самостоятельная проходка

- [x] Разобраться с готовностью восстановления в `src/workspace/recovery-controller.js` и UI startup; найти детерминированное условие завершения recovery scan **до** импорта фикстуры. Не скрывать и не игнорировать настоящие recovery dialogs, не изменять production без теста.
- [x] Регрессия для двух/трёх последовательных `Page.reload` со специально задержанным recovery snapshot/IndexedDB; только через реальные modal actions, без случайного закрытия чужой сессии.
- [x] `npm run check`, реальный Chromium `file://` smoke, PR CI success, merge и green exact-main SHA; provenance сохранён ниже.
- [x] Следующая самостоятельная [036](036-browser-connected-roi-quality.md) выделена из [003](003-tiled-content-aware.md); независимый лицензированный Adobe golden остаётся P0 [002](002-psd-compatibility-corpus.md).

## Реализация 035 ([PR #219](https://github.com/zeter1/ZeTer-Photo-Editor/pull/219), merged `66f41e6`)

- Подтверждён контракт: `src/main.js` выставляет `document.documentElement.dataset.appReady='true'` **только после** `await restoreRecoveryIfAvailable()`. Это корректный барьер вместо наличия `#editorCanvas` и фиксированной задержки 400 мс.
- `tools/browser-recovery-startup.mjs`: fail-closed ожидание либо реального recovery-dialog, либо завершённого bootstrap. При modal используется только собственная кнопка `[data-new-project]`, после чего ожидается `appReady=true`. Отменяется исключительно обычное окно с `aria-label="Новый документ"`; другие модалки считаются ошибкой.
- `tools/browser-ui-lock-mid-kernel-smoke.mjs`: маркер предыдущего document context + общий startup-gate перед 010D PSD16/PSB32, чтобы поздняя recovery modal не накрывала настоящий canvas.
- `tools/browser-recovery-reload-smoke.mjs`: в настоящем Chromium `file://` в трёх `Page.reload` задерживает `IDBOpenDBRequest.onsuccess` на 550 мс (при штатном timeout 750 мс). Snapshot имеет собственный тестовый key; каждая новая страница обязана показать реальную recovery-modal, успешно пройти `New Project` и подтвердить измеренную задержку ≥500 мс. По завершении удаляется **только** созданный тестом key. Production IndexedDB не подменяется в приложении.
- `tests/browser-recovery-startup.test.mjs`: покрытие задержанного/пустого скана, чужой диалог не закрывается, ошибка bootstrap не принимается за успех.
- **Проверено:** [PR CI 38563696598](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38563696598) — success на head `c320b1f`; [PR #219](https://github.com/zeter1/ZeTer-Photo-Editor/pull/219) слит как `66f41e6db7c06b63cc90bc370c69520f2017eb0f`; [exact-code main CI 38564063538](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38564063538) — success. Node tests, generated browser parity, настоящий Chromium `file://`, operation JSON/profiles и diff hygiene зелёные. Производственный runtime и версия не менялись.

## Закрытие и дальнейшая очередь

- [x] `npm run check`, `test:browser` в GitHub Actions, PR CI и exact-code main CI — success (ссылки выше).
- [x] Публичные recovery-dialog actions и delayed IndexedDB подтверждены тремя Chromium reload в едином browser smoke.
- [x] Provenance прежнего сбоя: [main CI 38545678383 attempt 1/2](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545678383) — первая попытка провалилась из-за позднего recovery dialog, retry прошёл. Новый head `66f41e6` подтверждён **отдельным** зелёным CI, а не старым retry.
- [ ] Следующая [036](036-browser-connected-roi-quality.md): браузерный большой connected ROI с native quality/latency/RSS. Общие [003](003-tiled-content-aware.md) и [002](002-psd-compatibility-corpus.md) открыты.

**Ограничение:** исправлена гонка **тестовой подготовки**, не изменена production-модель восстановления и не доказана полная Photoshop-совместимость.
