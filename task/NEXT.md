# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 2–4 / **CAP-BEZ-PATH-NODE-EDIT** — Shape Path + Saved Paths node insert/delete.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS (реализация опубликована в PR #392, локальная Chrome приёмка PASS; Linux PR-head/merge/exact-main pending).
> **BASE MAIN SHA:** 70b70693bff620f08b89785c4e2f31a40b25d138 (2026-11-16; baseline [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43735921273)).
> **ACTIVE PR:** [#392 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/392), ветка `feat/path-node-edit-20261116`, worktree `ZeTer-Photo-Editor-path-node`; код вне `main`. Новые head-workflows: [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43810071983) и [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43810071910), статус проверять по актуальному SHA.
> **LAST VERIFIED:** v1.46.17. Source-aware Pen Ctrl+click сегмента / Ctrl+Alt+click anchor для Shape Path и Saved Paths, точный De Casteljau включая closing cubic, open/closed minimum, owner/target/ID/lock checks. Target Node **42/42 PASS**; реальный Chrome `file://` Shape + Saved Path, RGBA, History Undo/Redo, `.zpe` reopen и native PSD/PSB self-round-trip **PASS**, полный `npm run test:browser` **PASS** (exit 0). Windows `npm run check` после исправления версии: 1646 PASS / 10 SKIP / 5 FAIL (все 5 Linux-only `/proc/cgroup`, НЕ full Windows PASS); focused version+paths 21/21 PASS. `git diff --check` PASS.
> **REMAINING ACCEPTANCE:** локальные version/Shape/Saved Chrome проверки PASS → [#392 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/392) → Linux PR-head core+real-photo CI, review/merge без обхода gates → exact-main обе CI. Настоящий Photoshop-authored Saved Path / Vector Mask corpus отсутствует: внешняя Adobe GUI interoperability NOT VERIFIED.
> **NEXT IMPLEMENTATION ACTION:** довести `CAP-BEZ-PATH-NODE-EDIT` до PR-head Linux CI и merge/exact-main без повторной реализации Vector Mask; после принятия выбрать следующий независимый P1 по матрице.
> **BLOCKERS:** Photoshop-authored Saved Path / mask corpus и [Photoshop-authored PSB32 provenance](002b2c-photoshop-psb32-provenance.md). Не использовать synthetic self-round-trip как доказательство Adobe interoperability.

## Краткая очередь

1. **CAP-BEZ-PATH-NODE-EDIT:** текущая P1, реализация опубликована в [PR #392](https://github.com/zeter1/ZeTer-Photo-Editor/pull/392); Linux core/real-photo и review/merge/exact-main gates pending.
2. **CAP-BEZ-MASK-PSD-UI:** IN PROGRESS — независимый Adobe-authored corpus, native high-depth.
3. **Stage 6 / 003X/6c-9:** IN PROGRESS — Worker stale/close/edit parity.
4. **Stage 9 / CAP-RAW:** TODO — RAW decode + non-destructive development.

**Документы:** [матрица](CAPABILITY_MATRIX.md) · [карта](README.md) · [новый журнал](002-bez-path-node-edit.md) · [предыдущий завершённый срез](002-bez-mask-node-insert-delete.md) · [родительская задача](002-bez-mask-psd-ui.md).
