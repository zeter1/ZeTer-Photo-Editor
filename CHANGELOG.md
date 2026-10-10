# История изменений

> Канонические правила ведения журнала: [docs/development/CHANGELOG_GUIDE.md](docs/development/CHANGELOG_GUIDE.md).
>
> Изменения, уже слитые в `main`, считаются актуальным опубликованным состоянием репозитория и записываются в раздел текущей версии. Раздел `Unreleased` для уже интегрированных изменений не используется. Это правило не означает автоматический deploy внешнего сайта — deployment проверяется отдельно.

## 1.43.4 — текущая версия

### 2026-10-10 — Регрессия вложенных PSD/PSB групп с масками и adjustment metadata

- Добавлено: детерминированный generated PSD/PSB corpus для вложенных групп, raster masks, clipping и неизменности исходных Photoshop adjustment blocks после повторного экспорта.
- Документация: зафиксированы fixture provenance, пределы внутреннего round-trip и незакрытый этап независимой Photoshop compatibility проверки в `task/002-psd-compatibility-corpus.md`.
- Совместимость: production/runtime код и версия 1.43.4 не изменяются; результаты CI/браузерных проверок фиксируются после выполнения, не предполагаются заранее.

### 2026-10-10 — Корректная контент-заливка CMYK и прозрачных границ

- Исправлено: у CMYK PixelBuffer без alpha в подборе текстуры теперь учитывается четвёртый канал K.
- Исправлено: граничная Content-Aware Fill учитывает straight alpha при смешивании доноров, не перенося скрытые цвета полностью прозрачного пикселя.
- Добавлено: регрессионные сценарии RGBA8, Float32 CMYKA и Uint16 CMYK4 по одному алгоритмическому контракту.
- Документация: описана модель каналов и добавлена приоритизированная очередь `task/`.

## 1.43.3 — 2026-10-10

### 2026-10-08 — Защита отложенной геометрии масштабирования холста

- Добавлено: регрессионный тест, проверяющий, что pointer-anchored zoom корректирует прокрутку по обновлённому положению overlay и текущему zoom непосредственно в animation frame, даже если оба изменились после wheel-события.
- Документация: уточнён временной контракт и сценарий в `docs/architecture/VIEWPORT_NAVIGATION.md` и `docs/testing/TEST_MATRIX.md`.
- Совместимость: production/runtime и версия 1.43.3 не изменяются.

### 2026-10-08 — Восстановление pointer capture после ошибки начала жеста

- Исправлено: общий Pointer Events router освобождает pointer capture и сбрасывает активный указатель после синхронной ошибки или отклонённого Promise от `onPointerDown`.
- Исправлено: поздняя ошибка старого `pointerdown` не может завершить более новый жест, в том числе при повторном использовании того же `pointerId`.
- Добавлено: три регрессионных сценария на sync/async отказ и защиту нового захвата от ошибки старого.
- Документация: уточнены контракт и тестовая матрица для failed-start в `docs/architecture/BOUNDARIES.md` и `docs/testing/TEST_MATRIX.md`.

## 1.43.2 — 2026-10-08

### 2026-10-08 — Проверены красные подсказки SAM при удалении фона

- Добавлено: отдельные поведенческие регрессии выбора маски SAM по положительной и отрицательной подсказкам даже при более высокой оценке неверной маски.
- Добавлено: проверка сохранения явно исключённого отверстия размером 3×3 model pixels, отсутствия изменения RGB/исходного слоя и отказа при противоречивых результатах.
- Документация: сценарий и границы автоматической проверки отмечены в `docs/testing/TEST_MATRIX.md`.
- Совместимость: production/runtime и версия 1.43.2 не изменяются.

### 2026-10-08 — Регрессии сохранности истории при ограничениях памяти

- Добавлено: изолированные тесты вытеснения старых снимков по бюджету памяти и числу записей, корректности курсора и Undo/Redo после создания новой ветки истории.
- Добавлено: проверка Clear History после Undo — остаётся именно выбранный снимок, а дальнейшее редактирование формирует новую корректную историю.
- Совместимость: production-код и номер версии 1.43.2 не менялись.


### 2026-10-08 — Безопасная история при ошибке восстановления снимка

- Исправлено: Undo, Redo и переход по истории откатывают курсор HistoryStack при ошибке декодирования снимка, чтобы указатель истории не расходился с фактически открытым документом.
- Добавлено: регрессионные тесты на каждый из трёх сценариев, отсутствие частичной публикации и успешный повтор после устранения ошибки.
- Ограничения: восстановление курсора гарантировано для штатного HistoryStack; ошибки после успешного восстановления снимка, в том числе во время публикации документа, не охватываются этим изменением.

## 1.43.1 — 2026-10-08

### 2026-10-08 — Проверка восстановления IndexedDB autosave в настоящем браузере

- Добавлено: browser smoke под `file://` с настоящим IndexedDB и контролируемым abort одной readwrite-транзакции; проверяются сохранность прошлого снимка, отсутствие преждевременных повторов и восстановление после cooldown.
- Добавлено: проверка persistence через reload, изоляции другого window key и однократного предупреждения.
- Ограничения: проверяется transaction abort, а не реальное исчерпание квоты; использованы production-модули с тестовыми портами сессии, без UI-ввода пользователя.

### 2026-10-08 — Возобновление автосохранения после временной ошибки IndexedDB

- Исправлено: после отказа записи autosave новое dirty-событие может повторить сохранение через 30 секунд без фонового цикла повторов и лишних предупреждений.
- Безопасность: после ошибки чтения recovery при запуске, в том числе во время параллельной неудачной записи, автоматическая запись по непрочитанному ключу остаётся запрещена; чужие window keys не изменяются.
- Добавлено: детерминированные регрессии на отказ/восстановление, сохранение актуального dirty-состояния, ограничение частоты повторов и защиту от перезаписи непрочитанного recovery.
- Проверено: PR #102 — CI #37723058640 успешно; слияние `6e1a41cff7769cf59144437bc7f5e5239c14291e` — push CI `main` #37723137867 успешно; `npm run check`, generated bundle parity, `npm run test:browser` (`file://`) и `git diff --check`.
- Ограничения проверки: контролируемые ошибки IndexedDB воспроизводились через storage-port; настоящий transient отказ браузерной IndexedDB/квоты под `file://` отдельно не моделировался.

## 1.43.0 — 2026-10-08

### 2026-10-08 — Проверен отказ автовосстановления после Save Smart Object

- Добавлено: интеграционная регрессия связывает Smart Object Save и настоящий recovery controller: изменение родителя и history, сериализацию нескольких dirty-вкладок, асинхронный отказ IndexedDB-подобного storage и отдельное предупреждение.
- Проверено по коду: rejection при записи recovery после успешного commit локально обрабатывается владельцем восстановления; Save не выдаёт уже применённую правку за откат. Production/runtime не менялся.
- Документация: уточнена точка commit и границы post-commit failure model в `docs/architecture/SMART_OBJECT_LIFECYCLE.md`.
- Ограничения проверки: ошибки повреждённого/неподдерживаемого document state и process-level OOM не покрываются; настоящее исчерпание IndexedDB quota не воспроизводилось.

### 2026-10-07 — Восстановлен обязательный цикл обновления версий

- Исправлено: накопившиеся после релиза 1.42.0 пользовательские изменения перенесены в новый текущий release line 1.43.0 вместо дальнейшего накопления под старым номером.
- Изменено: `package.json` остаётся каноническим источником версии, а canonical build теперь синхронизирует `application-version` в `index.html` и `version.json`; окно «О программе» получает тот же номер через этот meta-тег.
- Добавлено: version consistency regression проверяет согласованность `package.json`, `README.md`, `index.html`, `version.json`, `CHANGELOG.md` и runtime-маркера, используемого окном «О программе».
- Документация: закреплён SemVer contract — PATCH для обратно совместимых исправлений, MINOR для новых обратно совместимых пользовательских возможностей, MAJOR для намеренно несовместимых изменений; production/runtime change с изменением пользовательского поведения должен включать bump в том же логическом change.

### 2026-10-07 — Зафиксирована модель ошибок Photoshop Smart Object publication

- Проверено: финальные production helpers `publishEmbeddedSourceRewrite()` и `updateTargetAfterRewrite()` для уже подготовленного rewrite и канонического mutable JSON-state выполняют только синхронные присваивания и детерминированный fingerprint math; реалистичный recoverable throw после начала этой publication-зоны не подтверждён.
- Добавлено: focused regression в `tests/psd-smart-object-resource.test.mjs`, который защищает synchronous `undefined`, отсутствие throw и фактическое обновление linked resource/target baseline для поддерживаемого состояния.
- Документация: в `docs/architecture/SMART_OBJECT_LIFECYCLE.md` зафиксирован prepare-before-publish contract: codec/I/O/async/fallible работу нельзя переносить после первой destructive publication без явной all-or-none transaction/rollback.
- Проверено: PR #98 — CI #490 успешно; merge `9820aa30fded07049bff4c03afd7a71b980215ea` — main push CI #491 успешно; follow-up handoff commit `2f06ec9c0fd9d02b64cef94d6c50638353f15963` — main CI #492 успешно.
- Ограничения проверки: production runtime не изменялся; exotic `Proxy`/frozen host state и process-level failures вроде OOM не входят в поддерживаемый document-state contract этой проверки.


### 2026-10-07 — Уточнены структура и правила CHANGELOG

- Документация: обычный текст и заголовки новых записей ведутся на русском языке; технические термины, имена API, форматов, команд и кодовых сущностей можно оставлять на английском.
- Изменено: уже слитые в `main` изменения больше не помещаются в `Unreleased`; пока версия в `package.json` не меняется, они добавляются в верхний раздел текущей версии.
- Исправлено: записи текущей версии приведены к единой иерархии, чтобы отдельные даты не выглядели самостоятельными релизами.

### 2026-10-07T20:09:52+03:00 — Проверено изменение состава общего Smart Object во время Save

- Добавлено: детерминированные async-регрессии подтверждают, что linked sibling, удалённый во время preview, не изменяется; linked sibling, добавленный во время preview, входит в финальную публикацию; Photoshop sibling, добавленный во время native rewrite preparation, входит в финальный live target set.
- Контракт: shared/native Save обязан заново вычислять membership источника после reorderable await. Текущий production-код уже соблюдает этот контракт, поэтому проходка усилила regression coverage и документацию без изменения application logic.

### 2026-10-07T19:23:00+03:00 — Атомарная проверка блокировок общего Smart Object Save

- Исправлено: Save содержимого связанного ZPE/Photoshop Smart Object теперь проверяет canonical effective lock у каждого live target, а не только у representative. Locked sibling или locked ancestor group отменяет общий Save целиком до resource/layer/history/dirty/recovery публикаций; частичное обновление общего source запрещено.
- Добавлено: deterministic regressions для pre-existing locked linked sibling, late ancestor lock во время preview и Photoshop sibling lock во время native rewrite preparation. Preflight выполняется до Save generation claim; post-await проверки сохраняют silent superseded semantics.

### 2026-10-07T18:26:29+03:00 — Курсор кисти удаления фона за пределами изображения

- За пределами изображения у кисти удаления фона появляется обычная стрелка курсора, в том числе во время штриха с захваченным указателем. При возвращении на изображение стрелка скрывается, круг кисти и рисование пересекающейся частью сохраняются.
- Проверено: npm run check — 997/997; изолированный Chrome на фотографии Mustang — 18 сценариев, включая вычисленный native cursor снаружи/внутри при наведении и capture, видимую дугу кисти, края, отмену/повтор и неизменность фото. Без page errors.

### 2026-10-07T18:18:35+03:00 — Undo/Redo и рисование кистью удаления фона у границ

- Кисть удаления фона: Ctrl+Z отменяет последний зелёный/красный штрих, восстанавливая перекрытые метки; Ctrl+Y/Ctrl+Shift+Z повторяет. Кнопки и меню используют ту же историю. Отмена активного штриха освобождает capture; история ограничена 32 состояниями/32 МиБ, сбрасывается после обработки, смены владельца и очистки.
- Центр кисти может выходить за изображение: видимая пересекающая часть круга сохраняется, штрих можно начать снаружи у любого края/угла. Поле размера больше не перехватывает Ctrl+Z после начала штриха.
- Название слоя убрано с фотографии на холсте; рамка/контрольные точки и имя в панели слоёв сохранены.
- Проверено: npm run check — 997/997; независимые проверки — 43/43 плюс настоящие Undo/Redo wrappers; изолированный Chrome на фотографии Mustang — 17 сценариев (перекрытия, активная отмена, края/угол, byte identity фото, обычная document Undo), без page errors.
- Первые FAIL сохранены: устаревшие ожидания badge/fixtures и оставшийся фокус поля размера; исправлены по evidence. Проверка дуги сначала ошибочно требовала RGB=255, затем уточнена по прозрачности и скриншоту. Качество самой нейросети в этой правке не менялось.


### 2026-10-07T17:47:07+03:00 — Улучшенное удаление фона SAM 2.1 и уточнение кистью

- Изменено: вместо выбора слабой SlimSAM в инструменте оставлена только SAM 2.1 Hiera Tiny (~97 МБ с ORT), отдельная установка/отмена/удаление и карточка; LaMa остаётся отдельной моделью удаления объектов. Старый выбор SlimSAM игнорируется, её старый кэш автоматически не очищается.
- Добавлено: зелёные подсказки объекта и красные исключения фона (Alt), сохранение назначения штриха до его завершения, мягкость края 0–3 исходных пикселя; RGB и прежняя alpha сохраняются, прозрачность не повышается.
- Исправлено: подсказки выбираются глубоко внутри закраски, а не на её случайных краях. Несколько внутренних точек охватывают целый объект; малые явные отдельные подсказки не теряются рядом с большой областью. Убираются мелкие пятна и внутренние проколы, сохраняются крупные отверстия/отдельные части и красные исключения. Модель/параметры захватываются до await, текущий слой и Undo/Redo защищены прежними owners.
- Добавлено: pinned SAM2 external-data byte/hash contracts и локальный worker; новый catalog зарегистрирован в file:// сборщике. Загрузка только при явной установке; inference не обращается к сети.
- Проверено: npm run check 989/989; независимый focused verifier 24/24 и canonical bundle/index/version parity. Реальный CPU Chrome, пять фото (Mustang, пикап, собака, пакет среди других, левый кот) с приблизительными/уточняющими штрихами: все заданные точки нужных частей сохранены, фоновые точки прозрачны, RGB неизменен, alpha не повышена. Реальный file:// UI: установка/отмена/очистка partial cache, зелёный/красный preview без записи фото, отмена обработки, unchanged другой слой, exact PNG Undo/Redo, offline восстановление кэша и фото, удаление модели без изменения фото/LaMa. Remote bytes заранее скачаны и SHA-проверены, UI tests воспроизводят их локально.
- Ограничения проверки: первые single-door/неполные подсказки дали неполный объект; уточнения проверены отдельно, первые результаты сохранены. В ранних UI-автопрогонах первый зелёный штрих пропадал; причина UNKNOWN. С точной трассировкой последний полный сценарий прошёл без внештатного сброса; это не доказывает отсутствие нестабильности. Pixel ground-truth, тонкая шерсть/стекло, WebGPU и произвольные фото не проверены. Исправления по недоказанной причине не добавлялись. Сайт не публиковался.

### 2026-10-07T16:49:49+03:00 — Раздельные карточки нейросетей в настройках

- Изменено: SlimSAM для удаления фона и LaMa для удаления объектов оформлены отдельными карточками с рамками, промежутком, заголовком и названием/размером модели. Описание, состояние и действия установки/удаления находятся внутри собственной карточки; существующие обработчики и ID сохранены.
- Проверено: npm run check — 980/980; Chrome file:// browser smoke — PASS. Визуально проверены 1440×1100, 1024×768 и 640×800: отдельные рамки, промежуток, принадлежность кнопок и отсутствие горизонтального переполнения; вкладки/закрытие работают, page errors отсутствуют. Перед заменой сохранена резервная копия.

### 2026-10-07T16:43:01+03:00 — Кисть удаления фона по приблизительной подсказке

- Добавлено: отдельная «Кисть удаления фона» (Shift+E). Приблизительные штрихи дают SlimSAM положительные подсказки; нейросеть сама находит границы и сохраняет весь объект вне закрашенной области. «Удалить фон» меняет alpha только выбранного RGB8 растрового слоя; отдельный слой, transform и исходная прозрачность сохраняются. Один Undo/Redo; отмена, сброс, stale/lock guards и отказ для native high-depth/CMYK без конвертации.
- Добавлено: отдельная проверенная установка SlimSAM (~39 МБ со средой выполнения), кнопки в подсказке/постоянном уведомлении/параметрах инструмента и настройках; проценты/МБ, отмена, готовность и удаление модели. Кэш отделён от LaMa и проектов, удаляются только пять принадлежащих модели файлов. Во время обработки нет сетевых запросов с фото.
- Изменено: существующие владельцы маски, verified downloader, cache и worker lifecycle переиспользованы через узкие параметры; поведение удаления объектов сохранено. Добавлен канонический контракт AI_BACKGROUND_REMOVAL и инструкция в README.
- Проверено: npm run check — 980/980; штатный Chrome file:// smoke — PASS; независимые focused tests — 48/48 плюс native composition — 15/15. Реальная установка → отмена/повтор → CPU SlimSAM → отмена/повтор → удаление фона на публичном фото: целая машина, крыша и колёса вне штрихов, прозрачный фон, полностью непрозрачные RGB неизменны; другой слой byte-identical, Undo/Redo exact PNG, удаление модели сохраняет результат, внешние запросы только GET артефактов, page errors отсутствуют. Desktop 1440×900 и 1024×768 проверены визуально. WebGPU, offline restart и качество на произвольных фото не проверены. Перед обновлением сохранена резервная копия; сайт не публиковался.

### 2026-10-07T16:15:30+03:00 — Состояние нейросети в подсказке и удаление модели

- Изменено: описание инструмента читается по текущему состоянию модели: после установки текст и кнопка установки исчезают, после удаления возвращаются. Настройки показывают состояние установленной модели без предложения установить её повторно.
- Добавлено: «Удалить нейросеть» в настройках: очищает ровно четыре файла модели, включая частичный кэш отменённой установки, и память текущей страницы. Фото, проекты, история, настройки и посторонние записи не очищаются. Сбой транзакции сохраняет готовую модель; обработка/установка и удаление взаимно исключены. Другие вкладки могут сохранять свою модель; ограничение указано в настройках.
- Проверено: npm run check — 965/965; независимая focused проверка — 31/31. Реальный Chrome file://: установка → подсказка без установки → удаление → подсказка установки → перезагрузка без модели → повторная установка; native IndexedDB sentinel, фото/история/настройки сохранены. Во время реального CPU inference удаление модели заблокировано, после завершения доступно без переоткрытия настроек; page errors отсутствуют. Перед обновлением сохранена резервная копия. Сайт не публиковался.

### 2026-10-07T15:55:37+03:00 — Заметная установка модели и прогресс удаления

- Добавлено: инструкция и кликабельная установка нейросети в описании инструмента; большое контрастное уведомление справа внизу с установкой и закрытием. Уведомление не исчезает через 3 секунды; уходит при установке, закрытии или смене инструмента. Кнопки сразу открывают «Нейросети» и запускают установку, без второго нажатия.
- Добавлено: панель удаления с полосой обработки, реальными этапами подготовки/восстановления/сохранения, прошедшим временем и отменой. Первый запуск без выдуманного процента/ETA, следующие показывают примерный остаток по измеренному успешному вычислению этого режима. Таймер снимается при завершении; поздние сообщения отменённого worker игнорируются.
- Проверено: npm run check — 958/958; реальные Chrome pointer/keyboard сценарии в 1440×900 и 1024×768: запуск установки из обеих кнопок, отмена/повтор, CPU-прогресс, измеренная оценка следующего запуска, отмена с сохранением пикселей, без page errors. Независимая focused проверка — 26/26 и отдельный late-message probe PASS. Копия исходников перед обновлением сохранена; сайт не публиковался.

### 2026-10-07T15:34:33+03:00 — Нейросетевое удаление объектов и настройки

- Изменено: отдельный инструмент удаления объектов использует LaMa прямо в браузере вместо слабой заливки соседними пикселями. Маска и фото остаются на устройстве; RGB изменяется только в закрашенной области, alpha сохраняется. Одна запись Undo/Redo; реальная отмена worker, защита исходного документа/слоя после ожидания. Native high-depth/CMYK источник отклоняется без конвертации.
- Добавлено: «Настройки» справа от «Помощь», вкладки «Нейросети», «Обработка», «Рабочее пространство». Явная установка модели (~85 МБ), прогресс процент/МБ, отмена; cache-only запуск, проверенный SHA256 кэш отдельно от проектов. Уведомление и кнопка установки при выборе инструмента без модели. Автоматическое ускорение/CPU, привязка, начальный размер кисти.
- Проверено: pure tests и сборка — 954/954; browser smoke — PASS. Реальный Chrome file://: установка/отмена/повтор, отмена удаления с неизменным фото, удаление машины с outside-mask и Undo/Redo, повторное открытие offline, CPU inference на птице/разметке, вкладки клавиатурой; запросы только GET артефактов без фото. Независимая focused проверка — 23/23 PASS. Первый worker failure (opaque-origin module Blob) исправлен созданием module URL внутри worker; тестовые таймауты recovery/dirty-confirm отделены от результата inference. Развёрнутый сайт не обновлялся.

### 2026-10-07T14:35:10+03:00 — Отдельная кисть удаления объектов

- Добавлено: новый инструмент «Удаление объектов» (Shift+J), накопительная полупрозрачная маска, появляющиеся сверху «Удалить объект» и «Сбросить»; Escape отменяет штрих или сбрасывает готовую область.
- Изменено: применение замороженной маски через существующую локальную Content-Aware Fill на выбранном незаблокированном растровом слое; одна операция Undo/Redo, без замены обычного выделения и без потери native RGB/CMYK precision. Маска учитывает transform слоя и защищена от stale document/layer и повторного Apply.
- Проверено: npm run check — 940/940; npm run test:browser — PASS с pixel/Undo/Redo регрессией. Дополнительный Chrome-сценарий проверил маску и удаление при повороте 33°, scaleX 1.4 / scaleY 0.8, окна 1440×900 и 1024×768; независимая focused проверка — PASS.

### 2026-10-02 — Revalidate Smart Object Save lock after async preparation

- Исправлено: pending Smart Object content Save now revalidates the parent's **live effective lock** after preview rendering, so locking the layer or an ancestor group while Save is in flight cancels before Photoshop preparation or persisted writes.
- Photoshop safety: after native embedded-resource preparation Save re-resolves source authority and checks effective lock again before resource publication, target metadata/preview/content mutation, history, dirty/recovery/cache/tab or success feedback.
- Authority ordering: superseded generations stay silent; live lock is checked only after exact/source-aware parent identity is re-established, so same-ID replacements and shared/native identity semantics remain independent.
- Тесты/документация/сборка: deterministic deferred regressions cover both preview-time and Photoshop-rewrite-time lock races; a dedicated Smart Object lifecycle spec and canonical file:// generated artifacts are synchronized.

### 2026-10-02 — Bind unshared Smart Object Save to the exact parent layer

- Исправлено: pending content Save for an ordinary unshared Smart Object can no longer publish into a different Smart Object object that replaces the parent slot with the same layer ID while preview preparation is awaiting.
- Authority model: post-await Save checks now share one source-aware predicate — exact object identity for ordinary unshared Smart Objects, linked-source identity for ZPE linked instances, and Photoshop source identity for native Smart Objects.
- Publication safety: stale same-ID replacement cancels before preview/content mutation, history, dirty/recovery/cache/tab or success feedback.
- Тесты/документация/сборка: deterministic replacement regression and AI-facing authority routing are synchronized with the canonical file:// browser artifacts.

### 2026-10-02 — Contain Smart Object Save preparation failures

- Исправлено: Smart Object content Save now catches synchronous target/embedded-document preparation failures inside the controller instead of leaking a rejected Promise through fire-and-forget save callers.
- Publication safety: failed preparation leaves parent/content documents, history, dirty/recovery/cache state and previews untouched while preserving the existing error/status/toast diagnostics.
- Authority ordering: Save claims its monotonic generation only after shared/native target discovery and embedded-document restoration succeed, so a newer failed preparation cannot revoke an older already-authorized Save.
- Тесты/документация/сборка: deterministic regressions cover canonical restore failure and older-authorized/newer-target-discovery failure; AI-facing boundary/codemap/test routing and canonical file:// generated artifacts are synchronized.

### 2026-10-01 — Contain Smart Object conversion preparation failures

- Исправлено: accepted **Convert to Smart Object** commands now catch synchronous preparation failures (including source-bounds 48 MP safety rejection) inside the controller instead of leaking a rejected Promise through fire-and-forget menu callers.
- Publication safety: failed preparation leaves the source layer, selection and history untouched while preserving the existing diagnostic error/status/toast path; the canvas safety limit is unchanged.
- Authority ordering: Convert claims its monotonic generation only after snapshot/bounds validation, embedded-document construction and clone normalization succeed, so a newer failed preparation cannot revoke an older already-authorized conversion.
- Тесты/документация/сборка: deterministic regressions cover direct canvas-budget failure and older-authorized/newer-failed overlap; AI-facing boundary/codemap/test routing and canonical file:// generated artifacts are synchronized.

### 2026-10-01 — Make overlapping Smart Object conversions latest-authorized-wins

- Исправлено: overlapping **Convert to Smart Object** commands now let only the newest conversion that passed target/type/lock/nesting/source-bounds preflight publish after asynchronous preview rendering.
- Authority model: Convert owns a monotonic generation separate from Smart Object Save; exact document/session/source-slot/object-state checks remain independent, and a blocked/rejected newer Convert does not revoke an already-authorized older conversion.
- UI/error safety: superseded preview successes and failures return silently before stale cancellation feedback, mutation, history, status/toast or error logging, so older work cannot overwrite a newer conversion result.
- Тесты/документация: deterministic deferred regressions cover both completion orders, superseded preview failure, rejected-newer preservation and ordinary exact-state cancellation; AI-facing routing now documents the separate Convert/Save generations.

### 2026-10-01 — Make overlapping Smart Object content saves latest-authorized-wins

- Исправлено: two overlapping Smart Object content saves against the same unchanged child/parent state now let only the newest command that passed pending/parent/lock preflight publish.
- Authority model: `src/document/smart-object-controller.js` now combines a controller-local monotonic Save generation with the existing exact content-session/snapshot and parent/layer/shared-source guards; a blocked newer Save does not revoke an older authorized continuation.
- Photoshop safety: generation is revalidated after preview preparation and native embedded-resource rewrite, so superseded prepared `liFD` work cannot publish resources, targets, history, dirty/recovery/cache/UI state; superseded failures are silent.
- Тесты/документация: deterministic deferred regressions cover both completion orders, superseded preview failure, rejected-newer preservation and Photoshop rewrite overlap; AI-facing boundaries and test routing now document the dual-authority contract.

### 2026-10-01 — Make overlapping native .zpe opens latest-authorized-wins

- Исправлено: two overlapping native project opens against the same document/session/history/change epoch now publish only the newest command that actually passed pending-edit and replacement preflight.
- Authority model: `src/document/project-controller.js` now combines a controller-local monotonic open generation with the existing exact document/session/history/change-serial ticket; blocked newer attempts do not cancel an already-authorized older open.
- UI/error safety: superseded reads and superseded read failures exit silently before parse/sanitize or feedback publication, so an older command cannot replace a newer project or overwrite its success/stale/error UI and logs.
- Тесты/документация: deterministic deferred regressions cover both completion orders, superseded failure, rejected-newer preservation and exact success side-effect order; the native IO spec and AI routing now document the dual-authority rule.

### 2026-10-01 — Make overlapping PSD/PSB imports latest-authorized-wins

- Исправлено: when two PSD/PSB opens overlap against the same document/session/history/change epoch, only the newest import that successfully passed replacement/file preflight may continue to publication.
- Authority model: the PSD import controller now owns a monotonic command generation in addition to the existing exact document/session/history/change-serial ticket; the two guards protect independent command-intent and editor-state races.
- UI/error safety: superseded work exits silently after file read, decode and later raster/embedded preparation awaits, so an older completion or failure cannot replace the newer document or overwrite its status/toast/alert/error reporting.
- Тесты/документация: deterministic deferred regressions cover both completion orders, a superseded decode failure and a rejected newer replacement decision that must not cancel the already-authorized import; AI-facing architecture and test routing now document the dual-authority contract.

