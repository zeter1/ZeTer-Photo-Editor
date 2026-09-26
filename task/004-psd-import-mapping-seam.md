# Task 004 — PSD/PSB import mapping seam

## Goal

Вынести **один bounded owner** для преобразования уже декодированного PSD/PSB payload в canonical ZPE document, не трогая binary codec и не смешивая эту проходку с export metadata plans.

## Inspect first

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `docs/architecture/CODEMAP.md`
4. `src/document/psd-export-controller.js` — как соседнюю document boundary, не как место для import
5. только bounded range вокруг `openPsd()` в `src/main.js`
6. ближайшие PSD import / async-document-context / high-depth / CMYK tests

## Scope

- инвентаризировать ответственность `openPsd()`: decoded payload → groups/layers/document metadata/preview;
- выбрать API нового `src/document/psd-import-controller.js` с явными ports для runtime/UI/rendering;
- перенести только mapping/transaction orchestration, сохранив текущую последовательность validate → prepare → publish;
- добавить direct regression tests нового public owner;
- перевести source-contract tests на canonical owner;
- обновить AGENTS/PROJECT/CODEMAP/BOUNDARIES/AI_WORKFLOW/TEST_MATRIX/CHANGELOG и bundle graph.

## Preserve exactly

- PSD/PSB binary parsing остаётся в `src/formats/psd.js`;
- high-depth RGB и native CMYK source preservation/preview semantics;
- ICC/profile metadata и текущая честность managed/unmanaged preview;
- groups, masks, vector masks, saved paths, clipping;
- Smart Object/Text/Shape/Adjustment import metadata и opaque bytes;
- document/session identity, async stale-document guards и error/status behavior;
- bounded allocation/size guards.

## Non-scope

- не переписывать `src/formats/psd.js`;
- не переносить export preparation обратно/в import controller;
- не выносить в этой же проходке Text/Shape/Adjustment/Smart Object export plans;
- не добавлять новые Photoshop features.

## Verification

1. direct `psd-import-controller` regressions;
2. relevant PSD/import/high-depth/CMYK/async tests;
3. `npm run check`;
4. `npm run test:browser`;
5. PR CI exact-head green;
6. merge;
7. main CI exact merged SHA green.

## Done gate

Удалить этот task только после merge + green main CI. Если после extraction остаётся отдельный import seam — записать его новым bounded task, а не расширять текущий.
