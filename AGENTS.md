# AGENTS.md — ZeTer Photo Editor

Этот файл — короткая точка входа для ChatGPT/Codex и других AI-агентов. Не читайте весь репозиторий перед каждой задачей.

## С чего начать

1. Прочитайте [docs/ai/START-HERE.md](docs/ai/START-HERE.md).
2. По таблице маршрутизации откройте только нужную подсистему.
3. Для общей структуры используйте [docs/PROJECT.md](docs/PROJECT.md) и [docs/architecture/MODULE-MAP.md](docs/architecture/MODULE-MAP.md).
4. Глубокие исторические/runtime-контракты читайте только при необходимости: [docs/architecture/RUNTIME-CONTRACTS.md](docs/architecture/RUNTIME-CONTRACTS.md).

## Главные правила

- Source of truth находится в `src/`, а `src/app.bundle.js` — генерируемый артефакт. Вручную его не редактировать.
- `src/main.js` — composition root и orchestration. Новую автономную логику по возможности размещать у владельца: `core/`, `ui/`, `config/` или `adapters/`.
- Приложение обязано продолжать запускаться напрямую через `file://` на Windows; не вводить runtime-зависимость от dev-server, bundler CDN или внешней сети.
- Растровые изменения должны учитывать lock, selection, Undo/Redo, high-depth/CMYK source и асинхронное сохранение Canvas.
- PSD/PSB/ICC изменения должны сохранять unknown/opaque metadata там, где это обещает существующий round-trip contract, и fail-safe уходить в документированный fallback вместо записи stale metadata.
- Не маскировать ошибки отключением тестов, suppression или широким `try/catch` без root cause.
- Любое изменение кода отражать фактической записью в `CHANGELOG.md`.

## Проверка

После изменения source-кода минимум:

```bash
npm run check
```

Если затронуты startup, DOM, toolbar/drag, clipboard, меню или `file://` wiring:

```bash
npm run test:browser
```

Полная матрица и смысл каждого gate: [docs/testing/VERIFICATION.md](docs/testing/VERIFICATION.md).

Если что-то не запускалось, в итоговом отчёте явно писать `NOT VERIFIED`.
