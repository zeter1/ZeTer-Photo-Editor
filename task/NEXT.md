# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / **CAP-BEZ-MASK-ADJUSTMENT-DIRECT-EDIT** — прямое редактирование уже применённой Vector Mask на Levels/Curves adjustment layer внутри группы.
> **PRIORITY:** P1 · **STATUS:** TODO (следующий функциональный срез), родители CAP-BEZ / CAP-MASK / CAP-PSD **IN PROGRESS**.
> **BASE MAIN SHA:** `553e74715c79d97d83a456fa8f33612e43ab58a6` — точный merge #389 (до этого docs-only обновления). Перед новым кодом проверить актуальный HEAD main.
> **ACTIVE PR:** для нового среза нет. Предыдущий [#389 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/389) из проверенного head `01f253660f9597772f2fb1257dc59a5e5b0ef10d`, merge `553e74715c79d97d83a456fa8f33612e43ab58a6`. [#388 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/388) в `cb947b194448f435b80053793d00afdc248380a9`.
> **LAST VERIFIED:** PR #389 Linux exact head core [SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43729021682) и independent real-photo [SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43729021697), 13/13 checks SUCCESS, reviews/threads 0, mergeable true. Windows build v1.46.14 PASS; 32/32 focused Node PASS; Chrome `file://` `test:browser:pen-boolean` PASS (оба handles, alpha, Undo/Redo, `.zpe`, PSD+PSB native editable geometry), полный `npm run test:browser` PASS (117.57 s). После merge #389 exact-main [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43729734006) и [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43729733879) запущены; состояние смотреть по GitHub, не приписывать PASS до readback. Ранее Windows `npm run check`: 1618 PASS / 10 SKIP / 5 Linux-only `/proc/cgroup` FAIL, не полный PASS.
> **REMAINING ACCEPTANCE:** прямое редактирование applied Vector Mask на Levels и Curves внутри nested/grouped/clipped adjustment stack, подтверждение реального композитинга нижнего слоя; inherited group lock; stale document / changed target mid-gesture; полноценные History Undo/Redo; `.zpe` reopen; PSD/PSB native editable adjustment+path без flatten. Дать RED→GREEN production fix и настоящую Chrome `file://` приёмку, затем PR-head/exact-main gates.
> **NEXT IMPLEMENTATION ACTION:** добавить реальный Chrome тест с grouped Levels/Curves adjustment и его применённой Vector Mask; drag anchor + handle, сравнить RGBA нижнего слоя; зафиксировать первый RED, исправить production и обеспечить no-write при stale owner/group lock.
> **BLOCKERS:** внешний Adobe-authored Saved Path/Vector Mask corpus и [Photoshop-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md) BLOCKED. ZeTer PSD/PSB self-round-trip не равен Photoshop GUI compatibility.

## Краткая очередь

1. **CAP-BEZ-MASK-ADJUSTMENT-DIRECT-EDIT:** P1 TODO — настоящий grouped Adjustment Vector Mask Pen edit и alpha/PSD/PSB acceptance.
2. **CAP-BEZ-MASK-PSD-UI:** IN PROGRESS — расширить raster/adjustment/shape и внешний Adobe-authored interop; сохранность 16/32-bit native без flatten.
3. **Stage 6 / 003X/6c-9:** IN PROGRESS — Worker stale/close/edit parity; **Stage 9 CAP-RAW:** TODO — полноценный RAW pipeline.

**История:** [матрица](CAPABILITY_MATRIX.md) · [карта](README.md) · [журнал](002-bez-mask-psd-ui.md).
