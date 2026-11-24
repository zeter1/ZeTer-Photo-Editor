# CAP-RAW-DNG-LINEAR-CONTRAST — bounded локальный срез 1.47.17

**Дата:** 2026-11-23. **Stage:** 9 (RAW). **Приоритет:** P1. **Статус:** IN PROGRESS (код и локальная приёмка есть; remote PR/CI/merge ещё нет).
**Ветка:** `feat/raw-linear-contrast-20261123`, от локального стека `b429175`; реализация в локальном коммите `c04990f1a3978ad5eeb73a4f49e80ca6d19e5b6a`. НЕ чистый `main` и НЕ опубликованный PR.

## Пользовательская функция

- В RAW Properties добавлено редактируемое поле «Контраст RAW» от −1 до +1 (по умолчанию 0), повторная проявка реальных DNG pixels на основе исходного неизменённого `rawDng.dataUrl`, а не CSS фильтр готовой PNG.
- `src/formats/dng-color.js`: сценолинейная luminance S-кривая `f(y)=y+c·y·(1−y)·(2y−1)` после Highlights/Shadows и экспозиции, до sRGB OETF; фиксирует 0 / 0.5 / 1, монотонна при `c∈[−1,1]`; одно отношение `f(y)/y` применяется ко всем каналам для сохранения линейных цветовых соотношений.
- `src/formats/dng.js`: проверяет тип и диапазон контраста, записывает корректное поле `development.contrast`; default 0, native sensor/source bytes не меняются.
- `src/main.js`: новый field интегрирован в re-develop выбранного незаблокированного RAW-слоя с существующими owner/session/stale/lock guard, History Undo/Redo, reset.
- `src/core/state.js`: строгая сериализация и восстановление `.zpe` + legacy default 0; явные нечисловые, nonfinite и вне диапазона значения отклоняются вместе с неверным RAW metadata.
- `src/formats/dng-presets.js`: RAW-пресеты и portable schema 1 теперь включают параметр contrast; старые JSON без него принимаются и получают 0; импорт с недопустимым значением отклоняется, без скрытого clamp.

## RED → GREEN и фактические проверки

- **RED:** `tests/dng-contrast.test.mjs` до реализации не прошёл 4 функциональных контракта (tone curve, real DNG pixels, .zpe, preset compatibility).
- **GREEN:** `node --test tests/dng-contrast.test.mjs tests/dng-tonal-controls.test.mjs tests/dng-presets.test.mjs tests/dng-presets-transfer.test.mjs` — **15/15 PASS**; вместе с `tests/version-consistency.test.mjs` **16/16 PASS**.
- **Windows full `npm run check`: 1787 total, 1772 PASS, 10 SKIP, 5 FAIL**. Все 5 FAIL — старые Linux-only cgroup/proc tests на Windows. После корректировки старых exact-shape ожиданий новых FAIL нет. **Общий check НЕ PASS.**
- **Build:** `npm run build` PASS. **Real Chrome `file://`:** `npm run test:browser:raw-dng` PASS с новой contrast веткой: изменение значения через реальный Properties input, exact saved PNG/RGBA vs Node DNG oracle из той же кодовой базы (не независимый LibRaw), History Undo/Redo, .zpe save/reopen, immutable native sensor data, neutral reset; остальные RAW и PNG/PSD/PSB rendered регрессии PASS. Этот oracle основан на синтетическом fixture, а не camera-authored RAW.
- **Broad Windows Chrome:** `npm run test:browser` на финальной v1.47.17 **PASS, exit 0** (`Browser smoke passed`, real `file://`). Первый синхронный вызов превысил лимит ответа Bridgerator; повторный PowerShell wrapper UTF-8 BOM сохранил реальный process exit `0` в `G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-browser-20261123-contrast-exit.txt` и журнал `raw-browser-20261123-contrast-detached.log`. Наблюдаемые Chrome PSD16/PSB32/Worker/IndexedDB тесты вошли в общий smoke; это синтетический ZeTer corpus, не Adobe. **GitHub PR-head CI:** NOT RUN (новые локальные изменения). **Exact-main:** соответствует старому `ddd90d3` core SUCCESS, но не содержит контраст. **Independent camera pixel oracle:** BLOCKED.

## Изменённые файлы

`src/formats/dng-color.js`, `src/formats/dng.js`, `src/core/state.js`, `src/formats/dng-presets.js`, `src/main.js`, `tests/dng-contrast.test.mjs`, адаптация прежних exact-shape тестов, `tools/browser-raw-dng-check.mjs`; release metadata, bundle, матрица и очередь.

## Граница и следующее действие

Не заявлять Photoshop/LibRaw parity, 16/32-bit HDR выход или восстановление насыщенных фотонов. Тональная кривая применяется к текущему 8-bit DNG preview и не модифицирует native DNG. Результат локальный; проверить обязательные review/branch protection и самостоятельно выполнить GitHub push/merge по постоянному делегированию пользователя от 2026-11-23 при прохождении CI, затем в порядке **#397 → #398** обеспечить CI для PR #398 и чисто перенести ранее реализованный локальный RAW стек **включая этот bounded срез**, после чего проверить PR-head и exact-main Linux checks. Копирование готовых RAW подсистем повторно не требуется.

**Уточнение полномочий 2026-11-23:** отдельное согласие на каждый push/PR/CI rerun/merge для `zeter1/ZeTer-Photo-Editor` больше не требуется. Гарантии exact-head CI, обязательных review/branch protection, конфликтов и readback сохраняются. Новые удалённые действия этим локальным обновлением ещё не выполнялись.
