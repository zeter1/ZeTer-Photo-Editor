# 002B/2c — Independently verified Photoshop-authored PSB32 high-depth acceptance

**Приоритет:** P0 (Stage 002 PSD/PSB compatibility). **Статус:** BLOCKED. **Дата:** 2026-10-19.
**Зависимости:** [002B/1](002b-photocraft-native-composite-oracle.md) DONE, [002B/2a](002b2-photoshop-browser-native.md) DONE, [002B/2b](002b2b-external-psb32-candidate.md) DONE.

## Блокер

Нужен действительный, разрешённый для использования и независимо подтверждённый **Adobe Photoshop-authored RGB32 PSB** (PSB header version 2), с исходной публикацией, SHA-256, датой/процессом создания Photoshop, правами/лицензией и эталонным Adobe composite/render. PhotoCraft исходный Photoshop corpus пока содержит PSD16/PSD32, но не PSB32. `psd-tools` даёт настоящие PSB32, но не доказан Photoshop-origin. PSD32 нельзя выдавать за PSB32.

## Порядок реализации после снятия блокера

1. Зафиксировать versioned immutable upstream commit, fixture bytes, точный SHA-256 и size; документировать создателя, совместимую лицензию и Photoshop authoring evidence.
2. Получить сохранённый Photoshop composite и independently validate native RGB32 samples (не только ZeTer-to-ZeTer или PSD-to-PSB decode). Проверить group/mask/adjustment semantics, если они присутствуют.
3. Создать pinned dual-kind manifest с уже подтверждённым Photoshop PSD16 + PSB32 и выполнить `audit-external-high-depth-corpus.mjs` → `profile-external-high-depth-psd-psb.mjs` real native Worker, без снижений precision/hidden conversion.
4. Добавить обязательный Chromium `file://` public import, precise .zpe source preservation, edits → Undo/Redo/History, cancellation/memory gates; сравнить внешние reference render goldens, затем независимый Photoshop-tool round-trip где применимо.
5. Только после зелёных PR CI, PR merge и exact-main CI закрыть 002B/2c. Не объявлять общую Photoshop parity без проверки всех этапов.

## Что сделать, пока Photoshop PSB недоступен

Не подменять этот блокер синтетическим или самостоятельным PSB из ZeTer/psd-tools. Продолжать независимые Stage [003](003-tiled-content-aware.md) performance/memory задачи, сохранив P0 002B/2c в NEXT. Перепроверять новые источники PSB с provenance и лицензией, если они появляются.

## Связанные подтверждения

- [PR #273](https://github.com/zeter1/ZeTer-Photo-Editor/pull/273): Photoshop-published PSD16/PSD32 native layer browser import, real PR/exact-main green.
- [PR #274](https://github.com/zeter1/ZeTer-Photo-Editor/pull/274): real externally published psd-tools PSB32 native Float32/paired PSD parity, real PR/exact-main green, Photoshop authorship unknown.
