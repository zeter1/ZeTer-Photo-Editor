# 037C-3b-3 — native Worker malformed reply / maxBytes fail-closed

**Статус: /1 КОДОВАЯ ПРОХОДКА ЗАКРЫТА (2026-10-18); /2 genuine-photo Chromium malformed/maxBytes UI ЕЩЁ OPEN.**
[PR #261](https://github.com/zeter1/ZeTer-Photo-Editor/pull/261) → [main 813ccbe](https://github.com/zeter1/ZeTer-Photo-Editor/commit/813ccbeb3b8974471453948d5ba315df98d5468e); [PR CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39127286740), [PR photo CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39127286483), [exact-main CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39127667652), [exact-main photo CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39127667813) — все success. Эти реальные фото workflow проверяют предшествующую matrix без специальной инъекции malformed/maxBytes; /2 ещё не доказана.
Эта проходка следует за закрытой [037C-3b-2b/3b-2b](037c3b-2b-3b-2b-photo-cancel-successor.md).
Это *не* доказательство полного 037C или Photoshop-compatibility.

## Выполнено в коде и тестах

- `src/painting/tiled-inpaint-dispatch.js`: после freeze geometry и detached Worker ответ валидируется до preview/persistence/History: проверка неизменности unselected native bytes уже существовала. Дополнительно запрещены изменения **alpha в выбранных пикселях** и нечисловые `NaN` / `Infinity` в изменённых Float32-цветовых сэмплах; конечные HDR-сэмплы >1 допустимы.
- Ответ `{ unavailable:true, source:... }` или с дополнительными полями отвергается. Только чистый `{unavailable:true}` от supplier не скрывает compute/protocol failure за fallback.
- `tests/tiled-inpaint-ui-dispatch.test.mjs`: отрицательные CMYKA32 alpha, NaN, Infinity, смешанный unavailable/native, `maxBytes = source.rawBytes - 1` с отказом **до** selection sampling / Worker dispatch для RGB16 и CMYKA32; следующий нормальный запрос должен пройти. Отказ до preview проверяется через `createRasterEditController`; исходные native v2 tiles и source reference сохраняются.
- Синхронизированы generated browser bundle и hash/index manifest (версия 1.46.4).

## Следующая проходка — 037C-3b-3/2 genuine-photo Chromium

1. Два независимых настоящих pinned PSD16/PSB32 file:// UI imports со строго проверенным source/native SHA-256. Не заменять их synthetic native fixtures.
2. Через публичный UI выделить connected 8288px ROI и запустить настоящий Worker. В тестовом transport interception **после реального native Worker completion, до UI result validation** подать malformed native tile (в том числе selected alpha/non-finite color/counter/outside-ROI). Подтвердить показ ошибки через публичный status/toast, 0 new Fill History, bit-exact native v2 unchanged и 0 публикаций preview.
3. Отдельно установить для реального photo layer `maxBytes` ниже `rawBytes` на production-boundary без подмены формата входа; доказать отказ до Worker, сохранить source/history, затем успешно выполнить корректный запрос.
4. Артефакты и offline validator: жесткая привязка к frozen pins, отсутствие self-reported success вместо независимых native snapshots, две независимые receipt + negative tamper tests и genuine-photo GitHub CI.
5. PR CI → merge → exact-main CI, только затем закрывать /3b-3. После него **037C-3c** full acceptance с проверкой ранее собранных 6× native worker/Undo/Redo/quality, observational memory и failure matrix.

**Остаётся вне этой проходки:** P0 002 Adobe-authored compatibility goldens; Stage 003 global tiled budget; ICC/CMYK calibration; RAW pipeline; HDR/32-bit robustness и полная Photoshop compatibility.

## 037C-3b-3/2a — реализация в ветке, подтверждение ожидается

Начат [отдельный реальный PSD16/PSB32 Chromium selected-alpha отказ](037c3b-3-2a-photo-malformed-alpha.md). Вызов реального Worker и public UI fail-closed покрывается новой опциональной CI матрицей, но без green PR/exact-main evidence **/2a не закрыта**, /2b maxBytes + остальные malformed cases OPEN.

## 037C-3b-3/2a — принятая genuine-photo alpha-mutation матрица

[PR #262](https://github.com/zeter1/ZeTer-Photo-Editor/pull/262) → [main 7caacf7](https://github.com/zeter1/ZeTer-Photo-Editor/commit/7caacf75760bd4097bdaf7a99135774b7866b64f); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39130130353), [PR photo CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39130130421), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39130492852), [exact-main photo CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39130492841). Два независимых настоящих pinned PSD16/PSB32 photo Chromium сценария с native Worker и corrupt selected-alpha, публичной ошибкой, без preview/History и exact native v2 parity. **/2b: counters/Float32/outside-ROI + реальный public UI maxBytes/refusal-retry ещё OPEN.** После /2b — 037C-3c.

## 037C-3b-3/2b-1 — реальный Worker corrupted changed-counter (DONE, 2026-10-18)

Отдельные PSD16/PSB32 pinned-photo Chromium `file://` проверки; native Worker вычисляет реальный результат, test transport снижает `changed` на единицу до UI validator. Нужны public error, no-preview/no-History, byte-exact Save Project, offline pinned receipt, PR/exact-main CI. Остальные /2b кейсы (Float32 non-finite, outside-ROI, maxBytes public UI refusal/retry) остаются TODO. [Подзадача](037c3b-3-2b-1-photo-malformed-counter.md).


### 037C-3b-3/2b-1 подтверждённая приёмка

[PR #263](https://github.com/zeter1/ZeTer-Photo-Editor/pull/263) → [main 410acedf](https://github.com/zeter1/ZeTer-Photo-Editor/commit/410acedf5649a7d52e84650b4978d51dfe3958af); [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39133594716), [PR genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39133594742), [exact-main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39133988525), [exact-main genuine-photo success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/39133988451). Два независимых genuine photo Chromium сценария и strict offline validator прошли. **037C-3b-3/2b-2 OPEN**: non-finite Float32, outside-ROI, public UI `maxBytes` отказ/успешный повтор.
