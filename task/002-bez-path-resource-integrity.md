# CAP-BEZ-PSD-PATH-LIMIT — целостность Saved Paths при экспорте PSD/PSB

**Дата:** 2026-11-08 · **Приоритет:** P1/P2 (data integrity) · **Статус:** bounded local PASS; [PR #383 OPEN](https://github.com/zeter1/ZeTer-Photo-Editor/pull/383), CI PENDING.

**База:** main `70a17f1b2a56e0fa370c92b12efc480c3dd32701`; stacked dependency `feat/adjustment-psd-ui-20261107` (локальный head `6bb2b39`). Изолированная ветка `fix/psd-saved-path-integrity-20261108`.

## RED → GREEN

- **RED:** writer `src/formats/psd.js:writeSavedPathResources` и PSD, и PSB молча экспортировали `paths.slice(0, 998)`; 999-й и последующие редактируемые контуры терялись без ошибки. Новый настоящий binary writer test падал `Missing expected exception` на старом коде.
- **GREEN:** writer заранее отвергает число Saved Paths > 998 через `PsdImportError.code === 'PSD_EXPORT_PATH_RESOURCE_LIMIT'`, прежде чем создавать truncated output; защищён диапазон Photoshop Path Information resource ID 2000..2997. Используется исходный массив без `slice`.
- **Positive boundary:** все 998 уникальных контуров реально кодируются в PSD и PSB и заново декодируются, включая первый и последний имена.

## Изменённый код и проверки

- `src/formats/psd.js`: fail-closed guard вместо тихого обрезания.
- `tests/psd-saved-path-integrity.test.mjs`: две регрессии на overflow и полную границу 998 для PSD + PSB.
- Локально: RED 1 FAIL/1 PASS → GREEN 2/2 PASS; дополнительные 50/50 PSD/Vector Mask/Saved Paths тестов PASS.
- Production Chrome `file://`: `npm run test:browser:vector-mask` PASS, `npm run test:browser:adjustment-psd-ui` PASS и полный `npm run test:browser` PASS (115.52 s, exit 0).
- `npm run check`: build 1.46.9 PASS, 1605 Node PASS / 10 SKIP / 5 FAIL (пять Linux-only `/proc/cgroup` tests на Windows); общий check не объявляется успешным. `node --test tests/version-consistency.test.mjs` PASS, `git diff --check` PASS.
- Внешняя Adobe Photoshop GUI проверка не выполнялась; writer self-readback ≠ Adobe parity.
- PR-head Linux CI и exact-main CI не запускались для этой ветки (ветка ещё не опубликована).

## Ограничения / следующая задача

Этот bounded fix предотвращает потерю на границе **writer API**. Нормализация проекта `src/core/state.js` уже ограничивает `doc.paths` до 998; отдельное улучшение UX для явно сообщаемого превышения при входном файле возможно в будущем и не следует выдавать за реализованное.

**NEXT:** довести локальную `feat/adjustment-psd-ui-20261107` до разрешённых GitHub PR-head CI/merge/exact-main gates, затем публикация и CI этой stacked ветки. Далее приоритетная **CAP-BEZ-MASK-PSD-UI**: настоящий Chrome `file://` Saved Path (Pen) → Vector Mask application → anchor/handle and boolean edit → PSD/PSB UI export → reopen, сверить alpha/geometry/History/Undo/Redo/`.zpe` и исправить первый RED owner.

## Публикация — 2026-11-11

- [PR #383](https://github.com/zeter1/ZeTer-Photo-Editor/pull/383) открыт как stacked PR на ветку CAP-ADJ-PSD-UI (#382); code commit `035c4aa713545f1ef1b4718e9306507bc82e0854`. Девять Git blobs идентичны локальным по SHA, текущий parent #382 не менялся.
- Свежий Windows `node --test tests/psd-saved-path-integrity.test.mjs` — 2/2 PASS, `npm run test:browser:vector-mask` Chrome `file://` PASS. Linux PR-head CI пока не подтверждён. После merge родителя #382 PR #383 необходимо retarget на main, проверить полные Linux gates перед merge.

## Приёмка зависимости и ретаргет — 2026-11-11

- Родительский [PR #382](https://github.com/zeter1/ZeTer-Photo-Editor/pull/382) принят и MERGED в `main` `b94eeb5b3903dba10af34682fd8db6e582efa31a` после core/real-photo SUCCESS на точном `6964b09` ([core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42978011167), [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42978011176)). Exact-main gates [core](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42986464917) и [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42986465028) ещё проверяются; не объявлять PASS до результата.
- PR #383 теперь основан на `main` и mergeable; до этого documentation update отдельные Linux проверки #383 не запускались. Fresh latest-head CI и дальнейшее слияние остаются IN PROGRESS.
- После merge #383 следующая **функциональная** реализация: CAP-BEZ-MASK-PSD-UI с реальным Chrome `file://` и binary PSD/PSB readback; Adobe Photoshop-authored provenance — отдельно.

## Bounded merge acceptance — 2026-11-11

- PR-head `a40b88b65960d2f51201854391187267c53fa366`: Linux [core CI SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42986777354), [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42986777358).
- [PR #383 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/383) main `e0298721249eceff7a942571918d56921fa1bda2`; exact-main [core CI](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42987757832) и [real-photo](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/42987757817) запущены, final state не заявляется без readback.
- Fresh clean Windows: 11/11 focused, vector-mask Chrome `file://` PASS, CAP-ADJ-PSD-UI Chrome PSD+PSB PASS, полный `npm run test:browser` PASS (exit 0, 118.58 s). Существующая корневая рабочая копия оставлена без изменений.
- Следующий P1 code slice — [CAP-BEZ-MASK-PSD-UI](002-bez-mask-psd-ui.md). Само наличие paths-controller и PSD codec не закрывает genuine editable UI acceptance.
