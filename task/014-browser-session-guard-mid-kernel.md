# 014 / Stage 003 / 010D-B0 — browser session-guard mid native Worker kernel

Status: **merged to `main`** via [PR #194](https://github.com/zeter1/ZeTer-Photo-Editor/pull/194), squash `7d82588d721171cd8746b71d238db5588fb273bf`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38149023595), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38149125350). **Not** 010D-B active session switching. This is a bounded regression strengthening 010D-A before changing the production persistence authority contract.

## Scope

- Chromium `file://` real ZeTer-generated 1025×1025 PSD16 >8 MiB, native v2 tiled raster. Fixture is **not** an external Adobe-authored golden.
- Real `#addDocTabBtn` / `#docTabs .doc-tab` clicks create a second independent UI document, then restore the PSD16 tab; compare native PSD16 Save Project samples before/after switching.
- Test-only original Worker source probe triggers **after actual native kernel pixel mutation**, then stalls inside CPU kernel for a bounded period. In-flight tab click must currently be rejected by the edit-persist busy guard; there must be no early Worker termination, no redirected History/pixel publication and no accidental tab switch.
- Lock target in original document while Worker is stalled. Polling must stop stale Worker; original preview and native sample/tile topology must be unchanged.
- When cancelled job settles, navigate to second tab via real UI; compare second document title/size/History/layers to its pre-job state; return to PSD16 tab and verify native exact bytes still unchanged. Unlock and launch a successor real Worker Fill; exactly one History edit and mutated high-depth sample on original tab.
- Sample renderer heap and available browser process private memory at critical stages. These are **samples**, not true peak RSS or per-Worker RSS; no hard universal RAM guarantee.

## Acceptance

- [x] Add browser test code to `tools/browser-ui-lock-mid-kernel-smoke.mjs` (existing final isolated smoke scenario).
- [x] Verify Chromium `file://` smoke in PR CI (two tabs, guarded switch, native sample fidelity, successful successor).
- [x] Verify generated parity, Node suite, Chromium, profiles and diff hygiene on the exact merged `main` SHA (`7d82588d`).
- [ ] TRUE **010D-B**: safely allow *active* tab/session switch during the kernel by explicitly revoking the pending edit and making persistence ownership per-operation (do not clear a newer tab's persist guard in a stale `finally`). Test PSB32 and dual-session byte/history consistency.
- [ ] 010E bounded dense ROI, independent Adobe PSD16/PSB32 corpus and production high-water-mark memory remain separate.

## Why the guard is intentionally retained

Currently `src/workspace/session-controller.js` uses `blockPendingDocumentEdit()` for activation and the global raster `paintPersisting` is cleared on session load in `src/main.js`. Simply bypassing the UI guard would allow an old completion to release a newer document's global persistence lock and could cross session resources. Explicit per-job cancellation and ownership revalidation must come **before** enabling live switching. The B0 regression catches unintended removal of the guard until that contract is implemented.
