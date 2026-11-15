# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / CAP-BEZ-MASK-PSD-UI — редактируемые Saved Paths → Vector Masks → PSD/PSB.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS. Bounded **CAP-BEZ-PEN-NEW** разработан на `feat/pen-saved-path-create-20261115` (v1.46.12), его PR-head CI и merge пока требуют readback. Через реальную кнопку «Новый» можно создать пустой Saved Path, перейти к Pen, нарисовать Add + Subtract, применить Vector Mask; пустой путь не маскирует слой и режим редактирования не теряется.
> **BASE MAIN SHA:** `8eb755dc512a835146a2812402e67997d75499ee` — [#386 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/386) (v1.46.11), exact-main [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43712549988) и [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43712550021). PR-head #386 [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43001776838), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43001776952).
> **LOCAL ACCEPTANCE:** Node regression: new Path empty/IDs/998-limit, path-control edit target; focused Paths 14/14 PASS. Реальный Chrome `file://` `npm run test:browser:pen-boolean` PASS: no preexisting Saved Path → UI New → Pen add/subtract → alpha pixels → Undo/Redo → `.zpe` save/reopen → PSD+PSB export/reimport. Build v1.46.12 PASS; полный browser suite и Linux PR-head — отдельные gates, не утверждать до подтверждения.
> **NEXT IMPLEMENTATION ACTION:** завершить acceptance v1.46.12, PR-head core+real-photo, merge при разрешённых gates, exact-main CI. Следующий независимый код: **CAP-BEZ-PATH-OP-EDIT** — выбрать конкретный существующий subpath в Paths, изменить add/subtract/intersect/exclude через доступный control, обновить alpha Vector Mask при повторном Apply, проверить History, Undo/Redo, `.zpe`, PSD+PSB native geometry/operation и не трогать чужой документ.
> **LIMITATIONS:** PSD/PSB self-round-trip — не Adobe Photoshop-authored interoperability. Unicode Saved Path name в PSD/PSB не сертифицирован. PSB32 Photoshop-authored provenance отдельно [BLOCKED](002b2c-photoshop-psb32-provenance.md). CAP-BEZ/MASK/PSD родители IN PROGRESS.

## Приоритетная очередь

1. **CAP-BEZ-PEN-NEW — CURRENT code:** закончить локальный full-browser/readback, PR-head CI, review и merge.
2. **CAP-BEZ-PATH-OP-EDIT — NEXT CODE P1:** UI edit operation существующего subpath, reapply vector mask, редакторские handles/anchors, native editable PSD/PSB + `.zpe`.
3. **CAP-BEZ-MASK-PSD-UI:** raster/shape/adjustment masks и настоящие Adobe Photoshop-authored PSD/PSB GUI (внешняя приёмка).
4. **Stage 6 / 003X/6c-9:** Worker stale/close/edit native parity и точечные риски, без бесконечного profiling.
5. **CAP-RAW / Stage 9:** настоящий RAW decoder + неразрушающий develop, end-to-end TODO.

**История:** [#386 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/386), [#385 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/385), [#383 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/383). [Матрица](CAPABILITY_MATRIX.md) · [Карта](README.md) · [Журнал](002-bez-mask-psd-ui.md).
