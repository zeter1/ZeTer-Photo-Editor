# 024 / 010E-B4 — browser operation-wide timing and memory attribution

**Статус:** следующая невыполненная P1. Stage 002/003 открыты; не считать sampled memory истинным operation peak.

## Цель

Связать один реальный `file://` PSD16/PSB32 → native Worker Content-Aware Fill → private preview/publish → Undo/Redo с измерениями **времени всего действия** и памяти Chromium. Нынешний [019](019-browser-linux-rss.md) собирает RSS и per-PID HWM по отдельным снимкам, но не атрибутирует весь lifecycle конкретному Worker.

## План следующей инженерной проходки

1. Зафиксировать детерминированный `operationId` / временные границы UI: начало (после выбора источника), selection freeze, dispatch, Worker ready, native kernel finished, preview PNG, history publish, Undo, Redo, отмена; помечать cancelled/failed без ложной метрики completed.
2. Записывать CDP target/process mapping + Linux PID/status `VmRSS`/`VmHWM` до/во время/после операции, включая **новые/исчезнувшие PID**; отдельно Chrome main/renderer/utility/Worker, если доступно. Невозможность прямого Worker→PID mapping явно отмечать `unknown`.
3. Отделить `jsHeapUsedSize`, `privateMemory` (только если браузер предоставляет), sampled RSS и process-lifetime HWM. Последние не доказывают peak RAM операции; исключить интерпретацию суммы VmHWM как одновременного пика.
4. Сценарии: ZeTer-generated RGB16 PSD и CMYKA Float32 PSB в настоящем Chromium `file://`, успех, mid-kernel cancel, возобновление нового job и независимая Undo/Redo. Сверить immutable native little-endian words и не публиковать stale session.
5. Выводить machine-readable JSON для CI (informational) с sample count, lost PID count, sampling interval, unavailable metrics, началом/концом каждой фазы и peak *observed sample* для tracked PID. Не вводить случайные числовые performance gates.

## Критерии готовности

- [ ] Путь реально проходит `file://` Worker, не Node-only профилировщик.
- [ ] В тестах различаются operation duration, sampled RSS и per-process lifetime HWM.
- [ ] Проверено восстановление после отмены и native output parity.
- [ ] Linux отсутствует/нет /proc/CDP metric → аккуратная деградация, а не фиктивное число.
- [ ] `npm run check`, `npm run test:browser`, generated parity, CI и exact-main gate успешны.

## Параллельная P0

[002](002-psd-compatibility-corpus.md): independently Photoshop-authored licensed RGB16/CMYK32 PSD/PSB, эталонные рендеры, SHA-256/provenance. Настоящая широкая Photoshop compatibility этим профилем не закрывается.
