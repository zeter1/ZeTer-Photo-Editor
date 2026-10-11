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
