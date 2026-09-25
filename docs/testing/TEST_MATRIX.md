# Test matrix

Use the smallest relevant set while developing; finish source changes with the repository gate.

| Change area | Targeted tests / checks | Extra runtime gate |
|---|---|---|
| UI constants / toolbar math | `tests/tool-layout.test.mjs`, architecture test | browser smoke for drag/persistence |
| Menu/pointer/tool interaction | relevant interaction/selection/retouch tests | `npm run test:browser` |
| Documents/layers/groups | core, layer-groups, document-tabs | browser smoke when UI path changes |
| Smart objects/filters | smart-object / smart-filter tests | targeted browser check when dialogs change |
| RGBA pixel operations | pixel/retouch tests | visual/runtime when pointer stroke changes |
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
