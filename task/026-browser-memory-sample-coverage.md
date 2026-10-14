# 026 / 024C1 — Browser memory sample coverage and true finish semantics

**Статус (2026-10-14):** **слито в `main`** через [PR #210](https://github.com/zeter1/ZeTer-Photo-Editor/pull/210), squash `67e4451`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38522956593) и [CI точного code-commit `main` success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38523222466) (Node, generated parity, real Chromium `file://`, обе PSD16/PSB32 JSON, профили, diff hygiene). Stage 002/003 остаются открытыми.

## Проблема

После удачных ранних CDP privateMemory или Linux /proc VmRSS измерений Chrome может перестать предоставлять данные до финального снимка `finished` (отказ домена, PID исчез между CDP и /proc, ограничение доступа). Прежний код использовал **последний успешный** отсчёт как `endPrivateBytes` / `endAggregateRssBytes`, ошибочно подменяя реальное окончание операции. `sampledIncreaseBytes` также должен требовать истинный первый снимок, а не первый доступный позднее.

## Изменения в этой проходке

- [x] `tools/browser-renderer-heap-sampler.mjs`: `baseline*` строго относится к `before-import`, `end*` — строго к `finished`; при отсутствии соответствующих counters выдаётся `null` (не 0 и не предыдущий отсчёт). Прирост доступен лишь с достоверной baseline.
- [x] Добавлен независимый `metricCoverage` для Chromium `privateMemory` и aggregate Linux VmRSS: число наблюдений и пропусков, наблюдаемость в начальном/конечном снимке, первая/последняя фаза наблюдения и пропущенные этапные снимки. Отдельные JS heap, Target ID census и PID+starttime остаются независимыми.
- [x] `tools/browser-operation-timeline.mjs`: передача `metricCoverage` в версионированный информационный артефакт операции без изменений семантики Worker→PID=`unknown`.
- [x] Unit-регрессии: частично успешная memory sampling с `ENOENT` при конце, отказ обоих CDP domains, честные `null` вместо «end = old sample».
- [x] CI `npm run check`, browser `file://` PSD16/PSB32 и JSON verification — PR CI **success**.
- [x] PR CI success, merge в `main` и **отдельный exact-code main CI success** — подтверждены.

## Ограничения и следующие действия

- Показатель sampled maximum **не** является peak RSS и не доказывает отдельную память Worker; `VmHWM` — lifetime max каждого PID. Target ID→PID официально не доказан, `provenExitCount` остаётся `null`.
- **P0 / [002](002-psd-compatibility-corpus.md):** отдельно получить доказуемо Photoshop-authored licensed RGB16 PSD + CMYK32 PSB, источник/license/hash/render reference и исполнить manifest/codec/browser проверку. ZeTer-generated fixtures не эквивалент.
- **P1 / 024C2:** snapshot-level completeness и observation gaps при Chromium PID churn/cancel→retry без ложных утверждений об exit или суммарном HWM; проверить отдельные missing/reappearing PID incarnations.
- **P1 / 025B:** документированный и тестируемый CDP target→PID mapping для конкретного Chromium, только если он действительно существует; иначе сохранить `unknown`.
- **P2:** расширить независимый Photoshop layered PSD round-trip corpus (mask/group/text/adjustment/blend/reference rendering).

**Done gate:** merge + PR CI green + exact-code main CI green, а не только локальный unit test. Ни эта проходка, ни предшествующие не завершают Stage 002/003.
