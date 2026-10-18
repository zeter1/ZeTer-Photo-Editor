# 037C-3b-1 — browser native Worker execution watchdog

**Приоритет:** P1. **Статус:** код отправлен на проверку CI, 037C-3b и 037C в целом OPEN.

## Мотивация
Worker-клиент уже имел отмену, polling владельца документа и защиту от поздних ответов, но зависший Worker без `ready` / ответа мог удерживать raster persistence lease неограниченно долго.

## Реализовано
- [x] Opt-in `maxRunMs` в `src/core/tiled-inpaint-worker-client.js` (0 по умолчанию для переносимого Node). Строгая проверка конфигурации; injectable timer для детерминированных тестов.
- [x] При превышении лимита — `terminate()`, удаление слушателей, отказ с диагностикой. Timeout не является `unavailable`, поэтому UI не делает бесшумную повторную cooperative обработку.
- [x] Таймер снимается при успехе, ошибке, отмене и stale owner. Реентерабельный scheduler и поздние Worker replies не способны опубликовать старые пиксели.
- [x] Браузерный `file://` adapter устанавливает 180000 ms; generated bundle, index cache hash и version.json синхронизированы с source.
- [x] Три unit-test сценария: stalled Worker + late reply + следующая операция, stale tab до handshake, invalid/reentrant deadline timer.
- [ ] Проверить PR CI: `npm run check`, generated artifacts, file:// smoke.
- [ ] После green PR CI объединить с main и проверить exact-main CI.

## Следующие проходки из скриншота
- [ ] **037C-3b-2:** на *реальных* pinned CC0-derived PSD16/PSB32 через Chromium file:// воспроизвести cancel/tab switch/close/stale owner/late Worker result, проверить byte-exact исходный native и отсутствие лишней History записи.
- [ ] **037C-3b-3:** malformed native bytes, превышение maxBytes/memory-budget, невыход за memory bounds, fail-closed evidence + offline receipt verifier.
- [ ] **037C-3c:** итоговая multi-run PR/main CI acceptance с независимыми доказательствами. Не выдавать observational RSS за memory peak.
- [ ] **P0 002 / Stage 003 и остальная дорожная карта:** Adobe-authored Photoshop PSD interoperability, полноценная tiled/virtual render architecture, Smart Objects, 16/32 HDR/ICC/CMYK/RAW, Refine Edge/AI.

**Граница доказательства:** этот watchdog ограничивает длительность in-flight Worker после bootstrap, но не устанавливает гарантированный максимум RAM, не закрывает реальную Chromium failure matrix и не доказывает Adobe parity или Photoshop compatibility.
