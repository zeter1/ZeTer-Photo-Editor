# AI / Codex workflow

## Goal

Find the smallest correct context, change the canonical owner, and prove the result without making the model reread the entire editor.

## 1. INSPECT

Read in this order:
1. `AGENTS.md`;
2. `docs/PROJECT.md`;
3. one targeted map (`CODEMAP`, `BOUNDARIES` or `TEST_MATRIX`);
4. the exact source symbol and nearby test.

Avoid opening all of `src/main.js`, `src/formats/psd.js`, `CHANGELOG.md` or historical docs unless the task truly spans them.

## 2. DIAGNOSE

For bugs, start from observable evidence: failing test, browser error, traceback, exact UI reproduction or corrupted format fixture. Classify the owner before editing.

Useful routing:
- DOM/tool interaction → main + ui
- document/layer invariant → state
- clone/heal/smudge/blur/dodge/burn mechanics → retouch/controller + painting/controller state; include painting/gesture-controller when the bug is in stroke begin/move/end routing
- raster edit buffer / high-depth working state / persistence / paint preview → painting/controller
- brush/eraser/retouch stroke begin/move/end → painting/gesture-controller + painting/controller + retouch/controller
- fill / raster line / current-layer selection clear → painting/command-controller + painting/controller + pixel-buffer/pixels; main only supplies selection/tool/transaction ports
- merged Clipboard cut / multi-layer selection clear / rasterize selected layer → selection/clipboard-controller + selection/raster-mutation-controller
- pixels/precision → pixel-buffer/pixels
- rendering → render
- ICC/CMYK → color-management
- PSD/PSB → formats/psd
- startup/file:// → build-bundle + browser-smoke

## 3. PLAN

Prefer a bounded diff. Preserve existing behaviour not named by the task. If moving code, define its new owner and dependency direction first.

## 4. CHANGE

- edit canonical modules, never generated bundle directly;
- keep old import paths only as tiny compatibility shims when migration risk justifies them;
- do not hide failures with broad try/catch, disabled tests or weak assertions;
- add regression coverage for fixed behaviour.

## 5. VERIFY

Minimum source change gate: `npm run check`.

Also use `npm run test:browser` for startup, DOM, toolbar, menus, persistence and real `file://` behaviour.

A green syntax check is not proof of Canvas/pointer/format/runtime behaviour. Report NOT VERIFIED for layers you could not exercise.

## 6. REVIEW

Inspect the final diff for:
- accidental generated/manual edits;
- stale import paths;
- duplicated owners;
- changed safety limits;
- missing changelog;
- docs that point at old paths.

## 7. DELIVER

State what changed, what was actually verified, and any remaining NOT VERIFIED layer. Do not claim stronger verification than the evidence.

## Token-saving search strategy

Use path → symbol → bounded range → nearest test. Historical notes are last resort, not the first context loaded.
