# 034 / 024D3 — native quality для сложной связной ROI

**Статус:** реализация в рабочей ветке; PR/CI и merge проверить отдельно. Подпроход Stage 003, без изменения пользовательского runtime.

## Цель

Добавить численную native проверку качества существующего сложного связного выделения [018](018-complex-roi-profile.md): две области 64×64 + 96-пиксельный диагональный мост, RGB16 и CMYKA Float32, >256 затронутых плиток. Профиль раньше сравнивал bytes/допуски, но не публиковал MAE/RMSE по всему выбранному цветному содержимому.

## Реализовано в ветке

- [x] Независимый от inpaint-ядра test-only oracle `tools/complex-roi-native-quality.mjs` измеряет baseline/repaired MAE, RMSE и максимальную абсолютную ошибку относительно известного чистого native-фона **по всем выбранным цветовым каналам**, исключая CMYK alpha.
- [x] Строго проверяет входные `Uint16Array`/`Float32Array`, размер и уникальность frozen selection, non-finite образцы, точное отсутствие изменений вне выделения и сохранность alpha.
- [x] `tools/profile-complex-roi.mjs` публикует `quality` для каждой модели, требует реального улучшения MAE/RMSE; существующее точное совпадение результата Worker со sync остаётся обязательным.
- [x] Unit negative tests и интеграционные проверки поля `quality` для обеих native моделей.
- [x] Локально выполнен `node --test tests/complex-roi-native-quality.test.mjs` для отдельного helper: 4/4.

## До закрытия

- [ ] `npm run check` в полном репозитории и CI профили (локально полный checkout недоступен).
- [ ] PR CI success, merge, exact-main SHA CI success; после подтверждения записать PR, commit, run URLs сюда и в `task/NEXT.md`, `task/README.md`.
- [ ] Отдельно: реальный **Chromium `file://`** wide connected ROI с сохранёнными native words, временем операции, sampling coverage и memory diagnostics. Текущая проходка выполняет connected ROI только в **Node Worker**.
- [ ] Внешние **лицензированные Adobe-authored** PSD16/PSB32 + reference renders и source hashes по [002](002-psd-compatibility-corpus.md).
- [ ] Точное operation-wide/Worker peak RSS и доказанная target→PID attribution (сейчас `unknown`).

**Не заявлять:** Photoshop parity, качество на фото/текстурах, гарантированные performance/latency thresholds, browser-memory peak. Это synthetic constant-reference и process-wide Node snapshots.