### 2026-10-01 — Harden New Document replacement authority

- Исправлено: the delayed **File → New / Ctrl+N** dialog now binds its discard authorization to the exact originating document/session instead of allowing a later submit to act on whichever tab is active.
- Dirty-state safety: clean→dirty transitions and additional edits in an already-dirty document advance the monotonic change epoch and require a fresh discard confirmation; an unchanged dirty epoch that was already confirmed is not prompted twice.
- Transaction safety: stale-owner, rejected re-confirmation, pending-edit and factory-failure paths publish no replacement history/document/dirty/recovery/viewport state; successful creation keeps the existing factory-first publication order.
- Тесты/документация: focused regressions cover late dirty epochs, same-document/different-session staleness, owner replacement, no-double-confirm and exact success ordering; AI-facing boundaries and the test matrix now route future changes to the temporal-authority contract.

### 2026-10-01 — Harden Saved Path rename ownership

- Исправлено: Rename Saved Path now binds the delayed modal intent to the exact originating document instead of re-reading the active tab by numeric index at submit time, preventing a stale dialog from renaming another document's path.
- Target integrity: valid Photoshop path resource IDs are used to survive list reordering, but mutation additionally requires the exact original path object; removed or same-ID replacement targets fail closed, while sanitized ID-less paths use exact object identity as the fallback.
- History safety: stale, empty, same-name, removed and replaced targets publish no `Переименовать контур` history entry; a real same-owner rename still trims/caps the name and commits exactly once.
- Тесты/документация/сборка: focused PathsController regressions cover normal rename, tab switch, reorder, same-ID replacement and ID-less fallback; AI ownership maps and test routing document delayed modal callbacks as origin-bound commands.


### 2026-10-01 — Extract History panel renderer

- Refactor: History-list DOM rendering moved from `src/main.js` into `src/ui/history-panel-controller.js`; the composition root now supplies only the live history getter and canonical jump command.
- Session correctness: every panel render resolves the current mutable per-tab HistoryStack, so switching document sessions cannot leave rows bound to a stack captured when the controller was created.
- Исправлено: the Clear History button no longer calls the removed `updateHistory()` helper; it clears the current stack and routes through the single `updateAll()` refresh path, avoiding a runtime `ReferenceError`.
- Behavior/tests/build/docs: exact row order, marker/class/title/native disabled semantics, click delegation, bottom scroll, empty state, live rebinding, Clear History callback closure and classic `file://` bundle order are regression-guarded; AI ownership maps and the test matrix now point to the narrow renderer.


### 2026-09-29 — Tiled native retouch regions and lazy Clone/Heal snapshots

- Memory/runtime: native v2 Clone/Heal/Blur/Smudge/Dodge/Burn now reuse the stroke-scoped tile working set instead of materializing the full 16/32-bit RGB/CMYK plane before editing.
- Neighborhood correctness: the working set exposes bounded region reads/writes; Blur reads kernel halo across tile boundaries, Smudge reads the union of destination/source footprints, and only pixels that actually change mark tiles dirty.
- Clone/Heal semantics: stroke start creates a separate lazy read-only tile working set from the original serialized source. Source tiles are decoded on demand, so later dab samples remain immutable without a mandatory full-plane clone.
- Dodge/Burn/Blur coverage keeps global pixel coordinates across moving regions, preserving overlap behavior independently of tile boundaries.
- Тесты/документация: regressions cover region dirty identity, lazy tiled Dodge, cross-tile Blur, Clone snapshot routing and retouch gesture opt-in; TILED_RASTER/AGENTS/PROJECT/CODEMAP/README were updated for Stage 17d.

### 2026-09-29 — Tiled interactive Brush/Eraser working set

- Memory/runtime: interactive native Brush/Eraser on `zpe-pixel-buffer-source-v2` no longer materialize the full 16/32-bit RGB/CMYK plane at stroke start; a stroke-scoped working set lazily decodes only intersecting tiles and keeps dirty/preview-dirty tile sets.
- Preview: the existing full RGBA8 display canvas is initialized tile-by-tile, then only dirty tiles are tone-mapped/repainted during the stroke; layer filters remain preview-only and are not baked into the persisted canonical preview.
- Precision: untouched tile payloads stay byte-identical; Eraser promotes RGB→RGBA / CMYK→CMYKA tile-by-tile and serializes untouched alpha-promoted tiles sequentially instead of holding a second full source plane.
- Ownership: exact document/layer paint guards and async publication remain unchanged; retouch/flood/inpaint still use the documented contiguous compatibility boundary.
- Тесты/документация: new regressions cover lazy tile loading, selective persistence, alpha promotion and native Brush routing; TILED_RASTER/AGENTS/README document the Stage 17c boundary.


### 2026-09-29 — Tile-local high-depth raster mutations

- Precision/memory: `zpe-pixel-buffer-source-v2` получил bounded tile mutation visitor — Line и selection clear меняют native RGB/CMYK 16/32-bit samples по одному tile, не материализуя полный high-depth plane; untouched tile payloads сохраняются byte-for-byte.
- Alpha/safety: clear может повысить RGB→RGBA / CMYK→CMYKA по tile с предварительной проверкой document byte budget; invalid grid/visitor result fail-closed до publication.
- Transactions: current-layer и merged visible-layer clear сохраняют exact-owner/all-or-nothing guards; high-depth no-op больше не проваливается в Canvas8 и не теряет precision.
- Compatibility: общий high-depth fallback reserialize теперь adaptive v1/v2, поэтому крупный source после поддержанной contiguous операции сохраняет tiled persistence.
- Тесты/документация: regressions покрывают selective tile rewrite, alpha promotion, command routing и merged no-op; `TILED_RASTER.md` фиксирует оставшиеся boundaries.


### 2026-09-29 — Tiled high-depth raster source foundation

- Memory architecture: добавлен backward-compatible `zpe-pixel-buffer-source-v2` — strict row-major tiled container для native RGB/CMYK 8/16/32-bit samples; adaptive PSD/PSB import переводит sources от 8 MiB на 256×256 tiles, сохраняя существующий 48 MiB precision budget.
- Render path: RGB v2 preview декодирует и tone-map-ит по одному tile без второго full high-depth plane; staging использует `OffscreenCanvas`, когда он доступен, с Canvas fallback.
- Compatibility/safety: legacy v1 читается без миграции; mutable contiguous consumers материализуют v2 через прежний API. Sanitizer fail-closed проверяет grid order/geometry/byte budgets и ограничивает tile count.
- Тесты/документация: regressions фиксируют RGB16/CMYK Float32 exact round-trip, edge tiles, adaptive policy, visitor semantics и malformed-grid rejection; docs честно фиксируют оставшиеся non-tiled boundaries.


### 2026-09-29 — Native high-depth Select & Mask output

- Precision: explicit `Новый растровый слой + маска` no longer downgrades or refuses native PixelBuffer sources; RGB/CMYK 16-bit and Float32 edge-color cleanup now runs directly on native color samples while source alpha remains exact.
- Safety: async publication keeps the exact originating `highDepthSource` identity, serializes the duplicate only after revalidation, and refuses publication before mutation when the shared 48 MiB PixelBuffer budget cannot hold both source and non-destructive output.
- Preview/runtime: the output layer receives a regenerated display preview through the canonical raster persistence bridge while the native serialized source remains authoritative.
- Тесты/документация: RGB16 and CMYK Float32 regressions cover native color cleanup/alpha preservation, controller tests cover native output routing, and the mask architecture/test matrix document the new precision contract.


### 2026-09-29 — Select & Mask edge-color decontamination

- Refinement: Select & Mask can now decontaminate partially selected edge colors from nearby confident foreground samples, while keeping mask alpha and source alpha semantics separate and deterministic.
- Output safety: mask-only remains the default non-destructive path; pixel decontamination requires explicit `Новый растровый слой + маска`, which keeps the original source hidden instead of overwriting it and publishes one guarded history transaction.
- Precision/performance: full-resolution raster output is capped at 12 MP with bounded edge/color work budgets, and native PixelBuffer RGB/CMYK sources are refused rather than silently downgraded to RGBA8.
- Тесты/документация: pure color-cleanup regressions, controller publication/precision guards, Stage 9e source contracts and the raster-mask architecture guide cover the new path.


### 2026-09-29 — Texture-aware Content-Aware Fill

- Quality: Content-Aware Fill now refines smaller completed holes with deterministic PatchMatch-style neighbour propagation and bounded pseudo-random donor search, so repeated textures can be reconstructed from real source samples instead of ending at a boundary-weighted blur.
- Precision: the same refinement works directly on typed RGB/CMYK 8/16/32-bit samples; candidate donor centers and source-patch samples must stay outside the frozen original selection, and the winning donor copies the full native sample including alpha.
- Safety/performance: the existing 8 MP layer and 2 MP fill gates remain; PatchMatch refinement is capped at 250k selected pixels and larger fills deliberately keep the deterministic boundary-synthesis fallback.
- Тесты/документация: regressions cover deterministic stripe-texture recovery and the explicit fallback path; a dedicated architecture contract documents ownership, precision, budgets and the fact that this is a bounded PatchMatch-style implementation rather than Adobe's proprietary or ML fill.


### 2026-09-29 — Independent raster mask link/unlink transforms

- Masks: raster masks now persist an explicit linked/unlinked relationship plus a compact relative affine transform; Layer and context menus can toggle linkage without rewriting mask pixels.
- Transform safety: when a mask is unlinked, nudge/align/fit and interactive Move/Resize/Rotate compensate the mask from the command/gesture baseline, keeping mask coverage fixed in document space; cancel restores both layer and mask exactly.
- Rendering/PSD: runtime composition and PSD/PSB export consume the same relative transform, while relinking preserves the current offset and only changes future transform behavior.
- Compatibility/tests/docs: old projects default to linked identity masks; affine values are bounded/sanitized; new regressions cover transform invariance, cancellation, controller ownership, menu wiring and generated file:// artifacts.

### 2026-09-29 — Professional raster layer-mask controls

- Masks: raster layer masks now persist explicit invert, density and feather controls; Layer/context menus expose properties, invert and enable/disable commands without rewriting the source bitmap.
- Rendering: one bounded alpha transform owns feather → invert → density semantics for Canvas8 and high-depth display paths, while show-all masks remain compact and exact.
- PSD/PSB: mask controls are baked into exported mask alpha for visual compatibility, including explicit show-all masks when runtime controls require a real mask channel.
- Safety/tests/docs: property dialogs bind to the exact mask object, Select & Mask revalidates the exact prior mask before async replacement, stale/replaced/locked targets publish no history, and new schema/math/controller/export regressions plus a dedicated AI-facing mask contract document the boundary.

### 2026-09-29 — Content-Aware Fill foundation

- Feature: в меню «Правка» добавлена контент-заливка активного выделения на текущем растровом слое; алгоритм идёт от границы выделения внутрь и использует только неизменяемые donor-пиксели вне hole, поэтому synthesized samples не размазываются рекурсивно.
- Precision: один model-agnostic core работает с Uint8/Uint16/Float32 samples; native 16/32-bit RGB и CMYK редактируются через PixelBuffer и существующий exact-owner high-depth persistence без скрытого RGBA8 fallback.
- Safety: команда фиксирует selection snapshot до async Canvas preparation, повторно проверяет exact document/layer перед публикацией, подавляет history/status при stale persistence и ограничивает рабочий слой 8 МП, а hole — 2 МП для предсказуемой памяти.
- Тесты/документация/сборка: добавлены pure inpaint regressions, Canvas8/high-depth command tests, bundle-order guard и AI-facing ownership maps; file:// bundle/cache manifest регенерированы.

### 2026-09-29 — Extract history navigation owner

- Refactor: Undo / Redo / jump-to-history runtime transactions move from `src/main.js` into `src/workspace/history-navigation-controller.js`; History panel DOM and menu/keyboard/button routing remain composition concerns.
- Session safety: every command resolves the current mutable per-session HistoryStack at invocation time instead of capturing a stack during controller composition, while pending edits still block before any stack mutation.
- Behavior preservation: Undo/Redo keep selection → raster cleanup, Jump keeps raster → crop → selection cleanup, and all successful navigation preserves restore → `updateAll()` → dirty → exact status ordering; semantic no-ops publish nothing.
- Тесты/документация/сборка: direct owner regressions cover fail-fast bridges, blocked/no-op paths, exact publication ordering and live history rebinding; composition guards lock routing and file:// bundle order, with AI maps/test matrix updated to the canonical owner.

### 2026-09-29 — Extract New Document lifecycle owner

- Refactor: File → New / Ctrl+N dirty-confirm, exact modal schema and replacement transaction move from `src/main.js` into `src/document/new-document-controller.js`; the composition root now only wires explicit ports and routes menu/keyboard/recovery actions.
- Shared policy: PSD/PSB and native `.zpe` open flows reuse the same extracted document-replacement confirmation policy instead of depending on a composition-root helper.
- Atomicity: canonical `createDocument` validation runs before any publication; success preserves fresh `HistoryStack(80)` → document/session replacement → clean state → immediate recovery → fit-to-view order, while validation failures keep the modal open with zero partial replacement.
- Тесты/документация/сборка: direct owner tests cover preflight, exact confirmation/schema, submit recheck, ordered publication and failure rollback; a source/bundle guard locks composition routing and classic-script evaluation order; AI maps/test matrix now point to the canonical lifecycle owner.

### 2026-09-29 — Extract Document Background dialog orchestration owner

- Refactor: Image → Document Background modal schema/options, exact open-time owner capture and stale-result presentation move from `src/main.js` into directly tested `src/ui/document-background-controller.js`; the composition root now only wires explicit ports and routes the Image menu action.
- Owner safety: delayed Apply keeps the exact originating document while the dynamic “Основной цвет” option is sampled once per dialog open through an explicit primary-color port, so tab switches cannot redirect a late command.
- Behavior preservation: transparent/white/black/current-primary options, `Применить`, existing no-pending-guard policy, REJECTED status and normal COMMITTED/NOOP modal-close semantics remain unchanged; persisted no-op/history policy stays in `src/document/background-command-controller.js`.
- Тесты/документация/сборка: direct UI-owner regressions cover bridge validation, schema, dynamic sampling, captured-owner routing and all command outcomes; architecture guards enforce the split and classic bundle dependency order, with AI maps/test matrix updated to the canonical owners.

### 2026-09-29 — Extract document resize dialog orchestration owner

- Refactor: Image Size / Canvas Size modal schema, all nine anchor labels, repeated pending-edit guard and command-result presentation move from `src/main.js` into `src/ui/document-resize-controller.js`; the composition root now only wires the UI owner to the persisted command owner and routes menu actions.
- Owner safety: each dialog still captures the exact originating document at open and submits that owner to `src/document/resize-command-controller.js`, so tab replacement cannot redirect a delayed resize into another document.
- Behavior preservation: INVALID and REJECTED keep the modal open with the existing status/toast messages, while COMMITTED and semantic NOOP keep the generic modal controller's normal close behavior without duplicate history or UI publication.
- Тесты/документация/сборка: direct UI-controller regressions cover schema/guards/owner capture/outcome routing; architecture guards enforce the split and classic file:// bundle dependency order; AI maps and the test matrix point to the new canonical owner.

### 2026-09-29 — Extract document export orchestration owner

- Refactor: Export modal/command orchestration moves from `src/main.js` into `src/document/export-controller.js`; `main.js` now only composes the owner and routes menu/quick-export actions.
- Async safety: the controller repeats the pending-edit guard on submit, freezes exactly one detached document snapshot before the first async export boundary, and never publishes a partial download on render/preparation/codec failure.
- Format boundaries: PNG/JPEG/WebP quality + filename routing, PSD/PSB codec selection, ICC extraction cap and writer resource limits are covered directly while PSD document preparation remains in `src/document/psd-export-controller.js` and binary layout in `src/formats/psd.js`.
- Test/docs hygiene: VM/source-oracle tests no longer depend on the removed Export block as a text delimiter; direct controller coverage, architecture guards, `DOCUMENT_EXPORT.md` and AI/test routing document the canonical boundary.

### 2026-09-29 — Extract native project IO owner

- Refactor: native `.zpe` open/save orchestration moves from `src/main.js` into `src/document/project-controller.js`; incoming-file classification, schema, recovery storage and Smart Object persistence stay with their existing owners.
- Async safety: direct tests pin preflight → exact document/session/history/change-serial snapshot → read/parse/sanitize → revalidation → one publication; stale/pending/invalid outcomes publish no partial project state.
- Save semantics: regular `.zpe` download keeps immediate recovery without falsely marking the document clean; Smart Object content tabs still delegate to their owner.
- AI/build hygiene: source-eval project-open tests are replaced by direct owner tests, recovery assertions target the canonical owner, and a narrow project-IO spec documents the boundary.

### 2026-09-28 — Learning Center guided mastery loop

- Learning method: каждый урок теперь идёт по циклу «понять → сделать → проверить → закрепить»: ментальная модель и правило выбора, практический чек-лист на реальном холсте, проверка знаний с объяснениями и самопроверка мастерства.
- Progress gate: урок нельзя случайно зачесть одним кликом — завершение открывается только после практики, самопроверки и мини-теста; ранее пройденные v1-уроки мигрируют в v2 без потери прогресса.
- UX: добавлены прогресс по уровням «База / Уверенно / Продвинуто», метрики практики и проверок, состояния «В процессе / Готов / Освоен» и действие «Закрыть Центр и практиковаться».
- Regression/build/docs: unit- и file:// smoke-тесты закрепляют migration/readiness/checklists/quiz/persistence; AI-facing карта обновлена, browser bundle и cache manifest регенерированы.

### 2026-09-28 — Learning Center mastery curriculum

- Learning UX: короткая статическая памятка заменена отдельным 10-урочным маршрутом «База → Уверенно → Продвинуто» с целями, практикой на реальном холсте, критериями мастерства, типичными ошибками, шпаргалкой и итоговым проектом.
- Progress: пользователь вручную отмечает реально пройденные этапы; прогресс/последний урок сохраняются только локально в браузере и восстанавливаются после закрытия Центра.
- Accessibility/responsive: Центр получил отдельную широкую адаптивную оболочку, нативные кнопки навигации, progressbar, видимый focus, Escape, focus loop для info-dialog и reduced-motion fallback.
- Architecture/tests: учебный контент и state вынесены из `src/main.js` в `src/ui/learning-center-controller.js`; добавлены unit/source guards и file:// browser-smoke для открытия, прогресса, persistence, Escape и возврата focus.

### 2026-09-28 — In-app Learning Center

- UX: в меню «Помощь» добавлен «Центр обучения» перед справкой по горячим клавишам; «О программе» отделено визуальным разделителем.
- Onboarding: новый встроенный экран даёт пятиминутный маршрут от открытия изображения и навигации до слоёв, базовых инструментов, сохранения проекта и экспорта.
- Safety/learning: центр отдельно напоминает сохранять редактируемый `.zpe`, предлагает короткое практическое упражнение и направляет к полной справке по горячим клавишам.
- Regression/build: тест закрепляет wiring меню и ключевой учебный контент; file:// bundle и cache manifest должны быть перегенерированы вместе с исходником.

### 2026-09-28 — Extract canvas viewport navigation owner

- Refactor: zoom clamp/no-op policy, active-session zoom synchronization, canvas/overlay refresh, pointer-anchored correction and fit-to-view orchestration move from `src/main.js` into `src/workspace/viewport-controller.js`; keyboard/menu/wheel dispatch and pan gestures stay in the runtime composition root.
- Behavior preservation: the canonical 10%–1600% range, `1e-6` no-op threshold, one-shot `requestAnimationFrame` anchoring seam, 90 px fit padding, fit scroll reset and per-tab zoom persistence are covered by direct deterministic tests.
- AI/build hygiene: architecture/source guards point to the new owner, a narrow viewport specification documents ownership and temporal behavior, and the generated `file://` bundle loads the owner before `src/main.js`.

### 2026-09-28 — Split Selection Clipboard async owners

- Refactor: Selection Copy/Cut rendering, frozen intent capture, OS Clipboard write and latest-command continuation move into `src/selection/clipboard-copy-cut-controller.js`; `src/selection/clipboard-controller.js` becomes the stable facade and keeps Paste/native-paste/fallback lifecycle.
- Ownership hygiene: `clipboardCommandGeneration` and `pasteGeneration` now live in separate canonical owners while the public API consumed by `src/main.js` remains unchanged; destructive raster/history policy stays behind existing mutation ports.
- Regression/build/docs: source-contract tests are retargeted to the canonical owner, structural guards prevent generation domains from recombining, the file:// build graph loads the new owner before the facade, and `SELECTION_CLIPBOARD.md` records the reusable async contract.

### 2026-09-28 — Latest-owner overlapping Selection Clipboard commands

- Concurrency safety: each copy/cut invocation gets a controller-local monotonically increasing generation; a newer command supersedes older same-document/same-layer work after async render or OS Clipboard boundaries.
- Mutation/history safety: superseded Cuts cannot enter a later destructive merged/current-layer clear; an optional continuation predicate is propagated through merged preparation and Canvas8/native high-depth persistence, so ownership lost during an internal await aborts before pixel/history publication; post-clear completion then revalidates generation + exact context before transient UI or success publication.
- UI/error ownership: stale generations cannot clear a newer selection, force Move, or overwrite newer success/error status/toast; rejected stale Clipboard promises are observable in diagnostics without taking UI ownership back.
- Regression/docs: deterministic deferred-Promise coverage pins newer-first/older-first overlap ordering, selected-layer overlap, Copy→Cut/Cut→Copy semantics and stale rejection suppression; AI-facing boundary/test docs now record the separate copy/cut generation contract.

### 2026-09-28 — Origin-bound async Selection Clipboard copy/cut

- Correctness: copy/cut freezes exact originating document/session, full cloned selection geometry, copy mode and selected-layer identity before rendering or Clipboard awaits; copied PNG and later Cut consume the same intent.
- Async safety: context is revalidated before OS Clipboard write and before destructive continuation; same-ID document/layer replacements cannot receive a late clear or history publication.
- UI ownership: stale completion cannot clear a newer selection or force a newer tool; normal non-stale completion still clears the marquee and switches to Move.
- Regression/docs: deterministic deferred-Promise tests cover selection replacement, same-bounds geometry, stale targets, ordering and Clipboard failures; lower destructive ports accept caller-owned frozen context without weakening exact publication guards.


### 2026-09-27 — Frozen selection semantics for merged raster batches

- Correctness: merged multi-layer selection clearing now captures one cloned full selection-shape snapshot before target discovery and async preparation, so later targets cannot silently switch to a newer marquee/lasso/polygon/magnetic selection while the batch is pending.
- Precision/path consistency: target intersection, native 16/32-bit RGB/CMYK selection predicates and Canvas8 clipping consume the same captured geometry; clearing or replacing the live selection during an await no longer turns a later target into a full-layer or differently shaped clear.
- State ownership: the batch never restores or overwrites a newer live selection; the existing exact document/session/target-set/effective-lock all-or-none publication gate remains unchanged.
- Regression/docs: deterministic snapshot handoff tests and source guards pin the immutable-input contract, and the raster persistence/boundary/AI-routing docs now distinguish frozen preparation inputs from exact publication authority.


### 2026-09-27 — Atomic exact-target merged selection clearing

- Correctness: merged multi-layer selection clearing now validates the complete exact source-layer set after async raster/high-depth preparation; same-ID replacements and removed targets cannot receive or authorize a late prepared result.
- Transaction safety: effective locks are rechecked immediately before publication and any stale target rejects the whole batch before the first persisted write, so prepared high-depth mutations, rasterized replacements and history publish all-or-none.
- Regression/docs: deterministic stale-target, removal, late-lock, high-depth and preparation-failure tests plus an architecture guard reject the previous ID-only publication seam; the canonical raster-persistence spec now documents the reusable multi-target contract.


### 2026-09-27 — Exact-owner native high-depth raster persistence

- Correctness: native 16/32-bit RGB and CMYK paint caches now bind to the exact originating document and exact raster-layer objects; same-ID replacement documents/layers cannot inherit a stale typed working buffer or preview override.
- Async safety: current-layer high-depth publication now follows capture → prepare/serialize → await PNG preview → exact owner/target revalidation → atomic metadata publication; paint gestures additionally revalidate the exact captured working buffer before commit.
- Caller/history hygiene: native brush/eraser/retouch gestures plus high-depth line/fill/current-layer clear carry captured owner/target authority into persistence; stale results publish no layer write, Undo entry or success status, while encoding failures remain observable and clear unsaved native gesture state.
- Regression/docs: direct tests cover cache identity, normal native publication, active/same-ID document replacement, same-ID layer replacement, generic command stale publication and serialization failure; architecture/source guards and `RASTER_PERSISTENCE.md` now document the shared Canvas8/native ownership pattern.

### 2026-09-27 — Owner-bound Canvas8 raster persistence

- Correctness: reusable Canvas8 paint buffers now bind to the exact originating document and exact raster-layer objects instead of only a reusable layer ID; same-ID document/layer replacements cannot inherit a stale buffer or late PNG publication.
- Async safety: `ensureRasterBuffer(owner, layer)` prepares async raster materialization in a local candidate and publishes shared buffer state only after revalidation; `persistPaintLayer(owner, layer)` revalidates exact owner, target and captured Canvas immediately after PNG encoding and before the first persisted write.
- Caller ownership: fill/line/selection-clear commands and Canvas8 paint gestures hand exact document/layer authority to the raster owner; paint drag movement no longer re-resolves a same-ID layer from mutable current-document state, and clone-source preparation aborts if its owner changes while preparing the raster buffer.
- Regression/docs: controller tests cover exact cache identity, normal publication, same-ID document/layer replacement and serialization failure; command/gesture tests prove owner handoff and stale history/success suppression; `RASTER_PERSISTENCE.md` records the reusable Canvas8 contract for future AI/Codex passes.


### 2026-09-27 — Canonical persisted Gradient command controller

- Refactor: persisted Gradient Canvas preparation, PNG serialization, Raster-layer creation and history publication move out of the large `src/main.js` composition root into `src/painting/gradient-command-controller.js`; visual Gradient preview stays in `src/main.js`.
- Exact-owner reliability: Gradient drag now captures the originating document object. The command validates that exact owner before consuming live selection state and again immediately after async PNG serialization, so tab switches and same-ID document replacements cannot redirect a late Gradient into another document.
- Behavior/transaction hygiene: linear/radial geometry, colors + white fallback, opacity, selection clipping, shared `paintPersisting` exclusion, Raster schema, Russian statuses/toast and the single `Добавить градиент` history label are preserved; the busy guard is released in `finally` for success/error/stale outcomes.
- Regression/docs/build: direct delayed-serialization tests cover stale/same-ID replacement, busy/error cleanup and Canvas semantics; pointer source harness + architecture guards are retargeted; `GRADIENT_COMMAND.md` records the reusable capture → prepare → await → revalidate → publish pattern, and the canonical file:// build graph includes the new owner.

### 2026-09-27 — Canonical transient Crop gesture / overlay controller

- Refactor: transient Crop gesture ownership, normalized draft rectangle, final-release geometry, 10×10 pointer acceptance gate, per-document session-safe draft snapshot/restore and crop overlay/grid move out of the large `src/main.js` composition root into `src/interaction/crop-gesture-controller.js`.
- Exact-owner/session safety: active Crop gestures capture the originating document object, stale/replaced owners cannot yield a persisted crop intent, and session restore revives only immutable rectangle presentation data — never active pointer ownership.
- Ownership hygiene: persisted canvas/layer geometry and the single `Кадрирование` history publication remain in `src/document/crop-command-controller.js`; Crop-to-Selection keeps its separate 1×1 gate; generic pointer capture remains in `pointer-lifecycle-router.js`.
- Regression/docs/build: direct controller tests cover reverse drags, immutability, stale/undersized releases, cancellation and exact overlay metrics; VM pointer harnesses and architecture guards are retargeted; `CROP_INTERACTION.md` records the reusable split and AI documentation rules now require targeted specs/patterns when a stable contract would otherwise need rediscovery.

### 2026-09-27 — Canonical selected-layer transform surface controller

