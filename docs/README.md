# Документация ZeTer Photo Editor

Эта папка устроена как **маршрутизатор контекста**: AI или разработчику не нужно читать один огромный документ целиком.

| Нужно понять | Читать |
|---|---|
| С чего начать и где что лежит | [PROJECT.md](PROJECT.md) |
| Карта исходников и владельцы кода | [architecture/CODEMAP.md](architecture/CODEMAP.md) |
| Архитектурные границы и запрещённые зависимости | [architecture/BOUNDARIES.md](architecture/BOUNDARIES.md) |
| Рабочий цикл ChatGPT/Codex | [development/AI_WORKFLOW.md](development/AI_WORKFLOW.md) |
| Refactoring, debugging, code review и test-oracle правила | [development/QUALITY_PLAYBOOK.md](development/QUALITY_PLAYBOOK.md) |
| Какие тесты соответствуют изменению | [testing/TEST_MATRIX.md](testing/TEST_MATRIX.md) |
| История больших этапов PSD/PSB, HDR, CMYK и reliability | [reference/PROJECT_HISTORY.md](reference/PROJECT_HISTORY.md) |

Правило экономии контекста: начни с `PROJECT.md`, затем открой **один** документ по текущей области и только после этого конкретные исходники/тесты.
