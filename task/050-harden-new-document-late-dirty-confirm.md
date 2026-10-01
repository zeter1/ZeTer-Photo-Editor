# 050 — Harden New Document against late dirty-state changes

## Goal

Prevent **File → New / Ctrl+N** from discarding edits that become dirty after the initial replacement confirmation but before the delayed modal submit.

## Why now / evidence

Fresh review after PR #84 found a second temporal-boundary risk in a different owner:

- `src/document/new-document-controller.js::open()` runs `blockPendingDocumentEdit()` and `canReplaceDocument()` **before** opening the New Document modal.
- Its `onSubmit` repeats only `blockPendingDocumentEdit()`; it does not prove that the same document/change epoch is still the one whose discard was authorized.
- `tests/new-document-controller.test.mjs` explicitly covers the submit-time pending recheck, but has no regression for clean→dirty or new-change transitions while the modal is open.
- `src/selection/clipboard-copy-cut-controller.js` has real await boundaries before destructive Cut publication (render/Clipboard write). During the early await, the generic document pending guard may still be false; therefore a New dialog can potentially open before the late destructive phase dirties the document.

This is a **risk to verify**, not permission to patch by assumption. Reproduce the ownership/dirty transition in the narrowest harness first. If higher-level wiring proves the scenario impossible, record that evidence and retarget/remove this task instead of forcing a change.

## Scope

In scope:

- New Document replacement authority across modal open → submit.
- Exact current-document/change-epoch and dirty-confirm semantics required to make delayed submit safe.
- Focused unit/composition regression tests.
- Minimal AI-facing docs/test-matrix/changelog updates if behavior changes.
- Canonical generated bundle regeneration when source changes.

Non-scope:

- broad modal-system rewrite;
- broad Clipboard refactor;
- changing PSD/project-open replacement policy unless a shared policy bug is proven;
- unrelated session/history cleanup.

## Inspect first

1. `src/document/new-document-controller.js`
2. `tests/new-document-controller.test.mjs`
3. New Document composition in `src/main.js`: `documentChangeSerial`, `doc`, `dirty`, `blockPendingDocumentEdit`, history/recovery publication.
4. `src/selection/clipboard-copy-cut-controller.js` and the destructive raster mutation path to establish when the shared pending guard becomes active.
5. `tests/new-document-composition.test.mjs`, async-document-context/clipboard tests, and relevant architecture source guards.
6. `docs/architecture/BOUNDARIES.md`, `docs/architecture/CODEMAP.md`, `docs/testing/TEST_MATRIX.md`.
7. Current `.github/workflows/ci.yml` before writes.

## Behavioral contracts to preserve

- Pending destructive edit blocks New before replacement publication.
- Existing discard-confirm text remains exact unless there is a strong UX reason to change it.
- A clean, unchanged document should not gain a pointless confirmation.
- A dirty document already confirmed at dialog open should not be prompted twice merely because time passed; a second confirmation is justified only by a newly authoritative dirty/change state.
- Cancel/rejection publishes no document, history reset, dirty reset, recovery write, fit, or success feedback.
- Canonical `createDocument` validation still happens before any replacement publication.
- Real success preserves the current ordered publication contract: factory → history replacement → document replacement → clean state → immediate recovery → fit.
- Shared `canReplaceDocument()` behavior used by other open owners must not be accidentally weakened.

## Diagnose before choosing the fix

Prove which boundary is actually missing. Preferred authority model if evidence supports it:

- capture exact originating document and a monotonic change epoch/serial at modal open;
- at submit, revalidate pending state plus exact owner/epoch;
- if new dirty changes appeared after the previously authorized state, require a fresh discard decision before factory/publication;
- do not use dirty boolean alone as an epoch because `true → true` can hide additional edits.

Alternative: if the real root cause is that a destructive async command should participate in the existing shared pending-edit guard earlier, fix that owner instead **only** if it closes the gap generically without creating overlapping private flags.

Do not patch both paths speculatively.

## Targeted tests

At minimum, add deterministic regressions for the diagnosed contract:

- clean at open → document becomes dirty/new epoch before submit → fresh confirmation is required;
- user rejects that fresh confirmation → factory/publication remain untouched;
- dirty at open → user confirms → no new epoch → no duplicate confirmation at submit;
- dirty at open → user confirms → new epoch arrives before submit → fresh confirmation required;
- exact owner replaced/switched before submit cannot redirect or silently authorize replacement;
- existing submit-time pending rejection remains intact;
- factory failure still has zero partial publication;
- normal success retains exact publication order.

If the Clipboard/Cut path is the proven trigger, add one deferred integration/composition regression that freezes the await, opens New, completes the destructive command, then submits.

## Required verification

Development:

```bash
node --test tests/new-document-controller.test.mjs
```

Add the smallest adjacent composition/async tests required by the chosen root cause.

Before merge:

```bash
npm run check
npm run test:browser
git diff --check
```

Also verify generated parity for `src/app.bundle.js`, `index.html`, and `version.json`.

## Done gate

- Reproduction or contrary evidence is documented.
- No newly dirty document can be discarded by a stale New-modal authorization.
- No duplicate confirmation appears on the unchanged previously-confirmed path.
- Focused regressions cover the temporal boundary.
- Full PR-head CI is green.
- Squash merge is complete.
- Exact merged-main push CI is green.
- This task file is deleted only after that.
- Exactly one fresh bounded next task is queued from new evidence.

## Risks / handoff notes

The dangerous shortcut is “just call `canReplaceDocument()` again on every submit”: that can create duplicate confirmation for a dirty document whose state did not change. Prefer exact owner + monotonic change evidence, or prove a better shared pending-guard fix.

The reusable project-brain rule added after PR #84 applies here too: delayed UI callbacks are temporal boundaries even without an `await` in the callback itself.
