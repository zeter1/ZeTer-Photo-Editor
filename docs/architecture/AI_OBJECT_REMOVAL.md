# Browser AI object removal

## Owners

- `src/painting/object-removal-controller.js`: bounded transient layer-local brush mask, transform preview, frozen owner/serial/geometry/selection/lock/visibility predicate, AbortController, no source mutation while painting.
- `src/painting/object-removal-command-controller.js`: shared persistence exclusion, 8-bit-only preparation, repeated exact-owner continuation checks, mask-only RGB publication via `persistPaintLayer`, one history commit. Error/abort keeps source and valid mask.
- `src/ai/lama-preprocess.js`: pure context ROI, aspect-preserving 512-square edge padding, conservative mask downsampling, model-only margin, finite output validation, mask-only merge with unchanged alpha.
- `src/ai/lama-assets.js`: four pinned size/SHA256 descriptors.
- `src/ai/asset-cache.js`: bounded GET and verified artifact-only IndexedDB; separate database `zeter-object-removal-model-v1`. No photos/masks/tensors. Same origin quota remains shared: reserve 64 MiB, skip optional write if insufficient/unknown, never clear recovery to make space.
- `src/ai/lama-runtime.js`: verified runtime in owned Blob worker; module Blob URL is created inside the worker for file-origin compatibility. One worker per removal; actual termination on cancel/timeout/completion. No worker fetch; WASM/model passed as bytes. WebGPU with WASM fallback, or explicit WASM CPU. One thread does not need cross-origin isolation.
- `src/ui/object-removal-progress-controller.js`: one owned elapsed timer, real prepare/inference/save stages, indeterminate inference bar, approximate remaining time from previous completed inference in this page and selected processing mode. First inference has no invented ETA. Abort/error/success hides the panel and releases the timer; canceled late worker messages do not seed timing.
- `src/ui/toolbar-controller.js`: actionable object-removal help; pointer/focus retention, ArrowRight focuses installation, Escape returns focus; existing informational tooltips retain their behavior.
- `src/ui/editor-settings-controller.js`: explicit model install, progress/cancel, cache-only startup (no network), settings tabs and browser preferences. `src/main.js`: wiring, notifications and keyboard/pointer dispatch. Native dialog prevents document keyboard and clipboard commands while open.

## Fixed model and runtime

LaMa author repository: https://huggingface.co/g-ronimo/lama, revision `418036c6b541e526cdbb0bead1ec3a87dabede53`, `lama_512_int8.onnx` (62,074,990 bytes, Apache-2.0 model card). One input `input` float32 `[1,4,512,512]`: RGB 0..1 zeroed inside hole, fourth channel binary mask 1=erase. One output `output` float32 `[1,3,512,512]`, RGB 0..1. Do not mix preprocessing with models having separate `image`/`mask` inputs or 0..255 outputs.

ONNX Runtime Web 1.30.0 (MIT): matching `ort.webgpu.min.js`, `ort-wasm-simd-threaded.asyncify.mjs`, `ort-wasm-simd-threaded.asyncify.wasm`. This release's WebGPU bundle imports **asyncify**, not the older jsep build. Upstream npm archive integrity and each descriptor hash were checked. Total pinned download: 88,976,378 bytes (~84.85 MiB). Licenses/attribution: `docs/THIRD_PARTY_AI.md`.

## Installation and offline

Selecting the tool without a ready model shows a notice and install button. Apply opens Settings → Models and preserves mask/source. Install is an explicit network action. Installation buttons in the tool help, persistent prominent notice and options bar open the Models tab and start installation directly via `openForInstall`; normal Settings navigation and unprepared Apply only open guidance. Progress includes percent and MiB; cancel aborts fetch. Every network/cache artifact must match exact size+SHA256 before execution. GET uses credentials omit and no referrer, capped streamed bytes and a 180-second deadline. No inference data enters a request.

Verified public artifact buffers are retained for this page, allowing inference even if storage quota denies caching. UI says when the model is ready only for this page. Otherwise subsequent startup restores and re-verifies cached artifacts without a network request. Browser/site origin/file storage policy determines cache lifetime; browser clearing/eviction and private browsing can require reinstall. A website must permit pinned HTTPS artifact fetches and Blob workers/modules/WASM in its CSP. No site publication is performed by a local code change.

Tool help resolves live model readiness on each presentation and refreshes visible help on state changes: ready shows only usage instructions; missing shows installation instructions and action. Settings hides installation while ready and provides **Удалить нейросеть**. Removal deletes only the four `LAMA_ARTIFACTS.id` keys in one `artifacts` readwrite transaction, including partial canceled installations. Success requires `oncomplete`; abort/error/blocked/timeout retains resident readiness. Engine rejects removal during preparation/inference and rejects prepare/run during deletion. Successful deletion releases resident buffers and timing estimates; reinstall is supported. No database deletion, store-wide clear, recovery cleanup, photo/project/history or preference mutation. UI refreshes busy controls when a removal operation finishes with Settings still open.

Removal scope is the artifact cache at transaction completion and the current page's resident model. Other open tabs may keep resident buffers or complete their own pending downloads afterward; no all-tabs uninstall guarantee. `tests/lama-model-removal.test.mjs` covers fixed keys, transaction failure, busy ordering, retained readiness and reinstall. Live Chrome acceptance additionally checks ready/missing tool help, native IndexedDB unrelated sentinel preservation, image/history/preferences and real inference exclusion.

## Limits and evidence

Mask/source limit: 8 million layer pixels. Large or distant objects share a bounded 512-pixel context; quality is not guaranteed for all scenes. User must cover the complete object and its shadow. Native high-depth/CMYK source is rejected before inference; ordinary native Content-Aware Fill remains available.

Pure regressions: `tests/lama-assets.test.mjs`, `tests/lama-removal.test.mjs`, `tests/object-removal-controller.test.mjs`. Normal `tools/browser-smoke.mjs` needs no model download and checks the explicit install guidance, preserved source and mask reset. Real-model acceptance requires Chrome/Edge in an isolated profile, first install/cancel/reinstall, inference cancel/retry, outside/alpha and Undo/Redo, reload offline with recovery modal acknowledged, GPU and explicit CPU. Record first failures and their causes; pure mocks do not prove device/GUI/network behavior.
