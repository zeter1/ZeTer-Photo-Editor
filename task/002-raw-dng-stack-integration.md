# CAP-RAW-DNG-STACK-RECONCILIATION — локальный merge v1.47.12

**2026-11-20 · P1 · IN PROGRESS.** Цель: объединить уже готовые bounded RAW-функции, а не переписать их; определить точную очередь публикации и независимые проверки. Не является GitHub merge или camera-authored acceptance.

## Входы и отсутствие дубликатов

- GitHub main `ddd90d3be9c20092b043a3ea4761795177f7a94c`, core push CI `43923939475` **SUCCESS**.
- #397 `bf6dd6628e2934dc39965fb8cf9058919d2dc9af`: **OPEN**, 13/13 exact-head checks SUCCESS, reviews 0; ColorMatrix1/2 calibrated preview.
- #398 `05c48eb8398aea57b0470fcaacf50801503c1fa3`: **OPEN**, stacked on #397, base-main workflow CI **NOT RUN**, reviews 0; DefaultCrop geometry.
- Локальная `feat/raw-dng-chroma-demosaic-20261120` `0e7eba9918631f4c85b05111ac1237adc2610da1`: чистая, включает существующие SOF3 JPEG/restart/multiscan, packed Bayer, LUT, BlackLevel, DefaultScale, ForwardMatrix, Highlights/Shadows, BaselineExposure/Offset, AsShotWhiteXY и три demosaic modes (v1.47.12). Оригинал и другие worktrees сохранены.

## Выполненное изменение

- Создан **новый** локальный Git worktree `ZeTer-Photo-Editor-raw-integrated` от точного #398 SHA `05c48eb`, branch `feat/raw-stack-integration-20261120`.
- `git merge --no-commit --no-ff feat/raw-dng-chroma-demosaic-20261120` завершился **без конфликтов**. Объединённый индекс `src/` сравнен с локальным v1.47.12 — отклонений нет. Интеграционный commit `35bead7db3c6b35ae2046d9f9af03fc8c8a2b1c3` с двумя родителями `05c48eb` и `0e7eba9`. Это действующий редактор, а не дизайн-документ: исходники, canonical bundle, UI, тесты и .zpe совместно находятся в одной компилируемой ветке.
- Не выполнялись remote push, merge #397/#398, обход review/CI; изменения **локальные**.

## Повторно выполненная локальная приёмка именно интеграционного дерева

- `npm run build`: **PASS**; `node --test tests/dng*.test.mjs`: **109/109 PASS**; `git diff --cached --check`: **PASS** до коммита. Исходный source остаётся точным `src/` локальной v1.47.12.
- Chromium `npm run test:browser:raw-dng`: **PASS**, настоящий `file://`, FileInput DNG (synthetic fixture), полный RGBA pixel oracle, RAW exposure/WB/tonal/demosaic, History Undo/Redo, .zpe source bytes и повторное открытие, PNG/PSD/PSB rendered raster regressions. Журнал: `..\raw-integrated-20261120-browser.log`.
- Windows `npm run check`: **FAIL**, 1770 / 1755 PASS / 10 SKIP / 5 FAIL; ровно Linux-specific `/proc`/cgroup Node tests. Журнал: `..\raw-integrated-20261120-check.log`. Нельзя объявлять full check PASS.
- Широкий `npm run test:browser`: **FAIL**, `Timed out waiting for red object brush preview` после Stage 003 Worker probes; **контрольный неизменённый #398 (`05c48eb`) после `npm run build` воспроизвёл идентичный timeout**; новое RAW-объединение не необходимо для ошибки, но корень остаётся UNKNOWN. Журналы `..\raw-integrated-20261120-browser-full.log` и `..\raw-398-baseline-browser.log`. Нужен контроль на baseline; нельзя считать все browser smoke PASS.
- **GitHub PR-head Linux core/independent real-photo CI для `35bead7`: NOT RUN**. **Exact-main CI** применим только к прежнему SHA ddd90d3, НЕ к новому коду. Camera-authored DNG, независимый LibRaw/RawTherapee pixel golden, Adobe color parity: **NOT VERIFIED / BLOCKED**.

## Одно следующее действие

Получить отдельное разрешение на push/merge, затем с соблюдением review/CI: **#397 → retarget и CI #398 → публикация подготовленного RAW интеграционного коммита 35bead7** с повторной приемкой после обновления bases. При независимом продолжении разработки — сначала минимально изолировать общебраузерный brush timeout на baseline против merge, не приписывая его демозаике без доказательств.