- Refactor: read-only selected-layer Move / Resize / Rotate discovery, control hit-testing, frame/handle/name-badge drawing, rotated resize cursors and topmost Move targeting move out of the large `src/main.js` composition root into `src/interaction/layer-transform-surface-controller.js`.
- Behavior preservation: frame visibility/lock accents, non-Move corner dots, Move resize/rotate controls, zoom-aware `10 / zoom` hit tolerances, canvas-clamped rotation handle, reverse z-order target discovery, recursive group locks and the exact `Слой` fallback remain unchanged.
- Ownership hygiene: pointer-down now consumes semantic rotate/resize/move intents from the read-only surface while actual transform mutation, Smart Snap, history/no-op/finalization and rollback remain in `layer-transform-gesture-controller.js`; discrete nudge/center/align/fit remains in `layers/transform-command-controller.js`.
- Regression/docs/build: direct surface tests cover drawing, lock/visibility, geometry, cursor precedence, topmost targeting, text-preview display routing and read-only state preservation; source/architecture guards route future agents to the canonical owner and the file:// build graph includes the new module.


### 2026-09-27 — Canonical new Pen path publication command controller

- Refactor: final persisted publication of a brand-new Pen draft moves out of the large `src/main.js` composition root into `src/interaction/pen-path-command-controller.js`; bounds/localization, Shape-path construction, exact-owner publication and the single `Добавить Bézier-контур` history entry now have one focused owner.
- Behavior preservation: drafts are still consumed before publication; fewer than two points and geometry below the existing one-pixel extent remain zero-history no-ops, handle coordinates still participate in bounds, nodes localize to layer space with smooth/corner normalization, and name/path-closed/fill/stroke/stroke-width/opacity values retain the existing Pen mapping.
- Exact-owner safety: publication verifies the originating document before planning and again immediately before the first persisted write, so stale/replaced owners cannot receive a new path or history entry.
- Regression/docs/build: direct command tests cover bridge validation, too-short/degenerate/invalid no-ops, handle-inclusive localization/style mapping, open/closed paths and stale pre-write replacement; architecture/source guards keep publication logic out of `main.js`, AI routing docs point to the new owner, and the canonical file:// bundle graph includes it.

### 2026-09-27 — Canonical new Pen draft gesture controller

- Refactor: transient creation of a brand-new Pen path moves out of the large `src/main.js` composition root into `src/interaction/pen-draft-gesture-controller.js`: draft points/hover, double-click finish intent, per-point handle gesture, release status classification and cancel/reset/consume state now have one explicit owner.
- Behavior preservation: the close threshold remains `4 / zoom`; handle movement remains `1 / zoom`; new nodes start cornered with null handles; normal drag mirrors `handleIn` and marks smooth, Alt-drag keeps an independent `handleOut` with corner semantics; the three existing Russian release statuses and minimum-two-points warning are preserved.
- Correctness/safety: `pointerup` now applies its final coordinate before classifying the new handle, closing the gap where a release without a final `pointermove` could leave geometry at the previous point; draft gestures bind exact draft+node identity so reset/replacement cannot redirect a stale cancel or update into a replacement draft.
- Boundary/history hygiene: drafting owns no persisted layer mutation or history; `src/main.js` still owns bounds/localization and final Shape + `Добавить Bézier-контур` publication, while pointercancel/Escape delegate exact transient-node rollback and tool/document/session resets delegate the controller reset seam.
- Regression/docs/build: direct controller tests cover finish intent, thresholds, smooth/Alt modes, immutable snapshots, final release, cancellation, stale identity and invalid input; architecture/source guards prevent `penDraft`/`pen-handle` state from returning to `main.js`; AGENTS/CODEMAP/BOUNDARIES/AI workflow/test matrix route future agents directly to the canonical owner.

### 2026-09-27 — Canonical existing Bézier corner command controller

- Refactor: the one-shot Alt-click existing-anchor → corner mutation/history policy moves out of `src/main.js` into `src/interaction/path-control-command-controller.js`; the composition root now only distinguishes a handled command from drag fallback.
- Exact-owner safety: the command revalidates the active document, resolves the exact live Shape / Vector Mask / Saved Path target through the read-only surface owner, rechecks recursive layer locks immediately before mutation, and rejects stale/replaced/missing targets without redirected writes or history.
- Behavior preservation: real conversions still clear both handles, set `kind='corner'` and publish the three established source-specific history labels; already-corner/no-handles anchors remain a semantic no-op with exact status `Bézier-узел уже угловой` and no history entry.
- Regression/docs/build: direct command tests cover all three sources, ignored handle/non-Alt intent, no-op, stale/owner/recursive-lock rejection; surface identity coverage and architecture/source guards prevent mutation policy drifting back into `src/main.js`, AI routing docs now distinguish surface → one-shot command → gesture → new Pen draft, and the canonical bundle graph includes the new owner.

### 2026-09-27 — Canonical existing Bézier path-control surface controller

- Refactor: read-only discovery/projection/hit-testing/path tracing/control drawing/cursor feedback for existing Shape paths, Vector Masks and Saved Paths moves from the large `src/main.js` composition root into `src/interaction/path-control-surface-controller.js`; pointer/tool dispatch, Alt-click corner conversion and new `penDraft` / `pen-handle` creation remain outside.
- Behavior preservation: Saved Path edit mode keeps precedence and invalid-index cleanup; matching selected Vector Masks and Shape paths retain visibility rules; recursively locked controls remain visible with the locked style but are excluded from hit/edit targeting; handles still beat anchors and the hit radius remains `8 / zoom`.
- Overlay/cursor hygiene: layer-backed controls still use canonical layer→document projection, Saved Paths stay in document coordinates, vector/saved outlines retain dashed source styling, control metrics remain zoom-stable, and Canvas state is paired with `save()` / `restore()` while cursor feedback runs only for idle Pen interaction.
- Regression/docs/build: direct surface tests cover target precedence, invalid edit cleanup, visibility/lock policy, projection/hit priority/radius, open/closed cubic tracing, source styles/metrics and cursor guards; legacy source tests and architecture/AI maps are retargeted, and the canonical file:// build graph includes the new owner.

### 2026-09-27 — Canonical existing Bézier path-control gesture controller

- Refactor: dragging existing Shape-path, Vector Mask and Saved Path anchors/handles moves from direct mutation/history logic in `src/main.js` into `src/interaction/path-control-gesture-controller.js`; hit-testing, control drawing/status, Alt-click corner conversion and new `penDraft` / `pen-handle` creation remain in the composition root.
- Exact-owner safety: each gesture captures the originating document plus exact layer/path/subpath/node identities, uses stable Saved Path resource IDs when available, re-resolves those identities on update/finalize/cancel, and honors recursive effective layer locks so stale/same-ID replacement targets cannot receive redirected writes.
- Correctness fix: the `1 / zoom` drag threshold is now a mutation boundary as well as a history boundary — sub-threshold previews are restored to the captured baseline, closing the previous case where a micro-move could persist without an Undo entry. Returning to baseline likewise publishes zero history, while a real edit preserves the six established anchor/handle labels.
- Gesture semantics/reliability: layer-backed coordinates still localize through `documentPointToLayerPixel`; anchor moves translate both handles, Shift+anchor starts `handleOut`, smooth handles mirror until Alt breaks symmetry, final pointer-release geometry is applied even without a last `pointermove`, and pointercancel/Escape share the same exact-target rollback primitive.
- Regression/docs/build: direct controller tests cover Shape/Vector Mask/Saved Path edits, stable Saved Path identity, modifiers, threshold/no-op, final release, stale/replaced/missing/locked targets and rollback; legacy source tests and architecture guards are retargeted to the canonical owner, AI routing/docs are updated, and the generated file:// bundle graph includes the module.

### 2026-09-27 — Canonical interactive layer transform gesture controller

- Refactor: selected-layer Move / Resize / Rotate drag transactions move from direct geometry/history mutation in `src/main.js` into `src/interaction/layer-transform-gesture-controller.js`; generic Pointer Events capture remains in `pointer-lifecycle-router.js`, while hit-testing/cursor/tool dispatch stay in the composition root.
- Exact-owner safety: each gesture captures originating document + stable layer ID + object identity, re-resolves that exact target on update/finalize/cancel, honors recursive effective locks, and rejects stale/missing/same-ID replacement targets without redirecting writes or history.
- Gesture semantics: Shift axis lock, Smart Snap + Ctrl bypass, zoom-stable snap threshold, Resize Shift/Alt modifiers, minimum handle size and Rotate Shift 15° snapping keep their existing canonical geometry helpers; final release coordinates are applied even when no last `pointermove` arrives.
- History/cancel hygiene: real transforms publish exactly one preserved history label; return-to-baseline and unchanged Resize/Rotate finishes publish zero Undo; pointercancel/lost-capture/Escape share controller rollback so baseline restoration cannot target another document/layer.
- Regression/docs/build: direct transaction tests cover live preview, modifiers, snapping, final release, no-op, stale/replaced/missing/locked targets and cancel rollback; old source-slice tests now assert delegation, architecture/AI maps point to the canonical owner, and the generated file:// bundle includes the module.

### 2026-09-27 — Canonical document Crop command controller

- Refactor: persisted Crop geometry mutation/history moves from `src/main.js` into `src/document/crop-command-controller.js`; pointer gesture/overlay/cancel state and Crop-to-Selection UI gates stay with their existing interaction owners.
- Atomicity/safety: Crop now validates finite positive input, preserves legacy rounding, proves canvas safety, stages every final layer position against `MAX_LAYER_POSITION`, and revalidates the exact originating document immediately before the first persisted write.
- History hygiene: a full-document crop is a persisted semantic no-op with zero Undo/dirty publication while still completing the existing transient crop/selection/brush cleanup and viewport fit once; real crops publish exactly one preserved `Кадрирование` entry.
- Regression/docs/build: direct controller coverage adds stale/replacement/pre-write guards, invalid geometry and overflow atomicity; pointer/source guards and AI-routing docs point to the canonical owner, and the file:// build graph includes it.

### 2026-09-27 — Canonical document background command controller

- Refactor: persisted Image → «Фон документа…» mutation/history policy moves from the delayed modal callback in `src/main.js` into `src/document/background-command-controller.js`; modal markup/options/status and persisted schema/rendering remain with their existing owners.
- Stale-document fix: the dialog captures its originating document and Apply revalidates exact object identity immediately before mutation, so switching tabs or replacing the active document cannot redirect a stale background change.
- History hygiene: applying the already-selected background is now a semantic no-op with zero Undo/dirty/recovery publication; a real change publishes exactly one preserved `Фон документа` history entry.
- Regression/docs/build: direct controller tests cover bridge requirements, supported values, no-op, stale/replacement ownership and pre-write revalidation; architecture/AI-routing docs and the canonical file:// build graph point to the new owner.


### 2026-09-27 — Canonical document resize command controller

- Refactor: persisted Image Size and Canvas Size mutation/validation/history policy moves from delayed modal callbacks in `src/main.js` into `src/document/resize-command-controller.js`; modal markup, pending-edit UI guard and status presentation remain in the composition root.
- Stale-document fix: each dialog captures its originating document and Apply revalidates that exact owner immediately before mutation, so switching tabs while a resize modal is open cannot resize the newly active document.
- Atomicity/history: Image Size stages `checkedCanvasSize` + `imageResizeTransforms`; Canvas Size stages all nine-anchor shifts + `MAX_LAYER_POSITION` validation before writing. Invalid/no-op/stale paths leave document, transient selection/crop state and history untouched; real commands publish once.
- Тесты/документация/сборка: the VM/source-slicing resize test is replaced by direct controller regressions; architecture/AI-routing docs and the canonical file:// build graph point to the new owner.


### 2026-09-27 — Canonical discrete layer transform command controller

- Refactor: synchronous selected-layer nudge, center, canvas alignment and fit-to-canvas commands move from direct geometry mutation in `src/main.js` into `src/layers/transform-command-controller.js`; pointer Move/Resize/Rotate gestures and Properties live preview stay unchanged.
- Correctness/history: every command re-resolves the exact active layer ID, honors recursive effective locks, rejects non-transformable Adjustment layers, validates finite deltas/modes, and suppresses zero/already-centered/aligned/fitted Undo entries while preserving existing history labels for real mutations.
- Geometry: center/align/fit reuse canonical `layerFrame`, `frameBounds` and `alignLayerToCanvas` behavior, including rotated/scaled layers, instead of introducing parallel frame math.
- Regression/docs/build: direct controller and architecture/source-contract coverage pin behavior and ownership; AI routing/test docs and the canonical file:// bundle graph include the new owner.


### 2026-09-27 — Canonical Adjustment Layer command controller

- Refactor: persisted Adjustment Layer scalar/Levels, Curves and clipping commands move from `src/main.js` into `src/layers/adjustment-command-controller.js`; Properties markup and display formatting remain in the composition root.
- Stale-state/lock safety: callbacks now carry the originating document + stable layer ID, re-resolve the exact target, honor recursive effective locks, and stale/missing/locked paths publish neither mutation nor history.
- History/validation hygiene: canonical same-value updates and unchanged clipping create zero Undo entries; real commands publish exactly once without the former pre-`commit()` `markDirty(true)` duplication; invalid numeric/Levels/Curves input leaves persisted state unchanged.
- Regression/docs/build: direct controller tests cover scalar/Levels/Curves/clipping, lock/stale/missing/no-op and PSD metadata preservation; architecture/AI-routing docs and the canonical file:// build graph point to the new owner.


### 2026-09-27 — Canonical Layer Filter reset commands

- Refactor: Image-menu commands «Сбросить цветокоррекцию» and «Сбросить все фильтры слоя» now delegate to `src/layers/property-command-controller.js` instead of mutating `layer.filters` directly in the composition root.
- History/state hygiene: discrete resets re-resolve the exact active layer, honor recursive effective locks, suppress already-default Undo entries and clear matching live-preview baselines so a later range `change` cannot publish stale history.
- Canonicalization: reset publication runs through `sanitizeFilters`; Color Correction resets only configured color keys while preserving valid non-color effects, and full reset restores the complete canonical default shape including removal of unknown persisted filter keys.
- Regression/docs/build: direct controller tests cover no-op, lock/stale/missing targets, malformed persisted filters, non-color preservation and preview-baseline cleanup; architecture/AI-routing docs pin the controller as the single reset owner and the generated browser artifacts are refreshed through the canonical build.

### 2026-09-27 — Canonical Color Correction dialog controller

- Refactor: Color Correction modal construction, draft/live-preview transaction and finalization moved from `src/main.js` into `src/ui/color-correction-controller.js`; the composition root now only wires the owner and routes the Image-menu action.
- Stale-state fix: every preview/Apply revalidates the originating document plus stable layer ID and object identity, so tab switches or a removed/replaced target cannot mutate a coincidental layer or publish history into another session.
- Transaction safety: effective lock changes block Apply, stale/locked close paths restore the exact originating transient preview when the target survives, Reset is one history-free preview publication, repeated identical input is a no-op and real Apply commits at most once.
- Lifecycle/tests/docs/build: Cancel/Escape/backdrop share one idempotent finalizer with focus restoration; direct controller regressions cover clamps, no-op/history, stale target/document/lock and cleanup; architecture/AI-routing docs and the canonical file:// bundle graph point to the new owner.

### 2026-09-27 — Canonical Layer Properties command controller

- Refactor: generic Layer Properties / Color & Effects / persistent opacity+blend / HDR display-preview mutation and history policy moved from `src/main.js` into `src/layers/property-command-controller.js`; Properties markup remains in the composition root.
- Stale-state fix: rendered property/HDR controls now publish through the originating document + stable layer ID and re-resolve the exact live target before mutation, so callbacks retained across a tab switch cannot mutate an old layer while committing into the new session.
- History hygiene: filters, layer opacity, blend mode, generic properties and HDR preview suppress same-value commits; range `input` keeps an original baseline so the final `change` still produces exactly one Undo after live preview, while returning to the baseline produces no synthetic history.
- Validation: recursive effective locks, numeric/text enum normalization, transform clamps, raster canvas-size safety, filter/HDR sanitization and custom-font publication now share one narrow transaction owner.
- Regression/docs/build: direct controller tests cover exact-owner/lock/no-op/live-preview/HDR behavior; HDR and architecture source guards target the new owner; AI routing docs and the canonical browser build graph include the new module.


### 2026-09-27 — Canonical Layer/Group command controller

- Refactor: primitive layer/group semantic commands shared by the Layers panel, menus, buttons and keyboard routes moved from duplicated `src/main.js` callbacks into `src/layers/command-controller.js`; `src/main.js` is now composition/wiring plus feature-heavy menu ownership.
- Correctness: layer/group lock policy now consistently uses recursive effective ancestor locks, fixing the selected-layer path that previously checked only the immediate group.
- Stale-state safety: rename/group-properties modal Apply re-resolves the exact originating document/entity before mutation, so tab switches or removed targets publish neither stale writes nor history.
- History hygiene: failed and no-op reorder/move/property commands do not commit; group deletion keeps existing core behavior that reparents contents one level upward.
- Regression/docs/build: direct command-controller tests cover nested locks, pending delete, stale modals, no-op history, group preservation and layer/group moves; architecture/source contracts and AI maps point to the new canonical owner, and the generated browser bundle includes the new source.

### 2026-09-27 — Открытие recovery-проекта двойным левым кликом

- Исправлено: быстрый двойной клик по карточке автосохранённого проекта теперь обрабатывается только основной (левой) кнопкой мыши; двойной правый клик больше не запускает восстановление.
- Cleanup: detector переименован из right-click-specific в нейтральный `createRapidDoubleClickTracker`, а recovery action теперь помечается `primary-double-click`.
- Regression coverage: unit/source-contract тесты фиксируют primary-button contract и запрещают возврат `button === 2`/secondary-double-click поведения.
- Cache busting: runtime-изменение создало новый build ID `c36bc347c1d8ccfa`, поэтому HTTP/HTTPS-публикация получит исправленный bundle через существующий механизм автообновления.

### 2026-09-26 — Instagram в окне «О программе»

- About UI: карточка разработчика дополнена ссылкой `Instagram: @zeter1992` на `https://www.instagram.com/zeter1992/` с безопасным открытием в новой вкладке.
- Regression coverage: тест контактов разработчика теперь фиксирует email, Telegram, GitHub, Facebook и Instagram.
- Cache-busting proof: runtime-изменение создало новый build ID `8820a951ecb14661`, поэтому после корректной выкладки HTTP/HTTPS-версия должна получить обновлённый bundle без `Ctrl+F5`.

### 2026-09-26 — Facebook в окне «О программе»

- About UI: карточка разработчика дополнена ссылкой `Facebook: @zeter1` на `https://www.facebook.com/zeter1` с безопасным открытием в новой вкладке.
- Regression coverage: тест контактов разработчика теперь фиксирует email, Telegram, GitHub и Facebook.
- Cache-busting proof: изменение runtime породило новый build ID `7d62ac5cdc7f5524`, поэтому опубликованная HTTP/HTTPS-версия должна автоматически запросить обновлённый bundle без `Ctrl+F5`.

### 2026-09-26 — Автообновление web-сборки без Ctrl+F5

- Runtime bootstrap: HTTP/HTTPS-запуск перед стартом приложения получает `version.json` через `cache: no-store` + уникальный query и сравнивает server build ID с build ID текущего `index.html`.
- Cache busting: при новом build страница один раз открывается с `zpe_build=<build-id>`, после чего `src/styles.css` и `src/app.bundle.js` загружаются с тем же versioned query; защита от повторного reload не допускает цикла, если хостинг игнорирует query для HTML.
- Local compatibility: `file://` по-прежнему не требует HTTP-сервера и запускает bundle напрямую без сетевой проверки.
- Build/CI: `tools/build-bundle.mjs` теперь детерминированно вычисляет 64-bit build ID из HTML/CSS/bundle, обновляет `application-build` и генерирует `version.json`; CI проверяет все generated browser artifacts, а regression-тест фиксирует manifest/reload/file contracts.
- Deployment hygiene: README документирует выкладку `version.json` последним, чтобы ручное обновление на статическом хостинге не публиковало новый build marker раньше файлов приложения.

### 2026-09-26 — GitHub в окне «О программе»

- About UI: карточка разработчика дополнена ссылкой `GitHub: @zeter1` на профиль `https://github.com/zeter1`; ссылка открывается в новой вкладке с `noopener noreferrer`.
- Regression coverage: добавлен source-level тест, фиксирующий email, Telegram и GitHub-ссылки в окне «О программе».

### 2026-09-26 — Быстрый вход и переименование recovery-проектов

- Recovery UI: удалена кнопка «Позже»; Escape больше не скрывает менеджер неявно — пользователь выбирает явное действие.
- Быстрый вход: два быстрых клика правой кнопкой мыши по одной карточке (порог 360 мс) сразу восстанавливают выбранный проект; стандартное контекстное меню на карточках подавляется.
- Переименование: добавлена кнопка «Переименовать проект»; новое имя записывается и в метаданные recovery-записи, и в JSON-снимок активного документа, при этом исходное время автосохранения сохраняется.
- Regression coverage: добавлены тесты rapid-right-click detector, rename transaction и сохранения savedAt.

### 2026-09-26 — Менеджер автосохранённых проектов

- UX: стартовое окно восстановления теперь показывает список всех доступных локальных автокопий с активным названием проекта, временем сохранения, количеством документов, содержимым вкладок и принадлежностью текущему/другому окну редактора.
- Действия: добавлены «Загрузить проект», «Начать новый проект», «Удалить проект», «Позже» и «Восстановить выбранный»; удаление требует явного подтверждения, а загрузка использует существующий безопасный file-picker проекта.
- Надёжность: отказ от восстановления/переход к новому или дисковому проекту резервирует новый recovery-key, поэтому показанная автокопия не перезаписывается текущим окном; программный cross-window delete по умолчанию по-прежнему запрещён и допускается только после явного подтверждения из менеджера.
- Доступность/тесты: список использует нативные radio/button controls, видимый focus и замкнутую Tab-навигацию модального окна; regression-тесты покрывают сортировку/выбор recovery-записей, защиту foreign delete, подтверждённое удаление и запуск нового проекта.

### 2026-09-26 — Layers panel/tree controller extraction

- Refactor: recursive Layers tree rendering, row accessibility/focus, thumbnails/mask hints and panel-local layer/group drag/drop lifecycle moved out of the remaining `src/main.js` composition root into `src/ui/layers-panel-controller.js`.
- Reliability: rendered-row callbacks and drag identity are now bound to the exact originating document, so a tab switch cannot let stale DOM mutate the newly active document; all drop/drag-end/destroy paths clear local drag identity and decorations.
- Lock correctness: relative layer reorder now rejects a locked target layer as well as a locked source/ancestor, preventing a drop from publishing order history through a protected target.
- Boundaries/tests/docs: layer/group schema and mutation primitives remain in `src/core/state.js`, feature-heavy context-menu/history semantics remain runtime ports, direct fake-DOM regressions cover hierarchy/focus/DnD/stale ownership, and AI routing docs point to the canonical panel owner.

### 2026-09-26 — Selection Vector Mask controller extraction

- Refactor: selection-driven Vector Mask geometry, boolean subpath publication, 128-contour guard and selected-mask edit/toggle/invert/remove commands moved from the large `src/main.js` into `src/selection/vector-mask-controller.js`.
- Pen boundary fix: entering Vector Mask edit now clears a competing Saved Path edit target before publishing the exact Vector Mask layer ID, and the old duplicate `vectorMaskEditLayerId` assignment around `setTool('pen')` is replaced by one explicit runtime edit port.
- Boundaries: Pen anchor/handle geometry and edit state remain in `src/main.js`; Saved Paths remain in `src/ui/paths-controller.js`; PSD/PSB vector-mask import/export conversion and codec ownership remain outside the new selection controller.
- Тесты/документация: direct regressions cover rect/ellipse/path conversion, 72-point bridge usage, anchor/handle localization, boolean operations, re-enable/128-limit/guard paths and edit/lifecycle semantics; source guards and AI maps prevent the command cluster drifting back into the composition root.

### 2026-09-26 — Selection raster-mask / Select & Mask controller extraction

- Refactor: selection → raster layer-mask generation, Select & Mask option normalization, edge-aware preparation, non-destructive preview lifecycle and add/remove/final Apply transactions moved from the large `src/main.js` into `src/selection/mask-controller.js`.
- Reliability fix: final refined Apply and add-from-selection now follow prepare → exact document/layer/lock revalidation → publish, so a tab switch, selected-layer change or lock change during awaited preparation creates neither a stale mask nor a history entry.
- Preview safety: async preview preparation is bound to the originating document/layer and a per-modal generation token; stale/closed work cannot attach listeners or repaint another modal, and cleanup cancels queued animation work.
- Boundaries/tests: Smart Filter reuses the canonical `selectionMaskDataUrl()` bridge while retaining its own mutation transaction; direct controller regressions cover dimensions, safety bounds, valid publication, document/layer/lock races and preview cleanup, while legacy Select & Mask source contracts now target the canonical owner.

### 2026-09-26 — Shared Text typography/font settings controller extraction

- Refactor: shared Text typography/font UI policy moved from the large `src/main.js` into `src/ui/text-settings-controller.js`: option sets, local-font discovery/private registry, custom-font validation/read cache, modal fields and form normalization.
- Behavior preservation: `queryLocalFonts()` fallback/permission messages, Russian locale sorting + 1,000-font bound, stored-font fallback options, WOFF/WOFF2/TTF/OTF 5 MB validation, embedded `fontData`/`fontLabel` retention and typography clamps remain explicit controller contracts.
- Properties safety: manual system fonts and custom font files now use the same canonical owner as Text add/edit; async custom-font publication still revalidates the originating document, exact selected layer and lock state before mutation/history commit.
- Тесты/документация: direct controller regressions cover local-font capability/error paths, de-duplication/sort/cap/select preservation, bounded manual registry, custom-font cache retry semantics, precedence/normalization and source ownership; AI maps distinguish Text transaction ownership from Text settings/font policy.

### 2026-09-26 — Text edit / live-preview controller extraction

- Refactor: Text-tool add/edit modal transaction, visible-text hit routing, transient draft ownership, async live-preview generation and preview-canvas synchronization moved from the large `src/main.js` into `src/ui/text-edit-controller.js`.
- Reliability: async preview is explicitly latest-wins and revalidates the originating document + exact edit-layer identity after awaited font/settings resolution; final Edit Apply also revalidates the exact selected layer and lock state before mutation.
- Boundaries: generic `src/ui/modal-controller.js` no longer receives Text-specific preview/close callbacks; reusable per-modal `onMount`/`onClose` lifecycle keeps feature state in its owner while shared text font/form helpers remain outside until their own bounded extraction.
- Тесты/документация: direct controller regressions cover latest-wins/stale/closed preview, exact-selection Apply, locked-target rejection, Add semantics, preview-canvas DPR/zoom alignment and source ownership; AI routing docs and generated file:// bundle graph now point to the canonical Text owner.

### 2026-09-26 — Layer Blending / Layer Styles controller extraction

- Refactor: Blending Options / Layer Styles dialog construction, draft/live-preview transaction, preview-canvas crop/sync and modal lifecycle moved from the large `src/main.js` into `src/ui/layer-blending-controller.js`.
- Reliability: stale document/layer Apply and lock-after-preview now roll transient draft values back to the exact originating layer instead of leaving preview state behind; Cancel/Preview-off remain history-free and real Apply still commits exactly `Параметры наложения слоя`.
- Module hygiene: the controller imports `makeModalDraggable()` explicitly, removing a hidden dependency that previously worked only because the generated file:// bundle flattened module scopes.
- Тесты/документация: direct session regressions cover preview/rollback/no-op/real Apply/stale-owner/lock guards, preview-canvas tests now import the canonical owner instead of VM-slicing `main.js`, and AI routing docs identify the new boundary.

### 2026-09-26 — Smart Filter UI/controller extraction

- Refactor: Smart Filter stack/mask markup, reorder/toggle/remove/clear commands, mask transactions, properties-panel bindings and add/edit modal lifecycle moved from the large `src/main.js` into `src/ui/smart-filter-controller.js`.
- Boundaries: Smart Filter schema, sanitization and the canonical `MAX_SMART_FILTERS` limit remain in `src/core/state.js`; ordered pixel filtering and mask composition remain in `src/core/render.js`; the shared selection-mask rasterizer remains a narrow runtime port because layer masks also use it.
- Reliability: selection-mask creation preserves prepare-before-publish ownership checks, so switching documents while rasterization awaits cannot mutate or commit into the wrong document. Live density/feather preview still renders without history until the final change event.
- Тесты/документация: direct controller regressions cover stack commands, lock guards, last-filter mask cleanup, mask lifecycle, stale-document async cancellation, clamp/live-preview semantics and the canonical stack limit; architecture routing docs now point fresh AI/Codex sessions directly to the Smart Filter owner.


