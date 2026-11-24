# NEXT - ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 17a / CAP-PSD-ISOLATED-GROUP-COMPOSITE-PARITY / v1.47.31 Color Dodge / Color Burn clipping bases.
> **PRIORITY:** P1.
> **STATUS:** IN PROGRESS - targeted and full dedicated Windows Chromium and focused Node PASS; stacked candidate, remote gates pending.
> **BASE MAIN SHA:** 72e49f9f8b244aded1ffa5ff435cc8664691ef8c (#412 merged, both workflows PASS).
> **ACTIVE PR:** #413 parent OPEN on main; Color Dodge/Burn candidate stacked on #413 head 5e7fca96b931e38cbba3bcb8a56e09a29518b893 (branch feat/psd-dodge-burn-clipping-base-20261124).
> **LAST VERIFIED:** **Stage 17a / v1.47.31 Color Dodge / Color Burn — IN PROGRESS (2026-11-24):** production renderer extends the contiguous source-stack path to raster and isolated folder Color Dodge/Burn before actual backdrop blend. Windows live Chromium file:// RED exit 1 (expected [59,204,208,160], old actual [53,233,226,160]) → GREEN exit 0 (actual [59,202,207,160], unchanged ±2). 12 new scalar cases (2 modes × raster/folder × alpha 0/128/255), 24 new editable native PSD/PSB export/reimport paths, partial masks/opacity, clipped Levels/Invert, History Undo/Redo and .zpe PASS. Full dedicated Chromium exit 0 (148 total roundtrips expected from 124+24); focused Node 24/24 PASS; build 4905ef9579072cb3; diff hygiene PASS. Full npm check NOT RUN this pass. Seven remote runtime/test/build/README blob SHAs match local; CHANGELOG wording inspected separately. Linux CI not accepted. Synthetic, not Adobe-authored. Parent #413 exact head `5e7fca96b931e38cbba3bcb8a56e09a29518b893` core and independent pending; stacked draft must not merge before #413 and its exact-main gates. No schema or codec change.
> **REMAINING ACCEPTANCE:** #413 exact PR-head core/independent PASS, required gates, merge and exact-main CI; then reconcile this stacked candidate to main, exact-head core/independent, guarded merge and exact-main CI.
> **NEXT IMPLEMENTATION ACTION:** complete #413 acceptance, then accept existing Color Dodge/Burn candidate without duplicate implementation.
> **BLOCKERS:** licensed Adobe-authored clipping/knockout oracle; genuine camera DNG and LibRaw reference.

## Short queue

1. P1 #413 Soft Light acceptance.
2. P1 Color Dodge/Burn candidate acceptance.
3. P1 CAP-RAW-CAMERA-ORACLE (external reference blocked).
4. P2 Stage 6 Tiled Worker, Stage 8 ICC, Stage 2 vector masks.

[Stage 17a journal](002-psd-folder-group-mask.md) | [Capability matrix](CAPABILITY_MATRIX.md) | [task map](README.md).
