# Verification

Проверка должна соответствовать риску изменения. «Код выглядит правильно» не считается доказательством.

## Быстрый порядок

1. Посмотреть diff и убедиться, что нет случайных generated/fixture изменений.
2. Запустить project-native gate:
   ```bash
   npm run check
   ```
3. Если изменение затрагивает browser wiring/DOM/input:
   ```bash
   npm run test:browser
   ```
4. Для поведения, которое smoke не может доказать (визуальный Canvas, реальный pointer UX, Clipboard permissions), дополнительно проверить вручную в браузере.

## Что реально делает `npm run check`

По текущему `package.json`:

```text
npm run build
node --check src/app.bundle.js
node --check tools/browser-smoke.mjs
npm test
```

То есть gate доказывает:
- bundle воспроизводимо собирается;
- generated JavaScript синтаксически валиден;
- browser-smoke script синтаксически валиден;
- Node regression suite проходит.

Он не доказывает визуальную корректность всех Canvas paths.

## Browser smoke

`npm run test:browser` запускает Chrome/Chromium через DevTools Protocol и открывает **реальный `index.html` через `file://`**. Это важный integration gate, потому что прямой запуск без сервера — пользовательский контракт проекта.

Используйте его обязательно для:
- bootstrap/startup;
- toolbar/drag/drop;
- menus/modal DOM state;
- clipboard/paste guards;
- shortcuts, которые зависят от DOM;
- bundle/index wiring;
- ошибок console/runtime в браузере.

## Generated bundle gate

`src/app.bundle.js` никогда не правится вручную.

После source change:
1. `npm run build`;
2. generated diff должен соответствовать source diff;
3. CI дополнительно делает `git diff --exit-code -- src/app.bundle.js` после build.

Если CI показывает diff bundle, source commit неполный.

## CI

`.github/workflows/ci.yml` на `main`/PR выполняет:
- Node setup;
- `npm run check`;
- generated-bundle freshness;
- `npm run test:browser`;
- `git diff --check`.

Workflow read-only (`contents: read`).

## Focused regression

Для bugfix по возможности добавляйте test, который:
- воспроизводит именно пользовательский invariant;
- падает на старом поведении;
- не привязан к случайной internal implementation detail;
- использует hermetic fixture, если внешний формат критичен.

## Как отчитываться

Не писать «проверено», если запуск не состоялся.

Пример:
- `npm run check` — PASS
- `npm run test:browser` — PASS
- ручной Canvas UX — `NOT VERIFIED`

CI PASS подтверждает только gates, реально присутствующие в workflow.
