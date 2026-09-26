# Quality playbook for AI/Codex changes

Use this document for non-trivial refactors, bug fixes, reliability work and reviews. It complements the repository map; it is not a replacement for reading the exact owner and tests.

## Operating loop

INSPECT → DIAGNOSE → PLAN → CHANGE → VERIFY → REVIEW → DELIVER.

1. **Inspect the current owner.** Read `AGENTS.md`, `docs/PROJECT.md`, one targeted architecture/test map, then search for the exact symbol. Do not preload all of `src/main.js` or historical docs.
2. **Diagnose before changing behavior.** For a bug, collect the observable failure, exact reproduction, current invariant and the first incorrect state transition. A hypothesis is not a fix.
3. **Plan one bounded change.** Prefer one self-contained extraction or one root-cause fix with related tests. Avoid mixing unrelated cleanup, feature work and architecture moves.
4. **Change the canonical owner.** Keep state ownership explicit, pass dependencies through narrow ports, and do not create a second source of truth.
5. **Verify at the layer that can falsify the claim.** Syntax/unit tests are not a substitute for browser/file:// verification when the changed contract is browser-only.
6. **Review the diff as a reviewer, not as its author.** Look for hidden coupling, stale async publication, concurrency/ownership bugs, lost error context, weakened invariants and tests that merely mirror the implementation.
7. **Deliver with evidence.** State exact checks that passed and explicitly mark anything not verified.

## Refactoring a large orchestrator

Extract a section only when it has a coherent owner and a narrow API.

Before extraction:
- identify state owned by the section and state merely borrowed from the runtime;
- identify all callers, async callbacks, timers and persistence side effects;
- locate source-contract tests that assert the old file layout;
- write or preserve behavior-level regressions for risky paths;
- note bundle order and `file://` constraints.

During extraction:
- prefer grouped ports over implicit globals;
- keep browser/storage adapters at the boundary;
- keep ownership checks inside the domain/controller boundary, not only in UI;
- do not duplicate mutable state during migration;
- keep generated files generated.

After extraction:
- direct-test the new public controller/helpers;
- keep one architecture test that proves the code did not drift back into `src/main.js`;
- regenerate `src/app.bundle.js`;
- run `npm run check`, then `npm run test:browser` when startup/DOM/file:// paths are affected.

## Debugging and reliability

Evidence order:
1. expected behavior;
2. actual behavior;
3. minimal reproduction;
4. relevant log/trace/browser error;
5. state immediately before and after the first wrong transition;
6. root cause;
7. regression that would fail on the old defect.

For async code, always ask:
- which document/session/window owns this operation?
- can the owner change while awaiting?
- is publication revalidated after the await?
- are writes serialized where order matters?
- can a stale timer or callback publish after cancellation?
- does a UI affordance enforce a rule that should also be enforced in the controller/domain?

Do not hide failures with broad catch/suppression. Catch where the program can make an explicit recovery decision and preserve useful context without secrets.

## Test oracle rules

A green test is useful only if the broken behavior would make it fail.

Prefer:
- public/controller API over source slicing or VM execution of private function text;
- observable state/output over internal call order;
- deterministic fakes for time/storage/network at unit level;
- at least one realistic integration/browser path for browser contracts;
- minimal regression fixtures over large opaque dumps.

For a bug fix, use red-before-green when practical. If that is not practical, document the limitation and choose the closest independent oracle. Ask the mutation question: “what plausible defect would make this test fail?”

## Code-review checklist

Review design first:
- does the responsibility belong in this module?
- is there exactly one owner for mutable state?
- are dependency directions still obvious?
- did complexity move, or only change filename?

Then review functionality:
- success path and failure path;
- async/session/window ownership;
- cancellation and cleanup;
- destructive data safety;
- high-depth/CMYK and PSD/PSB invariants where relevant.

Then review tests:
- would they fail if the changed behavior broke?
- do they test a contract rather than implementation trivia?
- are important adjacent cases covered without duplicating the algorithm?

## GitHub/CI discipline

Before writes, inspect `.github/workflows/` and current branch/head. Keep one conceptual change per commit/PR with its tests and docs. Do not weaken CI to make a refactor green. If CI fails: run → failed job/step → logs → classify → root cause → fix → rerun.

The current CI intentionally uses read-only contents permission and concurrency cancellation for outdated runs. Preserve least privilege unless a workflow genuinely needs write access.

## Agent-legibility / token economy

Keep `AGENTS.md` short and navigational. Put deeper rules in targeted docs and keep code maps current. A future agent should be able to answer “which file owns this?” before opening large source files.

For long refactors, keep a small versioned queue in `task/`: one bounded task per Markdown file with owner, contracts, tests, verification and done gate. Read only one relevant task per pass. The queue records future work, never overrides current code/logs/CI, and completed task files are deleted only after merge plus green CI. This follows the repository-local execution-plan pattern while matching this project’s requested lightweight workflow.

When a new subsystem is extracted:
- add it to `AGENTS.md` and `PROJECT.md`;
- add ownership and non-ownership to `CODEMAP.md` / `BOUNDARIES.md`;
- add its direct test to `TEST_MATRIX.md`;
- update source-graph architecture tests where useful.

## Source checkpoints

- OpenAI, “Harness engineering: leveraging Codex in an agent-first world” (2026-02-11): repository-local knowledge, short `AGENTS.md`, progressive disclosure, versioned active/completed execution plans, mechanically enforced architecture.
  https://openai.com/index/harness-engineering/
- Google Engineering Practices, “Small CLs” and code-review guidance: self-contained changes, related tests, design/functionality/test review.
  https://google.github.io/eng-practices/review/developer/small-cls.html
  https://google.github.io/eng-practices/review/reviewer/looking-for.html
- GitHub Actions docs: least-privilege `GITHUB_TOKEN` permissions and concurrency controls.
  https://docs.github.com/en/actions/tutorials/authenticate-with-github_token
  https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency
- MDN, `unload` guidance: prefer `visibilitychange` for state persistence; do not rely on unload-time async storage.
  https://developer.mozilla.org/en-US/docs/Web/API/Window/unload_event
