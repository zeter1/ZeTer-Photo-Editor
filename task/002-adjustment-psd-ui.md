# CAP-ADJ-PSD-UI — реальный GUI PSD/PSB round-trip и mask alpha fix

**Дата:** 2026-11-07 · **Приоритет:** P1 · **Статус:** bounded implementation locally PASS; GitHub PR-head/exact-main CI pending.
**Base:** main `70a17f1b2a56e0fa370c92b12efc480c3dd32701`, ветка `feat/adjustment-psd-ui-20261107`.

## RED — реальный дефект

В Chrome `file://` после Layers/Levels и входного `.zpe` с document-sized raster mask (64×64), clipping, вложенной группой и vector mask экспорт PSD/PSB сохранял `levl` v2 и геометрию, но alpha канала `-2` в точке (16,16) оказывался **0** вместо **255**; после импорта верхний левый RGB пиксель 64 вместо ожидаемого ~128. Причина: `src/document/psd-export-controller.js:renderPsdMaskPixels` использовал `layer.width/height` для adjustment (каноническое 1×1), масштабируя документную маску до 1×1; обычные raster/shape masks сохраняют layer-local transforms.

Отдельно исходный smoke имел race: сравнивал имена исходного и импортированного слоёв до завершения async импорта, что давало ложный `native:false`. Тест исправлен: ожидает History `Импорт PSD/PSB` перед проверкой, что исключает исходный fixture.

## GREEN — локальное выполнение

- Документная растровая маска adjustment теперь рендерится в пространстве PSD документа, с учётом относительной `mask.transform`; normal-layer masks не менялись.
- Новый `npm run test:browser:adjustment-psd-ui` — настоящий Chrome `file://`: UI create/edit Levels/Curves (Master gamma + RGB red Curve), Export modal PSD/PSB, reimport `#fileInput`, diff реальных pixels/alpha, `psdAdjustment` в сохранённом `.zpe`, дальнейшие edit/History/Undo/Redo.
- Отдельный masked/grouped/clipped Levels с raster+vector mask: реальный PSD/PSB бинарный `decodePsd` oracle проверяет `levl`, group, clipping, vector mask, alpha mask внутри/outside; реальный UI import сверяет все четыре пикселя и `.zpe` save/reopen. RED → GREEN.
- `npm run build` — PASS для версии **1.46.8**. `node --test tests/psd-native-metadata-plans.test.mjs tests/psd-export-controller.test.mjs tests/psd-adjustment-layer.test.mjs` — **18/18 PASS**. `npm run test:browser:adjustment-psd-ui` — **PASS**.
- **Windows full check:** `npm run check` — **1603 PASS / 10 SKIP / 5 FAIL**, все пять FAIL относятся к Linux-only `/proc/cgroup` tests на Windows, эти checks не объявляются PASS. Полный независимый Linux CI пока PENDING.
- **Дополнительно:** `npm run test:browser:adjustment-create` и `npm run test:browser:adjustment-stack` — PASS; **полный `npm run test:browser` — PASS (Chrome file://, exit 0, 103.31 s)**; `node --check tools/browser-adjustment-psd-ui-check.mjs` и `git diff --check` — PASS.
- Exact PR CI и exact-main будут записаны только фактическими ссылками/результатами, без догадок.

## Scope

Production: `src/document/psd-export-controller.js`; focused CDP: `tools/browser-adjustment-psd-ui-check.mjs`, `tools/browser-adjustment-psd-ui-smoke.mjs`, `tools/browser-smoke.mjs`; scripts/CI, generated `src/app.bundle.js`, `index.html`, `version.json`, `package.json` (1.46.8), README/CHANGELOG/test matrix/task. Старый dirty worktree не затронут.

## Остаточные ограничения и следующий шаг

Бинарный собственный `decodePsd` — НЕ Adobe GUI и НЕ Photoshop-authored corpus. По направлениям CAP-ADJ/PSD все ещё IN PROGRESS. Следующий независимый вертикальный срез: **CAP-BEZ-MASK-PSD-UI** — Saved Paths/Vector Mask editable GUI, PSD/PSB vector data/alpha/History/Undo/.zpe.

## Дополнительная регрессия — 2026-11-11

- Добавлен `tests/psd-export-controller.test.mjs`: canonical adjustment 1×1 и смещённый/масштабированный слой не должны уменьшать документную raster mask (4×4); относительная `mask.transform` должна оставаться в координатах документа. Отдельный unit test PASS (4/4), все профильные вместе 19/19.
- Повторный production Chrome `file://` `test:browser:adjustment-psd-ui` PASS (PSD/PSB, Layers UI, binary mask, History, .zpe), `git diff --check` PASS. GitHub PR-head/exact-main PENDING, Adobe GUI не проверен.

## GitHub publication — 2026-11-11

- Опубликованы 17 файлов с проверкой `git blob` SHA каждого; фактический GitHub commit `f9e7c2739fdfa2308c32b35d82106b11a167c328` и [PR #382](https://github.com/zeter1/ZeTer-Photo-Editor/pull/382) на `main` `70a17f1b2a56e0fa370c92b12efc480c3dd32701`.
- [Core CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42977607666) и [real-photo CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42977607523) стартовали; финальный результат нужно читать по latest head, не выдавать запуск за PASS.
- Обновление `task/` изменяет PR head; после него нужен новый exact-head CI readback. Merge в `main` и exact-main CI на момент записи не выполнены.
