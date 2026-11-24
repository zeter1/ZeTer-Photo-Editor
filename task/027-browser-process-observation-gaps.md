# 027 / 024C2 — Полнота PID-наблюдений и разрывы при отмене Worker

**Статус (2026-10-14):** **слито в `main`**, [PR #211](https://github.com/zeter1/ZeTer-Photo-Editor/pull/211) → `93f5c2e`; [PR CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38525012524), [exact-code main CI success](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/38525286762). Node, generated parity, настоящий Chromium `file://` PSD16/PSB32, JSON и профили прошли; Stage 002/003 открыты.

## Проблема
- Успешные CDP PID списки и Linux `/proc` с PID+starttime не обязательно есть в каждом snapshot во время cancel→retry.
- Если финальный `/proc` снимок отсутствует, сохранённое от предпоследнего снимка `observedAtLastSnapshot` ложно выглядит как подтверждение видимости на финише.
- Если наблюдения разделены пропуском, их сравнение не подтверждает момент появления/исчезновения PID. Пропажа **не доказывает exit**.

## Изменения
- [x] `browser-renderer-heap-sampler`: независимые флаги полноты `pidMembershipObserved` и `linuxIdentityObserved` по каждому успешному snapshot; агрегированный `snapshotCoverage` (observed/missing, start/finish, наблюдаемые соседние переходы и неизвестные интервалы, сгруппированные gaps).
- [x] PID сравнения ведутся только между **соседними успешными** snapshot; не изобретать churn через missing CDP.
- [x] `browser-linux-process-identity`: `noteMissingSnapshot()` снимает притворное знание последней видимости и разрывает смежность; `observedAtLastSnapshotCount`, `noLongerObservedAtLastSnapshotCount` и `processes[].observedAtLastSnapshot` становятся `null` если финальный снимок неизвестен.
- [x] Знание ранее увиденных PID+starttime сохраняется: реальное различие starttime доказывает другой наблюдённый incarnation, но не точный момент завершения прошлого.
- [x] Unit-регрессии для cancel→retry после CDP отказа и Linux identity пропуска/повторного появления/PID reuse.
- [x] GitHub PR CI: `npm run check`, реальный Chromium `file://` PSD16/PSB32, JSON artifacts — success.
- [x] Merge и **CI exact-code main** — success, зафиксированы выше.

## Следующая очередь
- **P0 [002](002-psd-compatibility-corpus.md):** independently licensed Photoshop-authored PSD16 RGB + PSB32 CMYK, hashes, provenance, reference renders, сравнение codec/preview/browser без заявления об авторстве ZeTer fixtures.
- **P1 [025](025-browser-worker-target-census.md):** Worker target→PID attribution только если есть документированный API и проверка; иначе оставлять `workerPidMapping:unknown`.
- **P1 [003](003-tiled-content-aware.md):** профиль широкого connected ROI/interruptible fallback по реальным high-depth fixtures, проверка UI responsiveness/latency/RSS на реальном Chromium.
- Ни RSS sampled maximum, ни VmHWM процесса не является точным пиком всей операции. Stage 002/003 открыты.
