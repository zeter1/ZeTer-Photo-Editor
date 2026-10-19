# 003R — Reentrant Worker owner handoff (Stage 003)

**Приоритет:** P1. **Статус:** IN PROGRESS (2026-10-19). **PR:** [#276](https://github.com/zeter1/ZeTer-Photo-Editor/pull/276), открыт; PR CI/merge/exact-main PENDING.
**Зависимости:** базовый Stage 003 file:// UI Worker и cancellation/timeout уже реализованы.
**Контекст:** [003](003-tiled-content-aware.md). **Base:** main `ed74068c724d5885b459cac81c6613483a263be9`.

## Проблема и цель

`createTiledInpaintWorkerJobController.run()` ранее назначал `id` и `active`
**после** вызова `isCurrent()` и `createWorker()`. Эти вызовы могут
синхронно начать новый `run()` (custom Worker provider, owner hook):
старый вызов возвращается из callback позже и перехватывает `active`,
теряет контролируемое завершение, допускает stale `postMessage`.
Стандартные async Worker tests такой reentrancy не покрывали.

**Цель:** только самая новая генерация владеет Worker; superseded Worker
освобождается/terminate, не посылает job и не публикует результат.

## Реализация в ветке (пока не подтверждено CI)

- `src/core/tiled-inpaint-worker-client.js`: поколение захватывается до
  `cancel`/`isCurrent`/`createWorker`; после factory+owner проверяется
  поколение, stale instance без публикации завершается. В обработчике сообщений
  после пользовательского owner callback повторно проверяется settlement/generation.
- `tests/tiled-inpaint-worker-client.test.mjs`: factory reentrancy,
  owner-callback reentrancy до создания Worker и при `ready`;
  запрет старого `postMessage`, terminate orphan, прогресс нового job.
- `src/app.bundle.js`, `index.html`, `version.json`:
  детерминированный browser artifact parity для текущей версии 1.46.4;
  исходный hash 01996ec320cb8066, новый 7cc4839448094ba7.

## Критерии DONE

1. Тесты нового reentrant owner поведения и все существующие Node unit checks PASS.
2. `npm run check` и generated parity (`git diff --exit-code`) PASS на PR CI.
3. Chromium `file://` browser smoke PASS; Worker normal/cancel/retry не ухудшены.
4. PR слит в main, exact-main CI green на новом merge SHA.
5. Фактические PR/CI/merge ссылки записаны здесь и в `task/NEXT.md`.

## Проверки и ограничения

- **PASS (статическая/сборочная parity):** исходный bundle hash заново независимо
  вычислен и совпал с `version.json`; изменён ровно один source chunk;
  новый index/version hash вычислен тем же детерминированным алгоритмом.
- **PENDING:** Node tests, browser file:// runtime, PR CI, merge и exact-main CI.
  Локальный checkout невозможен из-за отсутствия DNS доступа к github.com,
  поэтому не заявлять локальный запуск тестов.
- Никакого изменения native pixel kernel, .zpe версии, PSD/PSB codec,
  mask/selection, history или исходных пикселей; эта проходка — lifecycle fix,
  не завершение всей Stage 003 и не Adobe provenance acceptance.

## Следующая работа

После green + merge и exact-main:
- P0 [002B/2c](002b2c-photoshop-psb32-provenance.md) остаётся **BLOCKED**
  до подлинного licensed Photoshop-authored PSB32 с Adobe reference.
- P1 [003](003-tiled-content-aware.md): наблюдение operation true peak RAM
  / точный mapping Worker→OS PID вместо sampled RSS и измеренная нагрузка
  на более крупных native PSD16/PSB32 в Chromium `file://`.
