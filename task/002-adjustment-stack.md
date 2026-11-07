# CAP-ADJ-STACK — ограниченный, проверяемый compositor-этап (2026-11-07)

**Задача:** Stage 2 / CAP-ADJ-STACK. **Основа:** exact `main` `30590285bb7e5eb547854dd1fa21cacc589db3d2`. **Ветка:** `feat/adjustment-stack-compositor-20261107`.

## Пиксельный дефект и исправление

- RED: реальный Google Chrome с production `file://` загрузил `.zpe` с нижним серым Shape, невидимой clipping-базой и поверх Levels gamma=2. До исправления корректировка меняла RGB всех нижележащих пикселей; тест истёк на «Hidden clipping base must not leak Levels onto background».
- В `src/core/render.js` clipped Adjustment без существующей базы теперь пропускается (fail-closed), а не становится неограниченной коррекцией всего композита. Та же защита применяется после скрытой группы, нулевой opacity и при разрыве вложенной clipping-цепочки.
- Если непосредственная база — группа, независимо от `pass-through`/isolated, clipping mask строится из **содержимого самой группы**. Для `pass-through` группа сначала рендерится относительно реального внешнего композита, а отдельный прозрачный буфер строится лишь при наличии соседнего clipped слоя. Для isolated-группы используется уже построенная group canvas и alpha с учётом group opacity.
- Проект не переносит adjustment в raster/flatten; сохранённый RGB Shape остаётся редактируемым. Временный group coverage buffer создаётся лишь при необходимости clipping.
- Отдельно не менялись PSD/PSB native metadata, native high-depth source, формат `.zpe` или алгоритмы ручного PSD flatten.

## Доказательства приемки

- GREEN: `npm run build`, `node --test tests/render-pipeline.test.mjs tests/adjustments.test.mjs tests/layer-groups.test.mjs tests/adjustment-command-controller.test.mjs` — **46/46 PASS**.
- Настоящий Windows Chrome `file://`: `npm run test:browser:adjustment-stack` — PASS. Сценарии: невидимая clipping-база; вложенные `pass-through`-группы как база; isolated group opacity; последовательные Levels → channel Curves (проверка RGB-каналов); пересечение raster+vector masks; сохранение alpha; изменение Levels в настоящем Properties; History и Undo/Redo; Ctrl+S реальный `.zpe` Blob; reopen и сравнение RGB/редактируемых параметров и масок.
- Новый `tools/browser-adjustment-stack-check.mjs` исполняется в существующем настоящем Chromium/CDP `tools/browser-smoke.mjs`; отдельная `test:browser:adjustment-stack` команда добавлена в `package.json` и GitHub Actions.
- Полный Windows Chrome `npm run test:browser` на итоговой production сборке: **PASS**, реальный Google Chrome `file://` (проверено по завершающему `Browser smoke passed`). `git diff --check` PASS. `npm run check`: **FAIL**, всего 1616 тестов: 1601 PASS, 10 SKIP и 5 FAIL на Linux-only `/proc/cgroup` (Windows). Linux PR-head CI пока NOT RUN.
- Смежные ручные Photoshop-authored PSD/PSB metadata/round-trip, full pixel oracle за пределами принятых сценариев и Linux CI проверяются отдельно; один bounded PASS не переводит весь CAP-ADJ в DONE.

## Следующее точное действие

1. Проверить `npm run check`, полный `npm run test:browser`, `git diff --check`, согласованность версии и generated artifacts.
2. Опубликовать независимый PR; привязать head SHA и проверить core CI плюс независимый real-photo (если сработал). Merge — только после разрешённых review/gates, затем отдельно exact-main CI.
3. После bounded CAP-ADJ-STACK перейти к CAP-ADJ-PSD: поддержка **доказанно** редактируемых Photoshop-authored Levels/Curves PSD/PSB, с native metadata, clipping/masks и сравнением до/после Photoshop, без выдачи synthetic fixtures за Adobe provenance.
