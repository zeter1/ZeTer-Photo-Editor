# Task 012 — Extract shared Text typography/settings owner

## Goal

Move the remaining shared Text typography/font settings seam out of `src/main.js` into one small canonical UI owner so both the Text add/edit controller and the Properties inspector reuse the same font discovery, custom-font loading and typography normalization rules.

Target owner: `src/ui/text-settings-controller.js`.

This task is intentionally bounded. Do **not** extract the whole Properties panel and do not move persisted text schema, renderer, PSD Text semantics or the already-extracted Text edit transaction.

## Confirmed starting point — 2026-09-26

- Task 011 is merged on `main`: Text add/edit modal transaction and live preview now belong to `src/ui/text-edit-controller.js`.
- Exact merged implementation checkpoint: `d669d2d1b9e888db4fa77532423fa534f285846b`; its `main` CI passed build/tests, generated-bundle parity, `file://` browser smoke and diff hygiene.
- `src/main.js` is about 3,768 lines after Task 011.
- The remaining cohesive typography seam is still in `src/main.js` around the Text Properties helpers:
  - `TEXT_WEIGHT_OPTIONS`, `TEXT_STYLE_OPTIONS`, `TEXT_ALIGN_OPTIONS`;
  - `localTextFonts`;
  - `customFontReads`;
  - `textFontOptions()`;
  - `loadComputerFonts()`;
  - `readCustomTextFont()` / `loadCustomTextFont()`;
  - `textModalFields()`;
  - `textSettingsFromForm()`.
- Those helpers are shared by:
  - `src/ui/text-edit-controller.js` through composition-root ports;
  - the Text Properties inspector in `src/main.js`;
  - the generic modal font-picker port.
- Properties currently also appends manually entered system-font names into `localTextFonts`, so registry ownership is split across the composition root.

## Root architectural problem

The Text transaction now has a clear owner, but font/typography policy still has mutable state and normalization rules inside the giant composition root. A fresh AI/Codex session has to rediscover the same helper block plus its Properties usages before changing fonts safely.

The next seam should make this ownership explicit without creating a second text schema or a second renderer.

## Required design

Create `src/ui/text-settings-controller.js` (or a clearly better equivalent only if inspection proves the boundary should be named differently) that owns:

- canonical UI option sets for Text weight/style/alignment;
- local-font registry/deduplication used by modal + Properties;
- browser `queryLocalFonts()` discovery, sorting and bounded publication to a supplied `<select>`;
- custom font file read/load cache;
- custom font validation: WOFF/WOFF2/TTF/OTF only, non-empty, maximum 5 MB;
- generation of `fontFamily` / `fontData` / `fontLabel` for loaded custom fonts;
- Text modal field construction;
- Text form-to-settings normalization/clamping;
- a narrow helper for registering a manually entered system font so Properties does not mutate controller internals.

Prefer direct imports for stable low-level helpers and narrow injected ports for browser/effectful dependencies. Keep the API small and make mutable font registry/cache private.

## Preserve exactly

- Existing `queryLocalFonts()` unsupported/permission-denied user messages.
- Local font family filtering, de-duplication, Russian locale sorting and 1,000-font cap.
- Existing option fallback for a layer whose stored font is not currently in the toolbar/local list.
- Custom font size/type validation and failure message.
- Custom font file read caching so repeated preview reads of the same `File` do not decode/load again.
- Existing embedded `fontData` / `fontLabel` retention when editing a layer without replacing its font.
- Current typography bounds:
  - font size 6–500 px;
  - line height 0.8–3;
  - letter spacing -5–20 px;
  - width semantics already enforced by the modal/state path;
  - weight/style/alignment fallback behavior.
- Existing tool defaults sourced from the live toolbar controls.
- Existing Text Properties behavior, including manual system font name, browser font picker and custom font file application.
- Exact document/layer/lock revalidation for asynchronous Properties custom-font publication.
- Generic `modal-controller.js` remains feature-neutral; it may receive a narrow `loadComputerFonts` callback but must not own font registry state.

## Keep outside this owner

- Persisted Text layer schema/sanitization and `documentWithTextPreview()`: `src/core/state.js`.
- Text rasterization and actual font-face loading/cache semantics: `src/core/render.js`.
- Add/edit transaction, latest-wins preview, modal lifecycle and exact Apply guards: `src/ui/text-edit-controller.js`.
- PSD/PSB TySh / EngineData import-export semantics.
- Whole Properties-panel markup/bindings and generic property commit orchestration.
- Generic modal construction.
- Toolbar ownership.

## Suggested ports

The exact API may be improved after inspection, but aim for something close to:

- `createTextSettingsController({...})`
- `fontOptions(value, label)`
- `loadComputerFonts(select)`
- `registerSystemFont(name)`
- `readCustomFont(file)`
- `modalFields(layer, width)`
- `settingsFromForm(values, layer)`

Browser-dependent constructors/functions should be injectable where that materially improves deterministic tests (`windowTarget`, `documentRef`, `FileClass`, ID factory). Avoid leaking mutable arrays/maps.

## Tests required

Add direct tests for the canonical owner rather than VM-slicing `src/main.js`:

1. local-font discovery unavailable path;
2. permission/error path;
3. filtering, de-duplication, locale-sort behavior and 1,000-entry cap;
4. select population preserves the current selection and does not duplicate existing options;
5. manual system-font registration is bounded/deduplicated and appears in future option sets;
6. custom font rejects invalid extension, empty file and >5 MB file;
7. repeated reads of the same file reuse the in-flight/completed cached result;
8. failed custom load evicts the cache so retry is possible;
9. form normalization preserves existing embedded font data when the selected family is unchanged;
10. custom/system font precedence remains unchanged;
11. typography clamps/fallbacks remain unchanged;
12. architecture/source guard proves the mutable registry/cache and helper implementations no longer live in `src/main.js`;
13. existing Text, PSD, rendering, Properties and modal regressions stay green.

If an async Properties race is touched, add/retain a regression that switches document/layer before the font await resolves and proves no stale publication/commit.

## Documentation updates

Update only the navigation/boundary docs that materially help future AI/Codex sessions:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/CODEMAP.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/testing/TEST_MATRIX.md`;
- `CHANGELOG.md`.

Make it explicit that Text transaction and Text settings/font policy are two adjacent but different owners.

## Verification

Use the project GitHub workflow:

1. read current `main`, current blob SHAs and `.github/workflows/ci.yml`;
2. make one bounded feature branch/PR;
3. run the focused new tests while developing where available;
4. require full `npm run check`;
5. require generated `src/app.bundle.js` parity;
6. require `npm run test:browser` for full `file://` startup;
7. require `git diff --check`;
8. inspect PR-head Actions;
9. merge only with the expected head SHA;
10. inspect the exact merged-main push run before deleting this task.

## Acceptance criteria

- `src/main.js` no longer owns `localTextFonts`, `customFontReads`, the Text option constants or the font/settings helper implementations listed above.
- Both Text edit modal and Text Properties consume one canonical settings/font owner.
- No duplicate typography normalization is introduced.
- No feature-specific font state is moved into `modal-controller.js`.
- Direct controller tests cover browser-font discovery, custom-font caching/validation and typography normalization.
- Existing text editing/rendering/PSD compatibility remains behaviorally unchanged.
- Generated bundle is canonical and clean.
- PR CI and exact merged-main CI are green.
- This task is deleted only after those checks pass, then exactly one next bounded task is created.
