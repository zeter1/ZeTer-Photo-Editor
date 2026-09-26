# Task 008 — Photoshop Smart Object embedded-resource rewrite seam

## Goal

Убрать следующий маленький cohesive Photoshop-specific owner из `src/main.js`: подготовку embedded PNG/PSD/PSB payload, rewrite `liFD`/linked-layer resource blocks и публикацию native Smart Object baseline metadata. После Task 007 generic Smart Object lifecycle уже живёт в `src/document/smart-object-controller.js`; следующий шаг должен окончательно оставить `main.js` только wiring для этого Photoshop resource path.

## Why now / evidence

После merge Task 007 в `main` остаётся отдельный плотный блок примерно вокруг:

- `serializePhotoshopEmbeddedAsset()`;
- `rewritePhotoshopEmbeddedSource()`;
- `applyPhotoshopEmbeddedSourceRewrite()`;
- `updatePhotoshopSmartObjectRewriteMetadata()`.

Этот блок уже отделён от generic lifecycle narrow ports:
`rewriteEmbeddedSource`, `publishEmbeddedSourceRewrite`, `updateTargetAfterRewrite`.

Значит seam теперь маленький, явно очерченный и может быть вынесен без повторного изменения Smart Object session/content policy.

## Inspect first

- `src/main.js` — четыре helpers, composition wiring и все оставшиеся callers;
- `src/document/smart-object-controller.js` — только port contract; generic lifecycle не переносить назад;
- `src/document/psd-export-controller.js` — `prepareDocument` / export-preparation contract;
- `src/document/psd-native-metadata-plans.js` — fingerprints + opaque block state conversions;
- `src/formats/psd.js` — `rewriteEmbeddedLinkedLayerAsset`, PSD/PSB encoders and size/format contracts;
- `src/core/io.js` — bounded data URL decoding;
- Stage 14b/14c, Smart Object controller, PSD round-trip/export integration tests;
- `docs/architecture/CODEMAP.md`, `BOUNDARIES.md`, `TEST_MATRIX.md`.

## Scope

1. Define one canonical Photoshop Smart Object resource owner, preferably a small module under `src/document/` such as `psd-smart-object-resource.js` (rename only if inspection proves a clearer responsibility).
2. Move embedded asset serialization/rewrite + publish/baseline metadata helpers out of `src/main.js`.
3. Keep low-level PSD/PSB binary codec implementation in `src/formats/psd.js`; do not copy codec logic into the document owner.
4. Preserve Task 007 prepare-before-publish invariant:
   - async rewrite prepares a result without mutating parent document;
   - generic controller revalidates originating content/session and parent identity;
   - only then publish port applies `psdLinkedLayerBlocks` and per-target metadata.
5. Prefer direct imports for stable pure/core/format primitives. Inject only host/effectful or orchestration capabilities whose ownership genuinely remains elsewhere (notably PSD export preparation if still controller-owned).
6. Add direct regression tests and one architecture guard proving `src/main.js` no longer owns Photoshop embedded-resource rewrite policy.
7. Update AI routing docs, source-contract tests, changelog and deterministic bundle.

## Preserve exactly

- supported embedded payload types: PNG / PSD / PSB;
- 40 MiB embedded asset bound and 4 MiB ICC profile bound;
- PSD vs PSB encoder selection;
- `maxPixels: 12_000_000` and `maxLayers: 200` export safety limits;
- native rewrite eligibility: matching UUID, embedded data asset, import baseline, unchanged embedded dimensions;
- `liFD` matching UUID rewrite behavior and source key/size metadata;
- fallback reasons/messages used by generic lifecycle;
- `previewFingerprint`, `embeddedFingerprint`, width/height baseline update;
- no parent-document or target mutation before generic controller stale-context revalidation.

## Non-scope

- changing PSD/PSB codec bytes or descriptor parsing;
- changing Smart Object convert/open/save/link/unlink behavior;
- adding new embedded formats;
- changing PlLd transform semantics for resized embedded documents;
- broad PSD export/import refactor;
- new Smart Object UI/features.

## Targeted tests

At minimum cover:

- PNG payload serialization path and size-bound failure;
- PSD and PSB path selection without changing export safety limits;
- unsupported payload fallback/error contract;
- rewrite eligibility failures: non-data source, missing baseline, dimension change, missing matching UUID;
- successful rewrite returns prepared linked-layer blocks **without mutating parent document**;
- publish applies prepared blocks only when called after controller revalidation;
- target metadata update preserves UUID/source identity and refreshes baseline fingerprints;
- architecture/source guard: `main.js` only wires the owner; binary codec remains in `src/formats/psd.js`;
- existing Stage 14c + Smart Object async race regressions stay green.

## Required verification

Targeted resource/Smart Object/PSD integration tests → `npm run check` → generated bundle parity → `npm run test:browser` → exact-head PR CI → squash merge with expected-head guard → exact merged `main` push CI.

## Review questions

- Did serialization/rewrite policy get one clear owner without pulling generic Smart Object lifecycle back into it?
- Is prepare-before-publish still mechanically enforced across every `await`?
- Did any size limit, eligibility guard, UUID/source identity or fallback reason drift?
- Are low-level PSD byte operations still owned by the format adapter rather than duplicated?
- Can a fresh AI session find the resource owner from `AGENTS.md`/CODEMAP without reading `main.js`?

## Done gate

Delete this task only after the merged `main` SHA is green. Then inspect the remaining `src/main.js` orchestrator and create only one next bounded task for the highest-value cohesive seam.
