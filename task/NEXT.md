# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / CAP-BEZ-MASK-PSD-UI → **CAP-BEZ-PATH-OP-EDIT + CAP-BEZ-PATH-DRAG-HIT** (bounded 1.46.13).
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS — bounded v1.46.13 реализован и локально проверен, [PR #388 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/388); Linux PR-head CI ещё PENDING.
> **BASE MAIN SHA:** `83bfd35092a0230b89b82bb6944911b5c6952024` — [#387 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/387); exact-main [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43723258117) / [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43723258105).
> **ACTIVE PR:** [#388 — CAP-BEZ-PATH-OP-EDIT + DRAG-HIT](https://github.com/zeter1/ZeTer-Photo-Editor/pull/388), branch `feat/path-subpath-operation-edit-20261115`, original code head `d80e04b5b9b2d655b0ef083423fce4bb745e289a`; latest head после этого обновления NEXT проверить заново. PR-head [core CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43723971622) / [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43723971711) PENDING для исходного head.
> **LAST VERIFIED:** 2026-11-15 Windows Node 29/29 focused PASS; `npm run build` PASS; `npm run test:browser:pen-boolean` PASS (real Chrome `file://`): Paths New → Pen add/subtract → короткая Shift-ручка → anchor drag при близкой ручке → Vector Mask alpha → операция существующего subpath → Undo/Redo → `.zpe` save/reopen → PSD/PSB GUI export+import, нативная геометрия anchor+обе ручки. RED 2/10 тестов из-за приоритета handles → GREEN 10/10 после nearest-control patch. Полный Windows Chrome `npm run test:browser` **PASS, exit 0** (115.28 s), независимые `test:browser:pen-smooth` и `test:browser:vector-mask` PASS; предыдущий `npm run check` для 1.46.13: 1615 PASS / 10 SKIP / 5 FAIL в Linux-only `/proc/cgroup` — не full PASS.
> **REMAINING ACCEPTANCE:** Linux core+real-photo CI точного опубликованного нового head, review/merge и exact-main CI. Отдельно: реальные drag anchors/handles уже применённой Vector Mask, ее alpha/Undo/Redo/.zpe/PSD/PSB, stale-owner и внешняя Adobe-authored GUI проверка.
> **NEXT IMPLEMENTATION ACTION:** пройти exact latest PR-head CI для #388, проверить конфликты/review, merge при успешных gates и exact-main CI; затем **CAP-BEZ-PATH-DRAG-VECTOR-MASK** — live edit применённой Vector Mask с alpha, Undo/Redo, `.zpe`, PSD/PSB editable geometry и stale owner guard.
> **BLOCKERS:** CI latest PR-head #388 ещё PENDING. Photoshop-authored PSB32 provenance [BLOCKED](002b2c-photoshop-psb32-provenance.md), собственный PSD/PSB self-round-trip != Adobe GUI. Parent CAP-BEZ/MASK/PSD IN PROGRESS.

## Краткая очередь

1. **#387 CAP-BEZ-PEN-NEW DONE (bounded):** [MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/387) в main `83bfd350` после exact PR-head core+real-photo SUCCESS; exact-main workflows ещё IN PROGRESS.
2. **CAP-BEZ-PATH-OP-EDIT / DRAG-HIT (current P1):** [#388 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/388); production код + Chrome `file://` alpha/geometry/Undo/Redo/`.zpe`/PSD/PSB подтверждены локально. Linux CI, review/merge и exact-main — текущий gate.
3. **CAP-BEZ-PATH-DRAG-VECTOR-MASK (next code P1):** реальная правка применённой маски на холсте, Undo/Redo/.zpe, native PSD/PSB и owner-safe обработка смены документа.
4. **CAP-BEZ-MASK-PSD-UI (parent):** Adobe-authored Saved Path/Vector Mask acceptance, raster/shape/adjustment workflows.
5. **Stage 6 / 003X/6c-9:** Worker stale/close/edit parity, отдельно от Photoshop PSB32 provenance. **CAP-RAW / Stage 9:** end-to-end RAW pipeline TODO.

**История:** [#387 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/387), [#386 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/386), [#385 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/385). [Матрица](CAPABILITY_MATRIX.md) · [Карта](README.md) · [Журнал](002-bez-mask-psd-ui.md).