### 2026-09-26 — Photoshop Smart Object resource owner extraction

- Refactor: embedded Photoshop Smart Object PNG/PSD/PSB payload serialization, bounded `liFD` linked-resource rewrite preparation/publication and native baseline metadata refresh moved from the large `src/main.js` into `src/document/psd-smart-object-resource.js`.
- Boundaries: generic content/session lifecycle and stale-tab revalidation remain in `smart-object-controller.js`; document-to-writer preparation remains in `psd-export-controller.js`; low-level PSD/PSB encoding and linked-record byte surgery remain in `src/formats/psd.js`.
- Reliability: resource rewrite keeps prepare-before-publish semantics, so parent linked blocks and target metadata are not mutated until the generic controller has revalidated the originating content tab and parent identity after async preparation. Existing 40 MiB asset, 4 MiB ICC, 128 MiB linked-block, 12 MP and 200-layer safety bounds are preserved.
- Тесты/документация: direct regressions cover PNG/PSD/PSB serialization selection, unsafe eligibility/fallback paths, real-fixture `liFD` preparation without parent mutation, explicit publication and identity-preserving baseline refresh; AI routing and architecture ownership docs now point directly to the resource owner.


### 2026-09-26 — Smart Object content lifecycle controller extraction

- Refactor: generic Smart Object convert/open/save/link/unlink orchestration, nesting/source-bounds rules, shared-source propagation and content-tab lifecycle moved from the large `src/main.js` into `src/document/smart-object-controller.js`.
- Boundaries: stable core state/geometry dependencies stay direct; browser preview rendering, workspace/session publication and Photoshop embedded-resource rewrite are narrow ports. PSD/PSB/PNG embedded serialization and linked-resource byte rewrite remain outside the generic controller.
- Bug fixes: linked Smart Object open status now counts instances against the parent document after the content tab is loaded, and async content save now revalidates the originating content tab/document after preview generation and after Photoshop embedded-resource preparation, preventing stale snapshots or native resource blocks from publishing after a tab switch.
- Тесты/документация: direct controller regressions cover linked-copy/unlink, conversion stale guards, parent-owner instance counts, shared-source save propagation, stale-tab cancellation and Photoshop rewrite port isolation; AI routing/boundary/test-matrix docs now point to the canonical lifecycle owner.


### 2026-09-26 — PSD import semantics owner extraction

- Refactor: Photoshop import-specific Text, solid Shape, Adjustment and Smart Object metadata mapping plus editable embedded-asset decoding moved from the large `src/main.js` into `src/document/psd-import-semantics.js`.
- Architecture: `src/document/psd-import-controller.js` remains the transaction/publish owner; binary codec stays in `src/formats/psd.js`. Shared vector-mask localization, opaque Photoshop resource conversion and Smart Object fingerprint helpers deliberately remain outside the new module and enter as explicit ports instead of creating duplicate owners or an import→export-plan dependency.
- Behavior preservation: TySh/EngineData baselines, shape eligibility/style metadata, adjustment normalization/channel bounds, Smart Object fingerprints and embedded PNG/JPEG/WebP/GIF/BMP/PSD/PSB editable-content fallbacks keep their existing import contracts.
- Тесты/документация: direct semantics regressions cover supported/unsupported shape mapping, immutable metadata baselines, Smart Object identity, raster embedded assets, failure fallback and bounded nested-PSD decode; architecture/source contracts and AI navigation now follow the canonical owner.


### 2026-09-26 — Photoshop native export metadata-plan boundary

- Refactor: Text/TySh, solid Shape, Adjustment and Smart Object native-export eligibility/rewrite planning moved from the large `src/main.js` into `src/document/psd-native-metadata-plans.js`; `psd-export-controller` now imports that canonical owner directly instead of receiving six runtime semantic callbacks.
- Boundaries: persisted opaque-block decoding and Smart Object baseline fingerprints are centralized with the planner; shared layer-local→document point math moved to `src/core/geometry.js`. PSD/PSB container parsing/writing and descriptor rewrite primitives remain in `src/formats/psd.js`.
- Reliability: all previous native eligibility guards, bounded metadata budgets, TySh single-run rule, Shape geometry/style checks, Adjustment fallback rules and Smart Object stale-metadata invalidation are preserved; unsupported cases still produce explicit raster/composite fallback reasons.
- Tests: added direct real-fixture regressions for supported/unsupported Text, Shape and Adjustment plans plus Smart Object identity invalidation; architecture/source contracts prevent the plan cluster drifting back into `src/main.js`.
- Docs/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES, AI workflow and TEST_MATRIX now route Photoshop export compatibility work to the new owner; canonical `file://` bundle graph includes it.

### 2026-09-26 — PSD/PSB import-mapping controller extraction

- Refactor: PSD/PSB file guard, codec orchestration, decoded layer/group/path mapping, native high-depth/CMYK preservation, ICC preview policy, bounded source budgeting, stale document/session guard and final publish coordination moved from the large `src/main.js` into `src/document/psd-import-controller.js`.
- Boundaries: `src/formats/psd.js` remains the binary decoder/writer; generic incoming-file routing stays in `src/document/import-controller.js`; export preparation remains in `src/document/psd-export-controller.js`. Existing Photoshop import-semantic helpers are temporary explicit ports rather than silently moving unrelated export planning.
- Reliability: the original validate → decode/prepare → revalidate originating document/session/history/change-serial → publish sequence is preserved, including the 512 MB file guard, 48 MP codec bound and bounded native PixelBuffer persistence budget.
- Tests: added direct controller regressions for RGB16 precision/group/path mapping, stale-tab cancellation and pre-decode oversize rejection; source contracts now follow the canonical import owner instead of assuming implementation lives in `src/main.js`.
- Docs/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES, AI workflow and TEST_MATRIX route PSD import work directly to the new controller; canonical `file://` bundle graph includes it.


### 2026-09-26 — PSD/PSB export-preparation controller extraction

- Refactor: bounded document→PSD/PSB writer preparation moved from the large `src/main.js` into `src/document/psd-export-controller.js`: export bounds, group ancestry, native high-depth/CMYK eligibility, prepared raster/native payloads, merged composite choice and bounded warnings.
- Boundaries: binary PSD/PSB parsing/writing and Photoshop block rewrite remain in `src/formats/psd.js`; import mapping and existing Text/Shape/Adjustment/Smart Object semantic plans stay outside this pass and enter the controller through explicit ports.
- Precision/reliability: native 16/32-bit RGB and 8/16/32-bit CMYK paths, 48 MP temporary-buffer guard, bounded typed-composite memory, raster fallbacks and Photoshop metadata passthrough contracts are preserved without algorithm rewrites.
- Tests: added direct `tests/psd-export-controller.test.mjs` for a no-Canvas native 16-bit path and the 48 MP safety bound; legacy PSD export source contracts now target the canonical owner and architecture tests forbid the helper cluster drifting back into `src/main.js`.
- Docs/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES, AI workflow and TEST_MATRIX route export-preparation work directly to the new owner; canonical `file://` bundle graph includes the controller.


### 2026-09-26 — Color-management UI controller extraction

- Refactor: document-level CMYK/ICC policy/profile actions, preview/edit transform caches, async native-CMYK preview rebuild and properties-panel bindings moved from the large `src/main.js` into `src/ui/color-management-controller.js`; runtime keeps only narrow painting/PSD-preview bridges.
- Reliability: stale document switches during async preview generation roll policy/profile state back without publishing prepared pixels, and both transform caches are invalidated after rollback/failure.
- Tests: added direct controller regressions for cache reuse/invalidation, stale-document rollback, proof-profile transactions and DOM error/disabled-state behavior; architecture guard prevents cache/action ownership drifting back into `src/main.js`.
- Architecture/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES and TEST_MATRIX now route UI orchestration to the controller while preserving ICC math in `src/core/color-management.js` and PSD/PSB bytes in `src/formats/psd.js`.
- Build: canonical `file://` source graph includes the new controller; generated `src/app.bundle.js` is rebuilt from canonical modules before CI.

### 2026-09-26 — Saved Paths controller extraction

- Refactor: selected saved-path index, Photoshop-compatible resource allocation, CRUD, panel rendering, keyboard/context-menu wiring и apply-as-vector-mask orchestration вынесены из большого `src/main.js` в `src/ui/paths-controller.js`.
- Boundaries: Pen direct-edit geometry/transient `documentPathEditIndex` остаются runtime-owned, а PSD/PSB binary codec остаётся в `src/formats/psd.js`; новый controller получает зависимости через grouped narrow ports.
- Tests: добавлены прямые controller regressions для ID range/998 limit, CRUD, adjustment/lock guards, accessible list/keyboard/context-menu behavior; session test дополнительно доказывает восстановление selected path per document.
- Architecture/AI: ownership maps, AI routing и test matrix обновлены; architecture guard запрещает возвращать Saved Paths CRUD/render state в `src/main.js`.
- Build: canonical file:// bundle graph включает `src/ui/paths-controller.js`; generated `src/app.bundle.js` синхронизирован из source modules.

### 2026-09-26 — Workspace layout controller extraction

- Refactor: persistent collapse state правой панели и canvas-mode visibility/viewport-centering вынесены из большого `src/main.js` в `src/ui/workspace-layout-controller.js`; runtime теперь только подключает DOM/runtime ports.
- Reliability: storage parsing/persistence остаются fail-soft, legacy `propertySections: ["color-effects"]` мигрирует в panel id `effects`, а переключение canvas mode сохраняет тот же canvas point в центре viewport.
- Tests: добавлены прямые controller regressions для migration, malformed storage, accessibility/persistence, click wiring и viewport-centering; architecture guard запрещает возврат layout state/functions в `src/main.js`.
- CI follow-up: legacy `workspace-navigation-v17` source-contract теперь проверяет canvas-mode implementation в каноническом `workspace-layout-controller.js`, а `src/main.js` — только как wiring boundary; это убирает stale slice по удалённой функции.
- Browser: `file://` smoke теперь реально сворачивает panel, проверяет localStorage после reload и переключает canvas mode клавишей Tab.
- Docs/AI: карты владельцев обновлены, а `task/` добавлен как versioned bounded queue для следующих небольших AI/Codex проходок; одна задача = один Markdown-файл, завершённая задача удаляется только после merge + green CI.
- Build: canonical source graph включает workspace layout controller; generated `src/app.bundle.js` синхронизирован из source modules.

### 2026-09-26 — Workspace recovery controller extraction

- Refactor: window recovery/autosave orchestration вынесена из большого `src/main.js` в `src/workspace/recovery-controller.js`: reload-stable window key, debounce/generation cancellation, serialized save/discard queue, dirty-tab snapshot collection и startup restore policy.
- Architecture: IndexedDB/record implementation остаётся в `src/core/recovery.js`; новый workspace controller получает storage/project/session/runtime/UI через явные grouped ports, а `src/main.js` остаётся composition root без собственного recovery state.
- Reliability: controller теперь сам запрещает удаление recovery entry другого окна и через restore UI, и через публичный `discardRecovery(key)`; unreadable sibling snapshots по-прежнему сохраняются при восстановлении валидных документов.
- Tests: добавлен прямой `tests/workspace-recovery-controller.test.mjs` для debounce, serialized discard, malformed siblings, key rotation, multi-window ownership и storage failure; legacy recovery tests больше не исполняют приватные куски `main.js` через VM slicing.
- CI follow-up: `tests/raster-save-boundary.test.mjs` больше не использует удалённый recovery helper как slice-marker для pending-edit guard; boundary теперь заканчивается на соседнем `setDoc`, поэтому тест не захватывает остальной runtime после extraction.
- Browser-smoke follow-up: восстановлены соседние `smartSnapEnabled` / `smartGuides`, случайно попавшие в механический recovery state range; `workspace-navigation-v17` теперь отдельно фиксирует наличие этого runtime state после будущих workspace extractions.
- Docs/AI: обновлены AGENTS/PROJECT/CODEMAP/BOUNDARIES/AI workflow/test matrix и добавлен `docs/development/QUALITY_PLAYBOOK.md` с evidence-first refactor/debug/review/test-oracle правилами и актуальными source checkpoints.
- Build: canonical `file://` bundle graph включает workspace recovery controller; generated bundle остаётся производным artifact.

### 2026-09-26 — Pointer lifecycle router extraction

- Refactor: generic overlay `pointerdown → pointermove → pointerup/pointercancel` ownership вынесен из большого `src/main.js` в новый `src/interaction/pointer-lifecycle-router.js`; tool-specific move/transform/paint/path/selection/crop dispatch остаётся в runtime orchestrator.
- Reliability: router владеет одним active pointer, явно управляет capture/release, игнорирует чужие active-gesture events и переводит неожиданный `lostpointercapture` в тот же cancellation path, чтобы жест не оставался «залипшим».
- Async safety: paint preparation по-прежнему проверяет жив ли исходный pointer через `pointerLifecycle.isActivePointer(pointerId)`, поэтому поздний async begin не стартует штрих после release/cancel.
- Tests: добавлены direct lifecycle regressions для capture, foreign-pointer filtering, cancel/lost-capture, external release и cleanup при rejected release callback; release-position regressions переведены с DOM-listener source slicing на tool-domain handler. CI follow-up также перевёл legacy source-contract/VM tests с `activePrimaryPointerId` на публичный pointer-lifecycle bridge.
- Docs/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES, AI workflow и test matrix получили отдельный interaction owner, чтобы pointer lifecycle находился без чтения всего `src/main.js`.
- Build: canonical `file://` bundle graph включает interaction router; generated `src/app.bundle.js` остаётся производным artifact.

### 2026-09-26 — Selection gesture controller extraction

- Refactor: transient selection interaction вынесен из большого `src/main.js` в новый `src/selection/gesture-controller.js`: rectangle/ellipse/free-lasso marquee lifecycle, polygon draft, magnetic edge snapping/draft и их overlay rendering.
- Architecture: `src/main.js` сохраняет только global pointer/keyboard capture/routing и canonical selection shape/session bridge; controller получает geometry/runtime/UI через явные grouped ports и не устанавливает DOM listeners.
- Reliability: document/session reset теперь очищает и polygon, и magnetic draft через единый controller reset; раньше session switch явно сбрасывал polygon draft, но magnetic draft мог пережить смену вкладки.
- Tests: добавлен прямой `tests/selection-gesture-controller.test.mjs`; source-contract тесты selection/magnetic routing переведены на нового канонического владельца, а global pointer-release regressions остаются на runtime boundary.
- Docs/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES, AI workflow и test matrix направляют selection gesture задачи сразу в `src/selection/gesture-controller.js`, чтобы следующий ChatGPT/Codex не перечитывал большой runtime.
- Build: canonical `file://` bundle graph включает новый controller; generated `src/app.bundle.js` должен оставаться точной сборкой source modules.

### 2026-09-26 — Selection raster mutation controller extraction

- Refactor: destructive merged-selection clearing and selected-layer rasterization вынесены из большого `src/main.js` в новый `src/selection/raster-mutation-controller.js`.
- Architecture: Clipboard orchestration остаётся в `selection/clipboard-controller.js`; current-layer fill/line/clear — в `painting/command-controller.js`; новый controller владеет heterogeneous multi-layer clearing, non-raster pixel-edit rasterization и guarded publication.
- Reliability: merged clear сохраняет prepare-all-before-mutate semantics и теперь повторно проверяет originating document/session перед публикацией async результатов, поэтому поздняя операция не переезжает в другую вкладку.
- Precision: native 16/32-bit RGB/CMYK selection clear по-прежнему проходит через typed PixelBuffer mutation и публикацию `painting/controller.js`, без принудительного Canvas8 fallback.
- Tests: добавлены direct controller regressions для visible/locked/adjustment filtering, non-raster replacement, tab-switch cancellation и high-depth clear; async rasterization tests теперь вызывают реальный controller вместо VM-slicing `main.js`.
- Regression follow-up: high-depth persistence/preview/render source-contract tests переведены с прежнего расположения mutation-кода в `src/main.js` на нового канонического владельца `src/selection/raster-mutation-controller.js` после CI #177.
- Docs/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES, AI workflow и test matrix направляют merged-cut/rasterization задачи прямо к новому владельцу.
- Build: canonical bundle graph включает новый selection controller; generated `src/app.bundle.js` синхронизируется только из source modules.

### 2026-09-26 — Raster command controller extraction

- Refactor: fill, raster-line и очистка пикселей текущего raster layer внутри активного выделения вынесены из большого `src/main.js` в новый `src/painting/command-controller.js`.
- Architecture: новый controller получает document/target/selection/tool/transaction/UI через grouped ports, использует общий `paintPersisting` guard из runtime и не становится владельцем global pointer events, selection/history state или multi-layer Clipboard cut.
- Precision: сохранены оба destructive paths — Canvas8 и native 16/32-bit RGB/CMYK PixelBuffer — включая selection predicate, CMYK ink conversion, high-depth mutation publication и async raster persistence.
- Reliability: line/fill/clear по-прежнему блокируют пересекающиеся raster operations; отдельный regression закрепляет раннюю установку pending-edit guard до async raster decode.
- Tests: добавлен direct `tests/painting-command-controller.test.mjs`; selection/fill/line, high-depth, raster-save-boundary и architecture contracts переведены на нового владельца.
- Docs/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES, AI workflow и test matrix теперь направляют one-shot raster commands сразу в `src/painting/command-controller.js`, а merged multi-layer cut явно оставляют в selection/runtime boundary.
- Build: `tools/build-bundle.mjs` включает command controller в canonical source graph; generated `src/app.bundle.js` синхронизирован с новым модулем.

### 2026-09-26 — Painting gesture controller extraction

- Refactor: lifecycle одного brush/eraser/retouch stroke вынесен из большого `src/main.js` в новый `src/painting/gesture-controller.js`: выбор raster target, native high-depth/CMYK vs Canvas8 path, `begin → move → end`, preview scheduling и финальная persistence/commit coordination.
- Architecture: глобальный pointer capture/routing, `currentTool`, selection/history ownership и общий `paintPersisting` guard остаются в runtime; controller получает их через небольшие grouped ports и не превращается в новый глобальный state owner.
- Retouch integration: clone/heal/smudge/blur/dodge/burn mechanics остаются в `src/retouch/controller.js`, а shared raster buffers/persistence — в `src/painting/controller.js`; gesture controller только связывает эти owners в пределах одного штриха.
- Reliability: сохранён async pointer-release guard — если pointer исчез во время подготовки raster buffer, поздний `begin` не запускает штрих; preview scheduling по-прежнему видит live paint-drag до первого кадра.
- Tests: добавлен direct `tests/painting-gesture-controller.test.mjs`; brush-performance и architecture contracts теперь проверяют нового владельца gesture lifecycle и запрещают возвращать `ensurePaintLayer/beginPaint/paintTo/endPaint` в `src/main.js`.
- Docs/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES, AI workflow и test matrix указывают точный owner для paint gestures, чтобы ChatGPT/Codex не искали stroke lifecycle по всему runtime.
- Build: `tools/build-bundle.mjs` включает новый controller в canonical source graph; generated `src/app.bundle.js` синхронизируется с исходниками.

### 2026-09-26 — Painting / raster edit state controller extraction

- Refactor: добавлен канонический `src/painting/controller.js` — единый владелец reusable Canvas8 paint buffer/context/layer id, native 16/32-bit/CMYK working buffer, high-depth mutation/persistence и paint-preview frame lifecycle.
- Architecture: `src/main.js` больше не хранит `brushCanvas/brushCtx/brushLayerId`, high-depth paint state и preview queue; runtime оставляет только gesture/transaction orchestration и обращается к painting controller через узкий API.
- Retouch integration: `src/retouch/controller.js` получает shared raster/high-depth state через painting-controller bridge, сохраняя private clone/heal/smudge/blur/dodge/burn scratch ownership отдельно.
- Reliability: document/session reset, undo/redo, resize/crop/rasterize/import и destructive raster paths сбрасывают канонический paint state через controller вместо разрозненных присваиваний в runtime.
- Tests: добавлен direct `tests/painting-controller.test.mjs`; architecture, brush-performance, high-depth, async document, resize, selection и retouch source-contract regressions переведены на нового владельца.
- Docs/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES, AI workflow и test matrix теперь направляют raster-edit задачи сразу в `src/painting/controller.js`, чтобы ChatGPT/Codex не перечитывали большой `src/main.js`.
- Build: `tools/build-bundle.mjs` включает painting controller в канонический source graph; `src/app.bundle.js` пересобран из обновлённых source chunks.


### 2026-09-26 — Retouch controller extraction

- Refactor: Canvas8 и native high-depth/CMYK mechanics для clone/heal/smudge/blur/dodge/burn вынесены из `src/main.js` в `src/retouch/controller.js`.
- Architecture: controller владеет только retouch source/scratch/per-stroke snapshot state; document/history/pointer lifecycle и generic brush/fill/line transactions остаются в runtime orchestrator, а pixel math — в `src/core/pixels.js` и `src/core/pixel-buffer.js`.
- Precision: high-depth и CMYK retouch по-прежнему маршрутизируется напрямую в typed-buffer primitives без Canvas8-квантизации.
- Tests: добавлен direct controller regression для Canvas8 tone, native high-depth tone и clone snapshot/reset semantics; architecture/source contracts переведены на нового владельца.
- Docs/AI: AGENTS, PROJECT, CODEMAP, BOUNDARIES и AI workflow получили отдельный retouch owner, чтобы такие задачи находились без чтения большого `src/main.js`.

### 2026-09-26 — Document import controller extraction

- Refactor: file classification, multi-image import и drag/drop/file-input routing вынесены из `src/main.js` в `src/document/import-controller.js`.
- Reliability: controller сохраняет decode/validate-all-before-mutate semantics и повторно проверяет исходные document/session перед первым изменением, поэтому поздний decode не импортирует слой в другую вкладку.
- Architecture: PSD/PSB parsing и project open/save остаются отдельными callbacks; import controller не поглощает format/persistence ownership.
- Tests: async document-context regressions теперь вызывают реальный import controller API; reliability contract читает нового владельца import transaction.
- Docs/AI: PROJECT, CODEMAP, BOUNDARIES и AGENTS получили отдельную document-import boundary, чтобы file/import задачи находились без поиска по `src/main.js`.


### 2026-09-26 — Selection clipboard controller extraction

- Refactor: copy/cut/paste lifecycle выделения вынесен из `src/main.js` в `src/selection/clipboard-controller.js`: PNG preparation, merged/selected copy modes, Clipboard API, native paste и Ctrl+V fallback state.
- Architecture: controller не владеет document/layer mutation; очистка выбранного или всех видимых слоёв остаётся явным callback boundary в `src/main.js`, сохраняя lock/high-depth/Undo semantics.
- Async safety: paste generation/timer state теперь локален controller-у, а direct/fallback paste сохраняют guard по исходному document/session при переключении вкладок.
- Regression: async clipboard tests вызывают реальный controller API вместо source slicing; architecture gate запрещает возвращать clipboard state/functions в `src/main.js`.
- Исправлено: global keyboard handler больше не читает приватный `openMenuKey` после menu-controller extraction; используется публичный `menuController.isOpen()`, и architecture test запрещает утечку внутреннего menu state.
- Docs/AI: PROJECT, CODEMAP, BOUNDARIES и AGENTS получили отдельную selection boundary, чтобы задачи copy/cut/paste находились без чтения большого runtime orchestrator.


### 2026-09-26 — Modal/dialog controller extraction

- Refactor: generic modal shell вынесен из `src/main.js` в `src/ui/modal-controller.js`: form fields, numeric normalization, async submit lifecycle, focus restore, backdrop/Escape close и draggable text-modal behavior.
- Architecture: info/recovery dialogs также перенесены в UI controller; text preview и editor mutations остаются callback-ами в `src/main.js`, поэтому controller не владеет document state.
- Tests: modal number/drag tests теперь импортируют канонические helpers напрямую вместо source slicing из большого orchestrator; reliability/recovery contracts читают нового владельца.
- Build: `tools/build-bundle.mjs` и generated `src/app.bundle.js` включают новый controller для сохранения прямого `file://` запуска.
- Docs/AI: PROJECT, CODEMAP и AGENTS указывают точную границу modal/dialog задач, сокращая необходимость искать generic UI plumbing в `src/main.js`.


### 2026-09-26 — Menu/context-menu controller extraction

- Refactor: generic lifecycle верхнего меню и context-menu вынесен из `src/main.js` в `src/ui/menu-controller.js`: DOM rendering, enabled-state evaluation, popup positioning, focus restoration, keyboard navigation и outside-click close.
- Architecture: доменные списки команд и editor mutations остаются в `src/main.js`; новый controller получает их через `getItems`/callbacks и не становится вторым source of truth.
- Reliability: async menu actions по-прежнему закрывают popup перед выполнением и выводят ошибку через toast; real `file://` browser smoke продолжает открывать Layer menu и проверять enabled/disabled state.
- Build/tests: bundle graph и architecture regression обновлены на нового канонического владельца menu mechanics.
- Docs/AI: PROJECT, CODEMAP и AGENTS дополнены точной точкой входа для menu/context-menu задач; также очищена повреждённая дублированная строка предыдущей toolbar-записи changelog.


### 2026-09-26 — Toolbar/tooltips controller extraction

- Refactor: toolbar drag/drop, persisted order, exact grid drop-slot и rich tooltip lifecycle вынесены из `src/main.js` в `src/ui/toolbar-controller.js`.
- Architecture: controller владеет только UI-механикой панели; `currentTool` и выбор активного инструмента остаются в `src/main.js`, а чистая grid/order математика остаётся в `src/ui/tool-layout.js`.
- Browser contract: существующий real `file://` smoke продолжает проверять drag в межколоночный gap, DOM order, localStorage и восстановление после reload.
- Docs/tests: architecture/source contracts и AI code map обновлены на нового канонического владельца toolbar lifecycle.
- Regression follow-up: architecture gate теперь проверяет корректную цепочку `main.js → toolbar-controller.js → tool-layout.js`, а не требует старую прямую зависимость `main.js → tool-layout.js`.
- Diagnostics: `tools/browser-smoke.mjs` теперь отдельно распознаёт `appReady="error"` и печатает fatal bootstrap message + browser errors вместо неинформативного timeout.
- Diagnostics follow-up: smoke также останавливается на первом top-level `Runtime.exceptionThrown`, даже если bundle упал до вызова `bootstrap()`.
- Исправлено: toolbar wiring снова использует `$$('.tool')` (querySelectorAll helper); предыдущий scripted replacement интерпретировал `$` как replacement token и случайно оставил одиночный `$`, что ломало bootstrap до запуска editor runtime.

### 2026-09-26 — Workspace/session controller extraction

- Refactor: lifecycle вкладок и document sessions вынесен из `src/main.js` в `src/workspace/session-controller.js`: создание/переключение/закрытие/переименование/дублирование вкладок, per-tab history/zoom/dirty/selection state и smart-object parent/child close guard.
- Architecture: `src/main.js` теперь только связывает controller с live editor state через явные getters/callbacks; document model остаётся в `src/core/state.js`, поэтому новый controller не становится вторым source of truth.
- Tests: добавлен отдельный unit regression для session sync, уникальных имён новых вкладок и Smart Object parent guard; существующий document-tabs contract переведён на нового владельца.
- Docs/AI: AGENTS, PROJECT и CODEMAP указывают `src/workspace/session-controller.js` как каноническую точку для задач по вкладкам/сессиям.
- Regression follow-up: VM/source-contract проверки inactive rename/duplicate и per-document path state переведены со старого `src/main.js` на реальный `createDocumentSessionController`, чтобы тестировать нового владельца поведения, а не прежнее расположение функций.
- Regression follow-up 2: pending-edit tab-switch test теперь вызывает реальный session controller, а recovery contract ищет immediate recovery у нового владельца close-tab lifecycle; старые text-slice зависимости от `main.js` удалены.

### 2026-09-26T00:07:00+03:00 — Архитектурный рефакторинг и AI-friendly карта проекта

