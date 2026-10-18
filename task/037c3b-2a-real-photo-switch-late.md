# 037C-3b-2a — real-photo Chromium tab-switch cancellation and late reply

**Приоритет:** P1. **Статус: ЗАКРЫТА (2026-10-18)** — [PR #251](https://github.com/zeter1/ZeTer-Photo-Editor/pull/251) → [main 1d4d376](https://github.com/zeter1/ZeTer-Photo-Editor/commit/1d4d37664905f7bd3d25523d18d7c251e11fb4fb). [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39111656278), [PR photo CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39111656280), [exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39111881316), [exact-main photo CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39111881348) — все success. **2/2 реальные photo-derived PSD16/PSB32 file:// Chromium-сессии** прошли новый failure gate. Полные 037C-3b и 037C остаются OPEN.

## Проблема

После 037C-3b-1 максимальный срок жизни browser Worker ограничен, но доказательство на *настоящих* pinned photo-derived PSD16/PSB32, что смена активной вкладки не публикует старые native tiles или History, отсутствовало.

## Контракт узкой проходки 037C-3b-2a

- [x] Отдельный opt-in `ZPE_REAL_PHOTO_BROWSER_FAILURE=1` в `tools/browser-smoke.mjs`, без изменения production Worker/bundle. Не смешивать с режимом успешного Worker Fill.
- [x] Через обычный file input импортировать точные ранее проверенные PSD16/PSB32. Проверить исходные freeze-пины по `reviewed-manifest.json` / `reviewed-native-artifacts.json`, а не по Canvas8.
- [x] Две независимые Chromium `file://` сессии (одна на формат): реальный Worker проходит handshake и получает native задачу на `postMessage`, `Uint32Array` ROI совпадает со всеми 8288 ожидаемыми пикселями.
- [x] Тестовый page-side seam удерживает отправку задания **до старта ядра**. На публичном переключении вкладки проверяет `terminate()`; затем инъецирует *синтетический* поздний `MessageEvent` после отмены и проверяет, что он игнорируется.
- [x] Публичный File → Save Project до и после отмены, побайтовое сравнение всех `highDepthSource.tiles`, топологии, метаданных, исходной и чужой History.
- [x] JSON receipt с форматными pinned SHA, явными no-publication flags, `actualMidKernelCancellationVerified:false` и `memoryCapVerified:false`. Отдельная fail-closed проверка двух файлов и негативные unit-tests.
- [x] Новый отдельный photo CI шаг и artifact upload, без коллизий с 037C-1/2/3a receipt именами.
- [x] Проверить на PR: `npm run check`, `npm run test:browser`, отдельно real-photo workflow (два самостоятельных Chromium).
- [x] После green PR CI слить [PR #251](https://github.com/zeter1/ZeTer-Photo-Editor/pull/251) и проверить exact-main CI, обновить `task/NEXT.md`.

## Честная граница

Этот этап доказывает **смену вкладки и поздний поддельный сигнал в реальном браузере после получения задания реальным Worker**, но **не** доказательство отмены внутри запущенного настоящего фото-kernel. Работа Worker останавливается тестовым intercept *перед* `postMessage`. Приёмка настоящей mid-kernel cancellation, document close, явной пользовательской отмены и независимых session-generation races переносится в 037C-3b-2b.

## Следующее

- [ ] **037C-3b-2b:** настоящая CC0-photo PSD16/PSB32 mid-kernel cancel / close / stale-owner / late-produced result; byte-exact исходные tiles/selection/history, в том числе против завершённого старого worker.
- [ ] **037C-3b-3:** malformed native replies, maxBytes/memory-budget, fail-closed public UI и offline receipt verifier. Не выдавать sampled RSS за peak.
- [ ] **037C-3c:** полноформатная PR→main acceptance после зелёных фото-gates.
- [ ] **P0 002, Stage 003 и остальное со скриншота:** Adobe-authored PSD corpus, глобальный tiled/virtual renderer, ICC/CMYK/32-bit HDR, RAW, Refine Edge/AI — OPEN.
