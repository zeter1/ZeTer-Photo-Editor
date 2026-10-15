# 037B2b-2g — защита записи полученного CC0 JPEG при ошибках I/O

**Статус: КОДОВАЯ ПРОХОДКА ЗАКРЫТА (2026-10-15): [PR #241](https://github.com/zeter1/ZeTer-Photo-Editor/pull/241) → [61247d0](https://github.com/zeter1/ZeTer-Photo-Editor/commit/61247d0ee49f706ef9308ac953ec7b1da16e487d); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38759811494, attempt 2). НЕ 037B2b-2 photo acceptance.** [Основная очередь](README.md), [037B2b-2e](037b2b-2e-source-acquisition.md) и [037B2b-2f](037b2b-2f-decoder-output-integrity.md).

## Причина

После проверки Wikimedia SHA-1/JPEG загрузчик делал writeFile(path,bytes,{flag:'wx'}). wx исключает перезапись, но **не откатывает частичный файл**, если запись/синхронизация завершается ошибкой (например, ENOSPC). Следующая попытка получала EEXIST, а partial original.jpg оставался кандидатом.

## Реализовано

- [x] tools/photo-source-publication.mjs: эксклюзивное создание wx, права 0600, writeFile + sync; при обычном исключении очистка только если путь всё ещё указывает на **тот же regular-file dev/inode**.
- [x] Дескриптор остаётся открытым до конца rollback, чтобы не перепутать новый чужой inode с освобождённым своим.
- [x] tools/fetch-real-photo-source.mjs: после **существующей** проверки HTTP/JPEG/SHA-1 вызывает новый helper; identity источника, URL и 32 MiB cap не меняются.
- [x] tests/real-photo-source-publication.test.mjs: точность байтов, эксклюзивность, 0600, injected partial write, fsync failure, замена имени чужим файлом, occupied output и dangling symlink.
- [x] Локально node --test tests/real-photo-source-publication.test.mjs: 5/5 PASS; полный npm run check и Chromium smoke требуют CI проекта.
- [x] [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38759811494) (повторная попытка): 1288 Node-тестов, build/generated artifacts, настоящий Chromium file://, JSON и профили, diff hygiene. Первая попытка имела Chromium DevTools launch timeout; на второй браузерные проверки прошли.
- [x] [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38760636543) для [main 8ca8378](https://github.com/zeter1/ZeTer-Photo-Editor/commit/8ca8378fd01b9df33a07b28169b944da74adba2e): 18/18 steps success, включая Chromium file://, после merge и фиксации handoff. Последующий docs-only commit не меняет проверенный код.

## Границы

Это **тестовая инфраструктура получения источника**, не production UI/render. Откат покрывает обычные обработанные ошибки, но не SIGKILL, crash, power loss или повреждение диска; успешная синхронизация сама по себе не заменяет независимую проверку source SHA-256 и лицензии. **В настоящей среде оригинальный JPEG не получен**; mock/synthetic JPEG tests не проверяют фотографическое содержимое, ICC, EXIF, Photoshop и Chromium.

## Следующие задачи — брать в указанном порядке

1. **P1 037B2b-2 OPEN** — в среде с HTTPS получить именно CC0 original; подтвердить SHA-1, независимо закрепить SHA-256 и лицензию, EXIF/ICC/color/visual review; Pillow RGBA8 и замороженные native RGB16/Float32 digest по независимым evidence.
2. **P1 037B2b-3 OPEN** — genuine-photo PSD16/PSB32 clean/defect fixtures; native import/readback ZeTer + Python + external psd-tools; independent SHA-256 review.
3. **P1 037C OPEN** — Chromium file:// реальный PSD16/PSB32 → polygon connected 8288 → Worker → Save Project/Undo/Redo; три независимых прогона на формат и строгие quality/RSS JSON negative gates.
4. **P0 002/Stage 003 OPEN** — лицензированный Adobe-authored corpus, реальный compatibility round-trip и bounded tiled/document/render budget. Другие возможности со скриншота — отдельные задачи.
