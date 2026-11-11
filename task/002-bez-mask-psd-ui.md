# CAP-BEZ-MASK-PSD-UI — Saved Paths и Vector Masks: настоящий PSD/PSB UI round-trip

**Статус:** IN PROGRESS — первый bounded срез CAP-BEZ-MASK-ADJ-APPLY локально PASS, полный Pen/boolean UI сценарий ещё TODO · **Приоритет:** P1 · **Начальная база:** main `e0298721249eceff7a942571918d56921fa1bda2` (#382 и #383 MERGED).

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
