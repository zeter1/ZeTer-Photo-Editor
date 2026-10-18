# 037C-3b-2b/1 — genuine photo Worker cancellation after native kernel write

**Приоритет:** P1. **Статус:** реализация в PR, CI ещё не проверен. Более широкий 037C-3b-2b остаётся OPEN.

## Цель проходки

Отдельно от закрытой 037C-3b-2a доказать в настоящем Chromium `file://`, что 16-bit PSD и 32-bit PSB *настоящего pinned фото* запускают native Worker, вычисляют хотя бы один пиксель Content-Aware Fill в ядре, и лишь **после этого** переключение вкладки отменяет Worker без публикации native bytes/History.

## Реализация в рабочей ветке

- [x] Только в тестовой Chromium-сессии подменяется configurable `__zpeTiledInpaintWorkerSource` инструментированной копией классического Worker. Производственный source, bundle и код вычисления не меняются.
- [x] Probe `zpe-test-native-kernel-write` встроен сразу после фактического изменения `pending[]`/`donorIndex[]`/`filled` в native kernel; затем ограниченный busy-spin удерживает Worker в ядре. Это тестовая синхронизация, а не измерение производительности.
- [x] Native Worker должен получить реальные frozen PSD16/PSB32 input tiles и exact polygon 8288 selectedIndices; `postMessage` **не перехватывается до ядра**, как в 037C-3b-2a.
- [x] Публичная смена вкладки после post-write probe должна вызвать `terminate()` без полного Worker reply; до/после сравниваются все native tiles через публичный File → Save Project и обе History.
- [x] После `terminate` инъецируется контролируемый *искусственный* late-result для проверки отсутствия публикации; это не натуральный поздний ответ настоящего Worker.
- [x] Отдельные fail-closed receipts `real-photo-{psd16,psb32}-mid-kernel-run-1.json`, verifier, отрицательные tests и opt-in `ZPE_REAL_PHOTO_BROWSER_MID_KERNEL=1`.
- [x] Изолированный per-format шаг GitHub Actions, upload проверяемых evidence.
- [ ] PR: проверка Node suite / generated artifacts / real-photo intake + два Chromium прогона (требует реальных CI JPEG/PSD/PSB из pipeline).
- [ ] Слитие после зелёных checks и повторная проверка точного `main` CI; тогда пометить узкий gate закрытым.

## Границы доказательства

- Post-write probe подтверждает, что Worker **начал** настоящее native ядро и записал **минимум один** пиксель; не доказывает завершение всего native kernel и не утверждает memory peak.
- Отмену вызывает пользовательское переключение вкладки; `close document`, отдельная кнопка Cancel, stale-generation race и late-completed Worker пока не проверены.
- JPEG-derived 16/32-bit fixtures не являются true high-dynamic-range camera source, Adobe-authored corpus или Photoshop parity.

## Что делать дальше из того же скриншота

1. **037C-3b-2b/2:** независимые сценарии реального close document, explicit cancel, stale owner generation и racing завершённого Worker для обоих форматов. Доказать no-publication через публичный проект, History/selection/session.
2. **037C-3b-3:** malformed native replies, maxBytes/memory-budget refusal, fail-closed UI и офлайн verifier. Не путать наблюдаемый RSS sample с peak.
3. **037C-3c:** полный CI acceptance на PR и exact-main, ревизия всех receipt gate; только тогда закрыть 037C.
4. **P0 002 / Stage 003:** Adobe-authored PSD/PSB compatibility goldens, виртуализация tiled rendering/preview, ICC/CMYK, RAW и оставшиеся функции снимка.