- Refactor: чистая UI-конфигурация вынесена из большого `src/main.js` в `src/ui/tool-config.js`; toolbar layout получил канонический путь `src/ui/tool-layout.js`.
- Architecture: PSD/PSB boundary перенесён в канонический `src/formats/psd.js`; старые `src/adapters/psd.js` и `src/core/tool-layout.js` оставлены только как маленькие compatibility shims, чтобы не ломать внешние/старые импорты.
- Build: `tools/build-bundle.mjs` собирает bundle только из канонических модулей; `src/app.bundle.js` синхронизирован с новым source graph.
- Tests: PSD regression-suite читает канонический format module; добавлен architecture regression, который защищает новые границы и не даёт случайно вернуть implementation в legacy paths.
- Docs/AI: `docs/PROJECT.md` превращён в короткую точку входа, подробная прежняя инженерная летопись сохранена в `docs/reference/PROJECT_HISTORY.md`; добавлены code map, boundaries, AI workflow и test matrix для быстрого поиска нужной части проекта с меньшим контекстом.
- Regression follow-up: source-contract тесты теперь проверяют вынесенные UI-константы в `src/ui/tool-config.js`, а legacy shims содержат валидные re-export модули с нормальными переводами строк.


### 2026-09-25T23:11:00+03:00 — Исправлено точное размещение инструментов при перетаскивании

- Исправлено: drop больше не зависит от попадания именно по кнопке инструмента; пустые промежутки и свободные ячейки двухколоночной панели теперь вычисляются как реальные позиции сетки.
- UX: во время перетаскивания показывается отдельная пунктирная ячейка назначения, поэтому заранее видно точное место, куда встанет инструмент.
- Persistence: инструмент вставляется именно в выбранный индекс, после чего новый порядок сразу сохраняется и восстанавливается после перезагрузки.
- Regression: browser smoke теперь синтетически перетаскивает последний инструмент прямо в пустой зазор между первой и второй ячейками, проверяет фактический DOM-порядок, localStorage и восстановление после reload.
- CI follow-up: сохранён прежний source-contract двухколоночной `.toolbar`-декларации, а `position: relative` вынесен отдельным правилом для drop-marker; существующий layout regression снова проверяет тот же UI-инвариант без ложного падения.
- Browser-smoke follow-up: тест gap-drop теперь посылает dragover/drop прямо в контейнер панели с координатой внутри реального межколоночного зазора; это проверяет slot-mapping без зависимости от browser hit-testing SVG/кнопок.
- Browser-smoke viewport: перед двухколоночным gap-drop regression явно устанавливается desktop viewport 1280×900; CI больше не попадает в адаптивный одноколоночный режим при ширине headless-окна 800 px.


### 2026-09-25T22:55:00+03:00 — Настраиваемый порядок инструментов

- UI: любую кнопку инструмента на левой панели теперь можно перетащить в произвольное место среди остальных инструментов; во время drag-and-drop видны состояние перетаскивания и цель вставки.
- Persistence: пользовательский порядок сохраняется в `localStorage` и автоматически восстанавливается при следующих запусках/перезагрузках редактора; неизвестные старые ID отбрасываются, а новые инструменты безопасно добавляются в список.
- Reliability: добавлен чистый helper нормализации/перемещения порядка, unit-regressions и реальный `file://` browser smoke, который проверяет восстановление порядка после reload.


### 2026-09-25T22:34:00+03:00 — Исправлена потеря Photoshop blend modes при PSD/PSB round-trip

- Исправлено: PSD/PSB `sLit`, `hLit`, `diff` и `smud` больше не деградируют в Normal; они сохраняются как Soft Light, Hard Light, Difference и Exclusion при импорте и экспорте.
- Renderer/UI: новые режимы доступны слоям и группам; adjustment layers используют alpha-safe формулы Soft Light / Hard Light / Difference / Exclusion без изменения destination alpha.
- High-depth/CMYK: typed compositors понимают тот же расширенный набор режимов вместо тихого fallback в `source-over`.
- Regression: добавлены PSD+PSB key round-trip, project-sanitizer, 8-bit adjustment и typed RGB/CMYK pixel-level проверки; `src/app.bundle.js` синхронизирован с исходниками.

### 2026-09-25T22:19:00+03:00 — Исправлен Photoshop Hue/Saturation Colorize round-trip

- Исправлено: PSD/PSB `hue2`/`hue ` с включённым Colorize теперь импортируют активную тройку Colorization Hue/Saturation/Lightness вместо неактивных master-полей.
- Renderer: Colorize saturation использует Photoshop-диапазон 0–100; значение 0 больше не превращается ошибочно в 50% насыщенности.
- Native writeback: `rewritePsdAdjustmentBlocks()` синхронизирует Colorize flag и патчит правильные offsets — colorization при Colorize и master при обычном Hue/Saturation, сохраняя неактивную тройку byte-for-byte.
- Regression: добавлены pixel-level Colorize checks и PSD+PSB round-trip через реальный pinned Hue/Saturation fixture.

### 2026-09-25T22:09:00+03:00 — Исправлена прозрачность корректирующих слоёв и checker preview

- Исправлено: корректирующие слои больше не повышают alpha полупрозрачных пикселей при повторном `source-over`; opacity, raster/vector mask и clipping теперь задают только степень цветового эффекта, а исходная alpha сохраняется.
- Blend semantics: alpha-safe compositor поддерживает текущие режимы `source-over`, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge и Color Burn.
- Исправлено: checkerboard прозрачности теперь композится позади уже отрендеренного документа и больше не попадает под adjustment layers или blend operations.
- Regression: добавлены pixel-level проверки semi-transparent alpha/mask coverage и source-contract проверки checker/render boundary; browser bundle пересобирается штатным генератором.

### 2026-09-25T21:57:51+03:00 — Исправлена проверка проекта после клонирования на Windows

- Исправлено: текстовые файлы проекта сохраняют LF при checkout даже с `core.autocrlf=true`; для `start.bat` сохранён CRLF.
- Проверено: `npm run check` — 391 тест пройден в LF-копии; выборочная проверка падения теста в CRLF-копии установила причину.


## 1.42.0 — 2026-09-25

### 2026-09-25 — Native Invert / Posterize / Threshold Adjustment Layers Stage 16c

- PSD/PSB parser: allow-list adjustment records расширен `nvrt`, `post`, `thrs`; zero-bounds Invert, Posterize и Threshold теперь попадают в semantic adjustment stack.
- Semantic model: Invert не имеет параметров; Posterize ограничен Photoshop-диапазоном 2–255 levels, Threshold — 1–255.
- Renderer: Invert инвертирует RGB с сохранением alpha; Posterize использует Photoshop-compatible 8-bit quantization; Threshold использует RGB luminance 0.30/0.59/0.11 и не меняет alpha.
- Properties: Posterize и Threshold редактируются численно, Invert явно показывается как parameterless adjustment; masks/clipping остаются общими Stage 16b controls.
- Native writeback: `post` и `thrs` patch-ят только big-endian 16-bit payload, `nvrt` сохраняется byte-identical; unsupported metadata по-прежнему fail-safe уходит в composite fallback.
- Project persistence: `.zpe` sanitizer allow-list синхронизирован с новыми adjustment kinds и native block keys.
- Regression: semantic pixel tests, .zpe persistence и synthetic native PSD+PSB round-trip проверяют все три новых adjustment records без внешней сети.
- Upstream format oracle: структуры подтверждены по pinned MIT `psd-tools` commit `8f9a25ea98202061365701db54ce938931b27c09`.
- CI follow-up: Stage 16a source-wiring regression синхронизирован с расширенным `nvrt/post/thrs` allow-list; runtime assertions не ослаблены.
- Version: приложение синхронизировано на 1.42.0.

## 1.41.0 — 2026-09-25

### 2026-09-25 — Adjustment Masks, Curves/Levels UI & Clipping Semantics Stage 16b

- PSD parser: layer-record clipping byte больше не отбрасывается; `clipping` сохраняется у bitmap/fill/adjustment layers.
- Adjustment raster masks: zero-bounds adjustment channel `-2` декодируется на document-size mask canvas с правильными absolute/relative bounds, default color и invert semantics.
- Native mask writer: adjustment PSD/PSB export пишет реальный `-2` channel и Layer Mask Data rectangle вместо прежнего forced `mask:null`; document-sized alpha переживает round-trip.
- Clipping renderer: clipped adjustment пересекает результат alpha нижележащего base layer в том же sibling stack, включая собственные raster/vector masks.
- Clipping writer: PSD/PSB layer record пишет Photoshop clipping byte; импортированные ordinary layers также сохраняют этот metadata flag.
- Levels UI/writeback: Properties редактирует Master, Red, Green и Blue input/output/gamma; `levl` writer patch-ит соответствующие 10-byte records, сохраняя остальные 29 records/extra bytes.
- Curves UI/writeback: Properties принимает 2–19 point pairs `input:output`; point-based version-1 `curv` writer bounded-пересобирает channel bitmap, point records и `Crv ` extra marker. Неизменённые curves blocks остаются byte-identical.
- Fail-safe: map-based/unknown Curves layout, invalid points, unsupported style/filter semantics по-прежнему переводят export в честный composite fallback вместо stale metadata.
- Real compatibility corpus: добавлены MIT fixtures `adjustment-mask.psd`, `clip-adjustment.psd`, `curves-rgb.psd`, `levels-rgb.psd` с pinned upstream commit/blob/size/SHA-256.
- Regression: mask/clipping проходят PSD+PSB round-trip; channel-specific Green Levels и edited real Curves повторно декодируются с изменёнными semantic values.
- CI follow-up: render-pipeline wiring regression обновлён под новый `clippingMask` argument и продолжает проверять cumulative adjustment semantics вместо точной старой сигнатуры вызова.
- Version: приложение синхронизировано на 1.41.0.

## 1.40.0 — 2026-09-25

### 2026-09-25 — Photoshop-native Adjustment Layer Mapping Stage 16a

- PSD parser: allow-list Additional Layer Info расширен `brit`, `CgEd`, `expA`, `hue2`/`hue `, `levl`, `curv`; zero-bounds adjustment records больше не теряются как пустые layers.
- Semantic model: новый `src/core/adjustments.js` нормализует Brightness/Contrast, Exposure, Hue/Saturation, master/channel Levels и Curves channel points и применяет их к нижележащему RGBA composite.
- Real stack import: decoder возвращает `adjustmentLayers` со `stackIndex`, raw blocks, group/vector-mask metadata и channel ids; main объединяет их с bitmap stack и создаёт настоящие ZPE adjustment layers.
- Editable controls: Properties получили kind-specific numeric controls для Brightness/Contrast, Exposure, Hue/Saturation и master Levels; Curves показывает сохранённые channel points в read-only foundation.
- Native writeback: `rewritePsdAdjustmentBlocks()` bounded-патчит CgEd/brit brightness+contrast, `expA` float32 exposure/offset/gamma, `hue2` master H/S/L и `levl` master record. Unknown bytes сохраняются.
- Native writer: поддержанный adjustment экспортируется как настоящий zero-bounds PSD/PSB layer с исходными channel ids и Additional Layer Info вместо raster layer.
- Safe fallback: raster adjustment mask, ZPE post-filters, неподдержанный metadata contract или изменённые Curves points не получают stale native metadata и переходят через существующий Composite Preview fallback.
- Masks: semantic adjustment renderer применяет и raster mask, и document-space vector mask к adjustment result.
- Real compatibility corpus: добавлены пять pinned MIT `psd-tools` fixtures (Brightness/Contrast, Exposure, Hue/Saturation, Levels, Curves) с commit/blob/size/SHA-256 manifest.
- Regression: реальные records декодируются в semantic model; editable parameters повторно декодируются после PSD и PSB writeback; Curves unchanged block остаётся byte-identical.
- CI follow-up: Stage 8a group-import wiring regression расширен на новый `adjustmentLayers` collection и проверяет объединённый group-key source stack без зависимости от прежней формы `parsed.layers`.
- Version: приложение синхронизировано на 1.40.0.

## 1.39.0 — 2026-09-25

### 2026-09-25 — Shape Descriptor Rewrite + Gradient/Pattern Fill Foundation Stage 15d

- Solid descriptor rewrite: добавлен `rewritePsdShapeStyle()`, который копирует source blocks и bounded-патчит только известные leaves вместо полной сериализации Photoshop ActionDescriptor.
- Fill edit: `SoCo` и `vscg/SoCo` RGB `Rd/Grn/Bl` doubles теперь переписываются из текущего ZPE `#RRGGBB`.
- Stroke edit: `vstk` обновляет `strokeEnabled`, `fillEnabled`, `strokeStyleLineWidth` и nested RGB stroke content; прозрачный fill/stroke переводится через enable flags.
- Safe native gate: fill/stroke/strokeWidth edits больше не требуют raster fallback, если исходный solid descriptor contract совместим; unsupported descriptor structure по-прежнему fail-safe переводит layer в preview.
- Gradient foundation: `GdFl` parser извлекает angle/type, gradient name/form/smoothness, до 64 RGB color stops и transparency stops с bounded metadata.
- Pattern foundation: `PtFl` parser извлекает pattern name/id, scale и linked policy.
- Zero-bounds fill layers: Gradient/Pattern Fill records больше не теряются полностью — adapter возвращает их в `fillLayers`, при этом canvas честно использует PSD composite preview до semantic renderer.
- Real compatibility fixtures: добавлены pinned MIT `psd-tools` minimal Gradient Fill и Pattern Fill PSD с size/SHA-256 provenance.
- Regression: real solid Shape fixture проходит PSD + PSB after fill=`#112233`, stroke=`#445566`, width=3.5; source descriptor blocks не мутируются.
- CI follow-up: Stage 8a group wiring regression допускает новый `fillLayers` return field между `layers` и `groups`, не ослабляя проверку group/import contract.
- Version: приложение синхронизировано на 1.39.0.

## 1.38.0 — 2026-09-25

### 2026-09-25 — Photoshop-native Shape / Vector Fill Mapping Stage 15c

- Shape metadata parser: PSD/PSB layer Additional Info теперь bounded-сохраняет `SoCo`, `vscg` и `vstk` blocks.
- Solid fill semantics: ActionDescriptor RGB `Clr ` переводится в ZPE hex fill; `vscg` subtype проверяется и Stage 15c принимает только `SoCo`.
- Stroke semantics: `vstk` parser извлекает stroke/fill enabled flags, line width, solid RGB stroke, opacity, cap, join и alignment.
- Editable import: single closed/add Photoshop vector-mask subpath импортируется как ZPE `shape:'path'` с текущими Bezier/corner anchors, fill и stroke вместо обычного raster layer.
- Native writer: `vscg/SoCo` и `vstk` descriptor bytes сохраняются opaque byte-for-byte, а `vmsk` vector path пересобирается из текущей ZPE geometry.
- Safe path editing: move и path-anchor edits остаются native; width/height resize, scale/rotation, fill/stroke edit, filters или layer styles переводят export в raster fallback, чтобы не создавать несогласованные Photoshop descriptors.
- Project persistence: `.zpe` sanitizer allow-list-ит только `SoCo/vscg/vstk`, bounded octet-stream payload и semantic baseline.
- Real compatibility fixture: добавлен MIT `psd-tools` `layers/shape-layer.psd`; regression фиксирует cyan `#00ffff` fill, magenta `#ff00ff` 1px stroke, 5-point polygon и PSD/PSB vector rewrite.
- CI follow-up: Stage 10 vector-mask wiring regression обновлён под semantic shape mapping — обычные layers по-прежнему импортируют/export vector masks, а native Photoshop shape использует path geometry как authoritative source без двойного mask application.
- UI: Properties показывает Photoshop Shape native round-trip / raster fallback status.
- Version: приложение синхронизировано на 1.38.0.

## 1.37.0 — 2026-09-25

### 2026-09-25 — Photoshop EngineData Typography & Editable Text Writeback Stage 15b

- EngineData parser: добавлен bounded parser Photoshop text-engine grammar (`<< >>`, arrays, properties, UTF-16 strings, numbers, booleans) без внешнего runtime.
- Typography mapping: `StyleRun`, `ParagraphRun` и `ResourceDict/FontSet` дают font name/family, font size, faux bold/italic, RGB fill, alignment, leading, tracking, underline/strike-through и run lengths.
- Real import fidelity: внешний `type-layer.psd` теперь импортируется как ArialMT/Arial 30 pt, красный, centered, tracking 15 / letterSpacing 0.45 и line-height 1.75 вместо generic Arial/black heuristic.
- Editable native text: single-style/single-paragraph-run content edit переписывает одновременно TySh descriptor `Txt ` и EngineData `/Editor /Text`.
- Run-length integrity: StyleRun и ParagraphRun `RunLengthArray` обновляются по UTF-16 code-unit length с обязательным Photoshop terminal CR; multiline `Hello\nWorld` получает run length 12.
- Transform compatibility: content writeback можно совмещать с Stage 15a affine `tx/ty` move rewrite в одном TySh block.
- Safe fallback: multi-run text и изменения typography/scale/rotation/box geometry не получают stale native metadata и продолжают экспортироваться raster preview.
- Project persistence: normalized EngineData typography summary сохраняется bounded в `.zpe`; исходный TySh остаётся authoritative opaque payload.
- Regression: реальный MIT `psd-tools` fixture проверяет EngineData oracle, text edit, font/style/paragraph preservation и повторный PSD + PSB decode.
- CI follow-up: README startup marker синхронизирован с `package.json`/meta version, чтобы version-consistency gate снова проверял один публичный current version.
- Version: приложение синхронизировано на 1.37.0.

## 1.36.0 — 2026-09-25

### 2026-09-25 — Photoshop-native Text Layer Mapping Stage 15a

- TySh parser: bounded Additional Layer Info parser распознаёт Photoshop `TySh` и TypeToolObjectSetting v1 / text descriptor v50 без внешнего runtime.
- Typed semantics: импортируются text value, 6-value affine transform, horizontal/vertical orientation id, anti-alias id, descriptor class/keys, warp class/version и TypeTool bounds.
- Editable import: horizontal Photoshop Type Layer создаётся как настоящий ZPE `text` layer вместо обычного raster layer; исходный TySh block сохраняется отдельно в `.zpe`.
- Safe project persistence: sanitizer allow-list-ит только `TySh`, bounded octet-stream payload и нормализованный semantic baseline.
- Native writer: PSD/PSB layer writer возвращает сохранённый `TySh` block; перемещение поддержанного текста переписывает только affine translation `tx/ty`, сохраняя остальные descriptor bytes.
- Honest fallback: text content, typography, width/height, scale или rotation edits пока отключают native text passthrough, потому что Photoshop `EngineData` run/style/paragraph writeback ещё не реализован.
- Vertical text: `Vrtc` пока не маскируется под horizontal ZPE text и остаётся raster preview.
- Real compatibility fixture: добавлен MIT `psd-tools` `type-layer.psd`; regression фиксирует `A`, transform `(1,0,0,1,0,4.978787...)`, descriptor metadata и PSD/PSB TySh round-trip.
- UI: Properties показывает состояние Photoshop Text native round-trip / raster fallback.
- Version: приложение синхронизировано на 1.36.0.

## 1.35.0 — 2026-09-25

### 2026-09-25 — Smart Object Embedded Asset Rewrite & Resource Rebuild Stage 14c

- Native liFD rewrite: добавлен bounded `rewriteEmbeddedLinkedLayerAsset()`, который находит embedded Linked Layer record по UUID и меняет только payload, 64-bit `datasize`, record length и padding.
- Non-destructive neighbors: другие `lnk2/lnkD/lnkE` records и внешние `liFE` links остаются нетронутыми; helper не мутирует caller-owned source blocks.
- Editable PNG: изменённый embedded PNG content сериализуется обратно в PNG и записывается в исходный Photoshop Smart Object resource.
- Editable PSD/PSB: extracted nested PSD/PSB можно пересобрать через существующий PSD/PSB writer и вернуть в `liFD` при соблюдении bounded pixel/layer/size limits.
- Shared Photoshop identity: несколько Smart Object layers с одинаковым Photoshop UUID открывают один source-content session и обновляются как один источник.
- Placement correctness: Photoshop placed-layer width/height больше не заменяются intrinsic размером embedded document при Ctrl+S; placement и content dimensions разделены.
- Round-trip gate: после успешного resource rewrite обновляются preview/content fingerprints и asset datasize, поэтому native passthrough остаётся допустимым; изменение intrinsic content size или unsupported payload сохраняют честный raster fallback.
- UI/UX safety: обычная ZPE linked-copy отключена для imported Photoshop Smart Objects, чтобы не создавать дубли с неконсистентной native UUID/resource семантикой.
- Regression: реальный MIT Smart Object fixture проверяет замену `liFD` payload, сохранение UUID, соседнего `lnkE` block и повторный PSD decode.
- CI follow-up: wiring-regressions Stage 11/14 и PSD export import-check теперь проверяют пользовательский contract и допускают расширенный Photoshop source identity/import surface вместо хрупкой зависимости от точной строки реализации.
- Version: приложение синхронизировано на 1.35.0.

## 1.34.0 — 2026-09-25

### 2026-09-25 — Smart Object Descriptor & Embedded Asset Extraction Stage 14b

- ActionDescriptor foundation: bounded parser читает Smart Object `SoLd/SoLE` DescriptorBlock и безопасно обрабатывает standard OSType primitives/lists/nested descriptors/reference values с depth/item/string limits.
- Placed metadata: `PlLd` теперь извлекает Photoshop 8-point transform, version и unique id; `SoLd/SoLE` typed summary сохраняет `Idnt`, resolution, class и descriptor keys.
- Linked Layer records: `lnk2/lnkD/lnkE` разбираются в `liFD` (embedded data), `liFE` (external) и alias records с UUID, filename, filetype, datasize/filesize, child id и cached data.
- Asset detection: payload type определяется по stored Photoshop filetype, magic bytes и только затем filename extension; PNG/JPEG/WebP/GIF/BMP и PSD/PSB распознаются без выполнения содержимого.
- Editable embedded content: supported embedded bitmap становится обычным nested ZPE document; embedded PSD/PSB декодируется в bounded nested raster/group document. Content-tab использует существующий Smart Object editor workflow.
- External-link safety: пути `fullPath/relPath` из Photoshop descriptors не открываются автоматически и не дают PSD доступ к локальной файловой системе.
- Round-trip invariant: неизменённый extracted embedded document сохраняет Stage 14a byte-for-byte native metadata/resource passthrough; после content edit preview/fingerprint меняется и native passthrough отключается до resource rewrite Stage 14c.
- Real fixture expansion: MIT `psd-tools-placedLayer.psd` добавляет одновременно embedded PNG и external PNG/PSD Smart Objects; regression проверяет typed UUID matching и отсутствие filesystem resolution.
- CI follow-up: external `liFE` records с `datasize=0` теперь имеют `data=null`, а не пустой `Uint8Array`, чтобы typed model отличал отсутствие cached payload от реально embedded zero-byte data.
- Version: приложение синхронизировано на 1.34.0.

## 1.33.0 — 2026-09-25

### 2026-09-25 — Photoshop-native Smart Objects / Placed Layer Round-trip Stage 14a

- PSD/PSB parser: layer Additional Layer Info теперь bounded-сохраняет `PlLd`, `SoLd` и `SoLE`; document Layer/Mask Additional Info сохраняет `lnk2`, `lnkD`, `lnkE`.
- Placed Layer identity: `PlLd` foundation читает `plcL` version и unique id, не пытаясь угадать неподдержанные proprietary descriptor fields.
- Import semantics: Photoshop Smart Object больше не становится обычным raster-layer — ZPE создаёт `smart-object` с lossless PNG preview и отдельным opaque Photoshop metadata payload.
- Project persistence: `.zpe` sanitizer allow-list-ит только Smart Object / Linked Layer keys, проверяет MIME/data URL contract и bounded limits; document хранит исходное число imported Photoshop Smart Objects.
- Safe passthrough gate: native metadata записывается обратно только если imported preview, geometry, transform и effect/filter state не изменены и исходный набор Photoshop Smart Objects сохранён.
- Honest fallback: после move/scale/rotate/filter/preview edit, удаления/дублирования исходного Photoshop Smart Object или повреждения linked resources export растрирует preview и не пишет stale placed/linked metadata.
- PSD/PSB writer: opaque Smart Object blocks и linked resources сохраняются byte-for-byte; PSB учитывает `8B64`/64-bit length contracts для linked-layer keys.
- Real compatibility fixture: добавлен MIT `psd-tools` Smart Object PSD с настоящими `PlLd + SoLd + lnk2/lnkE`; regression покрывает decode и повторный PSD + PSB round-trip.
- UI: Properties показывает Photoshop Smart Object kind/id и состояние native round-trip; редактирование opaque embedded payload не маскируется под уже поддержанное.
- Version: приложение синхронизировано на 1.33.0.

## 1.32.0 — 2026-09-25

### 2026-09-25 — Real ICC / Photoshop Compatibility Corpus Stage 13e

- Real ICC corpus: добавлены закреплённые CC0 profiles `CGATS001Compat-v2-micro.icc` и `DisplayP3-v4.icc` из `saucecontrol/Compact-ICC-Profiles` с upstream commit/blob, SHA-256 и полным CC0 notice.
- Independent oracle: golden vectors сгенерированы Pillow 12.3.0 / LittleCMS 2.19 и проверяют Perceptual CMYK→PCS Lab/XYZ, sRGB и Display P3; expected values больше не вычисляются кодом ZPE.
- PCS diagnostics: color-management core экспортирует `createCmykToPcsTransform()`, возвращающий managed XYZ D50 + Lab values из того же profile transform contract, что используется display/proof pipeline.
- Real PSD fixture: MIT `psd-tools` 4×4 CMYK PSD с реальным ~557 КБ printer ICC декодируется в native CMYK PixelBuffer, проходит profile-managed Display-P3 preview и ZPE native raster/profile PSD round-trip без изменения ICC bytes.
- Real PSB fixture: внешний layered PSB v2 проверяет группы, pass-through semantics, vector/raster mask presence и embedded RGB ICC на независимом контейнере, не созданном writer-ом ZPE.
- Hermeticity: CI не скачивает fixtures и не зависит от сети; `corpus-manifest.json` проверяет размер + SHA-256 каждого бинарного fixture.
- Maintenance: добавлен `tools/generate-icc-goldens.py` для осознанной регенерации reference vectors; в CI он не запускается, чтобы update oracle не мог маскировать regression.
- Third-party hygiene: лицензии и provenance corpus лежат рядом с fixtures.
- Version: приложение синхронизировано на 1.32.0.

## 1.31.0 — 2026-09-25

### 2026-09-25 — Production Color Proofing & Display Profiles Stage 13d

- Display ICC: `.zpe` хранит отдельный bounded RGB `displayProfile`; CMYK preview больше не ограничен только встроенной sRGB policy.
- Monitor/display transform: ICC core поддерживает PCS→RGB output LUT/MPE и типичный display matrix/TRC contract `rXYZ/gXYZ/bXYZ + rTRC/gTRC/bTRC`, включая inverse TRC, invertible matrix validation и signed XYZ colorants.
- Proof setup: source rendering intent и proof rendering intent разделены; soft proof сохраняет BPC и проходит source CMYK → PCS → proof CMYK → PCS → selected display ICC.
- Gamut Warning: добавлен magenta overlay с bounded ΔE threshold; proof/display round-trip проверяется отдельно от canonical CMYK source и не меняет native channels.
- UI: CMYK inspector получил загрузку/удаление display ICC, отдельный Proof Intent, Gamut Warning и ΔE threshold; sRGB остаётся явным fallback.
- Import: новый CMYK PSD/PSB использует текущие display/proof settings уже при построении первого preview и переносит proof/display setup в новый документ без смешивания с embedded source ICC.
- Compatibility regression: synthetic production-like Display-P3 v4 matrix/parametric-TRC structure, gamut overlay и byte-for-byte preservation embedded ICC resource 1039 при native CMYK PSD round-trip.
- CI follow-up: unmanaged Device-CMYK fallback больше не проходит лишний sRGB→XYZ→sRGB round-trip без display ICC, поэтому сохраняет прежние точные fallback samples и не создаёт микроскопический numerical drift.
- Browser boundary: application-level display ICC симулирует target device RGB, но финальную физическую monitor calibration по-прежнему выполняют browser/OS compositor.
- Version: приложение синхронизировано на 1.31.0.

### 2026-09-25 — Native CMYK Editing + Full Proofing Path Stage 13c

