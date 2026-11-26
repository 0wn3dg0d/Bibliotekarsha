import { StoreWebkitSettings } from '../stores/incognito';

export const SCREENSHOTS_GITHUB_OWNER = '0wn3dg0d';
export const SCREENSHOTS_GITHUB_REPO = 'Bibliotekarsha';
export const SCREENSHOTS_GITHUB_BRANCH = 'main';

export function getScreenshotUrls(rawPath: string): string[] {
  if (/^(https?:|data:)/i.test(rawPath)) return [rawPath];
  const clean = rawPath.replace(/^\/+/, '');
  return [
    `https://cdn.jsdelivr.net/gh/${SCREENSHOTS_GITHUB_OWNER}/${SCREENSHOTS_GITHUB_REPO}@${SCREENSHOTS_GITHUB_BRANCH}/${clean}`,
    `https://raw.githubusercontent.com/${SCREENSHOTS_GITHUB_OWNER}/${SCREENSHOTS_GITHUB_REPO}/${SCREENSHOTS_GITHUB_BRANCH}/${clean}`,
  ];
}

export type SettingsCategoryId =
  | 'library'
  | 'gamePage'
  | 'catalog'
  | 'community'
  | 'wishlistNews'
  | 'account'
  | 'incognito';

export interface SettingsCategoryDef {
  id: SettingsCategoryId;
  label: string;
  icon: string;
  description: string;
}

export interface SettingScreenshot {
  url: string;
  caption: string;
}

export interface SettingItemDef {
  id: string;
  category: SettingsCategoryId;
  kind: 'module' | 'webkit-bool' | 'webkit-select';
  moduleId?: string;
  parentModuleId?: string;
  webkitKey?: keyof StoreWebkitSettings;
  parentWebkitKey?: keyof StoreWebkitSettings;
  label: string;
  shortDesc: string;
  title: string;
  detailsHtml: string;
  screenshots?: SettingScreenshot[];
  warning?: string;
}

const SMART_TAGS_NOTE = `
  <div style="margin: 10px 0; padding: 10px 12px; background: rgba(102, 192, 244, 0.08); border: 1px solid rgba(102, 192, 244, 0.28); border-radius: 4px;">
    <strong>Как работают «Умные метки»:</strong> у каждой игры в Steam может быть до 20 пользовательских меток, выстроенных по убыванию точности — главные жанры и особенности всегда находятся в самом начале списка, а второстепенные в конце.
    Число справа от добавленной метки задаёт её минимальный приоритет. Например, если вы ищете <em>Point &amp; Click</em>, укажите <strong>до 5</strong> — тогда покажутся игры, где эта метка входит в первую пятёрку, а не висит где-то на 18-м месте. Также можно добавить метки в столбец исключений, чтобы полностью скрыть игры с ними.
  </div>
`;

export const SETTINGS_CATEGORIES: SettingsCategoryDef[] = [
  {
    id: 'library',
    label: 'Библиотека Steam',
    icon: '📚',
    description: 'Фильтры всей библиотеки и коллекций, рулетка, счётчики, блок «Сведения об игре», сводка NFO и Наблюдатель.',
  },
  {
    id: 'gamePage',
    label: 'Страница игры (Магазин)',
    icon: '🎮',
    description: 'Индикаторы русского языка, расширенные обзоры, сводка NFO, агрегатор цен (%), анализатор цен, PICS, подарки и заметки.',
  },
  {
    id: 'catalog',
    label: 'Каталог поиска (Магазин)',
    icon: '🔎',
    description: 'Всплывающие карточки игр, фильтры перевода/DLC/EA/демо, умные метки и массовое управление игнор-листом.',
  },
  {
    id: 'community',
    label: 'Лента активности',
    icon: '📰',
    description: 'Карточки игр при наведении, восстановление обложек и замена сломанных YouTube-плееров.',
  },
  {
    id: 'wishlistNews',
    label: 'Желаемое и Новости',
    icon: '🎁',
    description: 'Анализатор цен и подарков в списке желаемого, а также фильтр скрытия новостей в Новостном центре.',
  },
  {
    id: 'account',
    label: 'Аккаунт',
    icon: '🧹',
    description: 'Умная очистка списка скрытых продуктов по числу обзоров и рейтингу.',
  },
  {
    id: 'incognito',
    label: 'Режим «Инкогнито»',
    icon: '🕵️',
    description: 'Автоматический просмотр заблокированных в регионе страниц, локальный список желаемого и исправление виджетов.',
  },
];

