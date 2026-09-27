# Crop interaction specification

> Read this document when changing the Crop tool, crop overlay, crop pointer lifecycle, per-document Crop draft/session state, or persisted Crop geometry.

## Purpose

Crop intentionally uses two owners instead of one generic geometry controller:

| Concern | Canonical owner |
| --- | --- |
| Tool dispatch and application-level pointer routing | `src/main.js` |
| Pointer capture / release / active pointer identity | `src/interaction/pointer-lifecycle-router.js` |
| Transient Crop gesture, draft rectangle, session-safe snapshot and crop overlay | `src/interaction/crop-gesture-controller.js` |
| Persisted document/layer geometry and `Кадрирование` history | `src/document/crop-command-controller.js` |
| Per-document session container | `src/workspace/session-controller.js` |

Do not collapse these owners unless a new shared contract is demonstrated by production behavior and tests.

## Gesture contract

A Crop pointer gesture:

1. begins from the Crop tool dispatch with the **exact current document object**;
2. stores start/current coordinates in document space;
3. normalizes forward or reverse drags through the canonical geometry helper;
4. uses the actual `pointerup` coordinate even if no final `pointermove` occurred;
5. accepts a pointer crop only when both `width >= 10` and `height >= 10`;
6. returns a semantic accepted/rejected result to `src/main.js`;
7. never mutates document geometry and never commits history itself.

The 10×10 pointer gate is intentionally different from Crop-to-Selection's existing 1×1 eligibility gate.

## Exact-owner safety pattern

A gesture captures document object identity at `begin()`. `update()` and `finish()` may produce a live/accepted intent only while the current document is that exact object.

A tab switch, document replacement or stale gesture must clear its transient Crop state rather than redirecting a crop into a different document.

The persisted command repeats its own exact-owner validation before writing. This duplication across the transient/persisted boundary is intentional defense-in-depth, not duplicated ownership.

## Session snapshot pattern

Only immutable Crop **presentation geometry** may enter a document-session snapshot:

```text
{x, y, width, height} | null
```

Restoring a session must clear active pointer ownership. Never serialize or resurrect a gesture object, captured document owner, PointerEvent, pointer ID or pointer-capture state.

## Cancellation/reset contract

These paths must leave no stale Crop draft:

- pointer cancel / lost capture;
- Escape during an active Crop drag;
- Escape while only a Crop draft is visible;
- tool switch;
- document replacement;
- history jump;
- geometry-reset completion after Crop/Resize;
- session activation before a safe snapshot is restored.

Cancellation is transient-only. It does not publish history.

## Overlay specification

When a Crop draft is visible, it is drawn before selection and later overlay surfaces with these exact visual rules:

- outside dimming fill: `#0008`;
- clear Crop window from the dimming layer;
- border: `#ffffff`;
- border width: `1 / zoom`;
- border dash: `[8 / zoom, 5 / zoom]`;
- thirds alpha: `.72`;
- thirds dash: `[4 / zoom, 5 / zoom]`;
- vertical + horizontal guides at 1/3 and 2/3;
- Canvas state is balanced with `save()` / `restore()`.

Do not silently move Crop rendering later in the overlay stack: ordering is observable behavior.

## Change checklist for AI/Codex

Before changing Crop:

1. read this specification plus `docs/architecture/BOUNDARIES.md`;
2. inspect both Crop controllers and the live pointer/session callers;
3. search source-sliced/VM tests before changing pointer function dependencies;
4. keep transient and persisted owners separate;
5. preserve exact-owner guards, final-release geometry and both minimum-size policies;
6. update direct owner tests plus one structural ownership guard;
7. regenerate browser artifacts through `npm run build`, never by hand;
8. run `npm run check`, generated-artifact parity, browser smoke and diff hygiene;
9. prove the exact PR head in CI and then the merged `main` SHA.

## Forbidden drift

Do not:

- add history/commit ports to the transient Crop owner;
- move Crop-to-Selection policy into the gesture controller;
- restore active gestures from session data;
- make a stale gesture target whatever document is current;
- duplicate `cropRect` as mutable state in `src/main.js`;
- edit `src/app.bundle.js` as an independent source of truth;
- weaken failing tests or CI to make an extraction green.