- Native CMYK editing: Brush, Eraser, Fill, Clear и Line теперь изменяют canonical 4/5-channel CMYK PixelBuffer напрямую и сохраняют исходную 8/16/32-bit channel precision вместо растрирования display preview в RGB.
- CMYK retouch: Blur, Clone, Healing, Smudge, Dodge и Burn работают в typed ink-space с selection/stroke-coverage semantics; Clone/Heal используют immutable source snapshot, Dodge уменьшает C/M/Y/K ink density, а Burn добавляет нейтральное затемнение через K без RGB rasterization.
- CMYK compositing: compositeCmykPixelBufferLayers() поддерживает компонентные Normal/Multiply/Screen/Overlay/Darken/Lighten/Color Dodge/Color Burn semantics, layer opacity и bitmap masks без RGB round-trip.
- ICC MPE: multiProcessElementsType дополнен cvst/curf curve-set parsing с formula/sample segments и bounded validation; device→PCS и PCS→device MPE теперь явно проверяют channel contracts.
- ICC output transforms: добавлены B2D*/B2A*, lutBToAType (mBA) и profile-managed sRGB→CMYK conversion для цветов кисти в native ink-space.
- Soft proof: документ хранит отдельный bounded CMYK proof profile, переключатель soft proof, rendering intent и Black Point Compensation; preview строится по profile-to-profile path source CMYK → PCS → proof CMYK → PCS → sRGB.
- UI: CMYK inspector получил proof ICC upload/remove, soft-proof toggle и BPC toggle; canonical CMYK source остаётся неизменяемым при смене proof/display policy.
- Persistence: .zpe sanitizer сохраняет proofProfile, softProofEnabled и blackPointCompensation, не смешивая proof profile с source ICC.
- Regression coverage: добавлены synthetic cvst, mBA, B2D/D2B profile-to-profile tests, native CMYK brush/fill/clear/line/retouch tests и component blend regressions.
- CI follow-up: Float32 clone snapshot regression сравнивает snapshot с его фактическими Float32 samples, а не с double-precision literals; это сохраняет oracle «source immutable» без ложного падения на IEEE-754 rounding.


## 1.30.0 — 2026-09-25

### 2026-09-25 — Advanced ICC + Native CMYK Round-trip Stage 13b

- ICC v4: `color-management.js` получил `lutAToBType (mAB )` с embedded `curveType`/`parametricCurveType`, A→CLUT→M→Matrix→B sequence и проверкой offsets/bounds/grid sizes.
- ICC MPE: добавлен `multiProcessElementsType (mpet)` для `D2B0..D2B3`; поддерживаются float `clut`, `matf` и pass-through `bACS/eACS`. Неизвестные элементы fail-safe переводят profile transform в явный unmanaged fallback.
- Rendering policy: `.zpe` хранит sanitized `renderingIntent` (`perceptual`, `relative`, `saturation`, `absolute`) и `displaySpace=srgb`.
- UI: CMYK inspector позволяет менять rendering intent; display preview всех CMYK source пересчитывается из canonical PixelBuffer + embedded ICC без изменения native samples.
- Native writer: PSD/PSB writer получил `colorMode='cmyk'|4`, header color mode 4 и layer/composite channels C/M/Y/K/alpha; внутренний ink-space при записи инвертируется обратно в Photoshop CMYK storage.
- Precision: native CMYK writer поддерживает 8/16/32-bit PixelBuffer; 8-bit использует row-bounded PackBits, 16/32-bit — Raw big-endian и существующие `Lr16/Lr32`/`8B64` structures.
- Native composite: `compositeCmykPixelBufferLayers()` собирает 5-channel CMYK+alpha source-over composite с layer opacity, position и bitmap mask coverage без RGB conversion; allocation ограничен 256 МБ.
- Compatibility gate: mixed RGB/CMYK, text/shape, adjustment layers, active vector masks, isolated groups, non-transparent RGB background и видимый non-Normal blend оставляют RGB display-preview export и дают причину fallback.
- ICC round-trip: embedded profile resource 1039 сохраняется вместе с native CMYK channels; экранный preview остаётся sRGB display conversion и не объявляется press proof.
- Regression tests: synthetic `mAB`, float `D2B0/mpet`, intent fallback, display policy, typed CMYK composite и native CMYK PSD/PSB 8/16-bit writer round-trip.
- CI follow-up: export UI integration test обновлён под новые явные `RGB/CMYK` подписи PSD/PSB, чтобы проверять актуальный пользовательский contract вместо устаревшего текста.
- Version: приложение синхронизировано на 1.30.0.

## 1.29.0 — 2026-09-25

### 2026-09-25 — CMYK / ICC Preview Foundation Stage 13a

- PSD/PSB import: разрешён CMYK color mode `4` для 8/16/32-bit/channel рядом с существующим RGB path; четыре color channels больше не интерпретируются как RGB+alpha.
- CMYK storage: Photoshop-inverted CMYK samples декодируются в нормализованный внутренний ink-space (`0` = нет краски, максимум = полная краска), optional transparency остаётся отдельным straight-alpha channel.
- PixelBuffer: layered и merged CMYK данные представлены как 4/5-channel `cmyk` PixelBuffer и могут сохраняться canonical `.zpe` source без потери исходной channel precision.
- ICC engine: добавлен dependency-free `src/core/color-management.js` с безопасным ICC header/tag-table parser, `A2B0/A2B1/A2B2`, `mft1`/`mft2`, 4D multilinear CLUT interpolation и PCS Lab/XYZ → D50→D65 → sRGB display conversion.
- Fallback semantics: отсутствие/повреждение ICC либо unsupported `mAB`/MPE не маскируются под color-managed результат — importer использует явный Device-CMYK approximation и добавляет warning, что preview не является press proof.
- UI/import: CMYK layer/composite preview создаётся через один выбранный transform на документ; inspector показывает сохранённый CMYK source отдельно от HDR controls.
- Edit boundary: RGB typed editing primitives больше не пытаются мутировать CMYK PixelBuffer; destructive edit безопасно переходит через существующий RGB raster-preview boundary и снимает stale native source.
- Export honesty: текущий PSD/PSB writer остаётся RGB; наличие сохранённого CMYK source даёт отдельный Stage 13a warning и экспортирует display preview вместо ложного native CMYK round-trip.
- Persistence: CMYK source сохраняется даже для 8-bit документов в пределах существующего 48 МБ raw budget; sanitizer не прикрепляет к CMYK HDR tone-map settings.
- Tests: добавлены synthetic CMYK PSD layer/composite fixtures, channel inversion checks, synthetic CMYK→Lab `A2B0/mft1` ICC profile, managed preview, explicit fallback и alpha regressions.
- CI regression fix: layer decoder сохраняет channel id `3` как K для CMYK documents; high-depth persistence test проверяет invariant очистки `highDepthSource + highDepthPreview`, а не UI-текст.
- Version: приложение синхронизировано на 1.29.0.

## 1.28.0 — 2026-09-25

### 2026-09-25 — High-depth Multi-layer Composite / Export Bridge Stage 12g

- Typed composite core: `compositePixelBufferLayers()` собирает positioned RGB 8/16/32-bit sources напрямую в 16/32-bit RGBA PixelBuffer с straight-alpha source-over math и bounded allocation.
- Blend semantics: Normal, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge и Color Burn выполняются до PSD/PSB merged-image serialization; layer opacity и bitmap-mask alpha участвуют в том же typed equation.
- HDR/color space: 32-bit merged output работает в `linear-rgb-unmanaged`; sRGB 8/16-bit sources переводятся в linear перед blend, поэтому native Float32 highlights выше `1.0` не проходят через tone-map/Canvas8.
- Mixed stacks: rasterized 8-bit text/shape/transform/filter/style previews могут быть честно widened внутрь high-depth composite рядом с native layers; их собственная precision не выдумывается.
- Groups: pass-through группы с opacity 100% разворачиваются в порядке, совпадающем с document group render plan. Isolated group blend/opacity пока честно переключает только merged composite на Canvas8 fallback.
- Masks/fallback: bitmap masks поддерживаются в typed path; vector masks и adjustment layers пока используют explicit Canvas8 merged fallback, сохраняя существующую визуальную корректность без ложных claims.
- Memory: merged typed output ограничен 256 МБ; превышение budget не приводит к неограниченной allocation и переводит merged image на существующий Canvas8 fallback с warning.
- Export: при успешном Stage 12g `preparePsdExport()` вообще не вызывает Canvas renderer для merged image и передаёт `compositePixelBuffer` writer-у напрямую.
- Tests: добавлены 16-bit non-quantization, Float32 HDR blend, sRGB→linear mixed-depth conversion, positioned mask/opacity и allocation-bound regressions плюс export wiring checks.
- Version: приложение синхронизировано на 1.28.0.

## 1.27.0 — 2026-09-25

### 2026-09-25 — Typed High-depth Retouch Stage 12f

- Retouch core: добавлены typed PixelBuffer primitives для Dodge/Burn, Blur, Clone/Healing и Smudge; они работают с RGB 8/16/32-bit buffers без Canvas8 round-trip.
- HDR tone tools: Dodge/Burn меняют экспозицию в linear working space; Float32 highlights выше `1.0` сохраняются и могут дальше усиливаться/ослабляться, alpha не меняется.
- Blur: локальное alpha-weighted усреднение выполняется в linear RGB для sRGB sources, затем записывается обратно в исходную bit depth; overlapping dabs ограничиваются stroke coverage, как и старый Canvas8 path.
- Clone/Healing: Clone берёт immutable typed snapshot в начале штриха и использует bilinear sampling; Healing дополнительно адаптирует source texture к локальному destination color/luminance, не клипуя Float32 HDR.
- Smudge: переносит typed samples по направлению движения кисти и смешивает их source-over с feathered high-depth brush falloff.
- UI integration: blur/clone/heal/smudge/dodge/burn теперь входят в общий native high-depth paint state, используют selection predicate, RAF-batched tone-mapped preview и сохраняют обновлённый `highDepthSource` после commit.
- Compatibility: 8-bit retouch pipeline остаётся fallback для обычных raster layers; high-depth Alt+click clone-source больше не требует предварительной Canvas materialization.
- Tests: добавлены HDR dodge/burn, 16-bit blur non-quantization, immutable HDR clone, healing, smudge, serialization и UI-routing regression tests.
- Version: приложение синхронизировано на 1.27.0.

## 1.26.0 — 2026-09-25

### 2026-09-25 — Native 16/32-bit PSD/PSB Export Stage 12e

- Writer depth: `encodePsd*` / `encodePsb*` получили `bitsPerChannel=8|16|32` и `pixelBuffer`/`compositePixelBuffer` inputs; header depth больше не захардкожен в 8-bit.
- Photoshop structure: 16/32-bit layered documents пишут ordinary Layer Info как пустой и размещают layer-info body в `Lr16` / `Lr32`; PSB использует `8B64` + 64-bit tagged-block length.
- Channels: native 16-bit `Uint16` и 32-bit `Float32` RGB/alpha сериализуются Raw в big-endian sample order; Float32 значения вне `0..1` не клипуются. 8-bit writer сохраняет существующий row-bounded PackBits/RLE path.
- Decoder: high-depth import теперь также читает Photoshop-style document-level `Lr16/Lr32`, сохраняя совместимость со старыми ordinary-layer-info fixtures.
- Mixed documents: RGBA8 fallback layers и masks расширяются до выбранной document depth; это widening, а не восстановление precision, и UI добавляет явный warning.
- Export planner: identity raster layer с валидным high-depth source идёт в writer напрямую; transform/filter/style path остаётся raster-preview fallback. Один full-canvas native high-depth layer может дать точный typed composite, сложный merged composite остаётся Canvas8-derived с warning.
- Tests: добавлены exact 16-bit PSD round-trip, Float32 HDR PSB round-trip, `Lr16/Lr32`/`8B64` structure checks, high-depth mask и mixed-depth widening contracts.
- Version: приложение синхронизировано на 1.26.0.

## 1.25.0 — 2026-09-25

### 2026-09-25 — Native High-depth Editing Foundation Stage 12d

- PixelBuffer editing: добавлены clone/alpha-upgrade, source-over brush dab/stroke, typed flood fill и alpha clear для RGB 8/16/32-bit buffers без промежуточного RGBA8 round-trip.
- Precision: 16-bit операции записывают `Uint16` samples напрямую; Float32 editing не клипует RGB к `0..1`, поэтому HDR headroom сохраняется при кисти/линии/заливке.
- Brush/Eraser: high-depth raster использует отдельный working PixelBuffer; preview перестраивается максимум один раз на animation frame, commit сериализует обновлённый source обратно в `.zpe`.
- Fill/Line/Clear: заливка, линия, очистка выделения и cut/clear across visible layers получили native high-depth mutation path; selection predicate применяется в координатах слоя.
- Alpha: RGB source без alpha расширяется до straight RGBA только когда операция действительно требует прозрачности; если расширение превышает общий 48 МБ high-depth budget, сохраняется прежний безопасный Canvas8 fallback.
- Render bridge: paint-preview override умеет `skipAdjustments`, чтобы уже high-depth-corrected preview не проходил повторно через legacy RGBA8 color pass.
- Scope: blur/clone/heal/smudge/dodge/burn пока остаются Canvas8 fallback и при commit могут снять high-depth source; это явно оставлено на следующий typed-retouch этап.
- Tests: добавлены 16-bit non-quantization, Float32 HDR headroom, alpha upgrade/eraser, typed flood fill, selection clear и UI/render wiring regression contracts.
- Version: приложение синхронизировано на 1.25.0.

## 1.24.0 — 2026-09-25

### 2026-09-25 — HDR Preview Controls Stage 12c

- UX: high-depth raster Properties получили `Tone map` с режимами Auto / Clip / ACES и отдельный `Display exposure` от −6 до +6 EV плюс быстрый reset.
- State: добавлен sanitized `highDepthPreview`; настройки сохраняются только рядом с валидным `highDepthSource`, неизвестные tone-map значения откатываются в Auto, EV ограничивается безопасным диапазоном.
- Render: tone-map mode и display exposure входят в cache signature; изменение display controls переиспользует уже декодированный typed PixelBuffer и перестраивает только preview canvas.
- HDR semantics: Auto выбирает ACES для 32-bit float и Clip для 16-bit; display exposure применяется после non-destructive high-depth color controls и до tone mapping.
- Destructive boundary: brush/fill/erase/clear/cut материализуют текущий выбранный HDR display preview, после чего `highDepthSource` и `highDepthPreview` очищаются вместе, исключая stale metadata.
- Tests: добавлены persistence/clamping, Auto-mode resolution, Clip-vs-ACES highlight behavior, display-EV response, UI/cache wiring и destructive-boundary contracts.
- Version: приложение синхронизировано на 1.24.0.

## 1.23.0 — 2026-09-25

### 2026-09-25 — High-depth Render Bridge Stage 12b

- Render: raster layer с `highDepthSource` предпочитает сохранённый typed source вместо clipped RGBA8 fallback и только после high-depth corrections строит Canvas preview.
- Color: exposure, gamma, temperature/tint, vibrance, highlights и shadows вычисляются над normalized `Uint16Array`/`Float32Array`; исходный source не мутируется.
- HDR: 32-bit linear RGB использует ACES-style tone map и linear→sRGB display conversion; 16-bit sRGB проходит linearized correction и clip display bridge.
- Performance: renderer держит bounded cache максимум двух декодированных high-depth layer sources и переиспользует typed buffer при изменении filter signature.
- Editing boundary: destructive brush/fill/erase/clear/cut начинает с neutral tone-mapped high-depth base, после публикации 8-bit PNG существующий Stage 12a guard сбрасывает `highDepthSource`.
- Fallback: malformed/unsupported high-depth preview не ломает документ — renderer логирует проблему и возвращается к сохранённому RGBA8 `dataUrl`.
- Tests: добавлены 16-bit direct-color, Float32 HDR highlight separation, alpha/source immutability, render-cache/wiring и destructive-materialization contracts.
- Version: приложение синхронизировано на 1.23.0.

## 1.22.0 — 2026-09-25

### 2026-09-25 — High-depth Raster Source Stage 12a

- Added: canonical serializable PixelBuffer source (`zpe-pixel-buffer-source-v1`) с little-endian 8/16/32-bit sample encoding и безопасным deserialize round-trip.
- `.zpe`: raster layer получил optional `highDepthSource`; sanitizer проверяет geometry/channels/depth/raw byte count/base64 shape без дорогостоящего decode.
- PSD/PSB import: RGB 16/32-bit layer/composite source сохраняется вместе с 8-bit Canvas preview в пределах общего raw-budget 48 МБ; превышение бюджета даёт явный warning и не раздувает проект бесконтрольно.
- Correctness: destructive Canvas publication (paint/fill/erase/retouch/clear/cut) сбрасывает `highDepthSource`, поэтому проект не заявляет старую precision после изменения preview.
- UX: свойства raster layer показывают сохранённую bit depth/model/размер и честно отмечают 8-bit Canvas editing boundary.
- Tests: добавлены binary round-trip, malformed payload guards, `.zpe` persistence и invalidation contracts.
- Version: приложение синхронизировано на 1.22.0.

## 1.21.0 — 2026-09-25

### 2026-09-25 — Linked Smart Objects Stage 11c

- Added: `smart-object.linkedSourceId` и bounded source-ID helpers; `.zpe` sanitizer сохраняет связь обратно совместимо без повышения версии формата проекта.
- UX: «Создать связанную копию смарт-объекта» связывает исходный слой и новую копию; «Разорвать связь» оставляет выбранному экземпляру текущее embedded contents как независимый источник.
- Content tabs: экземпляры одной linked-группы переиспользуют одну вкладку содержимого вместо параллельных расходящихся редакторов.
- Save semantics: `Ctrl+S` во вкладке linked contents обновляет embedded document, preview и размеры у всех экземпляров источника одной history entry; instance-level transforms, masks, Smart Filters и blending не перезаписываются.
- Resilience: если исходный layer экземпляра удалён во время открытой content-tab, сохранение может продолжиться через оставшийся экземпляр того же linked source; preview caches инвалидируются для всех старых preview.
- Scope: Stage 11c реализует внутрипроектные linked instances внутри `.zpe`; persistent external-file links намеренно оставлены на отдельный будущий этап.
- Version hygiene: версия приложения поднята до 1.21.0, About читает номер из `application-version` meta вместо собственного hard-coded номера, а regression test теперь запрещает повторное расхождение.

## 1.20.0 — 2026-09-25

### 2026-09-25 — Smart Filter Masks Stage 11b

- Added: отдельная `smartFilterMask` у smart-object, независимая от обычной raster/vector mask слоя.
- UI: маску стека можно создать как «показать всё» или из выделения, включить/отключить, инвертировать, удалить, менять плотность 0–100% и растушёвку до 250 px.
- Rendering: Smart Filter result смешивается с исходным preview по effective alpha маски; density ослабляет маску к белому, invert переворачивает влияние фильтров, feather применяется перед composite.
- Cache correctness: mask payload и параметры входят в Smart Filter signature, поэтому смена маски, density/feather/invert не оставляет stale result.
- State: sanitizer нормализует data URL, enabled/invert, density и feather и сохраняет backward compatibility для smart-object без маски.
- Version hygiene: версия приложения синхронизирована на 1.20.0 в package/README/index metadata; regression test блокирует повторное расхождение версий.

### 2026-09-25 — Smart Filters Stage 11a

- Added: native ZPE Smart Filter stack для `smart-object`, максимум 24 entry с собственными name/enabled/filter payload.
- UI: Properties показывает ordered stack; доступны add/edit с live preview, enable/disable, move up/down, delete и clear-all.
- Semantics: список отображается top-first, а renderer применяет enabled Smart Filters снизу вверх; outer layer filters остаются отдельным совместимым этапом.
- Rendering: каждый Smart Filter использует существующие advanced color corrections через Pixel Worker и basic Canvas filter pass, не изменяя embedded source document.
- Cache correctness: Smart Filter cache и outer adjusted-raster cache учитывают `previewDataUrl + stack signature`, поэтому edit/reorder/content update инвалидируют результат без ручного cache-busting.
- Reliability: Cancel восстанавливает исходный stack; Apply создаёт одну history entry; sanitizer ограничивает stack и чинит duplicate IDs.
- Regression: state round-trip/clamping/limit, bottom-up render contract, cache-key contract, UI operations и isolated context-menu harness.

### 2026-09-25 — Paths Panel Stage 10f

- Added: отдельная collapsible-панель «Контуры» со списком `document.paths` и Photoshop resource ID/числом subpaths/узлов.
- Added: сохранить текущую vector mask, shape path или selection как saved path без растрирования.
- Added: rename, duplicate, delete и контекстное меню saved paths; выбранный path хранится отдельно для каждой вкладки документа.
- Added: «Перо» напрямую редактирует saved path anchors/handles в document coordinates; pointer cancel/history используют существующий path-control pipeline.
- Added: выбранный saved path можно применить как native ZPE vector mask обычного слоя через document→layer-local transform.
- UX: Paths panel участвует в общей persistent collapse-модели, поддерживает ArrowUp/ArrowDown и доступные SVG-иконки.
- Safety: максимум 998 saved paths и диапазон resource IDs 2000..2997; adjustment-layer path→mask пока явно отключён до отдельного coordinate-contract этапа.
- Regression: новый paths-panel test покрывает DOM, management actions, non-raster save/apply wiring, direct edit и per-tab selection state.

### 2026-09-25 — Native PSD/PSB Vector Masks + Saved Paths Stage 10d/10e

- PSD/PSB import: `vmsk` и `vsms` читаются как version-3 vector mask metadata с invert/disable/not-link flags и 26-byte Photoshop path records.
- PSD/PSB export: ZPE vector mask больше не bake-ится в layer RGBA; writer сохраняет source layer pixels и native `vmsk` отдельно.
- Path codec: 8.24 fixed-point document coordinates, open/closed subpaths, linked/unlinked Bézier knots, initial fill, even-odd/non-zero fill rule и Add/Subtract/Intersect/Exclude.
- Saved paths: Image Resources `2000..2997` импортируются в bounded `document.paths`, переживают `.zpe` snapshot/sanitize и экспортируются обратно в PSD/PSB.
- Reliability: writer отклоняет path coordinates вне Photoshop fixed-point range вместо silent overflow; parser ограничен `MAX_PSD_PATH_RECORDS`.
- Compatibility: Photoshop unlinked-vector-mask flag сохраняется, но ZPE transform behavior пока остаётся linked; import/export сообщает это ограничение.
- Regression: native vector masks и saved paths проходят PSD + PSB encode/decode round-trip tests, включая handles, boolean ops и resource IDs.

### 2026-09-25 — Vector Mask Direct Edit Stage 10c

- Added: «Редактировать векторную маску пером» в Layer/context menus.
- Pen: vector-mask subpaths показывают пунктирный контур, anchors и Bézier handles в document coordinates.
- Direct edit: anchor/handle drag использует существующие Shift/Alt semantics и сохраняет `pathSource + subpathIndex`, поэтому изменения не попадают в shape path по ошибке.
- Reliability: pointer cancel восстанавливает исходный vector-mask node; выход из Pen очищает mask-edit mode; клик по пустому месту в mask-edit mode не создаёт новый shape-layer.
- History: отдельные labels для перемещения узла/ручки vector mask.
- Regression: static contracts подтверждают target abstraction, drag routing, edit command и accidental-shape guard.

### 2026-09-25 — Vector Masks Stage 10a + Path Operations Stage 10b

- Added: first-class `vectorMask` в layer schema и `.zpe`, с enable/invert и bounded списком cubic Bézier subpaths.
- Added: создать/заменить vector mask из текущего выделения; прямоугольник сохраняется как 4 anchors, ellipse — как 4 cubic Bézier segments.
- Added: boolean contour operations для существующей vector mask: Add, Subtract, Intersect, Exclude.
- Render: vector-mask subpaths композитятся локально через `source-over`, `destination-out`, `destination-in`, `xor`, после чего пересекаются с raster layer mask в одном isolated pipeline.
- UI: Layer/context menus получили Replace/Add/Subtract/Intersect/Exclude, invert, enable/disable и remove; Properties показывает raster/vector mask state.
- Safety: sanitizer ограничивает 128 subpaths × 2000 nodes, отбрасывает контуры короче 3 точек и нормализует неизвестные операции.
- PSD/PSB: visual result сохраняется в raster preview; native Photoshop vector-mask resource пока не заявляется и export показывает warning.
- Regression: `.zpe` round-trip Bezier handles/boolean operations, malformed payload normalization, render contracts и UI wiring.

### 2026-09-25 — Select & Mask View Modes Stage 9d

- Added: четыре preview mode — «Чёрно-белая маска», «Наложение», «На чёрном», «На белом».
- Architecture: preview visualization вынесена в pure `composeMaskPreviewRgba()`; refinement alpha остаётся отдельным source of truth.
- Safety: `viewMode` не входит в final refinement options и поэтому не может изменить сохраняемую layer mask.
- Regression: точные pixel expectations для всех четырёх режимов и UI wiring contract.

### 2026-09-25 — Select & Mask Edge Detection Stage 9c

- Added: «Радиус обнаружения края», «Сила уточнения края» и «Умный радиус» в Select & Mask.
- Core: новый pure `refineMaskEdgeAware()` строит eroded foreground core + dilated edge band и уточняет band pixels по сходству с уверенными foreground/background RGBA samples.
- Smart Radius: color-separation confidence автоматически снижает влияние алгоритма на однородных/неопределённых границах.
- Source pixels: обычные слои анализируются через unmasked local render; adjustment layer использует текущий document composite.
- Preview parity: live preview получает тот же RGBA edge source и тот же ordering — smooth/shift → edge detection → feather/contrast/invert.
- Safety: full-resolution edge work ограничен бюджетом `pixels × radius <= 48M`; общий refinement limit остаётся 12 МП.
- Regression: recovery of a subject-colored fringe, conservative behavior on indistinguishable colors, full-pipeline wiring and UI/budget contracts.

### 2026-09-25 — Select & Mask Preview Stage 9b

- Added: live black/white mask preview inside «Уточнить выделение → маска…».
- Non-destructive: preview never mutates layer mask, document, history or recovery state before submit.
- Performance: selection is rasterized into a bounded reduced-resolution preview buffer (up to ~420×240), not a second full-size document mask.
- Consistency: preview and final apply share one parameter-normalization helper, including document→layer scale conversion.
- Responsiveness: rapid input/change events are coalesced with `requestAnimationFrame`; modal cleanup cancels pending frames/listeners.
- Fixed: history label now correctly distinguishes creation of a new refined mask from replacement of an existing mask.
- Docs: clarified that Stage 8a/8b flat-group wording was historical and superseded by native nested groups in Stage 8c.

### 2026-09-25 — ICC Metadata Round-trip Stage 7g

- Added: `.zpe` document schema сохраняет bounded ICC profile metadata и intentionally-untagged state.
- IO: binary ICC bytes кодируются в `data:application/vnd.iccprofile;base64,...`; decoder проверяет raw-size ceiling до/после `atob`.
- PSD/PSB writer: resources 1039 (ICC Profile) и 1041 (ICC Untagged) записываются с корректным Pascal-name/data even padding.
- Export: сохранённый профиль передаётся обратно в PSD/PSB; UI предупреждает, что это metadata preservation, а не ICC color conversion.
- Safety: raw ICC ограничен 4 МБ, `.zpe` profile data URL — 5.7 МБ; некорректные схемы/URL sanitizer отбрасывает.
- Regression: state sanitizer и adapter writer→reader byte-identical ICC round-trip.

### 2026-09-25 — ICC Metadata Foundation Stage 7f

- Added: PSD/PSB Image Resources parser для корректно padded `8BIM` resource blocks.
- ICC: resource `0x040F / 1039` читается как raw ICC profile bytes с 4 МБ safety cap; resource `0x0410 / 1041` переносит intentionally-untagged flag.
- Header summary: declared profile size, ICC version, device class, color space, PCS и `acsp` signature validation.
- UI: при импорте профилируемого PSD/PSB показывается явное предупреждение, что текущий Canvas preview ещё не делает ICC transform; ZPE не выдаёт unmanaged preview за color-managed результат.
- Regression: synthetic ICC v4 RGB/XYZ profile и untagged resource fixture.

### 2026-09-25 — Select & Mask Foundation Stage 9a

- Added: «Уточнить выделение → маска…» в меню «Выделение» и «Слой».
- Controls: сглаживание, расширение/сжатие края, растушёвка, контраст края и инверсия.
- Core: новый pure helper `refineMaskAlpha()` реализует separable morphology/blur pipeline для 8-bit alpha masks и покрыт unit tests.
- Geometry: параметры в px документа пересчитываются в layer-pixel space для масштабированных слоёв; adjustment layer работает в координатах документа.
- Safety: refinement масок больше 12 МП отклоняется понятной ошибкой вместо потенциальной блокировки вкладки; обычная маска из выделения остаётся без этого дополнительного CPU-heavy этапа.
- Regression: grow/shrink, noise smoothing, soft feather, contrast/invert и UI wiring.

