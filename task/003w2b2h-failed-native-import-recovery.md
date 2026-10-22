# 003W/2b-2h — Real failed PSD/PSB File Open rollback during native dense Worker

**Priority:** P1. **Status:** DONE. **Parent:** 003W/Stage 003. **Dependency:** [003W/2b-2g](003w2b2g-dense-import-replacement.md) merged and exact-main checks verified.

## Goal

Prove actual file:// Chromium refused/corrupt or unimportable PSD/PSB File Open while a genuine ~1.97M-pixel high-depth Content-Aware Fill Worker is in flight. Decode/preview failures must not revoke its lease, corrupt native bytes or History, or leak a replacement tab.

## Acceptance criteria

1. Independent PSD16 and PSB32 genuine high-depth source documents (ZeTer-authored, with Photoshop-authored provenance still tracked separately), one in-flight real Blob Worker each; capture original owner, frozen selection count, native exact bytes and preview.
2. Execute real File → Open UI with an explicitly approved but malformed/unsupported high-depth file; produce an actual file decode/preview failure, not a fake Worker callback. Old Worker remains owned and cancellable (no premature termination or stale replacement publication).
3. Confirm no new tab, no altered native data/preview/History; original Worker either finishes safely on the original owner or can be explicitly cancelled, with bounded settle and no cross-document writes.
4. Retry a valid native import and then perform a genuine dense Worker fill on the new owner, with selected-only mutation, alpha unchanged and byte-exact Undo/Redo.
5. Add strict independent PSD16/PSB32 JSON receipts, fail-closed negative validator tests, observational timing (no unsupported CPU/RSS/Worker→PID claim), CI checks, real-photo when applicable, PR merge and exact-main verification. Respect the 2,000,000 index and 180s limits and preserve file:// operation.

## Pre-acceptance implementation checkpoint (2026-10-22)

- Branch: [test/003w2b2h-failed-psd-import-recovery-20261022](https://github.com/zeter1/ZeTer-Photo-Editor/tree/test/003w2b2h-failed-psd-import-recovery-20261022).
- Browser mode `ZPE_DENSE_FAILED_IMPORT_BROWSER_ONLY=1` now drives **real malformed PSD/PSB bytes through File → Open** while a genuine ~1.97M native Worker is in flight. It checks the dirty approval, import error, original Worker still running with no reply/termination, original preview and History, then explicitly cancels via Escape.
- After cancellation it reads the original native tiles through File → Save Project and checks byte-exact original source; then imports an independently different valid native file and checks its data, completed second genuine dense Worker, alpha, outside-selection pixels, exact Undo/Redo, one tab and zero stale Worker replies.
- New strict dual-format JSON receipts/negative Node tests and isolated Chromium CI job. **PR #317**: https://github.com/zeter1/ZeTer-Photo-Editor/pull/317. Initial [CI #39817238849](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39817238849) FAILED: missing constant in new Node negative tests; the genuine Chromium test also waited for a status which the *original* Worker legitimately overwrote on completion. Both test faults repaired. Next run exposed a genuine production error: `ui.alert` was unbound and threw `Illegal invocation` instead of showing actual PSD/PSB decode error. Fixed in `src/main.js`, updated deterministic `src/app.bundle.js`/`index.html`/`version.json`, test now freezes Worker/native/History at the real error callback, then actively cancels old Worker and retries. **Final PR-head CI, both browser receipts, real-photo, merge, exact-main still UNVERIFIED.** Do not mark DONE.
- Files: `src/main.js`, generated `src/app.bundle.js`, `index.html`, `version.json`, `tools/browser-near-cap-ui-smoke.mjs`, `tools/browser-smoke.mjs`, `tools/browser-dense-failed-import-evidence.mjs`, `tools/verify-browser-dense-failed-import-evidence.mjs`, `tests/browser-dense-failed-import-evidence.test.mjs`, `.github/workflows/ci.yml`, `task/README.md`, `task/NEXT.md`, `CHANGELOG.md`.
- Follow-up: inspect real CI and fix observable failures before acceptance; PR and SHA to be recorded after creation. No CPU/RSS peak, Worker→PID, independent Photoshop PSB32 claim.

## Final acceptance (2026-10-22)

**DONE**: [PR #317](https://github.com/zeter1/ZeTer-Photo-Editor/pull/317) MERGED to exact [main 09a6639f](https://github.com/zeter1/ZeTer-Photo-Editor/commit/09a6639fd1708d32dc4b65c201ccbc755a63aa69), PR-head d7a4d11e. All final checks passed:
- [PR CI #39818707919 attempt 2 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39818707919), including 1463 Node tests, generated bundle/cache exactness and fresh real PSD16+PSB32 Chromium `dense-failed-import-browser` with JSON artifacts. First CI attempt needed repair of a Node-test missing import and test timing; rerun after genuine `ui.alert` production repair passed. Unrelated DevTools-startup timeouts in the first final attempt passed on rerun, without weakening browser assertions.
- [PR real-photo #39818706912 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39818706912).
- [Exact merged-main CI #39819777597 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39819777597) and [merged-main real-photo #39819777848 SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39819777848).
- Independent PSD16 and PSB32 receipts: real 12-byte malformed File Open approved while 1,973,400 selected native indices were in-flight; rejected decoder displayed accurate error, original Worker's lease persisted with untouched raster native, preview, History and one tab. Explicit Escape then exact Save Project native verification; valid distinct high-depth source import + second real dense Worker, only selected-color pixels changed, alpha and outside selection unchanged, no stale old replies, exact Undo/Redo and one tab.
- No operation-exclusive CPU/RSS peak or proven Worker→PID mapping; independent Photoshop-authored PSB32 is still blocked. Stage 003 and parent 003W/003T are NOT DONE. Next: [003W/2b-2i](003w2b2i-failed-import-worker-completion.md).

## Implementation starting points

`src/document/psd-import-controller.js`, `src/document/import-controller.js`, `tools/browser-near-cap-ui-smoke.mjs`, `tools/browser-smoke.mjs`, `task/003w2b2g-dense-import-replacement.md`.

**Known limitations:** independent Photoshop-authored PSB32 P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) BLOCKED; 003T operation-only RSS/CPU peak and exact Worker→PID mapping unresolved. Do not declare parent 003W or Stage 003 DONE.
