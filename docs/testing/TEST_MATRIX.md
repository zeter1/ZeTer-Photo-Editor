# Test matrix

Use the smallest relevant set while developing; finish source changes with the repository gate.

| Change area | Targeted tests / checks | Extra runtime gate |
|---|---|---|
| UI constants / toolbar math | `tests/tool-layout.test.mjs`, architecture test | browser smoke for drag/persistence |
| Global overlay pointer lifecycle / capture / cancellation | `tests/pointer-lifecycle-router.test.mjs`, `tests/pointer-release-tools.test.mjs`, architecture test | `npm run test:browser` |
| Menu/tool-specific interaction | relevant interaction/selection/retouch tests | `npm run test:browser` |
| Selection gesture state / marquee / lasso / polygon / magnetic | `tests/selection-gesture-controller.test.mjs`, `tests/selection-types-v119.test.mjs`, `tests/pointer-release-tools.test.mjs`, architecture test | `npm run test:browser` when global pointer/keyboard wiring changes |
| Documents/layers/groups | core, layer-groups, document-tabs | browser smoke when UI path changes |
| Smart objects/filters | smart-object / smart-filter tests | targeted browser check when dialogs change |
| RGBA pixel operations | pixel/retouch tests | visual/runtime when pointer stroke changes |
| Raster edit state / paint buffer / preview / persistence | `tests/painting-controller.test.mjs`, raster-save-boundary, architecture test | browser smoke when startup/render wiring changes |
| Fill / raster line / current-layer selection clear commands | `tests/painting-command-controller.test.mjs`, selection-fill-line, high-depth-editing, raster-save-boundary, architecture test | `npm run test:browser` when click/release wiring changes |
| Merged selection cut / multi-layer clear / selected-layer rasterization | `tests/selection-raster-mutation-controller.test.mjs`, selection-clipboard, async-document-context, high-depth-editing, architecture test | `npm run test:browser` when menu/clipboard/rasterize wiring changes |
| Brush/eraser/retouch stroke gesture lifecycle | `tests/painting-gesture-controller.test.mjs`, brush-performance, retouch/high-depth tests, architecture test | `npm run test:browser` for pointer wiring |
| 16/32-bit editing/composite | high-depth-* tests | format round-trip when export changes |
| ICC/CMYK | color-management, color-profile, compatibility corpus | fixture-based verification |
| PSD/PSB codec | `tests/psd-*.test.mjs` | fixture/golden round-trip |
| Recovery/IO | recovery/reliability tests | browser smoke for startup/reload flows |
| Bundle/source graph | architecture test + `npm run build` | CI generated-bundle diff |
| General source change | `npm run check` | `npm run test:browser` when browser contract involved |

## Repository gates

```bash
npm run build
npm test
npm run check
npm run test:browser
```

CI performs:
1. checkout + Node 24;
2. `npm run check`;
3. `git diff --exit-code -- src/app.bundle.js`;
4. real Chromium `file://` smoke;
5. `git diff --check`.

Do not weaken these gates to make a refactor pass.
