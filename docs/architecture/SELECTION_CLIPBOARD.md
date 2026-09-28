# Selection Clipboard architecture

This document is the narrow contract for Selection Copy / Cut / Paste ownership. Read it before changing Clipboard async behavior; do not infer these rules from `src/main.js` or the generated bundle.

## Owner map

```text
src/main.js
  └─ createSelectionClipboardController()
       ├─ clipboard-controller.js
       │    paste/native-paste/fallback generation + public facade
       └─ clipboard-copy-cut-controller.js
            copy/cut render + Clipboard write + latest-command continuation
                 └─ destructive ports
                      ├─ selection/raster-mutation-controller.js
                      └─ painting command/persistence boundary
```

- `src/selection/clipboard-copy-cut-controller.js` owns only Selection Copy/Cut transaction state and `clipboardCommandGeneration`.
- `src/selection/clipboard-controller.js` owns Paste, native paste-event/fallback timing and `pasteGeneration`, and preserves the single public facade consumed by `src/main.js`.
- The two generations are intentionally independent. Do not move either into `src/main.js` and do not combine them into a generic app-wide scheduler.
- Destructive pixel mutation and history publication stay in their raster owners. Clipboard code passes frozen authority and continuation guards through explicit ports.

## Copy / Cut transaction

The required order is:

1. Allocate a new copy/cut command generation.
2. Capture exact originating document/session, exact selection object identity, a cloned full selection snapshot, copy mode, exact selected layer when needed and current tool.
3. Validate target/bounds and prepare a PNG from the captured intent.
4. After async rendering, require both current command generation and exact originating context.
5. Start the OS Clipboard write.
6. After the write resolves, revalidate generation + context before any editor-state continuation.
7. For Cut, call the existing destructive port with the frozen selection and an `isContinuationCurrent` predicate.
8. After destructive async work, revalidate again before success UI, selection cleanup or tool switching.

A newer Copy/Cut supersedes an older command's **post-await editor continuation**, even when both commands started from exactly the same document/layer/selection objects.

## External Clipboard boundary

An already-started browser/OS Clipboard write is an external side effect and is not treated as cancelable. The guarantee is narrower and enforceable: once an older command loses generation/context authority, it cannot later mutate editor pixels/history or overwrite newer status/toast/transient UI.

Do not fake cancellation with sleeps, timestamps or selection bounds. Tests model reorderable awaits with deferred Promises.

Reference: MDN Clipboard `write()` documents the asynchronous Promise-based browser Clipboard boundary: <https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write>.

## Paste lifecycle

Paste uses a separate `pasteGeneration` because its conflicts are different:

- direct `Clipboard.read()` captures document/session and rejects a tab switch before import;
- Ctrl+V fallback owns its timer/generation and ignores stale delayed reads;
- a native paste event advances the Paste generation, cancels fallback timing and imports the browser-provided files;
- Paste does not supersede Copy/Cut continuation merely because it uses the same OS Clipboard.

Keep MIME-to-extension/File construction and paste timers in the Paste/facade owner unless a future evidence-based extraction creates another cohesive owner.

## Mutation and precision invariants

- Clipboard PNG must be written before Cut begins destructive mutation.
- Copy/Cut preparation uses one frozen full selection geometry; live selection changes cannot redirect a pending command.
- Exact object identity is publication authority; same IDs are insufficient.
- A stale/superseded command publishes no pixels, history, success/error status, toast or transient cleanup after losing ownership.
- Native high-depth RGB/CMYK destructive paths stay native where currently supported.
- The latest command may clear the original transient selection only if the same selection object and tool are still current.
- Browser `file://` startup remains first-class.

## Testing and change checklist

For Clipboard changes:

1. Run/inspect `tests/selection-clipboard.test.mjs` first.
2. Keep deferred-Promise regressions for render/write/destructive overlap; never replace them with timing sleeps.
3. Keep structural guards proving:
   - `clipboardCommandGeneration` lives only in the copy/cut owner;
   - `pasteGeneration` lives only in the Paste/facade owner;
   - `src/main.js` imports only the public facade;
   - the canonical build graph includes the copy/cut owner before the facade.
4. Include async-document/raster-persistence regressions when destructive continuation changes.
5. Finish with `npm run check`, generated-artifact parity, `npm run test:browser` and diff hygiene.
6. Treat a source-location/VM harness failure after extraction as a contract migration to inspect, not a reason to duplicate production logic in the old owner.

Current code/tests/CI override stale prose. If this contract changes intentionally, update this document and the nearest behavioral tests in the same bounded change.
