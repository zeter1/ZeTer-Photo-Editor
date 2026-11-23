# CAP-RAW-DNG-JPEG-PARTIAL-SCANS — bounded SOF3 SOS 2+2 (v1.47.1)

**2026-11-20 · Stage 9 / P1 · IN PROGRESS (локальный код/приёмка DONE; remote CI/merge NOT RUN).**

## Реализация

- **Feature commit:** 0e536fef162c88916fc11b31d3cf982ae55d4fee; локальная ветка feat/raw-dng-sof3-multiscan-20261120, worktree G:\МОЯ Веб-разработка\ZeTer Photo Editor\ZeTer-Photo-Editor-raw-next. База 5b9383e — четыре раздельных SOS. В цепочке также предшествующие локальные RAW-функции, отсутствующие в main.
- **Production:** src/formats/dng-lossless-jpeg.js принимает для SOF3 с четырьмя компонентами ровно две независимые SOS-группы по два уникальных компонента. Frame component IDs используются для записи в исходные Bayer CFA позиции, а каждый scan применяет собственные Huffman DC selectors, predictor 1–7, point transform и DRI/RSTn. Missing/duplicate/unknown IDs, неполное покрытие, неверные или смешанные Ns, SOS/RST/EOI отклоняются явно.
- **Fixtures/tests:** tests/fixtures/dng-lossless-jpeg-fixture.mjs добавляет синтетический scanMode paired. Новый tests/dng-lossless-jpeg-partial-scans.test.mjs охватывает precision 8/12/16, predictors 1/4/7, restart 0/1/3/7, перестановки component order, Pt=2, TIFF II/MM strips и padded tiles, дробный crop/Orientation, точные CFA и RGBA против uncompressed fixture и негативные damaged SOS/RST/EOI.
- **Реальный UI:** tools/browser-raw-dng-check.mjs и собранный src/app.bundle.js проводят Chrome file:// FileInput TIFF tiled paired SOS, сверяют весь RGBA, исходные compressed DNG bytes в .zpe, reopen, exposure/History/Undo/Redo; предыдущие PNG/PSD/PSB rendered raster проверки сохраняются.
- **Версия:** package.json, index.html, version.json, README.md, CHANGELOG.md — локальная 1.47.1, публичный main остаётся 1.46.19.

## Доказательства

1. **RED→GREEN:** после добавления test-fixture paired до production исправления новые тесты дали 3 FAIL / 1 PASS («неподдерживаемая смесь SOS»), затем 4/4 PASS. Выборка из четырёх JPEG suites: 16/16 PASS.
2. **PASS:** npm run build; npm run test:browser:raw-dng — настоящий Chromium file:// и FileInput, whole-image RGBA oracle, byte-identical RAW .zpe save/reopen, exposure/History/Undo/Redo, ранее проверенный PNG/PSD/PSB raster export.
3. Первый полный npm run check: 1723 tests / 1707 PASS / 10 SKIP / 6 FAIL. Шестое падение — заголовок CHANGELOG не отвечал version-consistency; исправлено, отдельный version-consistency тест PASS.
4. **Финальный Windows npm run check: FAIL**, 1723 tests / 1708 PASS / 10 SKIP / 5 FAIL — старые Linux-only /proc/cgroup тесты, неприменимые на Windows. Лог: G:\МОЯ Веб-разработка\ZeTer Photo Editor\raw-check-20261120-partial-scans-final.log. git diff --check PASS перед feature commit.
5. **NOT RUN** для нового SHA: PR-head Linux core CI, independent real-photo CI, exact-main CI. PR не создан, GitHub main не обновлён. Синтетический fixture/Node reference не является независимым LibRaw camera oracle.

## Границы, зависимости и следующая задача

- GitHub main: ddd90d3be9c20092b043a3ea4761795177f7a94c; [CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43923939475) только на этом SHA. [#397 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/397) head bf6dd66 с [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43836733301) и [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43836733325), reviews 0. [#398 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/398) head 05c48eb, stacked on #397, exact-head CI NOT RUN.
- Локальный навык G:\Мои навыки\zeter-github-workflow\SKILL.md требует отдельного прямого разрешения на push/merge. В этом обращении отдельного разрешения нет, GitHub не изменялся.
- Нет поддержки 1+2+1 mixed scans, camera-specific JPEG slices, subsampling; независимый licensed camera-authored DNG/LibRaw pixel golden BLOCKED. Full Stage 9 остаётся IN PROGRESS.
- **Следующий кодовый срез: CAP-RAW-DNG-JPEG-MIXED-SCANS.** Реализовать 1+2+1 с валидированным MCU/predictor/RST, duplicate/unknown/truncated negatives, II/MM TIFF strips/tiles и живым Chrome file://, .zpe, History/Undo/Redo. Отдельно после разрешения: последовательно интегрировать #397 → #398 → остальные локальные RAW commits с собственными exact-head CI.