### 2026-09-25 — Group Compositing Stage 8e

- Added: ZPE groups получили `opacity` и `blendMode` с backward-compatible defaults `1` и `pass-through`.
- Render: 100% Pass Through group рендерит children прямо в parent stack; reduced-opacity или non-pass-through group изолируется во временный Canvas и композитится как единое целое.
- Nested semantics: group render plan сохраняет порядок слоёв/подгрупп по исходному layer stack и рекурсивно применяет group hierarchy.
- UI: контекстное меню группы открывает «Параметры группы…» с режимом наложения и непрозрачностью.
- PSD/PSB: folder marker opacity и `lsct` section blend key теперь импортируются в ZPE и возвращаются writer'ом; Pass Through ↔ `pass`, Normal/Multiply/Screen/Overlay/etc. ↔ стандартные PSD blend keys.
- Added: sanitizer, renderer contract, PSD nested-group round-trip и adapter/UI wiring regressions.

### 2026-09-25 — High-depth ZIP Prediction Stage 7e

- Added: PSD/PSB compression=3 (ZIP with prediction) для RGB 16-bit и 32-bit layer/composite channels.
- 16-bit: predictor восстанавливается на уровне big-endian 16-bit samples с modulo-65536 delta decode.
- 32-bit: после byte-level delta decode выполняется Photoshop byte-plane unshuffle обратно в big-endian IEEE-754 samples.
- Safety: ZIP inflate теперь читается chunk-wise с жёстким expected-output ceiling; oversized decompression отклоняется как `PSD_ZIP_LIMIT` до сборки полного результата.
- Regression: high-depth layer fixtures проверяют Raw/RLE/ZIP/ZIP-prediction, отдельно добавлен composite ZIP-prediction round-trip fixture для 16/32-bit.

### 2026-09-25 — Nested Groups UX Stage 8d

- Added: group rows в панели слоёв стали draggable — группу можно вложить в другую группу.
- Added: drop группы на свободную область панели поднимает её обратно на верхний уровень.
- Added: контекстное меню группы содержит «Создать подгруппу».
- Safety: UI использует `moveLayerGroupIntoGroup()`, поэтому self/descendant cycles и ancestor locks нельзя обойти drag-and-drop.
- Fixed: блокировка слоя в context menu теперь учитывает всю цепочку родительских групп, а не только непосредственную папку.
- Added: regression contracts для group drag nesting/root extraction/subgroup action.

### 2026-09-25 — Native Nested Groups Stage 8c

- Added: ZPE group schema получила optional `parentGroupId`; старые проекты без поля остаются совместимыми.
- Inheritance: layer/group visibility и locking теперь учитывают всю ancestor chain, а не только непосредственную группу.
- Safety: sanitizer обнуляет orphan/self/cyclic parent links; попытка программно вложить группу в собственного потомка отклоняется.
- UX: панель слоёв рендерит настоящую group hierarchy с отступами и recursive collapse; ancestor hidden/locked state отображается на дочерних строках.
- Removal: удаление группы сохраняет содержимое — прямые слои и подгруппы поднимаются к её родителю.
- PSD/PSB: import сохраняет adapter `parentKey` как ZPE hierarchy, writer формирует nested `lsct` records по lineage transitions и сохраняет имена групп без `Parent / Child` flatten.
- Added: nested state/sanitizer tests и PSD nested group writer → reader round-trip regression.

### 2026-09-25 — PSD/PSB Group Export Stage 8b

- Added: плоские ZPE groups теперь экспортируются в PSD/PSB как настоящие `lsct` folder + bounding-divider layer records.
- Preserved: Unicode group names, visibility и open/closed (collapsed) state; child visibility пишется отдельно от folder visibility.
- Safety: одна группа должна занимать contiguous run слоёв. Если тот же `groupKey` появляется повторно после посторонних слоёв, writer отклоняет экспорт с `PSD_EXPORT_GROUP_SPLIT` вместо ошибочного захвата чужих слоёв.
- Compatibility: group marker records не создают pixel channels и используют pass-through section blend key; обычный RGB/8-bit layer writer остаётся прежним.
- Added: PSD group export → import round-trip regression и wiring tests для UI → writer.

### 2026-09-25 — PSD/PSB Group Import Stage 8a

- Added: PSD/PSB `lsct` section-divider records теперь восстанавливают folder boundaries вместо полного flatten при импорте.
- Mapping: type 1/2 open/closed folders переносят имя, visibility и collapsed-state; type 3 используется как hidden bounding divider, bitmap layers получают стабильный adapter `groupKey`.
- Nested groups: текущая плоская ZPE group model сохраняет nested context через имя полного пути `Parent / Child`; parent/child group hierarchy пока не заявляется.
- Guardrails: malformed/unmatched group markers, group opacity и неподдерживаемые group blend modes дают явные warnings вместо тихой подмены семантики.
- Added: synthetic nested PSD regression fixture и integration-contract test для adapter → ZPE group mapping.

### 2026-09-25 — RGB 32-bit Float PSD/PSB Import Stage 7d

- Added: RGB 32-bit/channel PSD/PSB layer и composite samples читаются big-endian как IEEE-754 float и сохраняются в `Float32Array` PixelBuffer, включая HDR-значения вне диапазона 0..1.
- Compression: Raw, PackBits/RLE и ZIP без prediction используют общий bytes-per-sample pipeline для 8/16/32-bit.
- Guardrail: ZIP prediction для 16/32-bit остаётся отдельным unsupported path `PSD_ZIP_PREDICTION_DEPTH` вместо неподтверждённого декодирования.
- Preview: текущий Canvas bridge явно остаётся 8-bit display boundary и ограничивает 32-bit preview диапазоном 0..1; HDR tone mapping/exposure и Float32 editing/export пока не заявляются.
- Masks: Float32 mask samples приводятся к 8-bit alpha только на текущей render boundary.
- Added: regression tests для 32-bit Raw PSD, RLE PSB, ZIP PSD, точного Float32 payload и clipped RGBA8 preview.

### 2026-09-25 — RGB 16-bit PSD/PSB Import Stage 7c

- Added: RGB 16-bit/channel PSD/PSB layer и composite channels теперь декодируются в precision-preserving `Uint16Array` PixelBuffer.
- Compression: поддержаны Raw, PackBits/RLE и ZIP без prediction; RLE считает scanline в байтах с учётом 2 bytes/sample и сохраняет PSB 32-bit row-length contract.
- Guardrail: 16-bit ZIP prediction пока отклоняется отдельным `PSD_ZIP_PREDICTION_DEPTH`, а 32-bit/HDR и CMYK остаются за capability gate вместо молчаливой потери данных.
- Masks: 16-bit user-mask samples безопасно приводятся к 8-bit alpha только на текущей Canvas mask boundary.
- UI contract: при открытии 16-bit PSD/PSB текущий ZPE/Canvas документ получает 8-bit preview и явно предупреждает, что high-depth precision после импорта пока не сохраняется.
- Added: regression tests для 16-bit Raw PSD, RLE PSB, ZIP PSD, точного Uint16 payload/preview bridge и unsupported-depth/prediction guards.

### 2026-09-25 — PixelBuffer Stage 7b: typed high-depth boundary

- Added: `src/core/pixel-buffer.js` defines a strict typed pixel contract for RGB/CMYK buffers with 8-bit integer, 16-bit integer and 32-bit float samples.
- Added: RGBA8 uses `Uint8ClampedArray`, 16-bit uses `Uint16Array`, 32-bit/HDR uses `Float32Array`; dimensions, channel counts, alpha semantics and data length are validated.
- Integration: PSD/PSB RGB/8-bit decoder now exposes `pixelBuffer` and keeps `pixels` as the same underlying array for compatibility; import UI consumes the PixelBuffer preview bridge.
- Zero-copy: current RGBA8 adapter-to-Canvas path returns the existing `Uint8ClampedArray` without an extra full-frame copy.
- Guardrail: CMYK PixelBuffer can be carried with profile metadata but RGB preview intentionally fails until a real color-management transform exists; no fake device-CMYK conversion is presented as accurate color.
- Added: regression tests cover RGBA8 zero-copy, RGB16 preview, RGB32 float preview/clamping, CMYK carry/guardrails and invalid sample/channel layouts.
- Scope: this is the source-format boundary needed for later 16/32-bit/CMYK work; the ZPE document model and Canvas renderer remain 8-bit at this stage.

### 2026-09-25 — PSB Stage 7a: RGB/8-bit Large Document Format

- Added: `.psb` import/export как Photoshop Large Document Format version 2 в существующем offline PSD adapter.
- Format: Layer and Mask section, Layer Info и per-channel lengths используют PSB 64-bit big-endian length fields; RLE scanline byte counts используют 32-bit fields.
- Compatibility: Color Mode Data и Image Resources сохраняют стандартные 4-byte length fields; PSD version 1 API/format остаётся без изменений.
- Added: `encodePsb()` и chunk-friendly `encodePsbBlob()`; UI принимает `.psb` и предлагает отдельный PSB export.
- Added: независимый synthetic PSB fixture проверяет 64-bit section/channel lengths и 32-bit PackBits row counts без использования production writer; отдельный writer round-trip покрывает Unicode layer name, blend mode и bitmap mask.
- Guardrails: Stage 7a остаётся RGB/8-bit и сохраняет текущие ZPE limits (48 МП import/export buffer budget, 512 МБ input guard, Canvas limits). CMYK/16/32-bit и истинные >2GB/tiled workflows пока не заявляются.
- Spec basis: Adobe Photoshop File Formats Specification — PSB version 2, 8-byte Layer/Mask + Layer Info + channel lengths, 4-byte RLE row byte counts.

### 2026-09-24 — CI reliability: Chromium sandbox on hosted Linux

- Fixed: browser smoke добавляет `--no-sandbox` только для root или Linux GitHub Actions, где hosted runner может запрещать usable Chromium sandbox через user-namespace/AppArmor policy.
- Root cause: post-merge CI Stage 6c завершал Chrome с `SIGABRT` и `No usable sandbox!` до публикации DevTools endpoint; 198/198 Node regression-тестов и generated bundle при этом были зелёными.
- Guardrail: флаг относится только к изолированному CI smoke-browser; production/editor code и локальный обычный browser launch не меняются. Добавлен structural regression на scope этого launch policy.

### 2026-09-24 — Performance Stage 6c: chunked PSD Blob export

- Added: `encodePsdBlob()` создаёт PSD `Blob` напрямую из chunked writer parts, не вызывая финальный `Writer.concat()` в пользовательском browser-export path.
- Compatibility: существующий `encodePsd()` по-прежнему возвращает `Uint8Array` и строится из того же `buildPsdWriter()`, поэтому byte-level API и regression fixtures сохраняются.
- Changed: `src/main.js` экспортирует PSD через `encodePsdBlob()` и передаёт готовый Blob в `downloadBlob()` без промежуточного contiguous byte buffer.
- Added: regression сравнивает `encodePsdBlob()` и `encodePsd()` byte-for-byte и повторно декодирует Blob output.
- Scope: browser memory-path стал chunk-friendly, но это ещё не настоящий WritableStream/file-system streaming и не PSB >2 GB.

### 2026-09-24 — Performance Stage 6b: row-stream PSD writer

- Changed: PSD PackBits/RLE writer больше не создаёт полноразмерные временные channel planes для RGB/alpha/mask/composite; канал строится построчно через bounded row buffer.
- Changed: RLE row lengths измеряются первым проходом, а encoded row chunks пишутся вторым проходом. CPU PackBits немного увеличивается, зато peak memory не включает дополнительный full-plane buffer на каждый канал.
- Changed: внутренний `Writer.append()` переносит chunk references без промежуточного `concat()` для layer records/channel data/layer-and-mask/composite sections; итоговый PSD по-прежнему материализуется один раз на выходе API.
- Added: regression на 260-pixel rows покрывает PackBits literal/repeat boundaries, alpha и bitmap mask round-trip.
- Added: structural regression фиксирует row-chunk seam и запрещает возврат `rgbaPlane`/`compositePlane` staging.
- Test maintenance: mask round-trip теперь использует отдельную white-RGB/alpha fixture, а legacy Stage 4 structural guard проверяет актуальные row-stream primitives (`encodeRleRgbaChannel`, `measureRleRgbaRows`, `appendRleRgbaRows`).
- Scope: публичный `encodePsd()` и RGB/8-bit PSD semantics не меняются; настоящий file streaming, PSB lengths и tiled document storage остаются следующими этапами.

### 2026-09-24 — CI reliability: browser startup budget

- Fixed: `file://` browser smoke теперь даёт Chrome/Chromium до 20 секунд на публикацию DevTools endpoint вместо 10 секунд.
- Root cause: hosted runner дважды показал startup timeout до загрузки приложения, а повторный run того же SHA проходил без изменений кода; Node regression suite и bundle-check во всех случаях были зелёными.
- Guardrail: timeout остаётся bounded; runtime/DOM/Blob Worker assertions не ослаблены и по-прежнему падают отдельно после успешного запуска браузера.

### 2026-09-24 — Performance Stage 6a: bounded pixel worker

- Added: крупные advanced color corrections (от 512×512 px) выполняются в одном bounded Blob Worker; RGBA buffer передаётся transferable без дополнительного полного clone перед обработкой.
- Reliability: максимум две pending pixel-задачи, timeout 45 секунд, worker reset на runtime/message error и синхронный fallback при недоступном Worker/перегрузке.
- Reliability: если transferred buffer уже detached при worker failure, renderer повторно читает исходные Canvas pixels и применяет тот же sync algorithm вместо потери изображения.
- Fixed: adjusted-color cache для smart-object теперь ключуется по `previewDataUrl`, поэтому обновление содержимого не может оставить stale color-corrected preview.
- Added: regression-тест сравнивает worker algorithm с sync RGBA output; render contract проверяет async path и smart-object cache source token.
- Browser proof: `file://` smoke отдельно проверяет, что Blob Worker реально стартует из локально открытого редактора.
- Scope: это responsiveness foundation; tiled raster storage, PSB streaming и 16/32-bit buffers остаются следующими отдельными этапами.

### 2026-09-24 — Smart Objects Stage 5a: embedded source + linked content tabs

- Added: новый слой `smart-object` хранит `embeddedDocument` как source of truth и `previewDataUrl` как render-cache; схема добавлена обратно совместимо в текущий `.zpe` v1.
- Added: raster/text/shape слой можно преобразовать в smart-object без растрирования исходной семантики внутри embedded document; внешний opacity/blend/group остаются на smart-object layer.
- Added: двойной клик по миниатюре, Properties и Layer menu открывают содержимое smart-object в отдельной связанной document tab.
- Added: `Ctrl+S` внутри content-tab обновляет embedded document и PNG preview родительского слоя, создавая ровно одну запись history в родительской session.
- Reliability: parent tab нельзя закрыть, пока открыты связанные content-tabs; заблокированный smart-object нельзя редактировать или обновлять через дочернюю вкладку.
- Reliability: UI и project sanitizer ограничивают рекурсивную вложенность smart-object тремя уровнями; внешние проекты глубже лимита сохраняют preview, но отбрасывают более глубокий embedded source.
- Added: regression-тесты schema/sanitizer, preview-render и session-link save contract.
- Test maintenance: brush-preview regression теперь проверяет поведенческий raster-override contract после появления smart-object preview path, а save-boundary VM harness учитывает `currentSession()` без ослабления блокировки сохранения во время raster edit.
- Known limitation: Stage 5a поддерживает embedded ZPE smart objects; linked external sources, smart filters/warp и native PSD smart-object round-trip ещё не реализованы.
- Verification: выполняется через PR CI, generated bundle consistency и реальный `file://` browser smoke перед merge.


### 2026-09-24 — PSD pipeline Stage 4: layered RGB/8-bit export

- Added: dependency-free PSD writer в `src/adapters/psd.js` записывает RGB/8-bit PSD version 1 с PackBits/RLE channel data.
- Added: экспортируются отдельные layer records с Unicode `luni` names, opacity, visibility, поддерживаемыми blend modes и merged transparency.
- Added: ZPE bitmap layer masks экспортируются как Photoshop user mask channel `-2`, включая disabled-state.
- Added: writer следует Photoshop 5+ layer flags, 4-byte layer-info/`luni` alignment и merged-image white-matte convention для полупрозрачного composite preview.
- Changed: text/shape layers, transforms, filters и styles сохраняются как raster preview соответствующего PSD layer, при этом PSD opacity/blend остаются отдельными свойствами слоя.
- Changed: если документ содержит видимый ZPE adjustment layer, исходные export layers остаются в PSD скрытыми, а сверху создаётся видимый `ZPE Composite Preview (adjustments baked)`; так визуальный результат не теряется до появления native adjustment mapping.
- Reliability: PSD export ограничен суммарно 48 МП временных RGBA-буферов; writer отклоняет malformed RGBA/mask buffers и файлы за пределами PSD-size guard.
- Added: round-trip regression `encodePsd → decodePsd` проверяет RGB pixels, Unicode name, opacity, multiply, hidden state и user mask.
- Compatibility review: layer flags, `luni` alignment, mask layout и merged-image RLE дополнительно сверены с реализацией writer в `ag-psd`.
- Verification: выполняется через PR CI, generated bundle consistency и реальный `file://` browser smoke перед merge.


### 2026-09-24 — PSD pipeline Stage 3: layered RGB/8-bit import

- Added: отдельный `src/adapters/psd.js` реализует dependency-free PSD binary adapter с жёсткими capability guards и memory/length checks.
- Added: импорт RGB/8-bit PSD version 1 с Raw, PackBits/RLE, ZIP и ZIP-with-prediction channel compression.
- Added: PSD bitmap layers превращаются в редактируемые ZPE raster layers с bounds, visibility, opacity и поддерживаемыми blend modes.
- Added: bitmap user layer mask (channel `-2`) переносится в ZPE layer mask; Unicode layer names читаются из `luni`.
- Added: если layered bitmap-preview отсутствует, adapter использует composite image как fallback.
- Reliability: PSB, CMYK/Lab/Indexed и 16/32-bit на этом этапе отклоняются явной ошибкой вместо скрытого преобразования с потерей данных; PSD больше 512 МБ блокируется до tiled pipeline.
- Reliability: документ заменяется только после полного decode + PNG preparation и проверки, что активная вкладка/история не изменились во время async-импорта.
- Known limitation: PSD groups пока flatten в список; Photoshop text/vector/smart-object semantics импортируются только если в PSD присутствует raster preview.
- Added: regression-тесты синтетического layered PSD, capability guards и file detection.


### 2026-09-24 — Bézier pipeline Stage 2b: direct-edit anchors и handles

- Added: выбранный path-слой в инструменте «Перо» показывает editable anchors и control handles в document coordinates с учётом transform слоя.
- Added: drag anchor перемещает узел вместе с его handles; drag handle редактирует кривую, сохраняя smooth-симметрию.
- Added: `Alt+drag` handle переводит узел в corner и разрывает симметрию; `Shift+drag` anchor создаёт smooth handles даже у старого straight/corner узла; `Alt+click` anchor удаляет handles.
- Added: hit-testing приоритетно выбирает handles, затем anchors; курсор отражает доступность direct-edit.
- Reliability: Escape и pointer cancel восстанавливают исходный node snapshot; история получает один commit только после завершённого изменения.
- Verification: выполняется через PR CI, generated bundle consistency и реальный `file://` browser smoke перед merge.


### 2026-09-24 — Bézier pipeline Stage 2a: cubic-контуры и ручки

- Added: `pathPoints` поддерживает `handleIn`, `handleOut` и тип узла `corner/smooth`; старые точки `{x,y}` автоматически остаются прямолинейными corner-узлами.
- Added: renderer строит смешанные straight/cubic сегменты через `bezierCurveTo()`, включая корректное замыкание последнего сегмента.
- Added: инструмент «Перо»: клик создаёт corner point, drag — smooth point с симметричными handles, `Alt+drag` — corner point с независимой исходящей ручкой.
- Added: live overlay показывает cubic preview, anchors и управляющие ручки; отменённый pointer gesture не оставляет лишний узел.
- Changed: bounds нового path-слоя учитывают не только anchors, но и control handles, поэтому ручки не оказываются за пределами локальной геометрии слоя.
- Added: regression-тесты для backward compatibility старых pathPoints и нового cubic render contract.
- Verification: выполняется через PR CI, generated bundle consistency и browser smoke перед merge в `main`.


### 2026-09-24 — Начат профессиональный imaging pipeline: маски и корректирующие слои

- Added: новый тип слоя `adjustment` применяет неразрушающую цветокоррекцию и Canvas-эффекты ко всему уже собранному нижележащему стеку.
- Added: базовая модель маски слоя с командами «показать всё» и «из выделения»; маска хранится в `.zpe` и ограничивает результат слоя через alpha-композитинг.
- Changed: корректирующие слои исключены из геометрических transform-handles, destructive pixel-операций и отдельной растеризации.
- Changed: новые поля добавлены обратно совместимо без повышения версии проекта; существующие проекты версии 1 продолжают проходить текущий sanitizer.
- Added: regression-тесты для сохранения adjustment/mask state и контрактов нового render pipeline.
- Verification: выполняется GitHub Actions после атомарного commit source + generated bundle.


### 2026-09-24 — Исправлен browser smoke в CI

- Fixed: восстановлен повреждённый хвост `tools/browser-smoke.mjs`, из-за которого CI останавливался с `SyntaxError: Unexpected end of input` до запуска браузера.
- Changed: `npm run check` теперь отдельно проверяет синтаксис browser-smoke harness до Node regression suite; навигационная ошибка Chromium выводится как отдельная причина.
- Fixed: teardown временного Chrome-профиля использует bounded retry для `ENOTEMPTY`/занятых файлов после завершения браузера вместо ложного падения уже прошедшего smoke.
- Verification: hosted Chrome успешно открыл реальный `file://` и прошёл startup/lock DOM assertions; следующий Actions run проверяет исправленный teardown.

### 2026-09-24 — Добавлен настоящий browser smoke для file:// и lock UI

- Added: `tools/browser-smoke.mjs` запускает установленный Chrome/Chromium без npm-зависимостей, подключается через DevTools Protocol и открывает фактический `index.html` по `file://`.
- Added: smoke проверяет чистый startup без runtime/console errors, создание растрового слоя, lock/unlock disabled-state, доступность видимости/разблокировки и guards пунктов меню слоя.
- Changed: CI после Node regression suite и проверки generated bundle выполняет `npm run test:browser`; документация теперь явно разделяет доказанный DOM-contract и остающиеся manual/browser boundaries.

### 2026-09-24 — Заблокированные слои явно отключают недоступные действия

- Fixed: режим наложения, непрозрачность, переименование, дублирование, удаление, изменение порядка и сброс эффектов теперь сразу недоступны для заблокированного слоя или слоя в заблокированной группе вместо визуально активного, но молча игнорируемого управления.
- Changed: пункт разблокировки собственного слоя недоступен, пока блокировка унаследована от группы; показ/скрытие слоя остаётся доступным.
- Added: regression-проверки фиксируют disabled-state и menu guards поверх существующих state-level тестов блокировки.

### 2026-09-24 — Подготовлена публикация исходников на GitHub

- Added: воспроизводимый CI для `npm run check` на Node.js 24 с минимальными `contents: read` permissions.
- Added: `SECURITY.md`, шаблон bug report и `.gitignore` для безопасной публичной разработки.
- Added: скрипт воспроизводимой генерации офлайн-шрифтов из зафиксированного commit `google/fonts`; готовый runtime по-прежнему хранит шрифты локально и не требует сети.
- Changed: README теперь описывает онлайн- и локальный запуск и исправляет устаревшее ограничение про инструмент «Перо».
- Changed: окно «О программе» больше не называет редактор только локальным, потому что приложение также развёрнуто в интернете.

### 2026-09-24T14:37:37+03:00 — Исправлены цвет и числовые поля текста

- Fixed: поле цвета в окне создания и редактирования текста показывает выбранный оттенок всей областью и обновляет его при выборе.
- Fixed: числовые поля диалогов и свойств приводят ввод к ближайшему допустимому шагу и границам; межстрочный интервал и масштаб допускают сотые доли, включая исходные значения.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 170 тестов без ошибок. Цветовое поле видно на присланном пользователем скриншоте; самостоятельная проверка браузера заблокирована политикой доступа к `file://`.

### 2026-09-24T14:18:53+03:00 — Предпросмотр слоя в окне параметров наложения

- Added: в каждой секции параметров наложения показывается фрагмент итогового холста вокруг слоя с фоном и другими слоями; он обновляется после изменения настроек и при изменении размеров окна.
- Changed: окно «Параметры наложения» теперь можно растягивать за нижний правый угол; списки и поля прокручиваются при уменьшении окна.
- Verification: `npm run check` пересобрал bundle и завершил 168 тестов без ошибок. Живое расположение и изменение размера в браузере не проверены: инструмент не допускает локальный `file://` адрес.

### 2026-09-24T14:12:52+03:00 — Расширены стили слоя и улучшены окна редактора

- Added: девять сохраняемых стилей слоя с отдельными переключателями и настройками: обводка, тиснение, внутренние тень и свечение, наложение цвета, градиента и узора, внешнее свечение и тень; добавлена непрозрачность заливки.
- Changed: окно «Параметры наложения» показывает черновик на холсте, отменяет его без изменения истории и записывает применение одним действием Undo/Redo; окно перемещается за заголовок в пределах экрана.
- Changed: открытые окна больше не затемняют холст и панели под ними; рендер стилей ограничивает временные Canvas 16 МП для больших слоёв.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 167 тестов без ошибок. Живое поведение в браузере не проверено из-за блокировки локального `file://` адреса браузерным инструментом.

### 2026-09-24T13:58:21+03:00 — Добавлены контекстные меню вкладок, слоёв и холста

- Added: правый клик по вкладке открывает команды перехода, переименования, копирования, создания и закрытия; закрытие вкладки с изменениями сохраняет подтверждение.
- Added: меню слоя и группы содержит доступные для них действия; на пустой области слоёв можно создать слой или группу, на холсте доступны команды редактирования и масштаба.
- Added: «Параметры наложения» в меню слоя открывают окно режима и непрозрачности с предпросмотром, отменой и одним действием истории при применении.
- Verification: `npm run check` пересобрал bundle и завершил 163 теста без ошибок. Живое поведение в браузере не проверено: браузерный инструмент заблокировал локальный `file://` адрес.

### 2026-09-24T13:46:16+03:00 — Настроена сила осветления, затемнения и размытия

- Fixed: перекрывающиеся отпечатки осветлителя и затемнителя больше не усиливают один штрих до белого или чёрного пятна; отдельные ползунки задают силу каждого инструмента.
- Changed: «Сила размытия» теперь задаёт интенсивность в процентах за штрих, включая слабые значения вроде 2%; повторные отпечатки одного штриха не накапливают эффект. Неиспользуемые цвет и непрозрачность скрыты для этих трёх инструментов.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 160 тестов без ошибок. Пользователь сообщил, что после проверки инструменты работают хорошо; отдельный браузерный тест агента не выполнен из-за блокировки локального `file://` адреса браузерным инструментом.

### 2026-09-24T13:34:16+03:00 — Расширены настройки текста и его предпросмотр

- Added: 12 локальных семейств шрифтов с кириллицей и лицензиями, выбор шрифта при создании и в свойствах, загрузка собственного WOFF/WOFF2/TTF/OTF и запрос списка шрифтов компьютера через браузер.
- Added: жирность, курсив, выравнивание, межстрочный и межбуквенный интервалы, подчёркивание, зачёркивание и ширина текстового блока; параметры сохраняются в проекте.
- Changed: диалог текста перемещается за заголовок и меняет размер; предпросмотр показывает фрагмент изображения в месте текста, а изменения временно видны на холсте до применения. «Отмена» убирает черновик, включая случай позднего завершения чтения шрифта.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 156 тестов без ошибок. Живое поведение в браузере не проверено из-за запрета браузерного инструмента на локальный `file://` адрес.

### 2026-09-24T10:52:57+03:00 — Сохранены копии документов и исправлено изменение размера

