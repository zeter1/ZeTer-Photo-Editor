# 009 — Stage 003: PSB32/CMYK Worker and cancellation

**Статус:** следующая незавершённая P1 проходка. 008 завершена, но 002 и 003 открыты.

## Цель
Проверить настоящий Chromium file:// UI import >8 MiB (не микрофикстура) PSB Float32 и/или CMYKA32 → native v2 → Content-Aware Fill Worker → preview → Undo/Redo. Отдельно проверить отмену во время реально pending Worker и отсутствие частичной публикации.

## План / критерии
- [ ] Детерминированная PSB32 fixture >8 MiB, bounded <48 MiB, отдельно нормальные/повреждённые native pixels; документировать synthetic ZeTer provenance, не считать Photoshop golden.
- [ ] Node decode + adaptive tiled native byte-oracle и точные little-endian Float32 значения в нескольких тайлах.
- [ ] Браузерный file input + Save Project native tiled source, настоящий Worker job и одна History запись, preview, Undo, Redo.
- [ ] Воспроизводимое прерывание pending Worker (например, смена/закрытие owning session или отмена) с proof: не публикуются частичные тайлы, нет History записи, source immutability, Worker stop.
- [ ] Stage markers + sampled renderer and process metrics с отдельным предупреждением, что это не full native/Worker RSS peak.
- [ ] PR CI и точный merge-SHA main CI успешны; документация 009 и NEXT синхронизирована.

## Другие открытые gates
- Stage 003: dense ROI adaptive strip/segment grouping, aggregate budgeting, гарантии Worker/cooperative parity и точной mid-stage cancellation.
- Stage 002 P0: лицензированный сторонний Photoshop-authored high-depth PSD/PSB, pin SHA-256 + independent reference renders.
- CMYK/ICC soft-proof parity, RAW/DNG, ML/GPU и сложные Photoshop interoperability особенности пока не считать закрытыми.

Правило: завершённость = код + тесты + PR + merge + exact-main CI, а не факт наличия тестового файла.
