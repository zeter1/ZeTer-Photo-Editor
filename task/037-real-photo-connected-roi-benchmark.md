# 037 — реальное изображение: проверяемое качество широкого connected ROI в Chromium

**P1, OPEN (после закрытой [036C](036-browser-connected-roi-quality.md)).**
**Не подменяет [002](002-psd-compatibility-corpus.md):** независимо Photoshop-authored RGB16/CMYK32 PSB golden — отдельная P0 и остаётся открытой.

## Цель

Проверить Content-Aware Fill native RGB16/Float32 на **реальной текстурированной фотографии**, а не на ZeTer-generated плоском эталонном фоне. Не использовать одну только self-authored PSD/PSB как доказательство Photoshop-совместимости.

## Исполнимая последовательность

- [ ] Подобрать legally reusable photographed image или авторский оригинал с явно записанными license, origin, asset SHA-256, разрешением, color-space и правом включения только в тесты. Хранить fixtures по правилам проекта, не копировать чужие несвободные файлы.
- [ ] Сделать воспроизводимый known-clean image reference; **отдельно** создать документ с контролируемыми дефектами в двух 64×64 островах и тонком связном diagonal corridor (либо зафиксировать другую точную непустую native selection shape). Сохранить исходник и reference раздельно, обеспечить неизменные alpha и outside selection.
- [ ] Через настоящий \`file://\` UI выполнить import → polygon selection → native Worker → public Save Project → Undo/Redo для PSD16 и PSB32, с независимым native word oracle для nonselection/alpha и сравнением MAE/RMSE только с genuine known-clean reference.
- [ ] Для каждого формата записать минимум 3 независимых запуска (не объединять в ложный benchmark SLA). Версионировать timings / memory sample coverage, включая пропуски CDP/Unix, **не** заявлять true Worker→PID, true RAM peak либо Photoshop parity по этому тесту.
- [ ] Провести blind negative matrix: nonselection/alpha mutation, ложная quality, перепутанные clean reference/bits, corrupt tiles, необоснованные sample peaks/PID joins; сохранить строгий fail-closed artifact read/write.
- [ ] Gate: \`npm run check\`, реальный Chromium \`file://\` smoke, profile/artifact CI, чистый diff, PR-review, merge и exact-code main CI. Занести фактический SHA/CI/qualitative limits сюда и в [NEXT](NEXT.md).

## Незакрытые более крупные направления

- **P0 [002](002-psd-compatibility-corpus.md)** — независимые лицензированные Photoshop-authored goldens с истинным Adobe round-trip, CMYK32 / group masks, metadata; без данных не отмечать выполненным.
- **Stage 003** — совместимый render/document contract и глобальный tiled memory budget для патологических больших документов; истинные operation peaks требуют другой измерительной методики.
- **Остальное со скриншота:** PSD export compatibility, Smart Objects, 16/32-bit/HDR, ICC/CMYK, RAW и Select & Mask / Content-Aware Fill являются отдельными крупными дорожными картами; один synthetic test их не закрывает.
