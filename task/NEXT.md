# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 9 / **CAP-RAW-DNG-FOUNDATION** — первый рабочий браузерный RAW-import с неразрушающей проявкой; не возвращаться к уже принятому Shape/Saved Path node editing.
> **PRIORITY:** P1 · **STATUS:** TODO (новый независимый функциональный срез; для кода ещё нет PR).
> **BASE MAIN SHA:** 39ae073a7c3daa12ae607663423ff767ed10f4d1 — [#392 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/392), ZeTer 1.46.17.
> **ACTIVE PR:** для CAP-RAW-DNG-FOUNDATION отсутствует; [#392 CLOSED/MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/392) и не требует повторной реализации.
> **LAST VERIFIED:** CAP-BEZ-PATH-NODE-EDIT: точный PR-head 81fc4bf981ec37290a3ba453b7747ad0888144d9 — [Linux core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43810434572), [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43810434570), все 13 checks SUCCESS; реальный Windows Chrome file:// Shape/Saved RGBA, Undo/Redo, .zpe reopen, editable native PSD/PSB self-round-trip PASS. [Exact merge-main core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43811572358) / [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43811572311): **PENDING**, проверить результат для main SHA 39ae073a. Windows full npm run check: 1646 PASS / 10 SKIP / 5 Linux-only /proc/cgroup FAIL; не полный PASS.
> **REMAINING ACCEPTANCE:** перед следующей работой проверить exact-main #392 core+real-photo; для нового CAP-RAW-DNG-FOUNDATION реализовать реальный DNG subset → RGBA/native raster, корректное CFA/black-white/white-balance, экспозицию в неразрушающем workflow с неизменяемым RAW-источником, безопасные ограничения на размер/данные, честное отклонение unsupported compression/photometric, Chrome file:// import/edit/UI → History Undo/Redo → .zpe reopen → PNG/PSD/PSB export. Начать с RED→GREEN Node decoder/tag tests; без Adobe compatibility обещаний.
> **NEXT IMPLEMENTATION ACTION:** добавить узкий валидируемый DNG TIFF/IFD Bayer reader и demosaic в core; интегрировать выбор .dng в существующий import-controller, осмысленные WB/exposure параметры и проверенную persistence. Не ломать обычный PNG/JPEG/PSD/PSB import. Не считать RAW реализованным до настоящего браузерного E2E.
> **BLOCKERS:** внешний Adobe-authored Saved Path/Vector Mask corpus и [Photoshop-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md); не подменять ими самопроверку. CAP-RAW-DNG-FOUNDATION не зависит от Adobe-authored PSD corpus.

## Краткая очередь

1. **CAP-RAW-DNG-FOUNDATION:** P1 TODO — реальный минимальный RAW импорт и неразрушающая проявка (новая пользовательская функция).
2. **CAP-BEZ-MASK-PSD-UI:** IN PROGRESS / external Adobe-authored interoperability BLOCKED; не повторять bounded Pen masks/paths из #389–#392.
3. **Stage 6 / 003X/6c-9:** IN PROGRESS — конкретный Worker stale/close/edit parity для native RGB16/CMYKA32, без бесконечного профилирования.
4. **CAP-RAW broader formats, ICC/native HDR, full Photoshop interoperability:** IN PROGRESS/TODO по [матрице](CAPABILITY_MATRIX.md); не объявлять DONE.

**Закрытый bounded срез:** [#392 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/392) · [журнал](002-bez-path-node-edit.md) · [матрица](CAPABILITY_MATRIX.md) · [карта](README.md).
