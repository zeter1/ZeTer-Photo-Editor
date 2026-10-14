# 035 — поздняя recovery-modal при последовательных browser file:// reload

**Статус: В РАБОТЕ (P1, тестовый reliability gate; PR/CI до завершения не закрывать).**

## Наблюдение 2026-10-14

- [PR #218 CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545340603) завершился success. Первая попытка [main CI 38545678383](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545678383) упала в `tools/browser-ui-lock-mid-kernel-smoke.mjs` (010D, real Chromium `file://`): `document.elementFromPoint` обнаружил `.recovery-modal` вместо `#overlayCanvas`, хотя импорт native PSD16 и проверки состоялись.
- Повторная попытка **того же** CI стала success. Это нестабильность сценария, а не доказанная регрессия Content-Aware Fill и не доказанное production-исправление.
- До этой проходки тест делал `Page.reload`, ожидал всего 400 мс и нажимал `[data-new-project]`, только если recovery prompt уже появился. Асинхронный IndexedDB recovery startup может показать окно **позже**, после `waitFor(!recovery-modal)` и во время PSB32/PSD16 теста.

## Следующая самостоятельная проходка

- [x] Разобраться с готовностью восстановления в `src/workspace/recovery-controller.js` и UI startup; найти детерминированное условие завершения recovery scan **до** импорта фикстуры. Не скрывать и не игнорировать настоящие recovery dialogs, не изменять production без теста.
- [x] Регрессия для двух/трёх последовательных `Page.reload` со специально задержанным recovery snapshot/IndexedDB; только через реальные modal actions, без случайного закрытия чужой сессии.
- [ ] `npm run check`, реальный Chromium `file://` smoke, PR CI success, merge и green exact-main SHA; отдельно сохранить provenance логов для наблюдавшегося сбоя.
- [ ] После этого — [003](003-tiled-content-aware.md) браузерный большой connected ROI + честные latency/RSS measurements, [002](002-psd-compatibility-corpus.md) лицензированный внешний Adobe golden.

## Реализация 035 (ветка `fix/035-browser-recovery-startup-gate`)

- Подтверждён контракт: `src/main.js` выставляет `document.documentElement.dataset.appReady='true'` **только после** `await restoreRecoveryIfAvailable()`. Это корректный барьер вместо наличия `#editorCanvas` и фиксированной задержки 400 мс.
- `tools/browser-recovery-startup.mjs`: fail-closed ожидание либо реального recovery-dialog, либо завершённого bootstrap. При modal используется только собственная кнопка `[data-new-project]`, после чего ожидается `appReady=true`. Отменяется исключительно обычное окно с `aria-label="Новый документ"`; другие модалки считаются ошибкой.
- `tools/browser-ui-lock-mid-kernel-smoke.mjs`: маркер предыдущего document context + общий startup-gate перед 010D PSD16/PSB32, чтобы поздняя recovery modal не накрывала настоящий canvas.
- `tools/browser-recovery-reload-smoke.mjs`: в настоящем Chromium `file://` в трёх `Page.reload` задерживает `IDBOpenDBRequest.onsuccess` на 550 мс (при штатном timeout 750 мс). Snapshot имеет собственный тестовый key; каждая новая страница обязана показать реальную recovery-modal, успешно пройти `New Project` и подтвердить измеренную задержку ≥500 мс. По завершении удаляется **только** созданный тестом key. Production IndexedDB не подменяется в приложении.
- `tests/browser-recovery-startup.test.mjs`: покрытие задержанного/пустого скана, чужой диалог не закрывается, ошибка bootstrap не принимается за успех.
- Проверки/PR CI/merge пока **не заявлены как успешные** до получения результатов.

## Гейты до закрытия

- [ ] `npm run check` и реальный Chromium `file://` smoke проходят на PR SHA; проверить JSON и отсутствие ложных ошибок.
- [ ] PR CI success, merge и затем отдельный exact-main green SHA; задокументировать URL/log provenance.
- [ ] Продолжить [003](003-tiled-content-aware.md) настоящий браузерный connected ROI с quality, latency и наблюдаемой RSS (не peak RAM); [002](002-psd-compatibility-corpus.md) независимый лицензированный Adobe golden.

Не путать успешный retry предыдущего CI с исправленной гонкой. До зелёного регрессионного CI 035 остаётся открытой.
