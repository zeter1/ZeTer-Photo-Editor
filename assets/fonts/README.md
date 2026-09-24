# Встроенные шрифты

В `embedded.css` каждого семейства находятся локальные WOFF2-данные для латиницы, кириллицы и расширенной кириллицы. Редактор подключает нужный файл при выборе шрифта; интернет во время работы не требуется. Другие письменности могут отображаться запасным системным шрифтом.

Шрифты получены из [Google Fonts](https://fonts.google.com/) и распространяются по SIL Open Font License 1.1. Полный текст лицензии и указание правообладателей для каждого семейства сохранены рядом в `OFL.txt`. Исходные каталоги:

| Семейство | Источник |
| --- | --- |
| Roboto | [google/fonts/ofl/roboto](https://github.com/google/fonts/tree/main/ofl/roboto) |
| Open Sans | [google/fonts/ofl/opensans](https://github.com/google/fonts/tree/main/ofl/opensans) |
| Montserrat | [google/fonts/ofl/montserrat](https://github.com/google/fonts/tree/main/ofl/montserrat) |
| Noto Sans | [google/fonts/ofl/notosans](https://github.com/google/fonts/tree/main/ofl/notosans) |
| Noto Serif | [google/fonts/ofl/notoserif](https://github.com/google/fonts/tree/main/ofl/notoserif) |
| Rubik | [google/fonts/ofl/rubik](https://github.com/google/fonts/tree/main/ofl/rubik) |
| Oswald | [google/fonts/ofl/oswald](https://github.com/google/fonts/tree/main/ofl/oswald) |
| PT Sans | [google/fonts/ofl/ptsans](https://github.com/google/fonts/tree/main/ofl/ptsans) |
| PT Serif | [google/fonts/ofl/ptserif](https://github.com/google/fonts/tree/main/ofl/ptserif) |
| Lobster | [google/fonts/ofl/lobster](https://github.com/google/fonts/tree/main/ofl/lobster) |
| Manrope | [google/fonts/ofl/manrope](https://github.com/google/fonts/tree/main/ofl/manrope) |
| Merriweather | [google/fonts/ofl/merriweather](https://github.com/google/fonts/tree/main/ofl/merriweather) |

Системные шрифты не копируются в проект: браузер показывает их список только через Local Font Access API после действия пользователя и разрешения на доступ. Загруженный пользователем файл шрифта сохраняется внутри его `.zpe` проекта.