# 003W/2b-2h — Real failed PSD/PSB File Open rollback during native dense Worker

**Priority:** P1. **Status:** TODO. **Parent:** 003W/Stage 003. **Dependency:** [003W/2b-2g](003w2b2g-dense-import-replacement.md) merged and exact-main checks verified.

## Goal

Prove actual file:// Chromium refused/corrupt or unimportable PSD/PSB File Open while a genuine ~1.97M-pixel high-depth Content-Aware Fill Worker is in flight. Decode/preview failures must not revoke its lease, corrupt native bytes or History, or leak a replacement tab.

## Acceptance criteria

1. Independent PSD16 and PSB32 genuine high-depth source documents (ZeTer-authored, with Photoshop-authored provenance still tracked separately), one in-flight real Blob Worker each; capture original owner, frozen selection count, native exact bytes and preview.
2. Execute real File → Open UI with an explicitly approved but malformed/unsupported high-depth file; produce an actual file decode/preview failure, not a fake Worker callback. Old Worker remains owned and cancellable (no premature termination or stale replacement publication).
3. Confirm no new tab, no altered native data/preview/History; original Worker either finishes safely on the original owner or can be explicitly cancelled, with bounded settle and no cross-document writes.
4. Retry a valid native import and then perform a genuine dense Worker fill on the new owner, with selected-only mutation, alpha unchanged and byte-exact Undo/Redo.
5. Add strict independent PSD16/PSB32 JSON receipts, fail-closed negative validator tests, observational timing (no unsupported CPU/RSS/Worker→PID claim), CI checks, real-photo when applicable, PR merge and exact-main verification. Respect the 2,000,000 index and 180s limits and preserve file:// operation.

## Implementation starting points

`src/document/psd-import-controller.js`, `src/document/import-controller.js`, `tools/browser-near-cap-ui-smoke.mjs`, `tools/browser-smoke.mjs`, `task/003w2b2g-dense-import-replacement.md`.

**Known limitations:** independent Photoshop-authored PSB32 P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED; 003T operation-only RSS/CPU peak and exact Worker→PID mapping unresolved. Do not declare parent 003W or Stage 003 DONE.
