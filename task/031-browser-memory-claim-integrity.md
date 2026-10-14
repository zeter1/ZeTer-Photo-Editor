# 031 / 024C6 — защита browser memory artifact от ложных Worker/PID/exit claims

**Статус (2026-10-14):** код и тесты подготовлены в `feature/031-browser-memory-claim-integrity`; CI/merge не считать завершёнными без фактического результата GitHub Actions.

## Причина

После 030 браузерный JSON уже сверяет порядок milestones и сводные `durationsMs`, но построение артефакта не отвергало вложенную подмену `workerTargets.provenWorkerTerminationCount`: злоумышленно изменённый JSON с ложным доказательством завершения Worker мог пройти rebuild/equality, поскольку код сверял только `workerPidMapping`. Такие метрики нельзя выводить из CDP `Target.getTargets` или `SystemInfo.getProcessInfo`.

## Реализация

- [x] `tools/browser-operation-artifact.mjs`: общая fail-closed проверка до сериализации **и** при повторном чтении CI JSON.
- [x] Запрещены претензии на operation-wide peak и Worker RSS, ложный `provenExitCount`, любое присвоение PID Worker через `workerPidMapping`.
- [x] Для вложенного Worker target census требуются явные `workerPidMapping:'unknown'`, `provenWorkerTerminationCount:null`, согласованный `uniqueWorkerTargetIds`; неизвестные поля census и PID/URL/private fields в individual targets отклоняются.
- [x] `tests/browser-operation-artifact.test.mjs`: негативные случаи с forged exit, Worker PID, peak RSS, подменёнными target metadata, пропущенным null, поддельным count и проверкой уже сохранённого PSD16 JSON.
- [ ] Локальные `npm run check` и Chromium `file://` — выполнить при наличии полного репозитория.
- [ ] GitHub Actions PR CI, merge и CI точного коммита main — фиксировать только по факту успешного результата.

## Границы

Это **только инструменты измерений и регрессии**, не ускорение пиксельного ядра и не новая функция UI. `Target.getTargets` по-прежнему **не** связывает target ID с Linux PID. Worker termination и истинный peak RSS не доказаны. Если CDP API недоступен, записывается `unknown`/`unavailable`, не подставляются синтетические значения. В future CDP schema changes нужно осознанно расширять список разрешённых полей, а не молча принимать новые claims.

## Что выполнять дальше

1. **P0 [002](002-psd-compatibility-corpus.md):** получить независимо лицензированные Photoshop-authored RGB16/CMYK32 файлы и внешние goldens, зафиксировать source/license/SHA256, без ложного Adobe provenance.
2. **P1 [025](025-browser-worker-target-census.md):** документированный метод target→PID с доказательными проверками PID+starttime; если такого CDP метода нет — честное `unknown`.
3. **P1 [003](003-tiled-content-aware.md):** browser quality/latency/RSS на широких connected ROI и честное сравнение с независимыми орacles, cancellation/atomic native bytes.
4. **P2:** PSD round-trip quality: masks/groups/text/adjustments/blend modes и явно задокументированные расхождения.

**Не закрывать Stage 002/003**: текущая проходка ограничена честностью тестовых свидетельств.
