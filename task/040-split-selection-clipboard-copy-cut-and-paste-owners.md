# Task 040 — Split Selection Clipboard copy/cut transaction from paste lifecycle

## Goal

Разделить два уже независимых async/concurrency-owner-а внутри `src/selection/clipboard-controller.js`: copy/cut transaction и paste/native-fallback lifecycle. Сохранить внешний API и поведение, но сделать границы меньше и понятнее для человека, ChatGPT/Codex и будущих regression-pass.

## Why now / evidence

Task 038–039 укрепили copy/cut correctness и оставили устойчивый контракт: exact document/session/layer/selection intent + latest-command generation + downstream continuation guard.

После этого текущий `src/selection/clipboard-controller.js` содержит **292 строки / ~12.9k символов / 16 функций** и две разные concurrency-модели в одном файле:

- copy/cut часть — примерно 7.9k символов: selection rendering, `clipboardCommandGeneration`, destructive continuation ownership;
- paste часть — примерно 3.7k символов: `Clipboard.read()`, `pasteGeneration`, shortcut fallback timer и native paste event.

Эти части уже имеют раздельные поколения и разные зависимости: geometry/render нужны copy/cut, `MIME_EXT`/File/Date/fallback timer — paste. После Task 039 смешанный owner стал дороже для чтения и source-guard тестов, хотя общая composition facade всё ещё полезна.

## Scope

1. Создать узкий owner, предпочтительно `src/selection/clipboard-copy-cut-controller.js`, который владеет:
   - selection PNG preparation;
   - exact originating intent capture;
   - `clipboardCommandGeneration`;
   - latest-owner continuation checks;
   - copy/cut OS Clipboard write;
   - destructive merged/current-layer continuation guard;
   - copy/cut status/toast/transient completion policy.
2. Оставить `src/selection/clipboard-controller.js` владельцем paste/native-fallback lifecycle и тонкой composition facade, чтобы `src/main.js` по возможности продолжал импортировать один `createSelectionClipboardController`.
3. Сохранить `pasteGeneration` полностью отдельно от copy/cut generation.
4. Обновить canonical build graph, architecture/source guards и AI-routing docs так, чтобы будущая нейросеть сразу шла в правильный owner.
5. Обновить `CHANGELOG.md` как behavior-preserving refactor.

## Non-scope

- Не менять пользовательскую семантику Copy/Cut/Paste, shortcuts, selection cleanup или tool switching.
- Не вводить общий async scheduler/transaction framework.
- Не менять raster mutation/persistence contracts, кроме минимальной типизации/wiring при необходимости.
- Не переписывать Clipboard API abstraction целиком.
- Не объединять эту проходку с новым UX/feature change.

## Inspect first

Перед изменениями перечитать:

- `AGENTS.md`;
- `docs/PROJECT.md`;
- `docs/architecture/BOUNDARIES.md`;
- `docs/architecture/RASTER_PERSISTENCE.md`;
- `src/selection/clipboard-controller.js`;
- `src/main.js` composition wiring;
- `tools/build-bundle.mjs`;
- `tests/selection-clipboard.test.mjs`;
- `tests/architecture-layout.test.mjs`;
- source/eval/regex tests, которые читают Clipboard controller или новый owner;
- `.github/workflows/ci.yml`.

## Behavioral contracts to preserve

- PNG must be written to OS Clipboard before Cut mutates pixels.
- Copy/cut captures exact originating document/session, cloned full selection geometry and exact selected layer when required.
- Newer overlapping copy/cut supersedes older post-await continuation.
- A stale generation cannot publish a later Cut, persisted pixels/history, success/error status, toast or transient cleanup.
- Optional downstream `isContinuationCurrent` reaches the last Canvas8/native-high-depth publication boundary.
- An already-started OS Clipboard write is not treated as cancelable.
- Paste direct read, native paste event and shortcut fallback keep their current `pasteGeneration`/timer and tab-switch semantics.
- Public keyboard/menu/native-event wiring remains behaviorally identical.
- `file://` runtime remains first-class.

## Planned refactor

Preferred shape:

```text
src/selection/
  clipboard-copy-cut-controller.js   # copy/cut transaction owner
  clipboard-controller.js            # paste owner + thin public facade
```

Keep dependencies explicit. Do not create a generic shared state bag merely to reduce argument count. If a tiny named grouped port improves readability, keep it local to this feature boundary.

## Targeted tests

At minimum keep/retarget deterministic coverage for:

- frozen selection/document/layer intent;
- Clipboard-before-Cut ordering;
- same-ID document/layer replacement;
- overlapping merged Cuts, selected-layer Cuts and Copy↔Cut ordering;
- stale Clipboard rejection suppression;
- ownership lost while downstream destructive preparation/encoding is already pending;
- paste direct read tab switch;
- paste shortcut fallback generation/tab switch;
- native paste event behavior;
- source/architecture ownership: copy/cut generation exists only in the new owner, paste generation only in the paste/facade owner;
- no duplicate copy/cut implementation remains in `src/main.js` or facade.

When function signatures/source locations move, update every regex/source extractor/VM harness in the same change rather than weakening checks.

## Required verification

1. Targeted Clipboard + async context + raster persistence tests.
2. `npm run check`.
3. Rebuild canonical `src/app.bundle.js` / cache manifest and verify generated parity.
4. `npm run test:browser` with real `file://` startup.
5. `git diff --check`.
6. PR exact-head CI green.
7. Merge, then exact merge-SHA `main` CI green.

## Done gate

Task is complete only when:

- copy/cut and paste async state live behind clearly separate owners;
- public behavior and Task 038–039 correctness contracts are preserved by tests;
- docs/build graph point to the new canonical owner;
- no stale duplicate implementation/source guard remains;
- PR CI and post-merge `main` CI are green.

## Risks / handoff notes

- Biggest risk is not runtime logic but source-based tests and generated build order. Treat source regex/extraction failures as real migration work, not reasons to weaken coverage.
- Keep the facade thin; if it starts re-owning generation or destructive policy, the split has failed.
- Do not move raster persistence code into the Clipboard owner. The copy/cut owner should only pass frozen authority/continuation through the existing ports.
