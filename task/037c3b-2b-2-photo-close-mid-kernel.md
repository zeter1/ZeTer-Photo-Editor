# 037C-3b-2b/2 — закрытие фото-вкладки после реального native kernel write

**Приоритет:** P1. **Статус: ЗАКРЫТА (2026-10-18)**. [PR #253](https://github.com/zeter1/ZeTer-Photo-Editor/pull/253) слит в [main 4117247](https://github.com/zeter1/ZeTer-Photo-Editor/commit/411724794082df2f34f5d066fd3cd55828b1646d); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39116653877), [PR genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39116653964), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39116891608), [exact-main genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39116891506). Версия 1.46.2. Полная 037C/037C-3b-2b всё ещё OPEN: явная отмена, stale generation и racing result предстоят.

## Исправление, подтверждаемое кодом

- `src/workspace/session-controller.js`: команда закрытия вкладки отзывает pending Content-Aware Fill до удаления owner-сессии, только после успешного dirty confirmation и только если закрытие меняет активного владельца. При отказе от закрытия/закрытии неактивной вкладки без смены активной job не отменяется.
- `tests/workspace-session-controller.test.mjs`: регрессии на порядок cancel → drop/activation, неизменную surviving History, отказ dirty-confirm и close inactive (без ненужной отмены).
- Публичный Chromium `file://` gate `ZPE_REAL_PHOTO_BROWSER_MID_KERNEL_CLOSE=1`: pinned PSD16/PSB32, 8288 ROI polygon, настоящий Worker `postMessage`, инструментированное *реальное* native kernel write (probe), после чего **публичный крестик закрытия** первой вкладки. Проверка `terminate` до нормального reply; искусственный late message не изменяет вторую вкладку.
- Вторая вкладка сравнивается через два публичных `File → Save Project` + History, до и после закрытия/late-event. Отдельные независимые JSON receipts, offline verifier, negative tests и CI artifact per format.

## Ограничение доказательства

**Оригинал после закрытия больше не существует.** Поэтому нельзя сравнивать его исходные native tiles **после** закрытия, утверждать snapshot сохранённого оригинала или считать этот тест доказательством byte-exact closed-document state. Гейт доказывает отмену Worker после первой native записи и невозможность поздней публикации в *оставшийся документ*; поле `originalNativeAfterCloseObservable:false` обязательно. Post-write probe встроен только в тестовую копию Worker source, не в release build. Не измерены true process RAM peak или Adobe/Photoshop parity.

## Критерии закрытия этой проходки

- [x] Source guard закрытия и четыре Node-регрессии.
- [x] Отдельные receipts + отрицательные validator tests + фотопроверка в CI.
- [x] PR CI `npm run check`, `npm run test:browser`, `git diff --check` — success, run #39116653877.
- [x] Real-photo CI — по одному отдельному подлинному PSD16/PSB32 Chromium-сценарию, independent artifact verification — success, run #39116653964.
- [x] Merge `4117247`, exact-main CI #39116891608, exact-main photo CI #39116891506 и запись ссылок в `task/NEXT.md`.

## Следующие задачи

1. **037C-3b-2b/3:** explicit user cancel (если UI существует — иначе сначала спроектировать UX с отменой), stale-generation и race завершённого Worker с real-photo native exact guard.
2. **037C-3b-3:** malformed native response / maxBytes memory refusal с fail-closed observable UI.
3. **037C-3c:** финальный PR+main evidence acceptance; отдельные P0 002 и Stage 003 остаются открыты.
