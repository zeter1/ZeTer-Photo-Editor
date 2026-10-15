> **037B2b-3d CLOSED (2026-10-15):** [metadata-integrity gate](037b2b-3d-layer-metadata-integrity.md); [PR #234](https://github.com/zeter1/ZeTer-Photo-Editor/pull/234) merged as [31a0de7](https://github.com/zeter1/ZeTer-Photo-Editor/commit/31a0de799b75600d052d46f87c8abd6b843226ec), [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38726903064) and [exact-code main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38727329049) success. Strict Python PSD16/PSB32 one-layer mask, blend-ranges, flags and name checks plus synthetic blind mutation tests. **STILL OPEN:** genuine CC0 original/review/pins (037B2b-2), external PSD/PSB reader (037B2b-3), Chromium 037C 3×/depth, Photoshop-authored 002, tiled 003. Synthetic fixture parity is not photographic/Adobe proof.

> **037B2b-3c CLOSED (2026-10-15):** [Python native PSD16/PSB32 reader](037b2b-3c-python-native-readback.md); [PR #233](https://github.com/zeter1/ZeTer-Photo-Editor/pull/233) merged as [7cc4459](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7cc4459b787f66a2590ae82d2ab4edb76f685867), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38724278629), [exact-main code CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38724736301). Native one-layer+merged bytes checked against pins with synthetic negative tests. **NEXT OPEN:** genuine CC0 source/EXIF/ICC/review/pins (037B2b-2), independent third-party PSD/PSB decoder (037B2b-3), real Chromium 037C 3×/depth, Adobe P0 002 and tiled Stage 003. Neither Photoshop parity nor real-photo benchmark is claimed.

> **037B2b-2d CLOSED (2026-10-15):** [Pillow source TIFF EXIF parity](037b2b-2d-python-exif-source-parity.md); [PR #232](https://github.com/zeter1/ZeTer-Photo-Editor/pull/232) merged `6d58f6b`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38708933494), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38709327930). **NEXT OPEN:** real licensed CC0 JPEG + externally reviewed EXIF/ICC/color/original+decoded+native frozen SHA-256 (037B2b-2), external PSD16/PSB32 native reader (037B2b-3), real Chromium 037C ×3/format. Adobe-authored 002 and Stage 003 remain OPEN; synthetic EXIF tests are not real-photo proof.

> **037B2b-2c (CLOSED, 2026-10-15):** [JPEG source TIFF IFD0 EXIF Orientation + fail-closed decoder claim reconciliation](037b2b-2c-exif-source-orientation.md). [PR #231](https://github.com/zeter1/ZeTer-Photo-Editor/pull/231) merged as [`4c66c7e`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/4c66c7e002e08108f839ef14a76f5b696ae2cb59), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38707055052), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38707413542). **NEXT OPEN:** independently licensed genuine CC0 JPEG + EXIF/ICC/color visual review + independently pinned original/decoded/native SHA-256 (037B2b-2), then real PSD16/PSB32 external reader (037B2b-3), Chromium 037C 3× per format. P0 Photoshop-authored 002 and tiled Stage 003 remain OPEN.

> **037B2b-2b (CLOSED; PR + exact-main CI success, 2026-10-15):** [ICC APP2 multipart completeness, byte-verified Pillow ICC assembly, EXIF missing-orientation handling](037b2b-2b-jpeg-metadata-gates.md). [PR #230](https://github.com/zeter1/ZeTer-Photo-Editor/pull/230) → [`1847c0b`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/1847c0b1409d6ebe7b2cadfeae014ea3267da48d), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38703368803), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38703772619). **Next:** licensed original JPEG + independent EXIF/ICC/color review + immutable SHA-256 original/decoded/native pins. This is test-only, not real-photo parity; 037B2b-2/3, 037C, 002 and Stage 003 remain OPEN.

> **037B2b-3b (СЛИТО; CI success, 2026-10-15):** [PR #228](https://github.com/zeter1/ZeTer-Photo-Editor/pull/228) → [927e1ec](https://github.com/zeter1/ZeTer-Photo-Editor/commit/927e1ec999592c05ff0a1231ce37e164d0807026), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38698794203) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38699204703). Offline `codec-evidence.json` и повторный `verify` saved PSD16/PSB32 layer+merged native hashes, 8288 ROI, fail-closed proof. Только synthetic surrogate/ZPE self-codec; настоящие licensed photo bytes и review, независимая Adobe проверка, Chromium 037C, P0 002 / Stage 003 — **OPEN**. [План](037b2b-3b-artifact-integrity.md).

> **037B2b-3a gate:** [PR #227](https://github.com/zeter1/ZeTer-Photo-Editor/pull/227) → [bde33df](https://github.com/zeter1/ZeTer-Photo-Editor/commit/bde33df15b4f5781ce778314f4624609f5e1bc28), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38696193576) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38696460061). Code is a synthetic-surrogate native PSD16/PSB32 self-codec gate, **not** real photo/ICC/EXIF/Adobe/Chromium quality. Remaining 037B2b-2/3 and 037C OPEN. [Details](037b2b-native-psd-psb-bridge.md).

> **037B2b-3a (слито + CI success, 2026-10-15):** [native PSD16/PSB32 defect bridge](037b2b-native-psd-psb-bridge.md) проверяет точные native layer+merged words, 8288 ROI и offline pinned-manifest gate. Только ZeTer writer→reader и структурный суррогат; настоящая фотография, независимый decoder/ICC/EXIF review, внешнее чтение PSD/PSB и browser quality ещё не получены. Далее 037B2b-2/3, 037C; P0 002 / Stage 003 OPEN.

## 037B2b-1 — offline photo/native bundle admission (ЗАКРЫТА, PR + exact-main CI success, 2026-10-15)

- Добавлен [037B2b-1](037b2b-photo-bundle-admission.md): CLI `candidate` / `verify` для локальных CC0 original JPEG, externally decoded RGBA8, independently pinned RGB16/Float32 clean+defect LE SHA-256; строгая схема manifest, 8288 connected ROI, проверка alpha и отказ при подмене байтов/метаданных.
- **Без обмана статуса:** JPEG entropy decode и ICC/EXIF остаются внешней рецензируемой процедурой; фотофайлы и reviewed source/decoded/native SHA-256 отсутствуют; test-only surrogate **не** реальная фотография. Chromium/Photoshop parity не доказаны; stage 037 OPEN.
- **Дальше:** 037B2b-2 получить licensed original + independently decoded/versioned RGBA8 + immutable real pins; 037B2b-3 реально сформировать PSD16/PSB32 с damage-only ROI; 037C Chromium file:// ×3/format с pixel oracle/observational memory. P0 002 и Stage 003 открыты. **Gate:** [PR #226](https://github.com/zeter1/ZeTer-Photo-Editor/pull/226) → [fab6c49](https://github.com/zeter1/ZeTer-Photo-Editor/commit/fab6c49abed85f7314ef91b1769975496f8263b7); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38691322897) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38691679311). Полные Node/build, Chromium file://, JSON/profile/diff hygiene success; фото asset всё ещё не получен.

## 037B2a — bridge pinned decoded RGBA8 → RGB16/Float32 connected native references (СЛИТО; PR + exact-main CI success, 2026-10-14)

- Реализован test-only [037B2a](037b2a-photo-native-fixture-bridge.md): детерминированный bounded crop RGBA8 → нативные Uint16/Float32 RGB с отдельными clean/defect buffers, точная 8288-пиксельная двухостровная diagonal connected ROI, неизменённые outside-selection и alpha. Кандидат native LE SHA-256 не считается закреплённым: допуск требует **независимый** `expectedReferenceSha256` и подтверждённый decoded RGBA8 SHA-256; есть негативные unit-проверки.
- **Ограничение:** это 8-bit-derived нативные слова, не true photo 16/32-bit depth, не независимо Adobe-authored corpus и пока не real-photo benchmark. Проверка ICC/EXIF и лицензированного оригинала отдельно обязательна.
- **Следующее:** 037B2b — реальные CC0 JPEG bytes + SHA-256 original/decoded RGBA8, credible ICC/EXIF/decode provenance, frozen SHA-256 clean RGB16/Float32 и PSD16/PSB32 defect documents; затем 037C browser `file://` ×3/format + quality/memory evidence. P0 [002](002-psd-compatibility-corpus.md) и общая [003](003-tiled-content-aware.md) остаются открытыми.
- **037B2a gate success:** [PR #225](https://github.com/zeter1/ZeTer-Photo-Editor/pull/225) → [64c0235](https://github.com/zeter1/ZeTer-Photo-Editor/commit/64c0235b70ea724ef6b6bacdc70c5ff9ce19a5fc), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38607110005), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38607607539). Build+Node, generated parity, Chromium `file://`, JSON/artifacts, profiles и diff hygiene — success. **037 в целом остаётся OPEN** до реальных фото-байтов и 037C.

## 037B1 — проверка исходного JPEG перед фиксацией real-photo эталонов (СЛИТО; PR CI success, 2026-10-14)

- **Gate 037B1:** [PR #224](https://github.com/zeter1/ZeTer-Photo-Editor/pull/224) → [8fa7b12](https://github.com/zeter1/ZeTer-Photo-Editor/commit/8fa7b12719a07ac92fd5af533c799a91fa0696c0), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38593642014); `npm run check`, Chromium `file://`, JSON artifacts, профили и diff hygiene — success. Exact-code main CI после фиксации handoff — ожидается.

- Добавлены `tools/real-photo-source-integrity.mjs`, `tools/inspect-real-photo-source.mjs` и `tests/real-photo-source-integrity.test.mjs`: строгий исходный SHA-1 карточки Wikimedia, ручная инспекция SHA-256 локальных оригинальных байтов, JPEG SOF/scan/размеры/3 канала/8-bit, **обязательный pinned SHA-256** для допуска исходника в fixture и отдельный pinned SHA-256 декодированных RGBA8 пикселей.
- Отрицательные сценарии: missing/wrong SHA-256, изменённый JPEG/SHA-1, malformed marker/EOI/SOF, некорректные размеры, RGBA mismatch, прозрачность и незафиксированный decoder output.
- **037B ещё открыта:** JPEG оригинал не загружен в репозиторий, реальный SHA-256 не закреплён, decoded pixels/ICC/orientation не подтверждены; настоящих frozen native RGB16/Float32 reference+defect PSD/PSB и benchmark чисел нет. Это test-only intake, не Photoshop parity.
- **Далее 037B2:** получить оригинал по documented CC0 URL, запустить `node tools/inspect-real-photo-source.mjs <local-jpeg>`, зафиксировать source SHA-256, проверить полный decoded RGBA8 digest, ICC/orientation, затем создать frozen native LE reference SHA-256 для RGB16/PSB32 и исправляемый connected ROI 8288 пикселей. После этого 037C: real file:// Chromium ×3/формат, JSON/RSS/CI.
- P0 [002](002-psd-compatibility-corpus.md), Stage 003 и прочие функции со скриншота по-прежнему открыты.

## 037A — native per-pixel known-clean oracle (СЛИТО; PR + exact-main CI success; 2026-10-14)

- Добавлен строгий test-only reference oracle для различной цветной текстуры **каждого** пикселя RGB16/Float32. Для clean snapshot обязателен SHA-256 канонических LE native words; проверяется точная неизменность outside-selection/alpha, независимость буферов, geometry, negative matrix. 5 отдельных Node tests проходят. [PR #223](https://github.com/zeter1/ZeTer-Photo-Editor/pull/223) → [27a6adb](https://github.com/zeter1/ZeTer-Photo-Editor/commit/27a6adb830797d3258bc640ffe09dd89c3ef92b8), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38586323259), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38586743806); `npm run check`, реальный Chromium smoke, profiles/artifacts и diff hygiene — success.
- Кандидат CC0 фото известен и документирован: [origin/licensing](../tests/fixtures/real-photo/README.md); фактические исходные bytes/SHA-256 ещё не pinned, реальных image-based измерений нет. 037 всё ещё открыта.
- **037B next:** pinned licensed photo asset → reference+defect RGB16/Float32 native PSD/PSB with SHA-256 → unit fixture gates.
- **037C after:** real `file://` Chromium polygon/native Worker/public project/Undo/Redo ×3, quality/nonselection/alpha, versioned timing+memory artifacts, fail-closed negatives, PR/main CI. Параллельно P0 [002](002-psd-compatibility-corpus.md) требует independent Photoshop-authored goldens; Stage 002/003 не закрыты.

## 036C — реальный Chromium wide connected ROI observation evidence (СЛИТО; PR + exact-code main CI success, 2026-10-14)

- **Gate выполнен:** [PR #222](https://github.com/zeter1/ZeTer-Photo-Editor/pull/222) → squash [27dbb27](https://github.com/zeter1/ZeTer-Photo-Editor/commit/27dbb2718ea0078dbbfffe09870494d8d90480bc); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38580054433), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38580574257). 1245 Node-тестов, bundle parity, настоящий Chromium file:// smoke, **4/4 JSON artifacts verified**, все профили и diff hygiene — success.
- Шесть явных timestamped stage samples для каждого ZeTer-generated PSD16/PSB32 wide connected ROI: renderer JS heap, optional CDP privateMemory, Linux /proc RSS и явно неизвестные PID/Worker-target observations. Нативная selection/Fill/Undo/Redo parity + MAE/RMSE из public Save Project сохранена. В CI: PSD16 8288/8288 (MAE 32333.33 → 0), PSB32 8288/8288 (MAE 1.45833 → 0); отдельные observed import/fill времена **не SLA**.
- Версионированные \`wide-connected-psd16.json\` и \`wide-connected-psb32.json\`, строгий write/read validator и negative matrix против подменённых timeline/memory gaps / quality и неподтверждённых Worker PID/RSS peak/exit. **Никакой истинный operation peak RSS / Adobe cross-app parity этим не доказан.** [036](036-browser-connected-roi-quality.md).
- **Следующая исполнимая P1 — [037](037-real-photo-connected-roi-benchmark.md):** реальная фотография с лицензией + независимый known-clean эталон, repeatable Chromium native quality/latency/observational memory с coverage. **P0 [002](002-psd-compatibility-corpus.md)** — независимо Photoshop-authored лицензированный RGB16 + CMYK32 PSB корпус пока не получен. **Stage 002/003 остаются открытыми.**

## 036B — реальный Chromium wide connected ROI (СЛИТО, 2026-10-14; exact-main CI success)

- **Gate:** [PR #221](https://github.com/zeter1/ZeTer-Photo-Editor/pull/221) → [`7fbc9117`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7fbc9117f617c4495ac0d0c20151145a177eb165); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38576559275), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38577167032). Все 1242 Node tests, bundle parity, настоящий Chromium `file://` smoke, JSON artifacts/profiles и diff hygiene — success.
- Настоящий UI PSD16 и PSB32 → 10-вершинное polygon выделение → native Worker → публичный Save Project ×4 → exact Undo/Redo. Фактически выбранных и изменённых пикселей **8288/8288**, 24864 color samples, неизменность вне selection и alpha. ZeTer-generated native 16-bit MAE: **32333.33 → 0**, Float32 MAE: **1.45833 → 0**. Наблюдалось 2 изменённых native tile payloads на формат. Браузерные import times 2458/4594ms и fill+preview 2232/2788ms — **однократные elapsed наблюдения**, не гарантии производительности.
- **Следующая 036C:** versioned serialized Chromium evidence с timestamps, RSS/CDP coverage и честными gaps, CI round-trip validator и negative matrix; не заявлять Worker→PID или true RAM peak по snapshot. [036](036-browser-connected-roi-quality.md).
- **P0 [002](002-psd-compatibility-corpus.md)**: независимо Photoshop-authored/лицензированный PSD16 + CMYK32 PSB corpus по-прежнему отсутствует. **Stage 003 всё ещё открыта.**

## 036A — wide connected ROI evidence baseline (слито; PR + exact-main CI success, 2026-10-14)

- [PR #220](https://github.com/zeter1/ZeTer-Photo-Editor/pull/220) слит в main [`94633e9`](https://github.com/zeter1/ZeTer-Photo-Editor/commit/94633e9e333aceb961241487853a92ea2531ed48); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38566438939), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38566790704): Node, generated bundle parity, Chromium file:// smoke, operation artifacts, profiles, diff hygiene.
- Добавлен test-only native tiled oracle: строго 8288 connected pixels (64×64 + диагональ + 64×64), byte/alpha invariance, native 16/32-bit MAE/RMSE, exact Undo/Redo, sampling missingness and no unproven RAM peaks. [036](036-browser-connected-roi-quality.md).
- **Следующая проходка 036B:** реальный Chromium `file://` PSD16/PSB32 с **широким** UI selection и native Worker (не Node-only), публичный `Save Project` для точного исходного/итогового/Undo/Redo source, затем 036C measured wall-clock+RSS/CDP samples, CI artifact validation, PR/main gate. 036 **открыта** до этого.
- P0 [002](002-psd-compatibility-corpus.md) требует внешних лицензированных Photoshop-authored goldens — не заменять их синтетикой.

## Следующее P1 — [036](036-browser-connected-roi-quality.md): настоящий Chromium `file://` wide connected ROI

- **P1 исполнимо:** после закрытия 035 перейти к браузерному широкому связному ROI (острова + диагональный коридор), native MAE/RMSE/точные bytes + preview/Undo/Redo и честные latency/RSS/CDP observation gaps. Не называть snapshot настоящим operation peak или Worker→PID. [003](003-tiled-content-aware.md).
- **P0 блокируется внешними данными:** [002](002-psd-compatibility-corpus.md) — лицензированные независимо Photoshop-authored PSD16 + CMYK32 PSB golden с provenance, SHA-256 и эталонным render.
- **035 закрыта:** [PR #219](https://github.com/zeter1/ZeTer-Photo-Editor/pull/219) → squash `66f41e6`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38563696598), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38564063538). Падение первого старого CI 38545678383 и его retry больше не используются в качестве доказательства исправления.

## 034 / 024D3 — native quality сложной связной ROI (слито, CI success)

- [034](034-complex-roi-native-quality.md): Node Worker RGB16/CMYKA32 native baseline/repaired MAE/RMSE по двум островам 64×64 и соединяющему диагональному коридору (8288 pixels). Новый pure oracle проверяет exact unchanged outside selection/alpha и rejects malformed inputs; синхронный результат и настоящий Worker сохраняют byte parity. **Только тестовый Node profile**, не браузерный wide ROI, не Adobe golden. [PR #218](https://github.com/zeter1/ZeTer-Photo-Editor/pull/218) слит (`8208ab9`): [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545340603) и [main CI retry](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38545678383) — success.
- **Следом:** P0 лицензированный Photoshop-authored корпус [002](002-psd-compatibility-corpus.md); P1 настоящее Chromium `file://` сложное connected ROI + latencies/observational memory [003](003-tiled-content-aware.md); P1 честная атрибуция Worker→PID или `unknown` [025](025-browser-worker-target-census.md). Общие Stage 002/003 остаются открытыми.

## 033 / 024D2 — браузерный native quality reference (слито; PR + exact-main CI success)

- [033](033-browser-synthetic-native-quality.md): real Chromium `file://` PSD16/PSB32 Worker + mid-kernel cancellation, retry и Undo/Redo измеряются по исходным Uint16/Float32 на ZeTer-generated постоянном фоне. Native MAE/RMSE относительно known 5×5 reference; качество должно улучшаться после Fill и точно возвращаться после Undo. CI JSON теперь содержит валидируемое quality evidence; отдельные негативные тесты. Это не Photoshop reference и не real Worker peak RSS. [PR #217](https://github.com/zeter1/ZeTer-Photo-Editor/pull/217) → `685d178`, [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38542625807), [exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38543002186) — success.
- **Дальше:** P0 [002](002-psd-compatibility-corpus.md) лицензированные Adobe-authored RGB16/CMYK32 golden; P1 [003](003-tiled-content-aware.md) настоящий браузерный benchmark сложных connected ROI (quality/latency/RSS), P1 [025](025-browser-worker-target-census.md) только доказанная target→PID атрибуция. Общие Stage 002/003 **открыты**.

## 032 / 024D1 — byte oracle для Chromium PSD16/PSB32 Fill + Undo/Redo (слито, PR и exact-code main CI success)

- [032](032-browser-native-selection-integrity.md): test-only сравнение native 16/32-bit words в изменённых тайлах по фактическому frozen Worker `selectedIndices`, включая соседние **невыделенные** пиксели; первый Fill/Redo, mid-kernel cancellation, recovery, Undo/Redo и unit negative matrix. Изменений production bundle нет. [PR #216](https://github.com/zeter1/ZeTer-Photo-Editor/pull/216) слит (`f3d1336`), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38538156947) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38538532002).
- **После:** P0 [002](002-psd-compatibility-corpus.md) лицензированные Photoshop RGB16/CMYK32+реальные golden; P1 [003](003-tiled-content-aware.md) браузерное качество/latency/RSS на сложных connected ROI и [025](025-browser-worker-target-census.md) documented target→PID или `unknown`. **002/003 не закрывать**.

## 031 / 024C6 — browser memory claim integrity (слито, PR + exact-main CI success, 2026-10-14)

- [031](031-browser-memory-claim-integrity.md): fail-closed проверка вложенного Worker census/target records и запрет ложных `provenWorkerTerminationCount`, Worker→PID, exit и operation peak RSS claims как при записи, так и при верификации Chromium JSON. Добавлены негативные unit/CI regressions. **Это только test harness**, не новый функционал редактора. [PR #215](https://github.com/zeter1/ZeTer-Photo-Editor/pull/215) → `505a1a9`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38533360435), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38533729179).
- **Следом:** P0 реальные Adobe-authored и лицензированные PSD16/PSB32 goldens [002](002-psd-compatibility-corpus.md); P1 documented target→PID или `unknown` [025](025-browser-worker-target-census.md) и независимые browser quality/latency/RSS [003](003-tiled-content-aware.md). Общие Stage 002/003 открыты.

## 030 / 024C5 — пересчёт итоговых browser durations по milestone (слито, PR + exact-code main CI success, 2026-10-14)

- [030](030-browser-operation-duration-evidence.md): проверка `durationsMs` по каждой канонической паре событий для настоящего Chromium `file://` PSD16/PSB32 cancel→retry. Неверные/неполные/подменённые summary-поля отклоняются при `finish` и при повторной проверке сохранённого JSON; unit-регрессии на forged cancel duration, типы, missing/extra поля и null/zero.
- **Gate выполнен:** [PR #214](https://github.com/zeter1/ZeTer-Photo-Editor/pull/214) → squash `98ea308`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38531032892) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38531246576). Node + generated parity, настоящий Chromium `file://` PSD16/PSB32, оба JSON, профили и diff hygiene — success. Это **только test harness**, production/editor bundle без изменений.
- **Следующие приоритеты:** P0 реальный independently Photoshop-authored/лицензированный high-depth corpus [002](002-psd-compatibility-corpus.md); P1 документированный target→PID или честное `unknown` [025](025-browser-worker-target-census.md), независимое browser quality/latency/RSS для connected ROI [003](003-tiled-content-aware.md). Общие Stage 002/003 **открыты**.

## 029 / 024C4 — упорядоченные browser operation artifacts (слито, exact-code main CI success, 2026-10-14)

- [029](029-browser-operation-evidence-order.md): единую fail-closed проверку этапов cancel/repair native Worker и относительных времён применяем при finish и сериализации CI JSON; тесты пытаются подменить порядок, дублировать событие, исказить duration и файл-артефакт.
- **Gate выполнен:** [PR #213](https://github.com/zeter1/ZeTer-Photo-Editor/pull/213) слит в `main` (`092b02d`), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38529014491), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38529236050): Node + generated parity, Chromium `file://` PSD16/PSB32, два JSON artifacts, профили и diff hygiene. Stage 002/003 по-прежнему открыты. **Следующее:** P0 независимый лицензированный Photoshop RGB16/CMYK32 high-depth corpus [002](002-psd-compatibility-corpus.md); P1 документированный Worker target→PID либо `unknown` [025](025-browser-worker-target-census.md), browser quality и latency [003](003-tiled-content-aware.md).

## 028 / 024C3 — Worker Target snapshot observation gaps (слито, exact-main CI success, 2026-10-14)

- [028](028-browser-worker-target-observation-gaps.md): независимые от CDP PID и Linux `/proc` пропуски `Target.getTargets`, `snapshotCoverage`, `null` при неизвестной последней видимости, никакой churn через gap, безопасная метка `invalid-phase`.
- **Gate success:** [PR #212](https://github.com/zeter1/ZeTer-Photo-Editor/pull/212) → `88ede195`; [PR CI 38527401333](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38527401333) и [exact-code main CI 38527667389](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38527667389). `npm run check`, настоящий Chromium `file://` PSD16/PSB32, JSON artifacts, профили и diff hygiene — success.
- **Следом:** P0 [002](002-psd-compatibility-corpus.md) лицензированный independently Photoshop-authored corpus, P1 [025](025-browser-worker-target-census.md) target→PID только с доказательствами, [003](003-tiled-content-aware.md) quality/performance в браузере. Stage 002/003 открыты.

## 027 / 024C2 — PID observation gaps при cancel→retry (слито, PR + exact-code main CI success, 2026-10-14)

- [027](027-browser-process-observation-gaps.md): добавлен per-snapshot CDP PID/Linux starttime coverage; пропущенный финальный /proc снимок не подменяется прежней видимостью, adjacency churn не вычисляется сквозь неизвестный интервал.
- **Гейт пройден:** [PR #211](https://github.com/zeter1/ZeTer-Photo-Editor/pull/211) → `93f5c2e`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38525012524), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38525286762). Unit + `npm run check`, Chromium `file://` PSD16/PSB32, JSON artifacts/profiles и diff hygiene — success.
- **Дальше:** P0 independently authored/licensed Photoshop RGB16 PSD + CMYK32 PSB ([002](002-psd-compatibility-corpus.md)); P1 documented Worker target→PID evidence или `unknown` ([025](025-browser-worker-target-census.md)); Stage 002/003 открыты.

## 026 / 024C1 — truthful browser memory snapshot coverage (merged, PR + exact-main CI success, 2026-10-14)

- **Реализовано и проверено:** [026](026-browser-memory-sample-coverage.md) — baseline/end privateMemory + RSS только если соответствующий **точный** стартовый/конечный снимок доступен, иначе `null`; отдельные counts/phase gaps и перенос coverage в operation JSON. Unit regression для финального `/proc ENOENT` и отказа CDP. **Слито:** [PR #210](https://github.com/zeter1/ZeTer-Photo-Editor/pull/210) → `67e4451`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38522956593), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38523222466) — `npm run check`, real Chromium `file://` PSD16/PSB32, 2 JSON и профили.
- **Следом:** P0 [002](002-psd-compatibility-corpus.md) — независимые Photoshop-authored RGB16/CMYK32 с лицензиями, hashes, renders; P1 024C2 PID-churn observation completeness и 025B только документированная target→PID attribution. Stage 002/003 ещё открыты.

## 025 / 024B3 — browser Worker target census (merged, PR + exact-code main CI success, 2026-10-14)

- Код и unit-регрессии слиты через [PR #209](https://github.com/zeter1/ZeTer-Photo-Editor/pull/209) ([PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38520690545) и [exact-code main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38520975172) — success, 1200 Node tests) в [025](025-browser-worker-target-census.md): независимый CDP `Target.getTargets` census для реального `file://` PSD16/PSB32 Worker, без утечки target URL/title и без ложной target→PID атрибуции. `workerPidMapping: unknown`; Target API отказ не блокирует Chromium PID/`/proc` и renderer heap. Не считать пропажу target доказанным exit или RAM peak.
- **Статус:** код в `main`, оба CI прошли; Stage 002/003 **открыты**. **Следом P0:** лицензированный independently Photoshop-authored RGB16 PSD + CMYK32 PSB с hashes/reference renders ([002](002-psd-compatibility-corpus.md)). **Следом P1:** документированный CDP target→PID способ или оставить `unknown`, memory evidence ([025](025-browser-worker-target-census.md)).

## 010E-B4 / 024B2b — настоящая Chromium mid-kernel отмена PSD16/PSB32 (merged, PR + exact-main CI success, 2026-10-14)

- **Слито в `main`:** [PR #208](https://github.com/zeter1/ZeTer-Photo-Editor/pull/208), squash `ad839ab6`. [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38518410697) и [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38518637139): 1196 Node tests, generated parity, Chromium `file://` PSD16/PSB32, проверенные и загруженные JSON, профили и diff hygiene.
- Для **обоих** ZeTer-generated файлов: after-write probe в настоящем native kernel → lock UI с отменой Worker до CPU-stall deadline (наблюдалось 229ms PSD16 и 312ms PSB32 от probe до terminate) → 0 completed replies → полное совпадение исходных serialized native tile bytes/никакой новой Fill History записи. Затем новый **неизменённый** Worker успешно выполняет Fill, Undo/Redo строго восстанавливают native bytes.
- Оба `stage003-*-with-cancelled-retry.json` отчёта подтверждены CI; наблюдения RSS и PID-HWM информационные, **не** точный peak и не Worker→PID атрибуция.
- **Следующая P0:** [002](002-psd-compatibility-corpus.md) — независимый лицензированный Photoshop-authored RGB16/CMYK32 PSD/PSB golden с хешами/эталонами. **Следующая P1:** документированный и проверенный CDP Worker→PID mapping, если возможно; иначе явно `unknown`. Stage 002/003 **не завершены**. [Детали 024](024-browser-operation-memory.md).

## 010E-B4 / 024B2a — Chromium operation JSON artifacts and honest process disappearance (merged, PR CI success, 2026-10-11)

- **Merged:** [PR #207](https://github.com/zeter1/ZeTer-Photo-Editor/pull/207) (`594295ad`), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38166256448) including real Chromium `file://`, JSON verification/upload, Node, generated parity and informational profiles. Exact-main CI runs separately.
- `tools/browser-operation-artifact.mjs`: versioned PSD16/PSB32 JSON files (real Chromium `file://` UI scenario) with operation timing, requested sample interval, Linux PID+starttime samples; CI verification and upload. PID missing at the final sample is **not a proven exit**. No operation peak RSS or supported Worker→PID mapping is asserted. [024 tracking](024-browser-operation-memory.md).
- **024B2b next:** in-kernel cancel→recovery PSD16/PSB32 + unchanged native words/history evidence, only then consider documented CDP target-to-PID mapping. **P0 [002](002-psd-compatibility-corpus.md)** still lacks independent licensed Photoshop-authored RGB16/CMYK32 golden; Stage 002/003 remain open.

## 010E-B4 / 024B1 — Linux PID incarnation identity (merged, exact-main CI success, 2026-10-11)

- **Implementation:** test harness reads `/proc/<pid>/stat` field 22 twice around VmRSS/VmHWM; rejects PID reuse within one sample. Track `PID+starttime` across browser CDP observations; per-incarnation sampled RSS / individual process-lifetime HWM, arrivals/missing/reuse, explicit Worker→PID `unknown`.
- **Done:** [PR #206](https://github.com/zeter1/ZeTer-Photo-Editor/pull/206) merged into `main` (`dec6db5f`); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38165437542), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38165563357) with Node tests, generated parity, real Chromium `file://`, native profiles and diff hygiene.
- **Next P1 / 024B2:** map Chromium targets to processes *only when independently supported*, run real PSD16/PSB32 mid-kernel cancel→new Worker recovery within the same timeline, JSON CI artifact, process-exit accounting with explicit limits. Missing CDP/`/proc` identity stays unavailable, not zero; sampled aggregate RSS and individual lifetime VmHWM never constitute operation peak.
- **P0 [002](002-psd-compatibility-corpus.md):** independent licensed Photoshop-authored RGB16/CMYK32 golden files still missing. Stage 002/003 are **open**.

## 010E-B4 / 024A — browser operation timeline + PID churn (merged, exact-main CI success, 2026-10-11)

- **[PR #205](https://github.com/zeter1/ZeTer-Photo-Editor/pull/205)**, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38164350321), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38164497873) на `47045507`. [024](024-browser-operation-memory.md): для реального Chromium `file://` PSD16/PSB32 Worker smoke — этапные длительности, отмена/History/native outcome и CDP PID churn отдельно от RSS/privateMemory/process HWM. Следом 024B PID identity/starttime, process attribution, mid-kernel cancel & recovery timing. Ни одно измерение не равно true peak RAM.
- **P0** [002](002-psd-compatibility-corpus.md): лицензированные независимые Adobe Photoshop-authored RGB16/CMYK32 PSD/PSB oracle + provenance. **Stage 002/003 всё ещё открыты.**

## 010E-B3B / 023 — общий лимит планирования oversized ROI (слито, exact-main CI success)

- [023](023-planner-total-budget.md): общий предел 4 194 304 посещений/probes для повторных fallback планов и bounded run planners; deterministic RangeError до ROI decode; sync/cooperative/Node Worker отказ RGB16 и CMYKA32. **Слито:** [PR #204](https://github.com/zeter1/ZeTer-Photo-Editor/pull/204) → `732ef97604`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38161611345), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38161771493).
- **Следом [P1 010E-B4](024-browser-operation-memory.md):** достоверная browser memory/HWM methodology и operation duration; **P0 002:** независимые лицензированные Adobe-authored high-depth PSD/PSB fixtures. Stage 002/003 остаются открытыми.

## 010E-B3A / 022 — cooperative oversized-ROI planning checkpoints (merged, exact-main CI success, 2026-10-11)

- [022](022-cooperative-planning-checkpoints.md): 32,768-visit cooperative checkpoints throughout oversized-selection ROI planning, including nested tile-group scans, stripes, frozen donor-bitmaps, region masks; synchronous/Worker order remains deterministic. Two new RGB16 cancellation regressions stop **before any ROI tile reads**, for frozen indices and geometry-scanned fallback.
- **Gate complete:** [PR #203](https://github.com/zeter1/ZeTer-Photo-Editor/pull/203) squash `55282cc3`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38160333627), [exact-code `main` CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38160516517). Stage 002/003 **not complete**; previous 020/021 are merged.
- **Next P1 010E-B3B:** strict overall planner visit/probe cap, fragmented worst-case masks and RGB16/CMYKA32 Worker/cooperative parity; then browser operation-wide peak-memory method and timing. **P0 002:** licensed independent Photoshop-authored high-depth oracle.

## 010E-B2 / 021 — connected horizontal-run bands (merged, exact-main CI green, 2026-10-11)

- [021](021-connected-run-bands.md): additional bounded 8-connected run-band fallback for parallel/forked selections B1 cannot group, limits 65,536 indices / 4,096 runs / 32,768 adjacency probes / 256 regions / 8 rows, RGB16 + CMYKA32 native byte and Worker/cancel parity.
- **Merged:** [PR #202](https://github.com/zeter1/ZeTer-Photo-Editor/pull/202), squash `656e39f3`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38158700018). Exact code SHA `656e39f3` [exact-main code push CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38158971996). **Next:** 010E-B3 planning-time cooperative chunking and timing under adversarial masks; browser operation-wide peak memory method; P0 licensed Photoshop-authored high-depth corpus. Stage 002/003 still open.

## 010E-B1 / 020 — adaptive bounded horizontal runs (merged, PR CI success, 2026-10-11)

- [020](020-adaptive-horizontal-runs.md): deterministic at-most-8-row connected horizontal-run fallback when halo groups, tiles and fixed stripes exceed aggregate ROI cap. Strict limits: 65,536 indices to sort, 4,096 runs, 256 groups; source immutable, global frozen donor exclusion, no partial publication. RGB16 / CMYKA32 reverse-index, Worker/cooperative parity, worst-case refusal tests.
- **Merged:** [PR #201](https://github.com/zeter1/ZeTer-Photo-Editor/pull/201) → squash `5c3de98b`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38157871061). Check the exact-main push CI separately. **Next:** 010E-B2 general connected clusters / planning-time budget; P0 independent Photoshop-authored high-depth corpus and browser operation-level memory peak remain open.

## 010E-M / 019 — Linux Chromium RSS + per-PID HWM (слито, PR CI success, 2026-10-11)

- [019](019-browser-linux-rss.md): отдельные измерения Linux `/proc/PID/status` VmRSS и индивидуального VmHWM в существующем реальном Chromium `file://` UI Worker тесте; не подменяют CDP privateMemory, не выдают sampled RSS за true peak. [PR #200](https://github.com/zeter1/ZeTer-Photo-Editor/pull/200), squash `1d8e6fbc`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38155212317); 11 реальных Linux RSS выборок, `privateMemory` CDP недоступен, RSS всё равно собран.
- **Следующий P1 остаётся 010E-B:** bounded adaptive horizontal runs/connected clusters + strict planner work cap + RGB16/CMYKA32 precision/cancel parity. **P0 / 002:** независимый Adobe-authored high-depth corpus. Stage 002/003 не закрыты.

## 010E-A — complex connected dense ROI / native Worker baseline (слито, CI success, 2026-10-11)

- [018](018-complex-roi-profile.md): две dense области и 96px diagonal bridge, 8288 selected / 536 changed native tiles, RGB16/CMYKA32 Node Worker exact byte parity, atomic refusal/cooperative cancel, separate-process timing + RSS. [PR #199](https://github.com/zeter1/ZeTer-Photo-Editor/pull/199), squash `b8e82e6`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38153857359), [CI точного кодового main SHA success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38154037812).
- Это synthetic Node source, **не** независимый Photoshop-authored golden и не Chromium peak-RSS; пользовательский движок в этой проходке не менялся.
- **Следующая исполнимая P1 / 010E-B:** bounded adaptive horizontal runs и connected clusters против fixed-grid, worst-case planner work cap, ROI exact native parity + cancel; затем реальный browser peak-memory methodology. **P0 / 002:** licensed Adobe Photoshop-authored high-depth PSD/PSB corpus. Stage 002/003 не закрыты.

## 010D-D — две независимые native PSB32 Float32 вкладки (слито, CI success, 2026-10-11)

- [017](017-dual-native-psb32-session-isolation.md): Chromium `file://`, две разные ZeTer-generated 1025² PSB32 Float32 в двух живых вкладках; отмена первого Worker mid-kernel, второй native Worker с exact little-endian words и Undo/Redo, затем первый Worker с независимым Undo/Redo и History. **Готово:** [PR #198](https://github.com/zeter1/ZeTer-Photo-Editor/pull/198), squash `24d0edb7`, [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38152587196), [CI кодового main SHA success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38152760057).
- **Далее:** P0 [002](002-psd-compatibility-corpus.md) — independently Photoshop-authored licensed RGB16/CMYK32 PSD/PSB golden с provenance/hash; P1 010E complex dense ROI и настоящий browser memory HWM. Stage 002/003 **ещё открыты**.

## 010D-C — PSB32 Float32 active mid-kernel switch + native Undo/Redo (merged, exact-main CI success, 2026-10-11)

- [016](016-psb32-mid-kernel-undo-redo.md): Chromium `file://` ZeTer-generated 1025² PSB32 Float32; test-only probe AFTER native kernel write, active tab switch cancellation, strict native sample value/**Uint32 little-endian words** via public Save Project, two-session History isolation, successor Worker and native Undo/Redo restore.
- Same regression continues for PSD16 Uint16; browser smoke invokes both under fresh reload. **Not** an independent Photoshop fixture, two native high-depth tabs or true peak memory test.
- **Gate complete:** [PR #196](https://github.com/zeter1/ZeTer-Photo-Editor/pull/196) merged (squash `9d146eb3`); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38150936804) and [exact-main push CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38151060369).
- **Next P0:** licensed Adobe-authored RGB16/CMYK32 PSD/PSB + reference render [002](002-psd-compatibility-corpus.md). **Next P1:** 010E worst-case dense ROI plan; then 010D-D *two native high-depth* concurrent-session stress and browser memory high-water-mark methodology. Stage 002/003 still open.

## 010D-B — active Content-Aware Worker cancellation on tab switch (слито, CI success, 2026-10-11)

- [015](015-active-session-worker-cancel.md): scoped persistence leases, explicit CPU-bound Worker revocation, stale continuation/history/status/brush guard, valid destination only. Other edits still protected by existing busy guard.
- Added Node delayed Worker reply regression and real Chromium `file://` PSD16 active mid-kernel switch → byte/History preservation → successor Fill. **[PR #195](https://github.com/zeter1/ZeTer-Photo-Editor/pull/195) merged** (`edabef3d`), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38150109876), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38150190339).
- **Remaining P1:** PSB32 Float32 browser active-switch regression, Undo/Redo two-document oracle, 010E complex dense ROI and true memory peak. P0 [002](002-psd-compatibility-corpus.md) independent licensed Adobe Photoshop-authored high-depth corpus remains open. Stage 002/003 NOT complete.

## 010D-B0 — guarded two-session Chromium UI mid-kernel regression (слито, CI success, 2026-10-11)

- [014](014-browser-session-guard-mid-kernel.md): расширенная реальная Chromium `file://` 010D проверка двух вкладок с PSD16; mid-kernel клик по другой вкладке обязан быть **отклонён** пока `paintPersisting`, затем после блокировки слоя/отмены Worker переключение в обе стороны сохраняет native bytes/History второй сессии и успешный повторный Fill в первой. Только test-only instrumentation, production bundle не меняется.
- **Историческое состояние именно 010D-B0:** тогда активная смена сессии ещё не поддерживалась. Теперь реализована в [015](015-active-session-worker-cancel.md) / PR #195; PSB32 browser regression остаётся открытым.
- **Gate:** [PR #194](https://github.com/zeter1/ZeTer-Photo-Editor/pull/194) слит в `main` (`7d82588d721171cd8746b71d238db5588fb273bf`); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38149023595), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38149125350): Node, generated artifacts, Chromium `file://`, profiles, diff hygiene.

## 010D-A — Chromium file:// UI layer-lock mid-kernel (слито, CI success, 2026-10-11)

- **Выполнено:** [PR #193](https://github.com/zeter1/ZeTer-Photo-Editor/pull/193), squash `3b7e684ddeb50fdf60354efc4e0fc871b6fe5f45`. [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38147932831), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38148022098): Node (1160 tests), generated parity, Chromium `file://`, native profiles, diff hygiene.
- [013](013-browser-ui-lock-mid-kernel.md): реальный ZeTer-generated PSD16 1025² через UI, true native kernel-write probe (test-only Worker source), блокировка живого слоя **во время** CPU-bound ядра, stale terminate без native pixel/History publish, Unlock → новый успешный Worker job + preview/History; CDP memory — sampled, **не** true peak RSS. Production supplier/bundle не менялись.
- **Следующее P1 — 010D-B:** реальный browser document/session switch mid-kernel (желательно PSB32) с сохранением обеих вкладок и замером cancellation/recovery. Параллельно P0 [002](002-psd-compatibility-corpus.md) независимые лицензированные Photoshop high-depth fixtures; затем 010E complex dense ROI и расширение memory/quality. Stage 002/003 **не завершены**.

## 010C — bounded dense ROI: код слит в main (2026-10-11)

- **Готово:** [PR #192](https://github.com/zeter1/ZeTer-Photo-Editor/pull/192), squash `1b504b836ae3bbe28da89080ffa6877be09a2047`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38146702722): Node, generated bundle/Worker, Chromium `file://`, profiles и diff hygiene.
- [012](012-dense-strip-segment-roi.md): bounded deterministic strip/segment fallback для плотных ROI, frozen original-selection donors, strict aggregate budget, RGB16/Float32 CMYKA native byte parity sync/cooperative/Node Worker, safe rejection and cancellation. **[exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38146836584) на `46ceafe9fb578af6f285e7ced1e60cfdda747670`; последующие docs-only commits проверяются отдельно.**
- **Следом 010D:** browser UI lock/session revocation во время настоящего CPU-bound Worker, sampled renderer/process RSS и корректная отмена/возобновление; **P0 002** independent licensed Photoshop-authored PSD16/PSB32 остаётся открытой задачей.

## Завершённая проходка 010B — Chromium file:// mid-kernel cancellation (2026-10-11)

- [011](011-browser-mid-kernel-cancellation.md): реальный Chromium native RGB16 Worker; тестовый probe строго после настоящей записи ядром первого пикселя, затем CPU-bound stall; direct cancel и owner polling до завершения ядра, новый job и immutable native source. Тестовая instrumentation только в isolated Blob, production не меняется.
- **Код и PR gate завершены:** [PR #191](https://github.com/zeter1/ZeTer-Photo-Editor/pull/191) слит в `main` (`e77d65b02fae0e72a6e1e1ad3e3277a1a44f809b`); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38145352146) (Node, generated parity, Chromium `file://`, profiles, diff hygiene). Exact-main CI следует проверить отдельно. Это отдельно от [010A](010-dense-roi-worker-mid-kernel-cancel.md) (Node); ещё не выполнены dense ROI strip/segment planner, UI lock revocation mid-kernel и независимый Photoshop corpus.
- **Следующий исполнимый шаг после gate:** 010C bounded dense ROI grouping с глобальной замороженной донорской маской и strict aggregate budget; RGB16/Float32 CMYKA exact parity (sync/cooperative/real Worker). P0 002 external licensed high-depth golden остаётся приоритетом.

## Проходка 010A — реальная отмена Node Worker внутри ядра (слито, CI success)

- Регрессия `tests/tiled-inpaint-mid-kernel-cancel.test.mjs` наблюдает **настоящую запись пикселей в CPU-bound `inpaintSelectedSamples`**, затем отменяет Worker до обработки дальнего пикселя. Проверяет прямую отмену, периодический exact-owner guard и успешный новый job; отдельный SharedArrayBuffer — только тестовый probe, производственная модель остаётся private-clone + atomic publish.
- **Оставшиеся действия 010:** объединение dense strip/segment ROI при bounded aggregate area и global frozen donors, sync/cooperative/Worker native byte parity, отдельный Chromium `file://` mid-kernel browser stress + memory samples. P0 002 — независимые Adobe Photoshop-authored лицензированные high-depth fixtures.
- **Приёмка 010A пройдена:** [PR #190](https://github.com/zeter1/ZeTer-Photo-Editor/pull/190) (merge `61dcd260`); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38144346522), [точный main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38144433426): Node tests, generated parity, Chromium `file://`, profiles, diff hygiene. **Не закрывает целиком 010 или Stage 003.**

## Завершённая проходка 009 — большой PSB32 / реальная Worker reply cancellation (2026-10-11)

- [009](009-large-psb32-worker-cancellation.md) — ZeTer-generated PSB32 Float32 1025×1025, 16 810 000 native bytes, адаптивный v2 / little-endian bit oracle; Chromium `file://` UI import → Worker Content-Aware Fill → canvas preview, History, Undo/Redo.
- **Готово и слито:** [PR #189](https://github.com/zeter1/ZeTer-Photo-Editor/pull/189), squash `0cd2c2efc260b4721737b0997d12b9e3dac12290`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38143205232), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38143299893). Отмена протестирована после **реального вычисления Worker**, с задержкой ответа, UI lock, завершением job и отсутствием повторной Fill-публикации. Это НЕ отмена во время ядра.
- **Следующая исполнимая проходка [010](010-dense-roi-worker-mid-kernel-cancel.md):** bounded dense/connected ROI planning и настоящая mid-kernel cancellation на реальном Worker (Node + Chromium). Параллельно P0 [002](002-psd-compatibility-corpus.md) — независимо Photoshop-authored PSD16/PSB32 и reference render, plus native/Worker browser peak RAM.

## Завершённая проходка 008 — большой PSD16 → v2 Worker в Chromium file:// (2026-10-11)

- [008](008-browser-large-psd16-worker.md) — новый тест реального браузерного пути: ZeTer-generated 1025×1025 RGBA16 PSD (>8 MiB) → file input → adaptive tiled v2 → точный Save Project native byte oracle → Worker Content-Aware Fill → preview/Undo/Redo + sampled CDP memory.
- **Готово, слито и проверено:** [PR #188](https://github.com/zeter1/ZeTer-Photo-Editor/pull/188), squash f172168cbbda02ecded76818055164b63eca5ac3; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38142325168); [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38142408685). Это НЕ независимая Photoshop-authored fixture, не PSB32 end-to-end, не доказательство peak RAM и не Stage 003 done.
- **После 008 выполнена 009:** PSB32 end-to-end и deterministic stale reply cancellation. Следующая 010 — adaptive dense ROI и real mid-kernel cancellation; Stage 002 independent corpus (P0) параллельно.

# Очередь реализации по скриншотам (актуализация 2026-10-11)

Источник статуса — `main` и реальные тестовые доказательства, а не обещание «Photoshop parity».
Подробные дневники: [002](002-psd-compatibility-corpus.md), [003](003-tiled-content-aware.md).

## Завершённая проходка 007 — file:// PSD16/PSB32 import precision (2026-10-11)

- [007](007-browser-psd-psb-ui-import.md): тестовый ZeTer-generated PSD16 и PSB32 → настоящий UI `#fileInput` → high-depth import → canvas preview → File > Save Project → точный native little-endian sample oracle из сохранённого `.zpe`.
- **Готово и слито:** [PR #187](https://github.com/zeter1/ZeTer-Photo-Editor/pull/187), squash `c3fd57a807e941676f6b8b50b240a93537829bad`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38137491812), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38137556394). 1151 Node-тест, generated parity, Chromium `file://`, профили и diff hygiene.
- **Не закрыто:** большой PSD16/PSB32 → v2 tiled Worker → preview → Undo/Redo/cancellation, memory peak; лицензированный независимый Adobe Photoshop-authored high-depth golden. `Stage 002/003` остаются в работе.
- **Следующая исполнимая задача:** браузерный сквозной v2 import→Worker при >8 MiB с memory samples и атомарной отменой; затем adaptive dense ROI strip/segment grouping с aggregate budget. Внешний Stage 002 corpus — параллельный P0.

## Что считать готовым

- [x] Базовая v2-модель документов/слоёв, raster/vector masks, adjustment layers,
  редактирование Bézier, базовый PSD/PSB импорт/экспорт, Smart Objects,
  native RGB/CMYK 16/32-bit, ICC, selection refinement и bounded Content-Aware Fill
  уже имеют реализацию и регрессии в `main`. Это **не** означает полной Adobe-совместимости.
- [ ] Полная cross-app и pixel parity Photoshop с независимо полученными high-depth файлами.
- [ ] Масштабируемые широкие выделения, проверенная пиковая память браузера, отмена,
  Undo/Redo на больших PSD/PSB без блокировки UI.
- [ ] Production-quality RAW/DNG и универсальный gamut/soft-proof workflow.
- [ ] Дополнительное качество Selection/Refine/Inpaint, реальные GPU/ML ускорения.

## Завершённая малая проходка — P1 native Worker byte profile (2026-10-11)

- Инструмент: [004-native-worker-byte-integrity-profile.md](004-native-worker-byte-integrity-profile.md); `tools/profile-native-worker-integrity.mjs`.
- **Готово и слито в `main`:** synthetic RGB16 и Float32 CMYKA Node Worker profiling, exact byte oracle, immutable native tiles, отдельный процесс на случай, memory/time snapshots и regression 1 MiB; CI запускает информационный 8 MiB профиль.
- **Gate подтверждён:** [PR #184](https://github.com/zeter1/ZeTer-Photo-Editor/pull/184) слит в `main` (`28ec5de2dbdd38e2782a8d5bc864a9dbdc0db5d2`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38133313481) и [точный `main` CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38133376298) — **success** (Node, Chromium `file://`, generated parity, 8 MiB diagnostics, diff hygiene). Нет browser peak RAM/Undo, лицензированного Photoshop PSD16/PSB32 и поддержки oversized connected ROI.
- **Следующий кодовый шаг:** bounded connected ROI с глобально исключёнными source selection donors. Затем Chromium `file://` Worker / preview / Undo / memory и Stage 002 внешний high-depth oracle.

## Завершённая проходка — P1 connected ROI fragments (2026-10-11)

- **Реализовано и слито:** [PR #185](https://github.com/zeter1/ZeTer-Photo-Editor/pull/185) → squash `1d18f525d62b03eb6734b883e94a8cc5642ca6a1`. Детали: [005](005-connected-roi-frozen-donors.md).
- Разреженные широкие связные выделения могут делиться на ограниченные native tile fragments при неудаче прежнего halo-disjoint плана. Глобальная замороженная bitmap запрещает все original-selection donors и PatchMatch-контекст; publish остаётся атомарным, source immutable и Worker/cooperative precision parity проверяется регрессиями.
- **Gate пройден:** [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38135146345) и [точный main push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38135223279) — **success** (Node, Chromium `file://`, generated bundle/Worker parity, профили, diff hygiene).
- **Открыто:** максимальное число 256 occupied tiles; связные плотные выделения/суммарный ROI свыше 8 MP отклоняются; нет browser end-to-end PSD16/PSB32 → UI Worker → preview → Undo/Redo/RAM или независимых Adobe pixel-goldens. Вся Stage 003 и Stage 002 остаются открытыми.

## Завершённая проходка 006 — >256 occupied native tiles (2026-10-11)

- [006](006-many-tile-bounded-fragments.md): снят прежний жёсткий отказ на 256 tile cells; для больших разреженных выделений включён безопасный per-cell fragment plan с global frozen donor exclusion и проверкой суммарного ROI бюджета.
- Добавлены отдельные regression fixtures RGB16 и Float32 CMYKA (512 cells, sync/cooperative/real Worker, out-of-budget, cancellation) и синхронизированы generated bundle/Worker.
- **Gate выполнен:** [PR #186](https://github.com/zeter1/ZeTer-Photo-Editor/pull/186) слит в main (`6204003f26f43b3babfa370508565f6ea86225e9`), [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38136465952), [точный main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38136526958). Это лишь bounded sparse-selection improvement, **не** поддержка всех плотных/больших ROI, не полноценная Stage 003, не внешний Photoshop high-depth golden.

## Ближайшие выполняемые проходки

| Приоритет | Следующая задача | Критерий приёмки |
|---|---|---|
| P0 | **Stage 002: внешний high-depth corpus.** Найти **независимо Adobe Photoshop-authored** RGB/CMYK PSD16 и PSB32 с правом распространения; записать исходный URL, лицензию, происхождение и SHA-256 без подмены синтетикой. | `tools/audit-external-high-depth-corpus.mjs` PASS на реальных файлах; экспертно проверены license/authorship; pinned manifest; без скачивания сомнительных assets в репозиторий. |
| P0 | **Stage 002 → 003: реальный cross-app oracle.** Выполнить decode/группы/маски/adjustment + внешние Photoshop render references (включая clipping/blend). | Сверка semantic + pixel snapshots, чёткий unsupported list, независимый от собственного PSD writer golden. |
| P1 | **Stage 003: 010E complex dense ROI / planning.** После выполненного 010C strip-segment fallback — горизонтальные runs/connected clusters, worst-case fragmentation, bounded planning time и browser memory. | RGB16/Float32 CMYKA sync/Worker/cooperative parity, отмена в read/kernel/write/serialize, caps при worst-case связной маске, неизменность нетронутых байтов/тайлов. |
| P1 | **Stage 003: browser end-to-end.** Chromium `file://` PSD16/PSB32 → tiled Worker → preview → Undo/Redo; отдельно lifecycle cancellation. | Автоматизированный сценарий, sample renderer + Worker/process memory и latency (не выдавать snapshot за peak), повторяемость и минимум две глубины. |
| P1 | Profiling byte-integrity проверки Worker на крупных RGB16/Float32 CMYK PSD/PSB и real browser peak RAM. | Измерить overhead per changed tile, latency, max memory и сравнить с previous baseline; exact native byte parity + source immutability. |
| P2 | Документы в Smart Objects, сложная структура Photoshop, текст/layout и vector path interoperability. | Поштучные independent fixtures + exact round-trip regression. |
| P2 | Color management и 16/32-bit performance на больших файлах; CMYK preview/soft proof. | ICC reference сравнения, измерения до/после и тесты конверсий. |
| P3 | RAW/DNG pipeline (LibRaw WASM), затем Select & Mask/Content-Aware quality и GPU/ML. | Отдельные технические спецификации, права на sample fixtures и контролируемый memory budget. |

## Завершённая проходка — P1 native Worker pixel integrity (2026-10-11)

- **Gate выполнен:** [PR #183](https://github.com/zeter1/ZeTer-Photo-Editor/pull/183) слит в `main` (squash `884896cf6630083d5760a595c137157e1df7d874`). [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38129441200) и [точный `main` push CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38129498774) завершились **success**: Node, generated parity, Chromium `file://`, profiles, diff hygiene. Общая задача 003 **не завершена**.
- **Контракт:** v1/v2 native source допускает только канонический Base64 с правильной padding-позицией и нулевыми неиспользованными битами; для Worker reply сравнить реальные little-endian bytes **каждого пикселя изменённого тайла**, не только tile ownership. Все изменённые пиксели должны входить в frozen selection, а `changed` обязан равняться реальному числу изменённых пикселей. Гарантия независима от lossless/8-bit preview.
- **Бюджет:** один бит выделения на пиксель (до ~2 MiB при максимальном 48 MiB source); одновременно декодируются только два payload одного changed tile; unchanged tiles не декодируются.
- **Regression:** `tests/tiled-inpaint-ui-dispatch.test.mjs` — CMYKA Float32 и RGB16 unselected neighbor tamper, forged pixel counters, alternative Base64 bits; `tests/pixel-buffer.test.mjs` — v1/v2 source padding and alphabet validation.
- **Проверено:** CI на точном merge SHA; код в `main`. Этот P1 hardening-подэтап завершён, но не доказал end-to-end Photoshop-паритет на сторонних high-depth файлах.
- **Далее после gate:** connected-wide ROI planning с неизменными исходными донорами, затем Chromium Worker/Undo/Redo/RAM/latency на больших сторонних PSD16/PSB32; параллельно P0 независимый лицензированный Photoshop-authored corpus.

## Предыдущая завершённая проходка (ветка `feat/stage002-bounded-corpus-preflight-20261011`)

- [x] В аудиторе P0 ограничено чтение недоверенного manifest (1 MiB) и
  запрещены symlink/path swaps manifest.
- [x] Проверены минимальные каналы RGB (3) и CMYK (4), нижняя граница размера
  PSD (40 байт) и PSB (44 байта), добавлены негативные регрессии.
- [x] PR [#182](https://github.com/zeter1/ZeTer-Photo-Editor/pull/182) проверен и слит (`2033a10`); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38128443224) и [точный main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38128545523) завершились **success**.
- [ ] Реальные Photoshop-authored PSD16/PSB32 **пока не получены**;
  эта проходка не закрывает 002 или 003.

### Правило отчётности

Выполнено = код + тесты + review + merge в `main` + зелёный CI **точного main SHA**.
До завершения всех gates помечать «в работе», не записывать «всё реализовано».