export const SETTINGS_CATALOG: SettingItemDef[] = [
  // ================= БИБЛИОТЕКА STEAM =================
  {
    id: 'mod:library-filter',
    category: 'library',
    kind: 'module',
    moduleId: 'library-filter',
    label: 'Общая фильтрация библиотеки (BSH)',
    shortDesc: 'Добавляет кнопку BSH в панель фильтров всей библиотеки Steam.',
    title: 'Общая фильтрация библиотеки',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку <strong>BSH</strong> в стандартную панель фильтров библиотеки Steam. Позволяет отфильтровать все игры аккаунта по дополнительным параметрам:</p>
      <ul>
        <li><strong>Русский язык:</strong> озвучка, субтитры/интерфейс, без перевода.</li>
        <li><strong>Ранний доступ:</strong> только в раннем доступе, бывшие игры раннего доступа / переиздания или скрытие раннего доступа.</li>
        <li><strong>Отзывы и рейтинг:</strong> точные диапазоны по количеству обзоров и проценту положительных отзывов.</li>
        <li><strong>Год выхода:</strong> выбор одного или нескольких лет со встроенным поиском.</li>
        <li><strong>Шаблоны:</strong> сохранение наборов фильтров для быстрого переключения в один щелчок.</li>
      </ul>
      ${SMART_TAGS_NOTE}
    `,
    screenshots: [
      { url: 'assets/screenshots/library-filter-btn.jpg', caption: 'Кнопка BSH в панели фильтров библиотеки' },
      { url: 'assets/screenshots/library-filter-modal.jpg', caption: 'Окно фильтров Bibliotekarsha' },
    ],
  },
  {
    id: 'mod:collection-filter',
    category: 'library',
    kind: 'module',
    moduleId: 'collection-filter',
    label: 'Фильтрация внутри коллекций',
    shortDesc: 'Добавляет кнопку BSH в шапку каждой коллекции рядом с сортировкой и подписывает перевод под обложками.',
    title: 'Фильтрация внутри коллекций',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку <strong>BSH</strong> в верхнюю панель каждой коллекции рядом со списком сортировки. При активном фильтре кнопка показывает счётчик вида <code>подходит/всего</code>, а рядом появляется кнопка быстрого сброса <code>×</code>.</p>
      <ul>
        <li><strong>Независимые фильтры:</strong> для каждой коллекции можно настроить свой отдельный фильтр по языку, раннему доступу, году выхода, обзорам, рейтингу и умным меткам.</li>
        <li><strong>Массовое применение:</strong> в окне фильтра есть кнопки «Применить ко всем коллекциям» (копирует текущий фильтр на все коллекции, не затрагивая общий список игр) и «Снять со всех коллекций».</li>
        <li><strong>Подписи под обложками:</strong> когда в коллекции включён фильтр, под каждой карточкой игры дополнительно выводится уровень русской локализации (например, «Русская озвучка» или «Субтитры + интерфейс»).</li>
      </ul>
      ${SMART_TAGS_NOTE}
    `,
    screenshots: [
      { url: 'assets/screenshots/collection-filter-header.jpg', caption: 'Кнопка BSH в шапке коллекции' },
      { url: 'assets/screenshots/collection-filter-cards.jpg', caption: 'Отфильтрованная коллекция с подписями локализации' },
    ],
  },
  {
    id: 'mod:sidebar-collections',
    category: 'library',
    kind: 'module',
    moduleId: 'sidebar-collections',
    label: 'Счётчики в списке коллекций',
    shortDesc: 'Показывает бейдж «подходит/всего» рядом с каждой коллекцией в левом меню при активном фильтре.',
    title: 'Двойные счётчики в списке коллекций',
    detailsHtml: `
      <p><strong>Что делает:</strong> когда в коллекции активен фильтр Bibliotekarsha, рядом с её названием в левом списке библиотеки появляется цветной счётчик <code>подходит/всего</code>.</p>
      <ul>
        <li>Голубой бейдж — в коллекции есть подходящие игры.</li>
        <li>Красный бейдж (<code>0/...</code>) — ни одна игра коллекции не прошла текущий фильтр.</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/sidebar-counters.jpg', caption: 'Счётчики подходит/всего в боковой панели коллекций' },
    ],
  },
  {
    id: 'mod:library-roulette',
    category: 'library',
    kind: 'module',
    moduleId: 'library-roulette',
    label: 'Рулетка библиотеки',
    shortDesc: 'Кнопка «🎲 Рулетка» в общих фильтрах для случайного выбора игры из отмеченных коллекций.',
    title: 'Рулетка библиотеки',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку <strong>🎲 Рулетка</strong> под кнопкой BSH в панели общих фильтров библиотеки. Помогает выбрать случайную игру с учётом всех активных фильтров Steam и Bibliotekarsha.</p>
      <ul>
        <li><strong>Список коллекций слева:</strong> отображает «Избранное», ваши коллекции и игры «Без категории» со счётчиком подходящих игр. Доступны поиск, кнопки «Выбрать все» / «Убрать все» и <strong>выделение протяжкой</strong> — зажмите левую кнопку мыши и проведите по списку, чтобы быстро отметить или снять сразу несколько коллекций.</li>
        <li><strong>Запуск рулетки:</strong> в шапке всегда видно, сколько уникальных игр участвует в розыгрыше. Можно включить «Приоритет по отзывам», чтобы игры с высоким рейтингом и большим числом отзывов выпадали чаще.</li>
        <li><strong>Просмотр подборки:</strong> переключение в сетку всех отобранных игр с поиском и сортировкой по имени, году выхода, умному рейтингу и наигранному времени.</li>
        <li><strong>Карточка игры:</strong> показывает постер, рейтинг, наигранное время, русский язык, дату выхода, разработчика, издателя, теги и описание, а также кнопки <strong>«Перейти в библиотеке»</strong>, <strong>«▶ Запустить»</strong> и <strong>«Магазин ↗»</strong>.</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/library-roulette-main.jpg', caption: 'Окно рулетки со списком коллекций и результатом' },
      { url: 'assets/screenshots/library-roulette-grid.jpg', caption: 'Режим просмотра всей подборки с сортировкой' },
    ],
  },
  {
    id: 'mod:game-loc-badge',
    category: 'library',
    kind: 'module',
    moduleId: 'game-loc-badge',
    label: 'Сведения об игре: Русский язык и Ранний доступ',
    shortDesc: 'Добавляет секцию «Сведения об игре» в правую колонку страницы игры в библиотеке.',
    title: 'Сведения об игре в правой колонке библиотеки',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет в верх правой колонки на странице игры в библиотеке нативный блок <strong>«Сведения об игре»</strong>.</p>
      <ul>
        <li><strong>Русский язык:</strong> показывает уровень перевода (Русская озвучка, Субтитры + интерфейс, Только интерфейс, Только субтитры или Без русского) с цветным индикатором.</li>
        <li><strong>Ранний доступ:</strong> если игра сейчас в раннем доступе, выводит, сколько времени она там находится; если уже вышла — показывает, сколько провела в раннем доступе до релиза.</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/library-game-details-card.jpg', caption: 'Секция «Сведения об игре» в правой колонке библиотеки' },
    ],
  },
  {
    id: 'mod:game-nfo-button',
    category: 'library',
    kind: 'module',
    moduleId: 'game-nfo-button',
    label: 'Кнопка сводки NFO (i) на странице игры',
    shortDesc: 'Круглая кнопка «i» рядом с кнопкой «Играть» для открытия окна NFO (HLTB, ZOG, друзья, обзоры и кнопка «✎ Заметки»).',
    title: 'Кнопка сводки NFO (i) в библиотеке',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет круглую кнопку <strong>i</strong> в панель статистики рядом с кнопкой «Играть» на странице игры в библиотеке. По нажатию открывается окно сводки со включёнными ниже разделами (время прохождения, русификаторы, друзья, расширенные обзоры), а в шапке окна доступна кнопка «✎ Заметки» для быстрого просмотра и редактирования личных заметок по игре.</p>
    `,
    screenshots: [
      { url: 'assets/screenshots/library-nfo-button.jpg', caption: 'Кнопка i рядом с панелью статистики' },
      { url: 'assets/screenshots/library-nfo-modal.jpg', caption: 'Окно сводки NFO в библиотеке' },
    ],
  },
  {
    id: 'mod:nfo-hltb',
    category: 'library',
    kind: 'module',
    moduleId: 'nfo-hltb',
    parentModuleId: 'game-nfo-button',
    label: 'NFO: Время прохождения (HowLongToBeat)',
    shortDesc: 'Показывает среднее время прохождения (сюжет, сюжет + доп., 100%, все стили) в окне NFO.',
    title: 'HowLongToBeat в окне NFO',
    detailsHtml: `
      <p><strong>Что делает:</strong> ищет игру на HowLongToBeat.com и выводит время прохождения по четырём категориям с числом учтённых прохождений. Если найдено несколько похожих названий, позволяет выбрать нужное совпадение.</p>
    `,
  },
  {
    id: 'mod:nfo-zog',
    category: 'library',
    kind: 'module',
    moduleId: 'nfo-zog',
    parentModuleId: 'game-nfo-button',
    label: 'NFO: Русификаторы (Zone of Games)',
    shortDesc: 'Ищет игру в базе ZoneOfGames.ru и выводит список русификаторов со ссылками и размером.',
    title: 'Русификаторы Zone of Games в окне NFO',
    detailsHtml: `
      <p><strong>Что делает:</strong> автоматически ищет игру по каталогу ZoneOfGames.ru и выводит список доступных русификаторов с прямыми ссылками и размером файлов. При неточном совпадении предлагает выбрать игру из списка вариантов.</p>
    `,
  },
  {
    id: 'mod:nfo-friends',
    category: 'library',
    kind: 'module',
    moduleId: 'nfo-friends',
    parentModuleId: 'game-nfo-button',
    label: 'NFO: Время друзей и Глобальные достижения',
    shortDesc: 'Выводит максимум/среднее/минимум часов друзей в игре и статистику глобальных достижений.',
    title: 'Друзья и Достижения в окне NFO',
    detailsHtml: `
      <p><strong>Что делает:</strong> собирает сводку по наигранному времени ваших друзей (лидеры по часам со ссылками на профили, среднее и минимальное время) и глобальную статистику достижений Steam (процент самого редкого достижения и средний прогресс).</p>
    `,
  },
  {
    id: 'mod:nfo-reviews',
    category: 'library',
    kind: 'module',
    moduleId: 'nfo-reviews',
    parentModuleId: 'game-nfo-button',
    label: 'NFO: Расширенные обзоры (Тотальные / Безкитайские / Русские)',
    shortDesc: 'Выводит расширенную статистику обзоров Steam в окне NFO библиотеки с чтением русских отзывов и разбивкой по 29 языкам.',
    title: 'Обзоры Steam в окне NFO библиотеки',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет в окно NFO на странице игры в библиотеке карточку с расширенной статистикой обзоров без перехода в магазин:</p>
      <ul>
        <li><strong>Тотальные:</strong> все обзоры Steam, включая активированные ключами. Нажатие открывает Глобальный монитор обзоров по 29 языкам Steam с таблицей, чекбоксами и интерактивной круговой диаграммой.</li>
        <li><strong>Безкитайские:</strong> статистика без обзоров на упрощённом китайском языке.</li>
        <li><strong>Русские:</strong> статистика только по русскоязычным обзорам. Нажатие открывает окно чтения русских отзывов с переключением «Самые полезные» / «Недавние».</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/library-nfo-reviews.jpg', caption: 'Карточка обзоров в окне NFO библиотеки' },
    ],
  },
  {
    id: 'mod:watcher',
    category: 'library',
    kind: 'module',
    moduleId: 'watcher',
    label: 'Наблюдатель (Уведомления и Календарь релизов)',
    shortDesc: 'Кнопка в верхней панели Steam: отслеживание изменений в желаемом и библиотеке + календарь релизов.',
    title: 'Наблюдатель и Календарь релизов',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку <strong>Наблюдатель</strong> в верхнюю панель клиента Steam со статусами актуальности базы для Желаемого (<code>Ж</code>), Библиотеки (<code>Б</code>) и счётчиком непрочитанных событий. Данные хранятся раздельно для каждого аккаунта Steam.</p>
      <ul>
        <li><strong>Список желаемого:</strong> отслеживает изменения даты выхода, выход из раннего доступа, добавление/изменение/удаление русского языка, появление или скрытие демо и плейтестов, а также снятие игры с продажи и возврат в магазин.</li>
        <li><strong>Библиотека:</strong> отслеживает выход из раннего доступа, изменения русской локализации и снятие/возврат игр. Можно отключить повторную проверку игр, у которых уже есть русский язык, для ускорения сканирования.</li>
        <li><strong>Календарь релизов:</strong> отдельное окно с сеткой календаря по месяцам для игр из вашего желаемого, фильтрами по годам и экспортом в файл <code>.ics</code>.</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/watcher-notifications.jpg', caption: 'Окно уведомлений Наблюдателя' },
      { url: 'assets/screenshots/watcher-calendar.jpg', caption: 'Окно календаря релизов' },
    ],
  },

  // ================= СТРАНИЦА ИГРЫ (МАГАЗИН STEAM) =================
  {
    id: 'wk:gamePage',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'gamePage',
    label: 'Индикаторы перевода, доп. обзоры и Монитор обзоров',
    shortDesc: 'Значки русского языка у обложки, статистика Тотальных/Безкитайских/Русских обзоров и Монитор по 29 языкам.',
    title: 'Индикаторы перевода, доп. обзоры и Глобальный монитор',
    detailsHtml: `
      <p><strong>Что делает:</strong></p>
      <ol>
        <li>Справа от обложки игры добавляет три значка-индикатора наличия русского языка: <strong>Интерфейс</strong>, <strong>Озвучка</strong> и <strong>Субтитры</strong>.</li>
        <li>Под стандартным блоком отзывов добавляет строку расширенной статистики:
          <ul>
            <li><strong>Тотальные:</strong> все обзоры Steam (включая активированные ключами).</li>
            <li><strong>Безкитайские:</strong> обзоры за вычетом написанных на упрощённом китайском языке.</li>
            <li><strong>Русские:</strong> статистика исключительно по русскоязычным обзорам.</li>
          </ul>
        </li>
        <li>Нажатие на <strong>«Русские»</strong> открывает окно с русскоязычными обзорами (переключатель «Самые полезные» / «Недавние» и подгрузка страниц).</li>
        <li>Нажатие на <strong>«Тотальные»</strong> открывает <strong>Глобальный монитор обзоров</strong> — собирает статистику по 29 языкам Steam в таблицу с долями и интерактивную круговую диаграмму.</li>
      </ol>
    `,
    screenshots: [
      { url: 'assets/screenshots/store-indicators-reviews.jpg', caption: 'Индикаторы русского языка и блок доп. обзоров' },
      { url: 'assets/screenshots/store-russian-reviews.jpg', caption: 'Окно русскоязычных обзоров' },
      { url: 'assets/screenshots/store-global-monitor.jpg', caption: 'Глобальный монитор обзоров по языкам' },
    ],
  },
  {
    id: 'wk:autoLoadReviews',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'autoLoadReviews',
    parentWebkitKey: 'gamePage',
    label: 'Автоматически загружать дополнительные обзоры',
    shortDesc: 'Загружает Тотальные, Безкитайские и Русские обзоры сразу при открытии страницы игры.',
    title: 'Авто-загрузка дополнительных обзоров',
    detailsHtml: `
      <p>Если включено, блок расширенных обзоров загружается автоматически сразу при открытии страницы игры, без нажатия на «Загрузить статистику».</p>
    `,
  },
  {
    id: 'wk:storeNfo',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'storeNfo',
    label: 'Кнопка NFO (HLTB, Русификаторы ZOG, Друзья и Достижения)',
    shortDesc: 'Кнопка NFO под индикаторами языка + восстановление блока друзей на страницах в режиме Инкогнито.',
    title: 'Кнопка NFO на странице игры в магазине',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку <strong>NFO</strong> справа от обложки игры (под индикаторами русского языка). По щелчку открывается сводное окно с тремя карточками:</p>
      <ul>
        <li><strong>HowLongToBeat:</strong> время прохождения (сюжет, с доп. заданиями, 100%, все стили).</li>
        <li><strong>Русификаторы (ZOG):</strong> поиск игры на ZoneOfGames.ru и прямые ссылки на переводы.</li>
        <li><strong>Друзья и Достижения:</strong> максимум, среднее и минимум часов друзей в игре + глобальная статистика достижений.</li>
      </ul>
      <p>Дополнительно восстанавливает блок друзей в правой колонке страницы игры, если она открыта через режим «Инкогнито».</p>
    `,
    screenshots: [
      { url: 'assets/screenshots/store-nfo-modal.jpg', caption: 'Сводное окно NFO на странице игры в магазине' },
    ],
  },
  {
    id: 'wk:nfoAutoLoad',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'nfoAutoLoad',
    parentWebkitKey: 'storeNfo',
    label: 'Автоматически загружать данные при открытии окна NFO',
    shortDesc: 'Сразу запускает загрузку HLTB, ZOG и статистики друзей при щелчке на кнопку NFO.',
    title: 'Авто-загрузка данных в окне NFO',
    detailsHtml: `
      <p>Запускает загрузку всех трёх карточек автоматически в момент открытия окна NFO, без ручного нажатия на кнопки обновления.</p>
    `,
  },
  {
    id: 'wk:earlyAccess',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'earlyAccess',
    label: 'Плашка раннего доступа',
    shortDesc: 'Компактный значок «В EA» / «Покинула EA» у обложки с точным сроком при наведении.',
    title: 'Плашка раннего доступа (Магазин)',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет справа над индикаторами компактную плашку <strong>«В EA»</strong> (если игра сейчас в раннем доступе) или <strong>«Покинула EA»</strong> (если игра ранее выходила в раннем доступе). При наведении на плашку показывается точный срок — сколько времени игра находится или провела в раннем доступе до релиза.</p>
    `,
    screenshots: [
      { url: 'assets/screenshots/store-ea-badge.jpg', caption: 'Плашка раннего доступа и всплывающая подсказка' },
    ],
  },
  {
    id: 'wk:salesMaster',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'salesMaster',
    label: 'Агрегатор цен — SalesMaster (%)',
    shortDesc: 'Кнопка «%» для сравнения цен по 17 магазинам ключей и гифтов + предложения текущей страницы Steam.',
    title: 'SalesMaster — Агрегатор цен (%)',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку <strong>%</strong> в панель действий на странице игры (рядом с кнопкой «Поделиться»). Открывает окно сравнения цен по 17 магазинам (SteamBuy, Playo, SteamPay, Gabestore, GamersBase, GamesForFarm, Gamazavr, GameRay, KupiKod, Zaka-zaka, Buka, GGSEL, Plati.Market, МТС Fog Play, Sous-Buy, Ростелеком, Gamers Hub) и текущей странице Steam.</p>
      <ul>
        <li><strong>Выбор издания / DLC (✎):</strong> позволяет выбрать конкретное издание или DLC со страницы игры либо вручную поправить поисковый запрос.</li>
        <li><strong>Фильтр по названию:</strong> поддерживает логические операторы <code>{и}</code>, <code>{или}</code>, <code>{не}</code>. Выделив слово в названии карточки и нажав правую кнопку мыши, можно добавить его в фильтр или в исключения.</li>
        <li><strong>Левая панель:</strong> диапазоны цены, процента и суммы скидки, опция «Только со скидкой» и переключатели магазинов.</li>
        <li><strong>Правая панель:</strong> список слов-исключений с экспортом и импортом.</li>
        <li><strong>Удобства:</strong> сортировка, переключение валюты <strong>RUB / USD</strong> и сворачивание окна (<code>—</code>) в кнопку в углу экрана без потери результатов.</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/store-salesmaster-main.jpg', caption: 'Окно агрегатора цен SalesMaster' },
      { url: 'assets/screenshots/store-salesmaster-editions.jpg', caption: 'Выбор конкретного издания или DLC' },
    ],
  },
  {
    id: 'wk:salesMasterAutoSearch',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'salesMasterAutoSearch',
    parentWebkitKey: 'salesMaster',
    label: 'Автоматически запускать поиск цен при открытии SalesMaster',
    shortDesc: 'Начинает опрос магазинов сразу после нажатия на кнопку «%».',
    title: 'Авто-поиск в SalesMaster',
    detailsHtml: `
      <p>Если включено, при каждом открытии окна SalesMaster сбор предложений по магазинам начинается автоматически, без нажатия «Обновить %».</p>
    `,
  },
  {
    id: 'wk:salesMasterAutoInsertTitle',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'salesMasterAutoInsertTitle',
    parentWebkitKey: 'salesMaster',
    label: 'Автоматически подставлять название игры в фильтр SalesMaster',
    shortDesc: 'Подставляет название текущей игры в поле фильтра по названию после сбора.',
    title: 'Авто-подстановка названия в SalesMaster',
    detailsHtml: `
      <p>После первого сбора данных автоматически вставляет название текущей игры в поле фильтра, скрывая посторонние товары.</p>
    `,
    warning: 'Если у игры длинное название с подзаголовком (например, Director’s Cut), лучше сократить строку в фильтре вручную, чтобы не пропустить подходящие предложения.',
  },
  {
    id: 'wk:priceAnalyzer',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'priceAnalyzer',
    label: 'Анализатор региональных цен',
    shortDesc: 'Сравнение цены по 41 региону Steam, 3 модели РРЦ Valve (Умная / ППС / Курс) и мировой рейтинг.',
    title: 'Анализатор региональных цен',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку <strong>«Анализатор цен»</strong> над блоком покупки на странице игры. По нажатию «Сбор данных» сравнивает цены игры по 41 региону Steam:</p>
      <ul>
        <li>Показывает место выбранного базового региона в мировом рейтинге (от самой дешёвой цены к самой дорогой).</li>
        <li>Рассчитывает отклонение цены от трёх официальных моделей ценообразования Valve: <em>Умная цена (Valve)</em>, <em>ППС</em> и <em>Прямой курс</em>.</li>
        <li>Все колонки таблицы можно сортировать. При выборе <strong>USD</strong> в качестве базы интерфейс таблицы переключается на английский язык.</li>
      </ul>
    `,
    warning: 'Каждый полный сбор отправляет около 41 запроса к серверам Steam. Частый запуск подряд на разных играх может привести к временному ограничению API на 5–15 минут.',
    screenshots: [
      { url: 'assets/screenshots/store-price-analyzer.jpg', caption: 'Таблица анализатора региональных цен' },
    ],
  },
  {
    id: 'wk:picsCheck',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'picsCheck',
    label: 'Проверка строгих региональных ограничений (PICS)',
    shortDesc: 'Помечает пакеты на странице игры, если издатель наложил жёсткие ограничения покупки/активации.',
    title: 'Проверка строгих ограничений (PICS)',
    detailsHtml: `
      <p><strong>Что делает:</strong> проверяет пакеты игры, недоступные в выбранном целевом регионе, и запрашивает скрытый список ограниченных стран напрямую у серверов Steam. Если обнаружены жёсткие ограничения (<code>purchaserestrictedcountries</code>), рядом с кнопкой «В корзину» появляется красная плашка <strong>«🚫 Строгие ограничения»</strong> со списком стран.</p>
    `,
    screenshots: [
      { url: 'assets/screenshots/store-pics-warning.jpg', caption: 'Предупреждение о строгих региональных ограничениях' },
    ],
  },
  {
    id: 'wk:picsTargetRegion',
    category: 'gamePage',
    kind: 'webkit-select',
    webkitKey: 'picsTargetRegion',
    parentWebkitKey: 'picsCheck',
    label: 'Регион проверки PICS',
    shortDesc: 'Регион, для которого проверяется недоступность игры перед запросом ограничений.',
    title: 'Регион проверки PICS',
    detailsHtml: `
      <p>Укажите регион: проверка строгих ограничений будет срабатывать для игр, которые недоступны в выбранном регионе.</p>
    `,
  },
  {
    id: 'wk:giftHelper',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'giftHelper',
    label: 'Доступность подарков — GIFT',
    shortDesc: 'Кнопка GIFT на странице игры: сравнение цены с регионом друга и проверка ограничений PICS.',
    title: 'Проверка подарка другу — GIFT',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку <strong>GIFT</strong> на странице игры. Вы выбираете регион друга, а модуль показывает его локальную цену в вашей валюте, объясняет итоговую стоимость списания по правилам Steam и проверяет, нет ли жёсткой блокировки пакета издателем (PICS).</p>
    `,
    screenshots: [
      { url: 'assets/screenshots/store-gift-helper.jpg', caption: 'Окно проверки доступности подарка GIFT' },
    ],
  },
  {
    id: 'wk:gameNotes',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'gameNotes',
    label: 'Личные заметки и оценки игр',
    shortDesc: 'Кнопка с карандашом: текстовые заметки, оценки по 5 критериям, личная оценка 0–100, галерея и экспорт JSON.',
    title: 'Личные заметки и система оценок',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку с иконкой карандаша в панель действий на странице игры (подсвечивается зелёным, если по игре уже есть заметка).</p>
      <ul>
        <li><strong>Редактор:</strong> свободный текст заметки, 5 критериев по 10-звёздочной шкале (Графика, Сюжет, Геймплей, Звук и музыка, Атмосфера) с автоматическим средним баллом и личная оценка от 0 до 100.</li>
        <li><strong>Галерея «Все заметки»:</strong> просмотр всех записей в виде карточек с сортировкой по дате, названию, среднему баллу, личной оценке или любому из 5 критериев.</li>
        <li><strong>Синхронизация и бэкап:</strong> заметки синхронизируются между страницей игры в магазине и окном NFO в библиотеке, а также входят в единый бэкап в настройках ⚙ BSH.</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/store-notes-editor.jpg', caption: 'Окно редактора заметки и оценок' },
      { url: 'assets/screenshots/store-notes-gallery.jpg', caption: 'Галерея всех заметок' },
    ],
  },
  {
    id: 'wk:externalLinks',
    category: 'gamePage',
    kind: 'webkit-bool',
    webkitKey: 'externalLinks',
    label: 'Доп. ссылки (PCGamingWiki / SteamDB / Копировать EN)',
    shortDesc: 'Быстрые кнопки в шапке страницы игры в магазине и в центре сообщества.',
    title: 'Дополнительные ссылки (PCGamingWiki / SteamDB)',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет в правую часть шапки игры недостающие кнопки (без дублирования, если они уже есть):</p>
      <ul>
        <li><strong>Копировать EN</strong> (в магазине) — копирует оригинальное английское название игры в буфер обмена.</li>
        <li><strong>PCGamingWiki</strong> — переход к статье игры с техническими фиксами и настройками.</li>
        <li><strong>SteamDB</strong> — переход на страницу статистики и истории цен.</li>
        <li><strong>Страница в магазине</strong> (в центре сообщества) — добавляет кнопку возврата в магазин, если она отсутствует.</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/store-external-links.jpg', caption: 'Добавленные кнопки в шапке игры' },
    ],
  },

  // ================= КАТАЛОГ ПОИСКА (МАГАЗИН) =================
  {
    id: 'wk:catalogTooltip',
    category: 'catalog',
    kind: 'webkit-bool',
    webkitKey: 'catalogTooltip',
    label: 'Карточки игр при наведении',
    shortDesc: 'Сводка по игре (издатель, отзывы, EA, перевод, метки, описание) при наведении на /search/.',
    title: 'Карточки игр при наведении в каталоге',
    detailsHtml: `
      <p><strong>Что делает:</strong> при наведении курсора на любую строку на странице поиска (<code>store.steampowered.com/search/</code>) слева открывается всплывающая карточка с издателями, разработчиками, серией, числом и процентом отзывов, статусом раннего доступа, поддержкой русского языка, топ-5 метками и кратким описанием.</p>
    `,
    screenshots: [
      { url: 'assets/screenshots/catalog-tooltip.jpg', caption: 'Всплывающая карточка игры в поиске' },
    ],
  },
  {
    id: 'wk:catalogTooltipEnglish',
    category: 'catalog',
    kind: 'webkit-bool',
    webkitKey: 'catalogTooltipEnglish',
    parentWebkitKey: 'catalogTooltip',
    label: 'Показывать поддержку английского языка в подсказках каталога',
    shortDesc: 'Добавляет строку наличия английского интерфейса, озвучки и субтитров.',
    title: 'Английский язык в подсказках каталога',
    detailsHtml: `
      <p>Полезно для переводчиков и тех, кто играет в оригинале: добавляет в карточку каталога строку с поддержкой английского языка.</p>
    `,
  },
  {
    id: 'wk:catalogFilters',
    category: 'catalog',
    kind: 'webkit-bool',
    webkitKey: 'catalogFilters',
    label: 'Расширенные фильтры и «Умные метки»',
    shortDesc: 'Блоки в правом сайдбаре поиска: Русский перевод, Ваши DLC, Ранний доступ, Демо/Плейтесты, Обзоры и рейтинг, Умные метки.',
    title: 'Расширенные фильтры каталога',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет в правую колонку поиска по каталогу сворачиваемые блоки фильтров:</p>
      <ul>
        <li><strong>Русский перевод:</strong> Только текст / Озвучка / Без перевода.</li>
        <li><strong>DLC:</strong> фильтр «Только ваши DLC» (дополнения к играм из вашей библиотеки дополнительно подсвечиваются фиолетовым).</li>
        <li><strong>Ранний доступ:</strong> Только ранний доступ / Бывший EA или переиздание / Скрыть ранний доступ.</li>
        <li><strong>Демо и плейтесты:</strong> С демо или плейтестом / Только демо / Только плейтесты.</li>
        <li><strong>Обзоры и рейтинг:</strong> точные диапазоны количества отзывов и процента положительных оценок.</li>
        <li><strong>Умные метки:</strong> кнопка «Настроить метки...» с перетаскиванием меток между активными и исключёнными.</li>
      </ul>
      ${SMART_TAGS_NOTE}
    `,
    screenshots: [
      { url: 'assets/screenshots/catalog-sidebar-filters.jpg', caption: 'Новые блоки фильтров в сайдбаре каталога' },
      { url: 'assets/screenshots/catalog-smart-tags.jpg', caption: 'Окно настройки «Умных меток»' },
    ],
  },
  {
    id: 'wk:catalogMassTools',
    category: 'catalog',
    kind: 'webkit-bool',
    webkitKey: 'catalogMassTools',
    label: 'Массовое скрытие и раскрытие игр (Игнор-лист)',
    shortDesc: 'Блок «Скрытие» в каталоге: «Раскрыватель» по обзорам/рейтингу и «Массовое скрытие» чекбоксами.',
    title: 'Массовое скрытие и раскрытие в каталоге',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет в правую колонку поиска блок <strong>«Скрытие»</strong> с двумя перетаскиваемыми окнами:</p>
      <ul>
        <li><strong>Раскрыватель:</strong> находит на текущей странице поиска игры из вашего списка «Не интересно», фильтрует их по числу обзоров и проценту рейтинга и пакетно возвращает подходящие обратно в каталог.</li>
        <li><strong>Массовое скрытие:</strong> включает круглые чекбоксы слева от строк выдачи, позволяя отметить ненужные игры и скрыть их одной очередью с защитой от лимитов запросов Steam (429).</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/catalog-unhider.jpg', caption: 'Окно «Раскрыватель»' },
      { url: 'assets/screenshots/catalog-mass-hider.jpg', caption: 'Режим чекбоксов «Массовое скрытие»' },
    ],
  },

  // ================= ЛЕНТА АКТИВНОСТИ =================
  {
    id: 'wk:homeInfo',
    category: 'community',
    kind: 'webkit-bool',
    webkitKey: 'homeInfo',
    label: 'Карточки игр и восстановление обложек',
    shortDesc: 'Подсказка со сводкой по игре при наведении и загрузка скрытых обложек в ленте активности.',
    title: 'Карточки игр и обложки в ленте активности',
    detailsHtml: `
      <p><strong>Что делает:</strong> на странице ленты активности (<code>steamcommunity.com/my/home</code>) восстанавливает пустые обложки регионально заблокированных игр и при наведении на ссылки показывает карточку с шапкой, датой выхода, издателем, разработчиком, отзывами, ранним доступом, русским языком, метками и описанием.</p>
    `,
    screenshots: [
      { url: 'assets/screenshots/community-home-tooltip.jpg', caption: 'Всплывающая карточка игры в ленте активности' },
    ],
  },
  {
    id: 'wk:homeInfoEnglish',
    category: 'community',
    kind: 'webkit-bool',
    webkitKey: 'homeInfoEnglish',
    parentWebkitKey: 'homeInfo',
    label: 'Показывать поддержку английского языка в подсказках активности',
    shortDesc: 'Добавляет строку поддержки английского языка в карточку ленты активности.',
    title: 'Английский язык в ленте активности',
    detailsHtml: `
      <p>Отображает наличие английского интерфейса, озвучки и субтитров во всплывающих карточках ленты активности.</p>
    `,
  },
  {
    id: 'wk:homeYoutubeFix',
    category: 'community',
    kind: 'webkit-bool',
    webkitKey: 'homeYoutubeFix',
    label: 'Исправление YouTube-плееров',
    shortDesc: 'Заменяет неработающие встроенные плееры YouTube на превью со ссылкой на ролик.',
    title: 'Исправление YouTube-плееров в ленте активности',
    detailsHtml: `
      <p><strong>Что делает:</strong> заменяет неработающие встроенные iframe-плееры YouTube в ленте активности на картинку-превью с кнопкой воспроизведения. Щелчок открывает видео напрямую на YouTube.</p>
    `,
    screenshots: [
      { url: 'assets/screenshots/community-youtube-fix.jpg', caption: 'Превью видео вместо сломанного плеера' },
    ],
  },

  // ================= ЖЕЛАЕМОЕ И НОВОСТИ =================
  {
    id: 'wk:wishlistGiftHelper',
    category: 'wishlistNews',
    kind: 'webkit-bool',
    webkitKey: 'wishlistGiftHelper',
    label: 'Анализатор и помощник подарков (Список желаемого)',
    shortDesc: 'Кнопка лупы на /wishlist/: фильтры по РРЦ Valve, меткам, языку и сравнение цен подарка с регионом друга.',
    title: 'Анализатор и помощник подарков в списке желаемого',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку лупы рядом с заголовком списка желаемого. Загружает карточки всех игр списка (пачками до 150 игр) и предоставляет:</p>
      <ul>
        <li>Сортировку по цене, скидке, названию, дате выхода и рейтингу обзоров.</li>
        <li>Расчёт отклонения цены от трёх моделей Valve (Умная цена, ППС, Курс) и фильтр по РРЦ.</li>
        <li>Полный набор фильтров: скидки, цена, обзоры, рейтинг, дата выхода, русский язык, ранний доступ, статус релиза, демо/плейтесты и умные метки.</li>
        <li><strong>Режим подарков (🎁):</strong> выбор региона друга, пересчёт цен в вашу валюту и цветовая индикация разницы (зелёная — без переплаты, красная — у друга дороже).</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/wishlist-gift-helper.jpg', caption: 'Окно анализатора и помощника подарков в желаемом' },
    ],
  },
  {
    id: 'wk:newsFilter',
    category: 'wishlistNews',
    kind: 'webkit-bool',
    webkitKey: 'newsFilter',
    label: 'Фильтр и скрытие новостей (Новостной центр)',
    shortDesc: 'Чекбоксы скрытия новостей, отмена последнего действия и перетаскиваемая панель на /news/.',
    title: 'Фильтр новостей в Новостном центре',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет на страницу Новостного центра (<code>store.steampowered.com/news/</code>) чекбоксы для отметки неинтересных новостей и перетаскиваемую панель управления.</p>
      <ul>
        <li>Выбранные новости скрываются кнопкой «Скрыть выбранные» (база хранится отдельно для каждого аккаунта Steam).</li>
        <li>После скрытия на 6 секунд появляется кнопка «Отменить».</li>
        <li>Через «Показать скрытое» и «Хранилище» можно в любой момент просмотреть и вернуть скрытые материалы.</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/news-filter-panel.jpg', caption: 'Панель управления и чекбоксы в Новостном центре' },
    ],
  },

  // ================= АККАУНТ =================
  {
    id: 'wk:ignoredCleaner',
    category: 'account',
    kind: 'webkit-bool',
    webkitKey: 'ignoredCleaner',
    label: 'Умная очистка списка игнорируемых игр',
    shortDesc: 'Кнопка «Управление очисткой» на /account/notinterested/ для массового раскрытия игр по рейтингу и обзорам.',
    title: 'Умная очистка списка скрытых продуктов',
    detailsHtml: `
      <p><strong>Что делает:</strong> добавляет кнопку <strong>«Управление очисткой»</strong> на странице скрытых продуктов (<code>store.steampowered.com/account/notinterested/</code>).</p>
      <ol>
        <li>Собирает число обзоров и рейтинг для всех игр из вашего игнор-листа.</li>
        <li>Позволяет задать диапазоны обзоров и рейтинга (%) — например, найти качественные игры с рейтингом от 80% и выше.</li>
        <li>Аккуратно извлекает подходящие игры обратно в рекомендации с автоматической паузой при лимитах запросов Steam (429).</li>
      </ol>
    `,
    screenshots: [
      { url: 'assets/screenshots/account-ignored-cleaner.jpg', caption: 'Окно умной очистки игнор-листа' },
    ],
  },

  // ================= РЕЖИМ ИНКОГНИТО =================
  {
    id: 'wk:enabled',
    category: 'incognito',
    kind: 'webkit-bool',
    webkitKey: 'enabled',
    label: 'Виртуальный режим «Инкогнито» (В.Р.И.)',
    shortDesc: 'Автоматически открывает заблокированные в регионе страницы магазина и сообщества.',
    title: 'Виртуальный режим «Инкогнито» (В.Р.И.)',
    detailsHtml: `
      <p><strong>Что делает:</strong> при обнаружении заглушки «Данный товар недоступен в вашем регионе» автоматически загружает страницу магазина или сообщества через выбранный регион В.Р.И. с обходом возрастного экрана и рабочим плеером трейлеров и скриншотов.</p>
    `,
    screenshots: [
      { url: 'assets/screenshots/incognito-page.jpg', caption: 'Заблокированная страница игры, открытая в режиме Инкогнито' },
    ],
  },
  {
    id: 'wk:defaultRegion',
    category: 'incognito',
    kind: 'webkit-select',
    webkitKey: 'defaultRegion',
    label: 'Регион по умолчанию для В.Р.И.',
    shortDesc: 'Основной регион для открытия заблокированных страниц (при неудаче пробуются резервные US, CH, KZ, JP).',
    title: 'Регион по умолчанию для В.Р.И.',
    detailsHtml: `
      <p>Регион, от лица которого запрашиваются недоступные страницы магазина, сообщества и виджетов. По умолчанию выбран <strong>US (США)</strong> как наиболее универсальный.</p>
    `,
  },
  {
    id: 'wk:incognitoWishlist',
    category: 'incognito',
    kind: 'webkit-bool',
    webkitKey: 'incognitoWishlist',
    label: 'Локальное желаемое и статус библиотеки (для В.Р.И.)',
    shortDesc: 'Показывает «В библиотеке» и локальный список желаемого на недоступных страницах игр.',
    title: 'Локальное желаемое и статус библиотеки',
    detailsHtml: `
      <p><strong>Что делает:</strong> на страницах, открытых через режим «Инкогнито», проверяет ваш реальный аккаунт Steam:</p>
      <ul>
        <li>Если игра уже есть на аккаунте — отображает кнопку <strong>«В библиотеке»</strong>.</li>
        <li>Если игры нет — возвращает рабочую кнопку <strong>«В желаемое»</strong> с сохранением в локальный список (раздельно для каждого аккаунта) и галерею <strong>«Управление недоступным желаемым»</strong>.</li>
        <li>Если ранее добавленная в официальное желаемое игра стала недоступна в регионе — автоматически переносит её в локальный список.</li>
      </ul>
    `,
    screenshots: [
      { url: 'assets/screenshots/incognito-wishlist-btn.jpg', caption: 'Кнопки статуса библиотеки и локального желаемого' },
      { url: 'assets/screenshots/incognito-wishlist-gallery.jpg', caption: 'Галерея «Недоступное желаемое»' },
    ],
  },
  {
    id: 'wk:widgetFixer',
    category: 'incognito',
    kind: 'webkit-bool',
    webkitKey: 'widgetFixer',
    label: 'Разблокировка недоступных виджетов Steam',
    shortDesc: 'Автоматически перезагружает заблокированные в регионе iframe-виджеты магазина.',
    title: 'Разблокировка виджетов Steam',
    detailsHtml: `
      <p><strong>Что делает:</strong> находит на страницах Steam встроенные виджеты игр (<code>store.steampowered.com/widget/</code>), которые выдают ошибку региональной недоступности, и автоматически перезагружает их через регион В.Р.И. (или резервные US, CH, KZ, JP).</p>
    `,
  },
];
