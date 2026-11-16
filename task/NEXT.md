# NEXT — единая актуальная очередь ZeTer Photo Editor

> **CURRENT TASK/ID:** Stage 9 / **CAP-RAW-DNG-ACTIVE-ORIENTATION** — проверяемая ориентация и ActiveArea несжатого Bayer DNG.
> **PRIORITY:** P1 · **STATUS:** IN PROGRESS — код 1.46.19 на ветке `feat/raw-dng-orientation-activearea-20261116`; Linux PR-head CI и merge пока NOT VERIFIED.
> **BASE MAIN SHA:** `b2a3d254d8fe078ae5654753b06a905c36255f69` — [#394 MERGED](https://github.com/zeter1/ZeTer-Photo-Editor/pull/394), foundation 1.46.18; exact head `3ff8c769`: [Linux core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43819646295) / [independent real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43819646223) (13/13 checks). Exact merged-main `b2a3d254`: [core SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43820596619) и [real-photo SUCCESS](https://github.com/zeter1/ZeTer-Photo-Editor/actions/runs/43820596686).
> **ACTIVE PR:** функциональная ветка [feat/raw-dng-orientation-activearea-20261116](https://github.com/zeter1/ZeTer-Photo-Editor/tree/feat/raw-dng-orientation-activearea-20261116), PR-head/CI ссылка после публикации. Не создавать дубликат.
> **LAST VERIFIED:** 11 focused Node PASS, `git diff --check` PASS; полный Windows `npm run test:browser` **FAIL** из-за CDP `Runtime.evaluate` timeout после Stage 036C (83.68s, причинность к DNG НЕ установлена; Linux CI нужен). Real Windows Chromium `file://` — classic Bayer import, exposure/WB/History, .zpe save/reopen, PNG/PSD/PSB + новый ActiveArea/Orientation pixel oracle, native sensor dimensions отдельно от preview и повторная проявка: PASS. Синтетический TIFF/DNG binary fixture **не** camera-authored RAW.
> **REMAINING ACCEPTANCE:** PR exact-head Linux core+independent real-photo SUCCESS, review/conflicts, merge, exact-main CI. Для полного RAW pipeline отдельно независимый camera-authored licensed DNG corpus и LibRaw/RawTherapee reference, ColorMatrix/ICC и DefaultCrop; compressed/packed DNG, precise highlights/shadows остаются TODO.
> **NEXT IMPLEMENTATION ACTION:** после принятия ориентированного DNG и exact-main CI — **CAP-RAW-DNG-CAMERA-COLOR**, camera-authored uncompressed Bayer + валидируемая ColorMatrix1/2/camera-to-XYZ/D50→sRGB pipeline, reference pixels и browser file:// E2E; не объявлять цветовую точность без внешней референсной проверки.
> **BLOCKERS:** проверяемый свободно распространяемый camera-authored uncompressed DNG + независимый reference; Photoshop-authored Adobe GUI corpus остаётся отдельно BLOCKED и не блокирует этот RAW-срез.

## Краткая очередь

1. **CAP-RAW-DNG-ACTIVE-ORIENTATION:** IN PROGRESS — PR gates/merge/exact-main для рабочего кода 1.46.19.
2. **CAP-RAW-DNG-CAMERA-COLOR:** P1 TODO — настоящий camera-authored reference, ColorMatrix, calibrated preview, E2E.
3. **CAP-BEZ-MASK-PSD-UI:** external Adobe interoperability BLOCKED; не повторять #392.
4. **Stage 6 / 003X/6c-9 и более широкие RAW/ICC/HDR:** IN PROGRESS по [матрице](CAPABILITY_MATRIX.md).

**История:** [RAW foundation](002-raw-dng-foundation.md) · [ActiveArea/Orientation журнал](002-raw-dng-orientation-activearea.md) · [матрица](CAPABILITY_MATRIX.md) · [карта](README.md).
