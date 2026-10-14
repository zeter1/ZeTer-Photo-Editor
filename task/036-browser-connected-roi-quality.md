# 036 — реальный Chromium quality/latency/RSS для широкого связного Content-Aware ROI

**Статус: ОТКРЫТО (P1, Stage 003).**
**Основание:** после закрытия [035](035-browser-recovery-modal-flake.md), [034](034-complex-roi-native-quality.md) по-прежнему доказывает native connected ROI только в Node Worker. Реальный Chromium проверяет небольшой 5×5 дефект ([033](033-browser-synthetic-native-quality.md)), но не широкий сложный ROI.

## Следующая самостоятельная проходка

- [ ] Взять текущий ZeTer-generated RGB16/PSB32 high-depth fixture и сложную **связанную** ROI: два плотных острова + диагональный коридор, занимающие достаточно tile cells для bounded planner. Не подменять тест маленьким прямоугольником и не создавать Photoshop golden из собственного writer.
- [ ] Через штатный `file://` UI: импорт → native Worker Fill → preview → Undo/Redo; зафиксировать выбранные индексы и проверить неизменность исходных native words **вне** выделения, alpha и donor source. Использовать известный чистый фон для независимых MAE/RMSE до и после Fill. Перепроверить Cancel/Retry или явно вынести это в следующую проходку, если не умещается.
- [ ] Измерить wall-clock этапы импорта, планирования, Worker, preview, Undo/Redo. Собрать наблюдаемые CDP renderer privateMemory и Linux process RSS/PID starttime с snapshot coverage; не выдавать sample за истинный пик процесса, отсутствие PID за exit или Worker target за PID без доказательств. Сравнить с [024](024-browser-operation-memory.md), [025](025-browser-worker-target-census.md).
- [ ] Добавить unit негативные cases для false quality evidence / changed-native bytes / некорректных ROI / неполного sampling; fail closed для неверных цифровых заявлений в JSON.
- [ ] Gate: `npm run check`, Chromium `file://` smoke, два browser operation artifacts и существующие benchmark-профили, зелёный PR CI, merge и зелёный exact-code main CI. Записать provenance ссылок в [NEXT](NEXT.md), [003](003-tiled-content-aware.md) и здесь.

## Вне этой проходки

- [002](002-psd-compatibility-corpus.md): independently Photoshop-authored и законно распространяемые PSD16/CMYK32 PSB goldens, external rendering и semantic parity — **P0 остаётся открытой**, не заменять синтетикой.
- Полный real-image quality / accurate operation peak RAM / GPU, AI, RAW/DNG, CMYK и Photoshop feature parity не считаются решёнными одним benchmark.
- Сначала проверить `task/NEXT.md` на свежий статус перед выполнением. Тестовые новые вспомогательные файлы размещать в `tools/`, `tests/`; не менять generated `src/app.bundle.js` вручную.
