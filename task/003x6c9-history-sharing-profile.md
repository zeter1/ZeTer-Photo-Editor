# 003X/6c-9 — real large History pooling memory/latency profile

**Приоритет:** P1. **Статус:** TODO (после bounded acceptance 003X/6c-8). **Зависимости:** 003X/6c-8. Parent 003X/Stage 6 IN PROGRESS; independent Adobe-authored PSB32 provenance 002B/2c BLOCKED.

## Цель
Измерить на больших RGB16/CMYKA32 Float32 documents реальную стоимость pooled native URL History: UI native source, separate History segments, reconstructed JSON transient, Undo/Redo CPU time, multiple document sessions and Worker input. Do not confuse unique pool byte count with total JS heap/RSS.

## Acceptance criteria
1. Identical baseline and pooled real Chrome file:// scenarios with the same Undo positions and original native samples.
2. Repeatable measurements of URL byte owner, non-native segments, reconstruction and GC/latency; true heap/RSS claims only with complete evidence.
3. Safe cancel/stale/session-close and workspace restore; exact .zpe v1/v2 and synthetic PSD16/PSB32 sNaN/-0/alpha oracles; document Adobe-provenance limitations.
4. Small verified code fix if a regression exists, otherwise document no-change decision.
5. Unit/browser regression, deterministic build, PR-head Linux 12-job core and separate real-photo CI, merge and exact-main proof; update task/NEXT.md, task/README.md and CHANGELOG.md.

Current: TODO. 003X/6c-8 unique pooled byte reduction alone does NOT prove RAM/RSS savings.