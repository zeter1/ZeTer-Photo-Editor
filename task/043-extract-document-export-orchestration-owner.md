# 043 — Extract document export orchestration owner

## Goal

Move the remaining image/document export orchestration out of the large `src/main.js` composition root into one directly testable document-domain owner without changing export formats or user-visible behavior.

## Why this is next

`src/main.js` still owns `exportDialog()` plus `exportPsdDocument()`. That block mixes:
- pending-edit command guards;
- modal field/schema and format routing;
- immutable document snapshot capture before async export work;
- PNG/JPEG/WebP quality + filename/download flow;
- PSD/PSB preparation, ICC bytes, codec selection, resource limits and warnings;
- status/toast/error publication.

The existing `src/document/psd-export-controller.js` already owns PSD document-to-writer preparation and `src/formats/psd.js` owns binary encoding. The missing boundary is command/UI orchestration.

## Target boundary

Create `src/document/export-controller.js` as the canonical orchestration owner for Export.

Keep:
- `src/document/psd-export-controller.js` — PSD/PSB preparation and semantic mapping;
- `src/formats/psd.js` — binary encode/decode;
- `src/core/io.js` — low-level download / data-url byte helpers;
- `src/main.js` — composition plus menu/button dispatch only.

Use explicit narrow ports. Do not pass a generic app/context bag.

## Behavior to preserve

### Command / modal
- Opening Export is rejected while a persisted document edit is pending.
- Modal title, format options and quality defaults/range stay unchanged.
- Submit repeats the pending-edit guard.
- Export captures one detached document snapshot at submit time before async work; later edits must not alter the in-flight export payload.

### PNG / JPEG / WebP
- Reuse existing composite renderer.
- Quality remains clamped to `0.01..1`.
- Extension comes from the existing MIME mapping.
- Filename uses the existing safe-filename policy.
- Success status and download behavior stay unchanged.

### PSD / PSB
- Keep existing `preparePsdExport` semantics.
- Keep PSD vs PSB codec choice and extension.
- Preserve ICC extraction cap, `48_000_000` max pixels and `500` max layers.
- Preserve warning logging/status/toast and success status/toast.
- Do not duplicate PSD preparation or codec logic in the new owner.

### Errors
- Existing console/error alert/status behavior remains observable.
- No partial download on rejected/pending/error paths.

## Tests / review

Add direct deterministic controller tests for:
- pending guard before modal;
- pending guard on submit;
- snapshot isolation across an async raster export;
- PNG/JPEG/WebP quality, extension and filename routing;
- PSD and PSB callback/codec routing;
- ICC/resource-limit handoff;
- warnings vs clean success publication;
- failure path with no download.

Migrate any source-oracle tests that currently slice `exportDialog` / `exportPsdDocument` from `main.js` to the canonical owner. Do not use the extracted functions as text delimiters for unrelated tests.

Add an architecture/source guard proving:
- `main.js` imports/composes the owner but no longer implements export orchestration;
- the build graph loads the owner before `src/main.js`;
- PSD preparation and binary codec ownership stay in their current modules.

## Documentation

Update the relevant AI routing / CODEMAP / BOUNDARIES / TEST_MATRIX and CHANGELOG. Add a narrow spec only if the extraction reveals reusable async/snapshot invariants not already covered clearly.

## Verification gate

1. focused direct export-controller tests;
2. affected raster-save / PSD export regressions;
3. `npm run check`;
4. generated `src/app.bundle.js`, `index.html`, `version.json` parity;
5. `npm run test:browser`;
6. `git diff --check`;
7. exact PR-head CI;
8. squash merge with expected head SHA;
9. exact merged-main push CI.

Do not delete this task until the merged main commit is green.