- Fixed: автовосстановление хранит документы окна вместе и разделяет копии разных окон; чтение старого формата и повреждённых записей не удаляет соседние копии.
- Fixed: начатое скачивание больше не считается подтверждённым сохранением и не очищает восстановление; «Позже», восстановление и удаление копии не перезаписывают копию другого окна.
- Fixed: изменение размера изображения проверяет допустимость преобразований до изменения слоёв, отклоняет неодинаковое масштабирование повёрнутого слоя; изменение размера изображения и холста не прерывает незавершённое редактирование и сбрасывает устаревшее выделение.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 150 тестов без ошибок. Живой браузер и реальный IndexedDB не проверены.

### 2026-09-24T10:17:30+03:00 — Асинхронные операции сохраняют исходный документ

- Fixed: позднее завершение импорта изображений, чтения буфера обмена и открытия проекта больше не переносит результат в другую вкладку.
- Fixed: открытие проекта отменяется, если исходный документ изменился во время чтения файла, включая правки ползунком до записи в историю; создание нового документа не оставляет окно переключения вкладки при очистке автовосстановления.
- Fixed: растеризация проверяет исходный выбранный слой перед заменой и защищает незавершённую операцию от смены документа.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 139 тестов без ошибок. Живой браузер не проверен.

### 2026-09-24T09:02:15+03:00 — Сохранение ожидает завершения редактирования

- Fixed: сохранение проекта, экспорт, переход по истории, Undo/Redo, смена вкладки и удаление слоя больше не прерывают незавершённый жест или асинхронную растровую операцию; команда просит повторить её после завершения.
- Fixed: заливка защищает документ уже во время декодирования слоя, а градиент — до завершения кодирования Canvas.
- Changed: экспорт использует отдельный снимок документа, поэтому правки после запуска не меняют экспортируемое изображение.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 130 тестов без ошибок. Живой браузер не проверен.

### 2026-09-24T08:48:05+03:00 — Исправлены конечные точки жестов и ограничение фигуры

- Fixed: перемещение, изменение размера и поворот слоя учитывают точку отпускания указателя без последнего события движения; щелчок без движения не создаёт лишнее действие истории.
- Fixed: инструмент «Рука» учитывает конечную точку панорамирования, а фигура остаётся квадратной или круглой, если Shift нажат при отпускании.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 126 тестов без ошибок. Живые жесты в браузере не проверены.

### 2026-09-24T08:29:37+03:00 — Исправлено завершение жестов инструментов

- Fixed: кисть, линия, фигура, кадрирование, градиент и выделение учитывают точку отпускания указателя, даже если перед ним не пришло отдельное событие движения.
- Fixed: второй указатель больше не двигает и не завершает активный жест первого указателя.
- Verification: `npm run check` пересобрал bundle, проверил синтаксис и завершил 122 теста без ошибок. Живое взаимодействие в браузере не проверено.

### 2026-09-21T21:08:58+03:00 — Улучшено качество существующих инструментов

- Changed: осветлитель и затемнитель теперь плавно меняют RGB существующих пикселей, сохраняют alpha и не рисуют белой или чёрной краской по прозрачному фону.
- Changed: штамп, лечебная кисть, палец и кисть размытия получили растушёванные края без заметной цепочки круглых отпечатков.
- Fixed: разрушающие растровые инструменты остаются на выбранном видимом растровом слое и больше не переключаются молча на другой слой под курсором; выбор источника штампа через `Alt+клик` по-прежнему находит растровый слой под точкой.
- Changed: магнитное лассо прослеживает контрастную границу промежуточными точками между кликами, градиент показывает цветной предпросмотр, а кадрирование — сетку третей.
- Fixed: подсказка инструмента «Линия» и README теперь описывают фактическое рисование в текущий растровый слой.
- Verification: `npm run check` пересобрал `src/app.bundle.js`; 119 regression-тестов прошли.
- Verification: отдельный Chrome через Playwright при прямом `file://` активировал все 22 инструмента и выполнил операции градиента, штампа, лечебной кисти, пальца, осветлителя, затемнителя, размытия, ластика, кисти, пера, магнитного лассо, волшебной палочки, заливки, линии, фигуры, перемещения, выделения, пипетки, текста, руки, масштаба и кадрирования без ошибок страницы или консоли.

### 2026-09-21T20:33:34+03:00 — Расширены инструменты ретуши и панель инструментов

- Added: рабочие инструменты «Штамп», «Лечебная кисть», «Палец», «Осветлитель», «Затемнитель», «Градиент», «Перо», «Магнитное лассо» и «Волшебная палочка» с горячими клавишами, параметрами и SVG-иконками.
- Changed: панель инструментов на широком экране показывает две колонки и развёрнутые доступные подсказки; на узком экране сохраняется компактная одна колонка.
- Added: в окно «О программе» добавлены имя разработчика, почта и безопасная ссылка на Telegram.
- Fixed: инструмент «Линия» рисует в текущий растровый слой; если слоя ещё нет, создаётся один слой «Линии», который переиспользуется следующими штрихами.
- Added: выбранный в панели слой постоянно отмечается на холсте контрастной рамкой, угловыми маркерами и подписью с именем; индикатор не попадает в экспорт.
- Changed: векторные контуры сохраняются в `.zpe`, рендерятся и проходят нормализацию при открытии проекта.
- Verification: выполнена команда `npm run check`; bundle пересобран, синтаксис проверен, 114 regression-тестов прошли.
- Verification: живой Chromium smoke не завершён — тестовый браузер закрывается до создания страницы; ручная проверка интерфейса и pointer-сценариев остаётся обязательной.

## 1.19.1
- Исправлен `Ctrl+X` в режиме **«Со всех видимых слоёв»**: текстовые и фигурные слои больше не остаются нетронутыми после того, как их изображение попало в буфер обмена.
- При merged-cut пересекающиеся незаблокированные текстовые/фигурные слои автоматически растрируются в том же визуальном виде, после чего выделенная область удаляется из них вместе с растровыми слоями.
- Заблокированные слои по-прежнему не изменяются и явно учитываются в статусе операции. Копирование в системный буфер всё так же выполняется **до** изменения документа.
- Общая логика растеризации переиспользуется обычной командой «Растеризовать слой» и merged-cut; добавлен regression-тест, запрещающий снова пропускать non-raster слои при `Ctrl+X`.

## 1.19.0
- Инструмент `M` теперь поддерживает **четыре типа выделения**: прямоугольное, эллиптическое, свободное лассо и многоугольное лассо.
- Тип выбирается в верхней панели параметров; `Shift+M` циклически переключает варианты.
- `Shift` при рисовании прямоугольного/эллиптического выделения ограничивает форму до квадрата/круга.
- Многоугольное лассо строится кликами; двойной щелчок или `Enter` завершает контур, `Esc` отменяет построение и восстанавливает предыдущее выделение.
- Копирование, вырезание, очистка, кисть, ластик, размытие и заливка теперь учитывают **реальную форму** выделения, а не только его bounding box.
- Для PNG в буфере область вне эллипса/лассо остаётся прозрачной. Добавлены regression-тесты геометрии и wiring новых типов выделения.

## 1.18.0
- Инструмент «Перемещение» получил **умную привязку** к краям и центру холста, а также к краям/центрам остальных видимых слоёв.
- При срабатывании привязки поверх холста отображаются временные **Smart Guides**; порог вычисляется в экранных пикселях, поэтому ощущение привязки не меняется при масштабировании документа.
- `Ctrl` во время перетаскивания временно отключает привязку, а `Shift` ограничивает движение выбранного слоя горизонталью или вертикалью.
- В параметры «Перемещения» добавлены шесть команд выравнивания слоя относительно холста: левый/правый/верхний/нижний край и оба центра; расчёт учитывает поворот слоя.
- Настройка умной привязки сохраняется локально между запусками редактора.
- Emoji/текстовые пиктограммы основных инструментов и действий заменены единым набором **SVG-иконок**; добавлен собственный векторный знак ZeTer в `assets/`.
- Геометрия привязки и выравнивания вынесена в pure-core и покрыта regression-тестами, включая повёрнутые слои и ограничение порога привязки.

## 1.17.0
- Группы слоёв получили собственную **видимость**: глаз на заголовке группы скрывает/показывает всё её содержимое в Canvas и экспортном render pipeline, не меняя индивидуальные флаги видимости дочерних слоёв.
- Добавлена **блокировка группы**: замок защищает дочерние слои от рисования, трансформаций, фильтров, удаления, переименования, изменения порядка и перетаскивания между группами.
- Состояния группы наследуются дочерними слоями в интерфейсе: скрытая группа приглушает строки, заблокированная группа показывает у дочерних слоёв наследованный замок.
- Заблокированную группу нельзя переименовать, удалить или использовать как цель drag-and-drop до разблокировки; сворачивание и переключение видимости остаются доступными.
- Формат `.zpe` расширен обратно совместимо: старые группы без новых полей открываются как видимые и разблокированные.
- Добавлены regression-тесты на наследование видимости/блокировки, сохранение этих состояний и защиту структуры группы.

## 1.16.0
- Добавлены группы слоёв в панели «Слои»: создание отдельной кнопкой, сворачивание/разворачивание и переименование группы двойным кликом.
- Слои можно перетаскивать прямо на заголовок группы; при перетаскивании между слоями сохраняется порядок и автоматически меняется принадлежность к группе.
- Перетаскивание слоя на свободное место панели выносит его из группы и помещает наверх стека.
- Удаление группы не удаляет её содержимое: слои остаются в документе и становятся обычными верхнеуровневыми слоями.
- Переименование выбранного слоя стало заметнее: добавлена кнопка `✎` и команда «Слой → Переименовать слой» в дополнение к двойному клику и `F2`.
- Формат `.zpe` расширен совместимо: добавлены `groups` и `groupId`, старые проекты продолжают открываться без миграции вручную.

## 1.15.0
- Инструмент прямоугольного выделения получил выбор источника Ctrl+C/Ctrl+X: все видимые слои или только выбранный слой.
- Режим «все видимые слои» копирует объединённый результат; Ctrl+X очищает выделение на всех доступных видимых растровых слоях.
- После успешного Ctrl+C/Ctrl+X выделение снимается и автоматически включается «Перемещение», чтобы Ctrl+V можно было сразу позиционировать.

## 1.14.0

- Добавлено копирование активной прямоугольной области в **системный буфер обмена** через `Ctrl+C`; в буфер записывается PNG выбранного слоя с учётом его положения, масштаба, поворота, непрозрачности и эффектов.
- Добавлено вырезание через `Ctrl+X`: сначала PNG гарантированно записывается в буфер, затем пиксели внутри выделения удаляются с незаблокированного растрового слоя одной исторической операцией «Вырезать выделение».
- Команды «Копировать выделение» и «Вырезать выделение» добавлены в меню «Правка» и «Выделение»; поддержаны также нативные browser-события `copy`/`cut`.
- Clipboard write стартует с `ClipboardItem(Promise<Blob>)`, чтобы не терять user activation во время асинхронного рендера PNG.
- Добавлена проверяемая геометрия округления/обрезки выделения до пиксельных границ и regression-тесты горячих клавиш, порядка copy-before-cut и clipboard wiring.

## 1.13.1

- Кнопка **«+»** создания документа теперь располагается **сразу после последней вкладки**, а не у правого края всей полосы.
- Полоса вкладок занимает только необходимую ширину до доступного предела; при большом числе документов включается горизонтальная прокрутка без разрыва между вкладками и кнопкой добавления.
- Добавлен regression-тест на расположение кнопки новой вкладки относительно контейнера вкладок.

## 1.13.0

- Добавлена **полноценная полоса вкладок документов** в верхней части холста. Рядом с вкладками появилась кнопка **«+»** для создания неограниченного числа новых рабочих документов.
- Каждая вкладка хранит **собственный документ, историю Undo/Redo, масштаб, выделение, кадрирование и dirty-state**, поэтому можно переключаться между несколькими изображениями без потери контекста редактирования.
- Вкладки можно **переключать кликом** и **закрывать крестиком**; при закрытии вкладки с несохранёнными изменениями редактор запрашивает подтверждение.
- Индикатор несохранённых изменений теперь отображается **на каждой вкладке отдельно**, а предупреждение при закрытии браузера учитывает dirty-состояние всех открытых вкладок.
- Добавлены regression-тесты на новую структуру document-tabs и независимые session-state вкладок.

## 1.12.1

- Блок **«Цвет и эффекты»** вынесен из секции свойств в **отдельную правую панель** со своим собственным заголовком и разворачиванием.
- Теперь панель **«Цвет и эффекты»** ведёт себя так же, как **«Слои»** и **«История»**: это самостоятельная карточка правой колонки, а не вложенная часть «Свойств».
- Состояние старой вложенной секции мигрируется в новый panel-state: если раньше у пользователя был свёрнут блок «Цвет и эффекты», теперь автоматически сворачивается новая панель.
- Добавлены regression-тесты на отдельную карточку **«Цвет и эффекты»** и совместимость состояния сворачивания.

## 1.12.0

- Все ползунки цветокоррекции растрового слоя перенесены в постоянный блок **«Свойства → Цвет и эффекты»**: экспозиция, яркость, контраст, светлые области, тени, температура, оттенок, насыщенность, красочность, тон и гамма.
- Размытие также находится в общем блоке эффектов; рядом добавлен быстрый **«Сброс»** для текущего блока.
- Правые панели **«Свойства»**, **«Слои»** и **«История»** получили сворачиваемые заголовки; вложенный блок **«Цвет и эффекты»** сворачивается независимо.
- Состояние свёрнутых панелей хранится локально в браузере и восстанавливается при следующем запуске.
- Заголовки сворачивания доступны с клавиатуры и обновляют `aria-expanded`; иконка показывает текущее состояние.
- Добавлены regression-тесты размещения всех контролов цветокоррекции и сворачиваемых панелей; полный набор — 75 тестов.

## 1.11.0

- Добавлена **неразрушающая цветокоррекция** выбранного растрового слоя с живым предпросмотром и одной записью Undo/Redo при подтверждении.
- Новый диалог «Изображение → Цветокоррекция…» содержит экспозицию, яркость, контраст, светлые области, тени, температуру, оттенок, насыщенность, красочность (Vibrance), тон и гамму.
- Отмена/Escape восстанавливают исходные параметры; отдельная команда сбрасывает только цветокоррекцию, не затрагивая размытие и другие эффекты.
- Базовые слайдеры панели свойств получили числовые значения и быстрый переход в расширенную цветокоррекцию.
- Формат `.zpe` расширен совместимо со старыми проектами: новые параметры имеют безопасные defaults и проходят нормализацию диапазонов при открытии.
- Попиксельные коррекции применяются через отдельный `src/core/color.js`; нейтральные настройки не трогают пиксели, а alpha-канал сохраняется.
- Добавлен ограниченный кэш скорректированных растров; внутренний pixel-loop не создаёт временные массивы на каждый пиксель.
- Canvas CSS-filter дополнен `hue-rotate`, поэтому регулировка тона работает и в общем render/export pipeline.
- Добавлены regression-тесты цветокоррекции, signed range sanitization, backward compatibility старых проектов и UI/render wiring; полный набор — 72 теста.

## 1.10.0

- Добавлено аварийное автосохранение проекта в **IndexedDB**: после изменений снимок сохраняется с debounce, не блокируя каждый pointer event синхронной записью в `localStorage`.
- При следующем запуске найденная аварийная копия проходит `sanitizeProject()` и предлагается к восстановлению; восстановленный документ остаётся несохранённым до явного `Ctrl+S`.
- Очистка автокопии при `Ctrl+S`, открытии другого проекта или создании нового документа сериализована после уже начатых фоновых записей, поэтому старая запись не может «вернуться» из race-condition.
- Добавлен timeout открытия IndexedDB и graceful degradation: проблемы browser storage не должны блокировать запуск самого редактора.
- Значение «Непрозр.» инструмента теперь применяется не только к кисти/ластикам/заливке/линии, но и к новым фигурам и текстовым слоям; preview фигуры показывает ту же непрозрачность.
- Добавлен отдельный визуальный стиль предупреждающих toast-сообщений.
- Добавлены regression-тесты формата recovery-record, wiring автосохранения, сериализации очистки, sanitization recovery и единой непрозрачности; suite расширена до 66 тестов.

## 1.9.0

- Добавлен отдельный инструмент **«Кисть размытия» (`R`)** для локальной ретуши растровых слоёв.
- Размер кисти задаёт область воздействия, новый параметр «Сила размытия» регулирует радиус blur, а «Непрозр.» — интенсивность смешивания эффекта.
- Размытие использует локальный scratch-buffer вокруг мазка вместо обработки всего слоя на каждом pointer move.
- Непрерывный мазок строится серией перекрывающихся blur-dab, поэтому при быстром движении курсора не остаются непромазанные разрывы.
- Кисть размытия работает только по существующему незаблокированному растровому слою и не создаёт скрытые слои автоматически.
- Размытие учитывает активное прямоугольное выделение, трансформацию растрового слоя, давление пера на размер кисти, live preview и Undo/Redo.
- Добавлены regression-тесты wiring инструмента, запрета автосоздания слоя и локального blur pipeline.

## 1.8.0

- Добавлен инструмент прямоугольного выделения (`M`) с «бегущей» рамкой, `Ctrl+A`, `Ctrl+D`, очисткой пикселей и кадрированием по выделению.
- Активное выделение теперь реально ограничивает кисть, ластик и заливку, включая повёрнутые и масштабированные растровые слои.
- Добавлена заливка (`G`) связной области с регулируемым допуском цвета и непрозрачностью; операция защищена от перекрывающихся асинхронных сохранений.
- Добавлен инструмент линии (`L`) как редактируемого фигурного слоя; `Shift` привязывает направление к шагу 45°.
- Добавлена лупа (`Z`): клик увеличивает масштаб относительно курсора, `Alt+клик` уменьшает.
- Верхнее меню получило отдельный раздел «Выделение».
- `Delete` при активном выделении на редактируемом растровом слое очищает пиксели, а без такого контекста сохраняет старое удаление слоя.
- Добавлен модуль `src/core/pixels.js` и regression-тесты flood fill, selection clipping, line hit-testing/snap и wiring новых горячих клавиш.

## 1.7.0

- Навигация холста стала ближе к профессиональным редакторам: `Space+drag` и средняя кнопка мыши панорамируют без переключения инструмента.
- Масштабирование теперь поддерживает `Alt+колесо` наряду с `Ctrl+колесо`, а также `Ctrl++`, `Ctrl+-`, `Ctrl+0` и `Ctrl+1`.
- `Tab` теперь включает полноценный режим холста: скрывает левую панель инструментов и правые панели, сохраняя текущую точку просмотра вместо принудительного `fitToView()`.
- Исправлено перехватывание одиночных горячих клавиш интерактивными элементами: Space/Delete/стрелки больше не ломают нативную клавиатурную работу кнопок и контролов.
- Исправлен «залипший Space» после Alt+Tab/потери фокуса окна: временный режим руки сбрасывается на `window.blur`.
- Панель слоёв получила roving focus и клавиатурную навигацию: `↑/↓`, `Home/End`, `Enter/F2` для переименования, `Delete` для удаления.
- Добавлен явный `:focus-visible` для строк слоёв.
- Добавлены regression-тесты для навигации холста, canvas-only режима, zoom-shortcuts и клавиатурной доступности слоёв.

## 1.6.0

- Добавлен безопасный лимит растровых Canvas-буферов: не более 48 МП; лимит применяется при создании документа, открытии проекта, импорте, растеризации, ручном изменении размеров растрового слоя и перед выделением Canvas для кисти.
- Пустые растровые слои остаются sparse (`dataUrl: null`) до первого реального штриха и больше не кодируются в полноразмерный PNG заранее.
- Кисть поддерживает давление пера через `PointerEvent.pressure`; мышь сохраняет стабильную ширину.
- Добавлены стандартные горячие клавиши `[` / `]` для изменения размера кисти, `Shift+[` / `Shift+]` — крупный шаг.
- Масштаб увеличен до 1600%; при больших увеличениях холст переключается на `image-rendering: pixelated` для пиксельной ретуши.
- Добавлен видимый контур размера кисти/ластика под курсором; исправлено соответствие контура реально выбранному растровому слою при перекрывающихся слоях.
- Пипетка больше не считывает визуальный checkerboard прозрачности как цвет и корректно сообщает о прозрачном пикселе.
- Decode-cache растров ограничен по размеру; повреждённое embedded-изображение больше не обрушает весь render pipeline.
- Добавлены команды «Центрировать слой на холсте» и «Вписать слой в холст».
- Ручка вращения прижимается внутрь интерактивной области, если обычная позиция выходит за край холста, поэтому её можно схватить даже у верхней/боковой границы.
- Исправлен обход pixel-budget через поля ширины/высоты растрового слоя.
- Убраны дублирующий toast при ошибке сохранения штриха и лишнее двойное обновление `modifiedAt` при перестановке слоя.
- Набор regression-тестов расширен до 46 сценариев.

## 1.5.0

- Добавлена ручка вращения выбранного слоя прямо на холсте; `Shift` привязывает угол к шагу 15°.
- Transform-handles получили `Alt`-масштабирование от центра; `Alt+Shift` одновременно сохраняет центр и пропорции.
- `Shift` при рисовании прямоугольника/эллипса создаёт квадрат/круг во всех направлениях перетаскивания.
- Инструмент «Текст» при клике по существующему текстовому слою открывает редактирование текста, размера и цвета вместо создания нового слоя.
- История действий стала кликабельной: можно переходить прямо к любому сохранённому состоянию.
- «Размер холста» получил 9-точечный якорь для контролируемого расширения и обрезки относительно содержимого.
- Перетаскивание слоёв в панели теперь меняет их порядок напрямую.
- Добавлены regression-тесты трансформации от центра, сохранения пропорций, rotation snapping и Shift-ограничения фигуры.


## 1.4.0

- Исправлена гонка асинхронного рендера: полный Canvas-рендер теперь сериализуется и коалесцируется через промежуточный буфер; устаревший кадр не попадает на экран.
- Добавлены реальные 8 transform-handles для изменения размера выбранного слоя, включая корректную работу на повёрнутых слоях.
- `Shift` при угловом resize сохраняет пропорции; вычисление каждого pointer move идёт от исходного transform, поэтому ручки не дрейфуют.
- Перемещение/resize слоя мышью может выходить за границы холста; pointer capture удерживает непрерывный drag.
- Добавлена перестановка слоёв drag-and-drop в панели «Слои».
- Ctrl+колесо масштабирует холст относительно позиции курсора.
- Добавлена команда «Размер изображения», масштабируемая вместе со слоями, и усилена валидация «Размер холста».
- Добавлена команда «Растеризовать слой» для текста и фигур, после чего по ним можно работать кистью/ластиком.
- PNG-кодирование завершённого штриха переведено с синхронного `toDataURL()` на асинхронный `toBlob()` + FileReader, что уменьшает блокировку UI на больших слоях.
- Добавлена защита от гонки быстрого `pointerdown → pointerup` во время асинхронной подготовки кисти и запрет старта следующего штриха, пока предыдущий ещё сохраняется.
- Исправлено восстановление состояния при `pointercancel` для resize/move/crop и добавлена отмена активной трансформации через Esc.
- При замене документа очищается image decode cache и сбрасывается временное состояние кисти, чтобы старый проект не мог протечь в новый.
- Растровое масштабирование использует high-quality image smoothing.
- Усилен sanitizer `.zpe`: ограничиваются числовые параметры, фильтры, duplicate layer ID и неподдерживаемые blend mode.
- Добавлены regression-тесты render pipeline, async brush persistence, pointer-race, rotated hit-testing/resize, reordering и sanitizer.

## 1.3.1

- Исправлен ластик: он больше не создаёт новый слой "Рисование" вместо стирания.
- Ластик теперь работает только по существующему растровому слою: выбранному слою с изображением/рисунком или верхнему растровому слою под курсором.
- Если под курсором нет подходящего растрового слоя, показывается понятное сообщение вместо скрытого создания нового слоя.
- Кисть и ластик теперь корректно рисуют/стирают в координатах самого слоя, поэтому работают не только по полноразмерному слою на весь документ, но и по обычным импортированным растровым изображениям.
- Добавлены regression-тесты, запрещающие автосоздание слоя ластиком и закрепляющие преобразование координат документа в пиксели слоя.

## 1.3.0

- Исправлена главная причина зависаний кисти: удалено `canvas.toDataURL('image/png')` из каждого `pointermove`. PNG-кодирование выполняется только при завершении штриха.
- Live-preview кисти теперь рендерит активный растровый слой прямо из Canvas через `rasterOverrides`, без Base64 encode/decode цикла.
- Перерисовка live-preview ограничена `requestAnimationFrame`, поэтому очередь pointer-событий не запускает бесконтрольное количество полных рендеров.
- Исправлена алгоритмическая проблема длинных штрихов: каждый новый сегмент получает отдельный `beginPath()`, вместо повторного `stroke()` всей растущей траектории.
- Добавлена обработка `getCoalescedEvents()` для более плавного ввода мышью/пером при высокой частоте событий.
- Первый штрих по уже открытой растровой картинке повторно использует декодированное изображение из render-cache вместо лишнего decode.
- Во время live-preview больше не переинициализируется overlay-canvas на каждом кадре.
- Checkerboard прозрачности переведён с тысяч `fillRect` на повторяющийся Canvas pattern.
- Добавлена обработка `pointercancel`, чтобы незавершённый штрих не оставлял инструмент в сломанном состоянии.
- История Undo/Redo получила бюджет памяти 128 MiB: старые тяжёлые raster snapshots автоматически удаляются, вместо бесконтрольного роста RAM.
- Добавлены regression-тесты, которые запрещают возвращать PNG-кодирование и полную перерисовку прямо в `paintTo`.
- Browser smoke: длинный штрих на документе 1919×922, кисть → ластик → Undo → Redo, без JavaScript errors.

## 1.2.0

- Исправлена корневая причина неработающего интерфейса при запуске двойным кликом по `index.html`: runtime больше не зависит от ES-модулей и HTTP-сервера.
- Добавлена браузерная сборка `src/app.bundle.js`, которая работает через обычный `file://` запуск.
- `start.bat` теперь просто открывает `index.html`; Python для запуска редактора больше не требуется.
- Усилен drag-and-drop из Windows Explorer: обработчики перенесены на capture-уровень `window`, чтобы браузер не перехватывал файл как навигацию.
- Определение drag-файлов теперь проверяет `DataTransfer.files`, `items` и `types`, а не только строку `Files`.
- Вставка через `Ctrl+V` продолжает использовать нативный `paste` и показывает диагностику, если браузер передал буфер без изображения.
- Добавлен boot-marker и понятное сообщение при критической ошибке запуска.
- Стартовый документ теперь чистый: без демонстрационных слоёв; первое импортированное изображение задаёт размеры документа.
- `Ctrl+V` получил двойной путь: нативный `paste` + Clipboard API fallback без двойной вставки.
- Добавлены regression-тесты, запрещающие возврат `type=module` в прямой Windows-запуск.

## 1.1.0

- Исправлено и расширено верхнее меню: Файл, Правка, Слой, Изображение, Вид, Помощь.
- Добавлено открытие меню и навигация по нему с клавиатуры.
- Добавлен глобальный drag-and-drop изображений с рабочего стола.
- Добавлено открытие `.zpe`, `.pixforge` и JSON-проекта перетаскиванием.
- Добавлена вставка изображений и скриншотов через `Ctrl+V`.
- Добавлена команда вставки изображения из Clipboard API с безопасным fallback на `Ctrl+V`.
- Горячие клавиши переведены на `KeyboardEvent.code`, чтобы Ctrl-команды работали при русской раскладке.
- Добавлен Ctrl+Shift+S для экспорта и Ctrl+Shift+N для нового растрового слоя.
- Добавлен сдвиг выбранного слоя стрелками, Shift+стрелки — шаг 10 px.
- Добавлен выбор соседнего слоя через Alt+↑ / Alt+↓.
- Добавлен Ctrl+колесо для масштабирования холста.
- Добавлено скрытие правой панели через Tab и fullscreen через F11.
- Добавлены уведомления об импорте/ошибках и полноэкранная подсказка при перетаскивании файлов.
- Изменение фильтров и непрозрачности теперь имеет live preview и корректно попадает в Undo/Redo.
- Добавлено предупреждение перед заменой документа с несохранёнными изменениями.
- Добавлены справка по горячим клавишам и окно «О программе».
- Логотип в шапке изменён с PF на ZP.
