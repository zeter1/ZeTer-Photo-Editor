# 035 — поздняя recovery-modal при последовательных browser file:// reload

**Статус: ОТКРЫТО (P1, test-only reliability).**

## Наблюдение 2026-10-14

- [PR #218 CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545340603) завершился success. Первая попытка [main CI 38545678383](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545678383) упала в `tools/browser-ui-lock-mid-kernel-smoke.mjs` (010D, real Chromium `file://`): `document.elementFromPoint` обнаружил `.recovery-modal` вместо `#overlayCanvas`, хотя импорт native PSD16 и проверки состоялись.
- Повторная попытка **того же** CI стала success. Это нестабильность сценария, а не доказанная регрессия Content-Aware Fill и не доказанное production-исправление.
- Тест сейчас делает `Page.reload`, ожидает всего 400 мс и нажимает `[data-new-project]`, только если recovery prompt уже появился. Асинхронный IndexedDB recovery startup может показать окно **позже**, после `waitFor(!recovery-modal)` и во время PSB32/PSD16 теста.

## Следующая самостоятельная проходка

- [ ] Разобраться с готовностью восстановления в `src/workspace/recovery-controller.js` и UI startup; найти детерминированное условие завершения recovery scan **до** импорта фикстуры. Не скрывать и не игнорировать настоящие recovery dialogs, не изменять production без теста.
- [ ] Регрессия для двух/трёх последовательных `Page.reload` со специально задержанным recovery snapshot/IndexedDB; только через реальные modal actions, без случайного закрытия чужой сессии.
- [ ] `npm run check`, реальный Chromium `file://` smoke, PR CI success, merge и green exact-main SHA; отдельно сохранить provenance логов для наблюдавшегося сбоя.
- [ ] После этого — [003](003-tiled-content-aware.md) браузерный большой connected ROI + честные latency/RSS measurements, [002](002-psd-compatibility-corpus.md) лицензированный внешний Adobe golden.

Не путать retry успех с исправленной гонкой: её причина ещё должна быть подтверждена.
