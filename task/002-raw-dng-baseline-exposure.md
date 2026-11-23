# CAP-RAW-DNG-BASELINE-EXPOSURE — bounded local v1.47.8 (2026-11-20)

**Stage 9 · P1 · bounded implementation DONE LOCALLY; remote integration IN PROGRESS.** Local code commit: cb1c879f5f76fcd86378667eb90fc4d25fa95a09 on branch feat/raw-dng-tonal-controls-port-20261120. Based on existing local v1.47.7 RAW stack. Not published to GitHub. Parent RAW pipeline IN PROGRESS.

## Real implementation

- src/formats/dng.js: parse TIFF 50730 BaselineExposure signed SRATIONAL[1] in II/MM IFD0 or CFA; missing defaults to 0 EV. Reject conflicting duplicate metadata, invalid TIFF type/count, zero denominator, inaccessible pointer or camera EV outside ±16. ±16 is a bounded safety rule, not a normative DNG-wide limit.
- Apply 2**(camera BaselineExposure + user Exposure) to linear RGB after camera colour calibration and before tonal adjustments and sRGB OETF. Manual Exposure slider and Reset stay relative to camera baseline. Does not recover clipped sensor highlights.
- src/document/import-controller.js and src/core/state.js: preserve original DNG bytes, whitelist camera EV provenance in .zpe v1/v2 and default legacy project metadata to zero; reject invalid explicit values. Redevelopment re-reads native source rather than trusting provenance.
- src/main.js: show read-only BaselineExposure EV in actual RAW Properties, preserving user Exposure/WB/Highlights/Shadows, History Undo/Redo and layer/session guards.
- tests/fixtures/dng-fixture.mjs: synthetic II/MM signed rational TIFF tag; tests/dng-baseline-exposure.test.mjs: 4 new tests; tests/dng-import-controller.test.mjs: .zpe provenance; tools/browser-raw-dng-check.mjs: actual Chromium file:// FileInput, RGBA, property, exposure Undo/Redo and .zpe.
- Version 1.47.8 canonical bundle, HTML and manifest from npm run build.

## Verification

- **RED:** before code change, 0/4 new Node tests passed: absent 50730 metadata, pixel mismatch, fail-open corrupt tag, dropped .zpe provenance.
- **GREEN:** 4/4 new tests, 35/35 focused combined tests (camera colour/DefaultCrop/import/tonal/version/baseline). npm run build PASS, git diff --check PASS.
- **LIVE local Chromium file:// PASS:** DNG FileInput → actual RGBA pixel oracle with +0.5 EV → RAW Properties → user Exposure → History Undo/Redo → .zpe byte-identical original DNG and camera metadata save/reopen; previous tonal, ForwardMatrix, packed CFA, BlackLevel, SOF3 and rendered PNG/PSD/PSB raster regressions PASS.
- **Windows npm run check: FAIL:** 1757 tests, 1742 PASS / 10 SKIP / 5 FAIL, all five Linux /proc/cgroup tests unavailable on Windows. Log: G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-baseline-final.log. Overall check NOT PASS.
- **Remote:** v1.47.8 PR NOT OPEN, core + independent workflows NOT RUN, exact-main NOT RUN for this new code. #397 final head bf6dd662 core and independent Linux SUCCESS; #398 05c48eb is stacked and target-branch CI NOT RUN, both 0 reviews. Exact-main core CI SUCCESS only for ddd90d3.

## Boundaries and exact next task

Synthetic TIFF is not camera-authored DNG; no licensed external LibRaw/RawTherapee pixel oracle, camera vendor tone comparison or full HDR/profiles. BaselineExposureOffset not supported. Original native RAW is immutable; rendered PSD/PSB self-round-trip does not prove Adobe parity. Parent Stage 9 IN PROGRESS.

**Next: CAP-RAW-DNG-STACK-RECONCILIATION.** Inspect #397 exact head, seek separate authorization for remote writes/merge, merge only with required checks/reviews, retarget #398 and run exact Linux CI, then propose a single nonduplicative feature PR containing verified local v1.47.8 on clean main. No force push or premature claims about published code.

[Queue](NEXT.md) · [Matrix](CAPABILITY_MATRIX.md).
