# 055 — Make overlapping Smart Object conversions latest-authorized-wins

## Goal

Prevent an older `convertSelected()` continuation from overwriting the feedback produced by a newer authorized **Convert to Smart Object** command after asynchronous preview rendering. Preserve the existing exact document/session/layer mutation guards; add command-intent authority only for overlap ordering.

## Why now / current evidence

The completed Save pass established the dual-authority pattern for Smart Object content saves. Current `src/document/smart-object-controller.js::convertSelected()` still has one reorderable await:

1. pending/edit + target/type/lock + nesting preflight;
2. capture document/session/source/index/original state;
3. build embedded document;
4. `await renderPreview(embedded)`;
5. exact document/session/source/object-state guard;
6. replace source with Smart Object + commit success.

The existing exact guard correctly prevents an old conversion from replacing a layer after a newer conversion already published. However, it does **not** express command ordering. If A and B both pass preflight against the same unchanged source, B can finish first and publish success; when A later resumes, A sees the replaced source and publishes the stale “conversion cancelled” status over B's success. If A's preview rejects after B became authoritative, the outer catch can likewise log/toast an error from the superseded command.

This is a UI/diagnostic race rather than a document-corruption race, but it violates the repository's latest-authorized async-command contract and can mislead the user about the final successful state.

Implementation baseline: merged Smart Object Save fix `dd4be04d7c716ae917eb71fa15dda8e5fab05f38`; CI #464 passed 918/918 Node tests, generated-artifact parity, Chromium `file://` smoke and diff hygiene. The queue-only commit that creates this task should also be green before implementation starts.

## Inspect first

Read only the smallest relevant route first:

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `src/document/smart-object-controller.js` — especially `convertSelected()`
- `tests/smart-object-controller.test.mjs`
- current `.github/workflows/ci.yml` and latest main Actions run

Use current code/tests/logs as source of truth if this task drifts.

## Required behavior / invariants

### 1. Generation is command-intent authority, not editor-state authority

Add a controller-local monotonically increasing generation dedicated to `convertSelected()` (do **not** reuse the Save generation).

A conversion may claim a generation only after its initial preflight succeeds:

- no pending document edit;
- selected layer exists;
- target is not already Smart Object / Adjustment;
- target is not effectively locked;
- nesting depth allows conversion;
- any other synchronous precondition that rejects the command before preview work begins.

A newer attempt rejected by preflight must **not** revoke an already-authorized older conversion.

### 2. Revalidate immediately after every reorderable await

Currently the relevant boundary is `await renderPreview(embedded)`.

Immediately after that await, first prove the conversion generation is still current. A superseded continuation returns silently before exact stale-state feedback.

If a future await is introduced later in the transaction, revalidate generation again after it and re-prove exact state before mutation.

### 3. Preserve the existing exact owner/target guard independently

Do not replace or weaken:

- exact document object;
- active session ID;
- exact source object still occupying the captured slot;
- unchanged source snapshot/state.

Generation answers “is this still the newest authorized Convert command?”
The exact guard answers “does this prepared result still belong to the same editor state?”

Both protections remain necessary.

### 4. Superseded continuations are silent

After a newer authorized Convert claims generation, an older continuation must publish none of:

- layer mutation;
- history/commit;
- success/cancel/error status;
- toast;
- error/warn log;
- unrelated UI cleanup.

Ordinary editor-state staleness for the still-current command keeps the existing explicit cancellation feedback.

### 5. Preserve single-command behavior

A normal single conversion must keep:

- layer ID/name/visibility/opacity/blend/group semantics;
- source-bounds and embedded-document behavior;
- one `Преобразовать в смарт-объект` commit;
- the existing success status;
- the existing failure reporting when the command is still authoritative.

Do not broaden this pass into Smart Object Save, open/link/unlink, PSD resource code, or generic controller extraction.

## Regression tests

Use deterministic deferred Promises; no sleeps/timers.

Add focused `tests/smart-object-controller.test.mjs` cases for at least:

1. A starts, B starts and therefore supersedes A, A preview resolves first:
   - A returns with no mutation/commit/stale status;
   - B later resolves and publishes exactly once.

2. B resolves/publishes first, A resolves later:
   - document/layer stays at B's result;
   - feedback/log/commit state is unchanged by A.

3. A preview rejects only after B has claimed generation:
   - A failure is silent;
   - B can still publish normally.

4. B never acquires authority because preflight rejects it (pending edit or effective lock):
   - A remains authorized and may publish.

5. Existing tab-switch/source-change cancellation still emits its documented cancellation status when that command remains current.

6. Existing normal conversion identity/commit behavior remains green.

Prefer extending the existing test helper only as needed to observe error/warn output and inject preflight guards.

## Documentation update

Review and update only routing/spec docs that actually help a fresh AI locate this contract:

- `AGENTS.md`
- `docs/PROJECT.md`
- `docs/architecture/CODEMAP.md`
- `docs/architecture/BOUNDARIES.md`
- `docs/testing/TEST_MATRIX.md`
- `CHANGELOG.md`

Keep docs explicit that Convert and Save generations are **separate subsystem command counters** even though both use the same dual-authority pattern.

Do not create a redundant large Smart Object document unless the existing routing docs have become insufficient.

## Generated artifact discipline

If `src/document/smart-object-controller.js` changes, regenerate through the canonical build graph:

- `npm run build`
- commit the resulting `src/app.bundle.js`, `index.html`, and `version.json`
- never hand-edit generated bundle contents as source of truth

## Required verification

Minimum gate:

- focused Smart Object controller tests;
- `npm run check`;
- `git diff --exit-code -- src/app.bundle.js index.html version.json` after the canonical build;
- `npm run test:browser`;
- `git diff --check`;
- exact PR-head CI green;
- squash merge;
- exact merged-main push CI green.

If CI fails: inspect failed step/logs → classify product/test/generated-artifact/harness issue → fix root cause → rerun. Do not weaken checks.

## Done gate

Done only when:

- overlapping Convert commands obey latest-authorized-wins;
- superseded success/error continuations are silent;
- rejected newer preflight does not revoke older authority;
- exact document/session/source guard remains independent;
- deterministic regressions cover both completion orders and rejection/error cases;
- AI navigation/docs describe the contract;
- generated artifacts are canonical;
- PR and merged-main CI are green.

After that, delete this task and create exactly one new bounded task from fresh evidence.
