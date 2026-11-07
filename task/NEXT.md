# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / CAP-ADJ-PSD-NEW — нативный экспорт вновь созданных ZeTer Levels/Curves как редактируемых PSD/PSB adjustment layers.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS — RED→GREEN Node + PSD/PSB round-trip 18/18 PASS локально; новая ветка `feat/adjustment-psd-roundtrip-20261107`, GitHub PR и CI ещё предстоит подтвердить.
> **BASE MAIN SHA:** `59fa89773556cd9a81448937bdb9309033afd582` — [CAP-ADJ-STACK #380 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/380). Exact-main [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42380960751), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42380960684).
> **LAST VERIFIED (2026-11-07):** #380 latest head `6683025d136f01e296bd85d0766b7775e6430ffa`: [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42370374669) и [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42370374855); review threads отсутствуют, squash merge в `59fa897`. Windows #380 локально build, 46/46 Node, Chrome `file://` stack/History/Undo/Redo/.zpe PASS; полный Windows check имел 5 Linux-only `/proc/cgroup` FAIL, не путать с Linux CI.
> **FUNCTIONAL IMPLEMENTATION:** у созданных в ZeTer Levels/Curves раньше не было `psdAdjustment` source, поэтому PSD/PSB export переходил в flatten. Теперь `createPsdAdjustmentBlocks` пишет Levels v2 (29 records) или point Curves v1 и сохраняет их через `psdAdjustmentNativePlan` в PSD/PSB layer; imported native blocks по-прежнему переписываются своим путём, unsupported adjustments fail-closed. [Журнал CAP-ADJ-PSD](002-adjustment-psd-new.md).
> **BOUNDARY:** новая реализация проходит собственный PSD/PSB decode round-trip и прежние импортные Photoshop fixture тесты, но Photoshop GUI-authored output, внешняя Adobe editability, полный native-bit/.zpe v2 contract ещё НЕ проверены. Не приравнивать synthetic/self-readback к внешней совместимости.
> **NEXT IMPLEMENTATION ACTION:** довести CAP-ADJ-PSD-NEW до PR-head CI/review/разрешённого merge и exact-main CI. Затем **CAP-ADJ-PSD-UI** — настоящий Chromium `file://`: создать Levels/Curves в Layers UI, изменить их, экспортировать PSD/PSB через UI, повторно открыть и проверить editable kind/points, clipping/group/маски и пиксели. Внешние Photoshop-authored PSD/PSB отдельно.
> **BLOCKERS:** Adobe Photoshop-authored PSB32 provenance [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED отдельно; Stage 6 native Worker RSS/peak UNKNOWN.

## Краткая очередь

1. **CAP-ADJ-PSD-NEW** — новый native Levels/Curves writer + controller round-trip; local implementation готова, GitHub gate PENDING — CURRENT.
2. **CAP-ADJ-PSD-UI** — Chrome `file://` UI native PSD/PSB export/reopen для newly-created Levels/Curves, Masks/Clipping/History acceptance — NEXT.
3. **CAP-ADJ-PSD-EXT** — внешняя Photoshop-authored metadata/GUI editability, PSB HDR и multi-depth fidelity — IN PROGRESS / sample-dependent.
4. **CAP-MASK/CAP-BEZ** — Photoshop-native vector controls/path UI/PSD round-trip — IN PROGRESS; [#378](https://github.com/zeter1/ZeTer-Photo-Editor/pull/378) bounded DONE.
5. **Stage 6 / 003X/6c-9** — targeted Worker stale/close/edit native parity; отдельный PSB32 provenance BLOCKED.

Предыдущие принятые этапы: [CAP-ADJ-CREATE #379](https://github.com/zeter1/ZeTer-Photo-Editor/pull/379), [CAP-ADJ-STACK #380](https://github.com/zeter1/ZeTer-Photo-Editor/pull/380), [CAP-MASK-VD #378](https://github.com/zeter1/ZeTer-Photo-Editor/pull/378). История и доказательства сохранены в [README](README.md), [матрице](CAPABILITY_MATRIX.md), [журналах](002-adjustment-stack.md) и [архиве](archive/2026-11-04-NEXT-legacy.md).
