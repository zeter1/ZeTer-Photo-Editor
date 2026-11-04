# 010D-B — active native Worker cancellation on document-tab switch

**Статус: слито в `main` (2026-10-11).** [PR #195](https://github.com/zeter1/ZeTer-Photo-Editor/pull/195), squash `edabef3dcd313310a0af8aa6fa05db97b60e6ee4`. [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38150109876), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38150190339): Node, generated parity, Chromium `file://`, profiles, diff hygiene. Продолжает [014](014-browser-session-guard-mid-kernel.md).

## Реализация

- Введён identity-checked persistence lease для растровых команд. Старый `finally` не может освободить блокировку уже работающей новой операции.
- В `activateDocumentTab` destination валидируется *до* отмены. Только незавершённая Content-Aware Fill отзывает publication authority и завершает CPU-bound Worker; остальные жесты, команды и закрытие вкладок сохраняют pending-edit guard.
- Async continuation после каждого await проверяет текущую вкладку и cancellation, не пишет History/status/preview и не очищает буферы новой сессии.
- Убрана безусловная очистка `paintPersisting` при загрузке вкладки, добавлен явный метод остановки tiled Worker.
- Node регрессия моделирует смену документа, одновременное выполнение второго Fill и запоздалый ответ первого. Реальный Chromium `file://` smoke обновлён с guarded click на активную смену PSD16-вкладки **после записи первого native-пикселя в Worker**, затем проверяет обе вкладки, native bytes, History и повторную Fill.

## Gate

- [x] Production source изменения + regenerated `src/app.bundle.js`, `index.html`, `version.json`.
- [x] Автоматические Node-regressions и real Chromium `file://` smoke оформлены.
- [x] [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38150109876): Node, generated parity, Chromium `file://`, profiles, diff hygiene.
- [x] Merge в `main` (`edabef3d`) и [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38150190339).
- [x] Последующая [010D-C / 016](016-psb32-mid-kernel-undo-redo.md) закрыла PSB32 Float32 active-switch **browser test** с native Undo/Redo bit oracle ([PR #196](https://github.com/zeter1/ZeTer-Photo-Editor/pull/196), main CI success); второй документ в ней обычный, независимый Photoshop-authored golden и две native high-depth сессии остаются открыты.

## Далее

1. Две независимые native PSB32 вкладки: параллельный второй Worker после отмены первого, оба separate Float32 byte/History oracles (базовая одиночная native PSB32 active-switch + Undo/Redo завершена в [016](016-psb32-mid-kernel-undo-redo.md)).
2. 010E complex dense ROI: горизонтальные runs/connected segments, bounded planning и worst-case stress memory.
3. P0 [002](002-psd-compatibility-corpus.md): независимо Photoshop-authored PSD16/PSB32 с лицензиями, SHA и рендерами.
4. Browser memory high-water-mark methodology, цветовой/CMYK/ICC oracle, RAW/DNG, Select & Mask.
