# CAP-ADJ-PSD-NEW — новые редактируемые Levels/Curves в PSD/PSB

**Дата:** 2026-11-07 · **Приоритет:** P1 · **Статус:** IN PROGRESS до PR CI/merge/exact-main.
**Base:** main `59fa89773556cd9a81448937bdb9309033afd582`. **Ветка:** `feat/adjustment-psd-roundtrip-20261107`. **Связанный merged PR:** [#380](https://github.com/zeter1/ZeTer-Photo-Editor/pull/380).

## Дефект и минимальная реализация

- Ранее `psdAdjustmentNativePlan(layer)` отвергал все корректирующие слои без импортированного `psdAdjustment`, в том числе вновь созданные Levels/Curves. Их экспорт включал сводный `ZPE Composite Preview (adjustments baked)`, поэтому коррекции нельзя было редактировать как Photoshop adjustment layers.
- **RED:** новый тест требовал native export для нового Levels и получил `eligible: false`, `нет imported Photoshop adjustment metadata`. Остальные 4 tests файла прошли.
- **GREEN:** `src/formats/psd.js:createPsdAdjustmentBlocks` генерирует native `levl` v2 (29 10-байтных записей с нейтральными параметрами, затем патчирует Master/RGB) и `curv` point v1 (маска каналов + Crv extension). Использует уже существующий проверяемый rewrite/validation и сохранение PSD/PSB blocks.
- `src/document/psd-native-metadata-plans.js` выбирает генерацию только для нового Levels/Curves. Imported raw source продолжает использовать прежний rewrite. Unsupported kinds, styles, дополнительные filters и несовпадение импортного kind не выдаются за native. Для вновь созданных слоёв записаны Photoshop channel IDs `[-1,0,1,2,-2]`.
- Writer `src/document/psd-export-controller.js` уже поддерживает native adjustment records, zero-bounds, clipping и display composite: изменение автоматически проходит через существующий экспорт, без архитектурного обхода.

## Проверки, отдельно от внешней Photoshop-совместимости

- **RED:** `node --test tests/psd-native-metadata-plans.test.mjs` — 4 PASS / 1 FAIL на отсутствии native-plan у нового Levels, до изменения production-кода.
- **GREEN:** `node --test tests/psd-export-controller.test.mjs tests/psd-native-metadata-plans.test.mjs tests/psd-adjustment-layer.test.mjs` — 18/18 PASS.
- PSD и PSB self-readback: у новых Levels/Curves сохранились отдельные zero-bounds native adjustment layers, Master/RGB channel values/Curves points, clipping, не добавлен baked preview. Legacy импортный MIT fixture набор Levels/Curves и другие корректировки остаются PASS.
- `npm run build` — PASS, версия 1.46.7, canonical generated bundle/index/version согласованы. `node --check src/app.bundle.js`, `git diff --check` PASS.
- Полный Windows `npm test`: **1618 total / 1603 PASS / 10 SKIP / 5 FAIL**, все 5 FAIL относятся к Linux-only `browser-cgroup-delegation-probe`/`browser-chromium-cgroup-control` (`/proc/cgroup` отсутствует в Windows). Не объявлять полный Windows check успешным; Linux CI нужен отдельно.
- Настоящий Windows Chrome `file://`: `npm run test:browser:adjustment-create` PASS (Layers/Levels/Curves/Colorize, пиксели, History, Undo, `.zpe`); `npm run test:browser:adjustment-stack` PASS (clipping/group/masks/History/Undo/Redo/`.zpe`). UI экспорт newly-created Layers в PSD/PSB этими smoke ещё НЕ проверен.
- **Не доказано:** сохранение/редактирование экспортированных файлов в GUI Adobe Photoshop; настоящая внешняя Photoshop-authored PSB32 provenance; native-bit HDR fidelity и full end-to-end UI. Результат собственного парсера — не внешняя валидация.

## Файлы

- `src/formats/psd.js`, `src/document/psd-native-metadata-plans.js`
- `tests/psd-native-metadata-plans.test.mjs`, `tests/psd-export-controller.test.mjs`
- generated `src/app.bundle.js`, `index.html`, `version.json`; `package.json`, `README.md`, `CHANGELOG.md`, `docs/testing/TEST_MATRIX.md`
- `task/NEXT.md`, `task/README.md`, `task/CAPABILITY_MATRIX.md`, этот журнал.

## Следующий пункт после PR

**CAP-ADJ-PSD-UI** — в настоящем Chromium `file://` создать Levels/Curves через Layers UI, поменять Master/RGB points и clipping/mask, экспортировать PSD и PSB через UI, снова импортировать и проверить native editability, видимый пиксель и History. Отдельно добавить Adobe-authored native fixture + внешний Adobe GUI readback, не заменять его synthetic round-trip. После CI merge основного среза и exact-main обновить NEXT.
