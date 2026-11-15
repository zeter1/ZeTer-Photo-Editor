# CAP-BEZ-MASK-PSD-UI — Saved Paths и Vector Masks: настоящий PSD/PSB UI round-trip

**Статус:** IN PROGRESS — bounded CAP-BEZ-MASK-ADJ-APPLY [#385 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/385), новый bounded CAP-BEZ-MASK-PEN-SUBPATH v1.46.11 локально RED→GREEN Chrome PASS; полный Pen create/anchor/boolean/Adobe UI parity ещё TODO · **Приоритет:** P1 · **Актуальная кодовая база:** main `7fbc633ea82269b40fafba10fc25af5c96fc9b47` (#385 MERGED).

## Функциональная цель

В production Chrome `file://` создать через Pen и Paths настоящий Saved Path; применить как Vector Mask к выбранному редактируемому слою, изменить anchor/handles и boolean operation (add/subtract/intersect/exclude), экспортировать реальными UI-командами PSD и PSB, импортировать заново. Проверить native editable paths/masks, геометрию и RGBA/alpha pixels, порядок слоёв, History/Undo/Redo и сохранение/восстановление `.zpe`. Отдельно проверить owner-safety при смене документа и отсутствие flatten.

## Первая реализационная операция

1. В новой чистой ветке написать воспроизводимый RED Chrome E2E, используя `tools/browser-adjustment-psd-ui-check.mjs` для действительного PSD/PSB UI экспорта и `src/ui/paths-controller.js` для настоящих Paths controls; не подменять клики API-фальшивкой.
2. Сопоставить результат с `src/main.js` (`importPsdVectorMask/exportPsdVectorMask`), `src/document/psd-export-controller.js` и `src/formats/psd.js`; исправить **первое реальное расхождение** минимальным production patch, не раздувать scope.
3. Добавить focused Node regression, проверить `npm run build`, `npm run test:browser:vector-mask`, новый Chrome PSD/PSB round-trip, `npm run test:browser`, Undo/Redo/`.zpe`, затем Linux CI PR-head/exact-main.
4. Документировать неиспытанное: Adobe-authored external paths и Adobe Photoshop GUI остаются открыты; synthetic/self-readback ≠ interop.

**Done только при подтверждённом RED→GREEN, сохранении редактируемой геометрии/alpha и реальном UI-тесте.** Родительские CAP-BEZ, CAP-MASK, CAP-PSD IN PROGRESS.

## Первый RED→GREEN: применить Saved Path к Levels (2026-11-11)

- **RED (реальный Chrome `file://`):** `#pathsList .path-row` существует после загрузки настоящего `.zpe` с Saved Path и корректирующим слоем Levels, однако `#applyPathMaskBtn.disabled === true`; пользователь не может применить контур как Vector Mask. `npm run test:browser:adjustment-psd-ui` FAIL `disabled`.
- **Production GREEN:** `src/ui/paths-controller.js` больше не исключает adjustment в `canApplyPath` и apply handler; блокировка слоя и невалидный path по-прежнему отклоняются, маска локализуется прежним `importPsdVectorMask`. `src/app.bundle.js` пересобран, версия **1.46.10**.
- **Browser acceptance (Windows actual Chrome `file://`):** Paths row + Apply создает маску Levels, смежные raster/vector masks пересекаются по альфе; UI Undo убирает маску, Redo возвращает; экспорт через настоящий диалог PSD и PSB сохраняет native Saved Path и editable Levels/vector metadata, binary alpha oracle, reimport UI и `.zpe` reopen — **PASS**.
- **Focused unit:** `tests/paths-controller.test.mjs` теперь проверяет разрешение adjustment/обычного слоя и отказ при locked layer. `node --test tests/paths-controller.test.mjs tests/psd-saved-path-integrity.test.mjs` **11/11 PASS**; `npm run build`, version consistency 1/1, `git diff --check` PASS. Full Chrome browser suite и Linux CI проверять отдельно до merge.
- **Remaining:** Pen gesture create, actual anchors/handles and boolean path edit, import/export both ordinary layers and adjustment with geometric oracle, external Adobe-authored GUI — NOT DONE. Продолжать независимо, не объявлять CAP-BEZ целиком готовым.

## Второй RED→GREEN: Pen добавляет boolean subpaths в Saved Path (2026-11-11)

- **Реальный пробел:** при включённом `documentPathEditIndex` `src/main.js:onOverlayPointerDown` блокировал создание нового контура, позволяя только drag существующих anchors/handles; отсутствовал UI для выбора subpath.operation при Pen рисовании.
- **Node RED:** `tests/paths-pen-subpath.test.mjs` (2 теста) падал `appendPenSubpath is not a function`. **GREEN:** `src/ui/paths-controller.js` добавляет валидированный замкнутый cubic subpath с `add|subtract|intersect|exclude`, проверяет exact owner, node count, finite anchors/handles, клонирует геометрию и вызывает History commit. `src/main.js` маршрутизирует готовый Pen gesture; `index.html` предоставляет реальный select `#penPathOperation` (v1.46.11).
- **Chrome file:// acceptance:** `npm run test:browser:pen-boolean` PASS. Настоящий Paths/Edit, CDP Pen pointer clicks (4 anchor), Enter, Paths/Apply к обычному Shape, pixel oracle: subtract center alpha 0 / outside alpha 255; History Undo/Redo; Ctrl+S реальный Blob `.zpe` содержит 2 редактируемых subpaths и маску, повторное открытие через projectInput возвращает нужную alpha; экспорт PSD **и** PSB через настоящий диалог, `decodePsd` фиксирует native Saved Path operation subtract, повторный импорт через fileInput сохраняет геометрию/пиксели. `src/app.bundle.js` и `version.json` обновлены через build.
- **Focused Node:** `node --test tests/paths-pen-subpath.test.mjs tests/paths-controller.test.mjs` 11/11 PASS; unit-проверки покрывают все четыре operation, копирование nodes/handles и отказ неверных геометрий, stale owner. `npm run build` PASS. Полный Windows `npm run check`: **1608 PASS / 10 SKIP / 5 FAIL** в Linux-only `/proc/cgroup` (не считать full PASS). Full `npm run test:browser` Chrome file:// PASS (2026-11-11); Linux PR-head CI ещё не запущен до публикации ветки.
- **Known main CI blocker:** exact-main `7fbc633` [core FAILURE](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42990916980) / retry attempt 2: 003T Chromium Worker lifecycle control real Worker transitions; [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42990916811). Не приписывать этот existing failure новой ветке.
- **NEXT:** отдельный реальный Pen UI create Saved Path без начального fixture, изменение boolean operation существующих subpaths, проверяемый drag anchors/handles, raster/shape маски, exact PSD/PSB geometrical oracle + Adobe-authored evidence. Parent CAP-BEZ/CAP-MASK/CAP-PSD **IN PROGRESS**; synthetic self readback не является внешней Adobe parity.

## Третий RED→GREEN: Новый Saved Path без исходного fixture (2026-11-15)

- **BASE:** #386 merged `8eb755dc512a835146a2812402e67997d75499ee`; exact-main core [SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43712549988), real-photo [SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43712550021).
- **Node RED:** `tests/paths-pen-create.test.mjs` 0/3 PASS до production изменения: отсутствует `createEmptyDocumentPath`, «Новый» не активен. **Chrome RED:** при добавлении пустого path и Pen-кликах History фиксировал «Добавить Bézier-контур» (новый Shape), сам Saved Path оставался `0 конт. · 0 узл.`. Причина: `path-control-surface-controller.js:selectedTargets` сбрасывал edit index для `subpaths: []`.
- **GREEN production:** кнопка `#newPathBtn`, `createEmptyDocumentPath` с PSD Resource ID, 998 limit, History и Pen edit, запрет применять пустую маску. Surface сохраняет edit target при валидном `subpaths: []`, очищает только недействительную/удалённую цель. `src/app.bundle.js` пересобран.
- **Acceptance:** 4 новых Node tests PASS (empty path/IDs/limit/stale target), 14/14 focused Paths Node PASS. Реальный Windows Chrome `file://` `npm run test:browser:pen-boolean` от загруженного документа **без Saved Path**: UI New → Pen outer add → inner subtract → Paths Apply → inside alpha=0/outside alpha=255 → History Undo/Redo → `.zpe` save/reopen → PSD и PSB real export/import → native 4-node operations + rendered alpha PASS. Не заявлена сохранность Unicode имени пути в стороннем Photoshop.
- **Gates:** Windows `npm run build` 1.46.12 PASS. Full browser, PR-head Linux CI и exact-main проверить отдельно и записать только фактический исход.
- **NEXT:** отдельное редактирование operation уже существующего Saved Path subpath через UI и его привязка к выбранному subpath/owner; после изменения повторное применение как Vector Mask, History, `.zpe` и нативный PSD/PSB geometry/alpha.
