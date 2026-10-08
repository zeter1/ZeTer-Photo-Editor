# Document export transaction

`src/document/export-controller.js` is the canonical owner of the user-facing **Export** command. It owns command/modal orchestration and format routing, but it does not render pixels, prepare PSD layer payloads, encode PSD/PSB bytes or implement low-level downloads.

## Ownership map

| Concern | Canonical owner |
|---|---|
| Export modal schema, pending-edit preflight, submit routing, feedback | `src/document/export-controller.js` |
| Detached document snapshot representation | `src/core/state.js` via explicit ports |
| PNG/JPEG/WebP composite rendering | `src/core/render.js` via `compositeToBlob` port |
| PSD/PSB document → writer preparation | `src/document/psd-export-controller.js` |
| Photoshop-native metadata eligibility/rewrite plans | `src/document/psd-native-metadata-plans.js` |
| PSD/PSB binary encoding | `src/formats/psd.js` via codec ports |
| Safe filename, ICC data-url bytes, browser download | `src/core/io.js` via IO ports |
| Runtime composition/menu/button dispatch | `src/main.js` |

## Transaction contract

The command is intentionally split into two phases.

### 1. Open

1. Check `blockPendingDocumentEdit()`.
2. If an edit is pending, do not open the modal.
3. Otherwise expose the existing format/quality schema.

### 2. Submit

1. Repeat `blockPendingDocumentEdit()`. The document may have entered a pending raster transaction while the modal was open.
2. Capture exactly one detached export document with `restoreDocument(snapshotDocument(getDocument()))`.
3. Do not read the mutable live document again for the in-flight export.
4. Route the detached snapshot:
   - PNG/JPEG/WebP → `compositeToBlob`;
   - PSD/PSB → PSD preparation → selected codec.
5. Publish the browser download only after rendering/preparation/encoding succeeds.
6. Publish format-specific status/toast diagnostics.
7. On failure, keep the error observable through console + alert/status and publish no partial download.

The snapshot must be captured **before the first asynchronous export boundary**. JavaScript `await` yields execution; relying on the live document after that point would let later user edits silently change the meaning of an already-submitted command.

## Windows-safe download names

`src/core/io.js` exposes one `safeFilename` helper shared by raster/PSD/PSB export and native `.zpe` Save (via `src/document/project-controller.js`). A document name is a filename **stem**: these callers append the format extension after sanitization. Preserve Unicode and ordinary valid names, replace forbidden Win32 filename/control characters, remove trailing dots/spaces and prefix reserved device stems (`CON`, `PRN`, `AUX`, `NUL`, `COM1–9`, `LPT1–9`, `CONIN$`, `CONOUT$` and the Win32 superscript-digit spellings) with `_` even when the document name has a suffix. Empty/dot-only names fall back to `image`. Do not let a canvas/export controller maintain a second filename sanitizer.

## PSD/PSB invariants

Do not move these concerns into the orchestration owner:

- layer/group/path/native-metadata preparation stays in `psd-export-controller.js`;
- binary layout stays in `formats/psd.js`;
- the orchestration owner receives both through narrow ports.

Preserve the current writer handoff limits:

- ICC profile data URL: maximum `4 * 1024 * 1024` bytes;
- writer `maxPixels`: `48_000_000`;
- writer `maxLayers`: `500`.

PSD and PSB keep separate codec/extension routing. Preparation warnings are not failures: the file is downloaded, then the bounded warning count is surfaced in status/toast and details stay in the console.

## Testing contract

Prefer direct controller tests over evaluating slices of `src/main.js`.

At minimum cover:

- pending guard before modal;
- pending guard on submit;
- detached snapshot isolation across a delayed raster export;
- PNG/JPEG/WebP quality clamp + extension + filename routing;
- PSD vs PSB codec selection;
- ICC/resource-limit handoff;
- clean vs warning completion;
- thrown render/preparation/codec error with zero downloads;
- architecture guard proving `main.js` only composes the owner and the file:// build graph loads it before `main.js`.

When this wiring changes, finish with `npm run check`, generated-artifact parity and `npm run test:browser`.
