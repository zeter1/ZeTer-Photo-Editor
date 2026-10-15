# 037B2b-2e — bounded HTTPS acquisition of documented CC0 JPEG

**Статус: КОДОВАЯ ПРОХОДКА ЗАКРЫТА (2026-10-15).** [PR #239](https://github.com/zeter1/ZeTer-Photo-Editor/pull/239) merged as [00cf871](https://github.com/zeter1/ZeTer-Photo-Editor/commit/00cf871bc891e781b6e9079e9be373fe1fd39c97); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38750599295): Node/build, Chromium file://, operation JSON, profiles и diff hygiene. Exact-main CI после обновления task проверяется отдельно. Это инфраструктурная часть открытого 037B2b-2, **НЕ** готовый реальный фото-бенчмарк.

## Контекст

037B2b-3h закрыл сторонний psd-tools readback СИНТЕТИЧЕСКИХ PSD16/PSB32. Настоящий оригинал нельзя заменить ещё одной самопроверкой derived fixture. Genuine Wikimedia JPEG bytes, внешняя EXIF/ICC/color review, frozen SHA-256 original/decoded/native, Chromium quality остаются открытыми.

## Изменения

- [x] Создан tools/fetch-real-photo-source.mjs: единственный фиксированный HTTPS URL на документированный CC0 оригинал; fetch redirect:error, timeout 30 s, HTTP 200, Content-Type image/jpeg, fail-closed Content-Length и streaming cap 32 MiB.
- [x] inspectPhotoJpeg до disk write сверяет SHA-1 c7fc9f013c70e01f164d232462ddd6e37e4079c4, JPEG 2560×1920 и EXIF/ICC marker structure. SHA-256 публикуется ТОЛЬКО кандидатом, не independently reviewed pin. CLI не принимает URL или политику источника в аргументах.
- [x] Output пишется только в новый файл (exclusive wx, mode 0600) после проверок; отклонённые ответы/изменённые JPEG не создают original.
- [x] tests/real-photo-source-acquisition.test.mjs: offline structural surrogate; фиксированный URL/policy, аргументы CLI, отрицательные статус/MIME/redirect/length/byte mutation/oversize и no-write проверки.
- [x] [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38750599295): Node/build, Chromium file://, JSON/profile/diff hygiene; [PR #239](https://github.com/zeter1/ZeTer-Photo-Editor/pull/239) merged.
- [ ] Проверить exact-main CI для итогового документационного изменения, не переносить успех PR на иной head.
- [ ] Загрузить и изучить подлинный source в среде с HTTPS: текущая рабочая среда не смогла получить оригинал. Фото не помещено в репозиторий.

## Получение фото и handoff

~~~sh
node tools/fetch-real-photo-source.mjs ORIGINAL-NEW.jpg
node tools/inspect-real-photo-source.mjs ORIGINAL-NEW.jpg
python3 tools/decode-real-photo.py ORIGINAL-NEW.jpg decoded.rgba decoder.json
node tools/real-photo-bundle-cli.mjs candidate ORIGINAL-NEW.jpg decoded.rgba decoder.json > candidate.json
# Только после независимой review и SHA-256 pin:
node tools/real-photo-bundle-cli.mjs verify reviewed-manifest.json ORIGINAL-NEW.jpg decoded.rgba
~~~

Успешный fetch доказывает совпадение с документированным SHA-1 и проверку синтаксиса JPEG, но НЕ подтверждает independently pinned SHA-256, полноту JPEG entropy, цвет/EXIF/ICC, лицензию на текущую версию источника и Photoshop compatibility. Нельзя автоматически делать reviewed-manifest.json из candidate.json.

## Следующие проходки

1. P1 037B2b-2: получить CC0 оригинал, независимо проверить лицензию/EXIF/ICC/color и frozen SHA-256 оригинала и декодированного RGBA8; durable source bytes.
2. P1 037B2b-3: из допущенного genuine-photo bundle создать PSD16/PSB32, проверить ZeTer, Python и psd-tools readback, native clean/defect SHA.
3. P1 037C: Chromium file:// import → 8288 ROI → native Worker → Save/Undo/Redo, три независимых прогона на формат с quality + memory evidence.
4. P0 002, Stage 003: независимый Photoshop-authored corpus и global tiled/render/export/RAM budget; остальной профессиональный scope скриншота тоже остаётся открытым.

Scope: только photo acquisition tool/tests/task. Production UI/render, codec и generated bundle не менялись.
