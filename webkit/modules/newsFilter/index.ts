import {
  StoreWebkitConfig,
  getActiveSteamId64,
  idbGet,
  idbSet,
  injectStyleOnce,
} from '../../shared/ipc';

interface HiddenNewsItem {
  id: string;
  appID: string | null;
  gameName: string;
  newsTitle: string;
  dateHidden: number;
}

const NEWS_ITEM_SELECTOR = ':is(.gPGNIeRVWCQ-, ._398u23KF15gxmeH741ZSyL)';
const NEWS_APP_AREA_SELECTOR = '.Zlty4OIYdk8-, ._3-0KOhYVQX2zIP3z-jCAdu';
const NEWS_APP_NAME_SELECTOR = '.C2L2kTp8KYY-, ._71phFKOzg8aQlBU1rCA2T';
const NEWS_LINK_SELECTOR = 'a.Focusable[href*="/news/app/"]';
const NEWS_TITLE_SELECTOR = '.SlFMYJwWSU4-, ._1M8-Pa3b3WboayCgd5VBJT';
const NEWS_IMAGE_CONTAINER_SELECTOR = '.lSYF-snjG-M-, ._3HF9tOy_soo1B_odf1XArk';
const NEWS_IMAGE_CONTAINER_FALLBACK_SELECTOR = '.iogiG-p5PHg-, ._2A8sQ35o5MKE0P2B9C0bAn';
const PANEL_POS_KEY = 'use_newsfilter_panel_position_v1';

const NEWS_FILTER_CSS = `
  .use-newsfilter-checkbox-area {
    position: absolute;
    top: 0;
    left: 0;
    width: 90px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    -webkit-tap-highlight-color: transparent;
  }
  .use-newsfilter-checkbox {
    appearance: none;
    -webkit-appearance: none;
    width: 46px;
    height: 46px;
    border: 3px solid rgba(102, 192, 244, 0.6);
    border-radius: 5px;
    background-color: rgba(27, 40, 56, 0.5);
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    opacity: 0.5;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .use-newsfilter-checkbox-area:hover .use-newsfilter-checkbox {
    opacity: 1;
    border-color: #ade0ff;
    background-color: rgba(27, 40, 56, 0.75);
  }
  .use-newsfilter-checkbox:checked {
    background-color: rgba(102, 192, 244, 1);
    border-color: #e1e8ed;
    opacity: 1;
  }
  .use-newsfilter-checkbox:checked::before {
    content: '✔';
    color: #0a121c;
    font-size: 30px;
    font-weight: bold;
  }
  .use-newsfilter-newsitem-selected {
    opacity: 0.45;
    transition: opacity 0.25s ease-in-out;
  }
  .use-newsfilter-newsitem-selected:hover {
    opacity: 0.75;
  }
  .use-newsfilter-newsitem-persistently-hidden {
    opacity: 0.25 !important;
    border: 1px dashed #4a5562;
    transition: opacity 0.3s, border 0.3s;
  }
  .use-newsfilter-controls-container {
    position: fixed;
    top: 20px;
    right: 15px;
    background: rgba(20, 23, 28, 0.92);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #2b3440;
    z-index: 100010;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 200px;
    font-family: "Motiva Sans", Arial, sans-serif;
  }
  .use-newsfilter-button {
    padding: 7px 12px;
    background-color: #58a6ff;
    color: #0d1117;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background-color 0.2s, transform 0.1s;
    width: 100%;
    text-align: center;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  .use-newsfilter-button:hover:not(:disabled) {
    background-color: #79bbff;
    transform: translateY(-1px);
  }
  .use-newsfilter-button:active:not(:disabled) {
    transform: translateY(0px);
    background-color: #4a90e2;
  }
  .use-newsfilter-button:disabled {
    background-color: #30363d;
    color: #6a737d;
    cursor: not-allowed;
    box-shadow: none;
  }
  .use-newsfilter-storage-count {
    color: #99a1a8;
    font-size: 11px;
    margin-top: 2px;
    text-align: center;
  }
  #use-newsfilter-confirm-hide-button:not(:disabled) {
    background-color: #d9534f;
    color: white;
  }
  #use-newsfilter-confirm-hide-button:not(:disabled):hover {
    background-color: #c9302c;
  }
  #use-newsfilter-undo-button {
    background-color: #f0ad4e;
    color: #0d1117;
  }
  #use-newsfilter-undo-button:hover:not(:disabled) {
    background-color: #ec971f;
  }
  #use-newsfilter-manage-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 650px;
    max-height: 75vh;
    background-color: #171a21;
    border: 1px solid #4a5562;
    border-radius: 4px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
    z-index: 100020;
    padding: 15px;
    display: none;
    flex-direction: column;
    color: #c6d4df;
    font-family: "Motiva Sans", Arial, sans-serif;
  }
  #use-newsfilter-manage-panel h3 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #67c1f5;
    text-align: center;
    font-size: 16px;
  }
  #use-newsfilter-hidden-list {
    list-style: none;
    padding: 0;
    margin: 10px 0;
    overflow-y: auto;
    flex-grow: 1;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 3px;
  }
  #use-newsfilter-hidden-list li {
    padding: 7px 10px;
    border-bottom: 1px solid #232830;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }
  #use-newsfilter-hidden-list li:last-child { border-bottom: none; }
  #use-newsfilter-hidden-list li .hidden-item-text {
    flex-grow: 1;
    margin-right: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #use-newsfilter-hidden-list li .hidden-item-text .game-name { color: #67c1f5; font-weight: bold; }
  #use-newsfilter-hidden-list li .hidden-item-text .news-title {
    color: #b0b8c0;
    display: block;
    font-size: 0.9em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #use-newsfilter-hidden-list li .hidden-item-text .app-id { color: #76808c; font-size: 0.85em; display: block; }
  .use-newsfilter-restore-btn {
    background-color: #55c655;
    color: #0d1117;
    border: none;
    padding: 3px 7px;
    font-size: 10px;
    border-radius: 3px;
    cursor: pointer;
    font-weight: 500;
    flex-shrink: 0;
  }
  .use-newsfilter-restore-btn:hover { background-color: #4CAF50; }
  .use-newsfilter-manage-buttons { display: flex; justify-content: space-between; margin-top: 10px; gap: 10px; }
  @keyframes use-newsfilter-fadeout {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-20px); }
  }
  .use-newsfilter-fading-out {
    animation: use-newsfilter-fadeout 0.35s forwards ease-out;
    overflow: hidden;
  }
`;

export function initStoreNewsFilterModule(cfg: StoreWebkitConfig): void {
  if (!cfg.newsFilter) return;
  if (!window.location.hostname.includes('store.steampowered.com')) return;
  if (!window.location.pathname.includes('/news') || window.location.pathname.includes('/view/')) return;

  injectStyleOnce('bsh-newsfilter-css', NEWS_FILTER_CSS);

  let storageKey = 'use_hiddenNewsData_v4';
  let persistentlyHiddenItems: HiddenNewsItem[] = [];
  let lastHiddenItems: HiddenNewsItem[] = [];
  let undoTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let showPersistentlyHidden = false;

  const saveHidden = async () => {
    await idbSet(storageKey, persistentlyHiddenItems);
  };

  const loadHiddenAndMigrate = async () => {
    const steamId = await getActiveSteamId64();
    if (steamId) {
      storageKey = `use_hiddenNewsData_v4_${steamId}`;
    }

    const stored = await idbGet<HiddenNewsItem[]>(storageKey);
    persistentlyHiddenItems = Array.isArray(stored) ? stored : [];

    const oldDataRaw = localStorage.getItem('hiddenNews');
    if (oldDataRaw) {
      try {
        const oldData = JSON.parse(oldDataRaw);
        if (Array.isArray(oldData) && oldData.length > 0) {
          const existingIds = new Set(persistentlyHiddenItems.map((i) => i.id));
          let added = 0;
          for (const oldItem of oldData) {
            if (!oldItem?.link || !oldItem?.title) continue;
            const match = String(oldItem.link).match(/\/app\/(\d+)\/view\/(\d+)/);
            if (match && match[1] && match[2] && !existingIds.has(match[2])) {
              persistentlyHiddenItems.push({
                id: match[2],
                appID: match[1],
                gameName: '[N/A; 1.9.5]',
                newsTitle: String(oldItem.title),
                dateHidden: new Date(oldItem.date).getTime() || Date.now(),
              });
              existingIds.add(match[2]);
              added++;
            }
          }
          if (added > 0) await saveHidden();
        }
      } catch {}
      localStorage.removeItem('hiddenNews');
    }
  };

  const findAllNewsItems = (): Element[] => {
    const direct = Array.from(document.querySelectorAll(NEWS_ITEM_SELECTOR));
    if (direct.length > 0) return direct;

    const found = new Set<Element>();
    document.querySelectorAll('a[href*="/news/app/"][href*="/view/"]').forEach((link) => {
      let cur: HTMLElement | null = link.parentElement;
      for (let depth = 0; cur && depth < 6; depth++, cur = cur.parentElement) {
        if (cur.tagName === 'BODY' || cur.id === 'application_root') break;
        const newsLinks = cur.querySelectorAll('a[href*="/news/app/"][href*="/view/"]');
        if (newsLinks.length === 1 && cur.offsetHeight >= 60 && cur.offsetHeight <= 420) {
          found.add(cur);
          break;
        }
      }
    });
    return Array.from(found);
  };

  const getNewsIdsFromLink = (newsItem: Element): { appID: string | null; newsID: string | null } => {
    const linkEl =
      newsItem.querySelector(NEWS_LINK_SELECTOR) ||
      newsItem.querySelector('a[href*="/news/app/"][href*="/view/"]');
    const href = linkEl?.getAttribute('href') || '';
    const match = href.match(/\/news\/app\/(\d+)\/view\/(\d+)/);
    if (match && match[1] && match[2]) {
      return { appID: match[1], newsID: match[2] };
    }
    return { appID: null, newsID: null };
  };

  const getNewsItemDetails = (newsItem: Element) => {
    const { appID, newsID } = getNewsIdsFromLink(newsItem);
    const linkEl =
      newsItem.querySelector(NEWS_LINK_SELECTOR) ||
      newsItem.querySelector('a[href*="/news/app/"][href*="/view/"]');
    const newsTitle =
      newsItem.querySelector(NEWS_TITLE_SELECTOR)?.textContent?.trim() ||
      linkEl?.textContent?.trim() ||
      'Без заголовка';
    const appArea = newsItem.querySelector(NEWS_APP_AREA_SELECTOR);
    const gameName = appArea?.querySelector(NEWS_APP_NAME_SELECTOR)?.textContent?.trim() || null;
    return { appID, newsID, gameName, newsTitle };
  };

  const updateSelectedCount = () => {
    const selectedItems = document.querySelectorAll('.use-newsfilter-newsitem-selected');
    const confirmBtn = document.getElementById('use-newsfilter-confirm-hide-button') as HTMLButtonElement | null;
    if (confirmBtn) {
      confirmBtn.disabled = selectedItems.length === 0;
      confirmBtn.textContent = `Скрыть выбранные (${selectedItems.length})`;
    }
  };

  const updatePersistentHiddenCountDisplay = () => {
    const countEl = document.getElementById('use-newsfilter-storage-count-span');
    if (countEl) countEl.textContent = String(persistentlyHiddenItems.length);
  };

  const toggleTemporaryHide = (newsItem: Element, shouldHide: boolean) => {
    newsItem.classList.toggle('use-newsfilter-newsitem-selected', shouldHide);
    updateSelectedCount();
  };

  const applyPersistentHideStyle = (newsItem: HTMLElement, newsID: string | null) => {
    const isHidden = Boolean(newsID && persistentlyHiddenItems.some((h) => h.id === newsID));
    if (isHidden) {
      newsItem.classList.add('use-newsfilter-newsitem-persistently-hidden');
      newsItem.style.display = showPersistentlyHidden ? '' : 'none';
    } else {
      newsItem.classList.remove('use-newsfilter-newsitem-persistently-hidden');
      newsItem.style.display = '';
    }
  };

  const addNewsCheckboxes = (newsItems: Iterable<Element>) => {
    Array.from(newsItems).forEach((rawItem) => {
      const item = rawItem as HTMLElement;
      const { newsID } = getNewsItemDetails(item);
      if (!newsID) return;

      const existingArea = item.querySelector('.use-newsfilter-checkbox-area') as HTMLElement | null;
      const isHidden = persistentlyHiddenItems.some((h) => h.id === newsID);

      if (!existingArea) {
        const checkboxArea = document.createElement('div');
        checkboxArea.className = 'use-newsfilter-checkbox-area';
        checkboxArea.title = 'Отметить для скрытия';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'use-newsfilter-checkbox';
        checkbox.dataset.newsId = newsID;
        checkboxArea.appendChild(checkbox);

        checkboxArea.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          checkbox.checked = !checkbox.checked;
          toggleTemporaryHide(item, checkbox.checked);
        });

        const imgCtn = (item.querySelector(NEWS_IMAGE_CONTAINER_SELECTOR) ||
          item.querySelector(NEWS_IMAGE_CONTAINER_FALLBACK_SELECTOR) ||
          item) as HTMLElement;
        if (getComputedStyle(imgCtn).position === 'static') {
          imgCtn.style.position = 'relative';
        }
        imgCtn.appendChild(checkboxArea);

        if (isHidden) {
          applyPersistentHideStyle(item, newsID);
          checkboxArea.style.display = 'none';
        }
      } else {
        applyPersistentHideStyle(item, newsID);
        existingArea.style.display = isHidden ? 'none' : 'flex';
      }
    });
  };

  const isManagePanelOpen = () => {
    const panel = document.getElementById('use-newsfilter-manage-panel');
    return Boolean(panel && panel.style.display === 'flex');
  };

  const restoreNewsItem = async (newsIDToRestore: string) => {
    persistentlyHiddenItems = persistentlyHiddenItems.filter((item) => item.id !== newsIDToRestore);
    await saveHidden();
    updatePersistentHiddenCountDisplay();

    findAllNewsItems().forEach((el) => {
      const item = el as HTMLElement;
      const { newsID } = getNewsIdsFromLink(item);
      if (newsID === newsIDToRestore) {
        item.style.display = '';
        item.classList.remove('use-newsfilter-newsitem-persistently-hidden');
        const area = item.querySelector('.use-newsfilter-checkbox-area') as HTMLElement | null;
        if (area) area.style.display = 'flex';
        const cb = item.querySelector('.use-newsfilter-checkbox') as HTMLInputElement | null;
        if (cb) cb.checked = false;
        toggleTemporaryHide(item, false);
      }
    });

    populateHiddenList();
    updateSelectedCount();
  };

  const clearAllPersistentHiddenNews = async () => {
    persistentlyHiddenItems = [];
    await saveHidden();
    updatePersistentHiddenCountDisplay();

    findAllNewsItems().forEach((el) => {
      const item = el as HTMLElement;
      item.style.display = '';
      item.classList.remove('use-newsfilter-newsitem-persistently-hidden', 'use-newsfilter-fading-out');
      const area = item.querySelector('.use-newsfilter-checkbox-area') as HTMLElement | null;
      if (area) area.style.display = 'flex';
      const cb = item.querySelector('.use-newsfilter-checkbox') as HTMLInputElement | null;
      if (cb) cb.checked = false;
      toggleTemporaryHide(item, false);
    });

    populateHiddenList();
    updateSelectedCount();
  };

  const populateHiddenList = () => {
    const listEl = document.getElementById('use-newsfilter-hidden-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (persistentlyHiddenItems.length === 0) {
      listEl.innerHTML = '<li style="text-align:center; color:#808b96; padding: 10px;">Хранилище пусто.</li>';
      return;
    }

    const sorted = [...persistentlyHiddenItems].sort((a, b) => (b.dateHidden || 0) - (a.dateHidden || 0));
    sorted.forEach((itemData) => {
      const li = document.createElement('li');
      const textCtn = document.createElement('div');
      textCtn.className = 'hidden-item-text';

      const gameSpan = document.createElement('span');
      gameSpan.className = 'game-name';
      gameSpan.textContent = itemData.gameName || 'Игра не указана';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'news-title';
      titleSpan.textContent = itemData.newsTitle || '(Новость без заголовка)';
      titleSpan.title = itemData.newsTitle || `Новость для AppID: ${itemData.appID}`;

      const idSpan = document.createElement('span');
      idSpan.className = 'app-id';
      idSpan.textContent = `NewsID: ${itemData.id} (AppID: ${itemData.appID || '—'})`;

      textCtn.append(gameSpan, titleSpan, idSpan);

      const restoreBtn = document.createElement('button');
      restoreBtn.type = 'button';
      restoreBtn.className = 'use-newsfilter-restore-btn';
      restoreBtn.textContent = 'Вернуть';
      restoreBtn.onclick = () => restoreNewsItem(itemData.id);

      li.append(textCtn, restoreBtn);
      listEl.appendChild(li);
    });
  };

  const createManageHiddenPanel = () => {
    if (document.getElementById('use-newsfilter-manage-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'use-newsfilter-manage-panel';
    panel.innerHTML = `
      <h3>Хранилище скрытых новостей</h3>
      <p style="font-size:11px; color: #808b96; text-align:center; margin-bottom: 10px;">Новости из этого списка скрыты в ленте для текущего аккаунта.</p>
      <ul id="use-newsfilter-hidden-list"></ul>
      <div class="use-newsfilter-manage-buttons">
        <button type="button" id="use-newsfilter-clear-all-hidden-btn" class="use-newsfilter-button" style="background-color: #c9302c; color: #DCEBF7;">Очистить хранилище</button>
        <button type="button" id="use-newsfilter-close-manage-panel-btn" class="use-newsfilter-button" style="background-color: #4a5562; color: #fff;">Закрыть</button>
      </div>
    `;
    document.body.appendChild(panel);

    const clearBtn = document.getElementById('use-newsfilter-clear-all-hidden-btn') as HTMLButtonElement;
    let confirmPending = false;
    let confirmTimer: ReturnType<typeof setTimeout> | null = null;
    clearBtn.onclick = async () => {
      if (!confirmPending) {
        confirmPending = true;
        clearBtn.textContent = 'Точно очистить всё?';
        confirmTimer = setTimeout(() => {
          confirmPending = false;
          clearBtn.textContent = 'Очистить хранилище';
        }, 4000);
        return;
      }
      if (confirmTimer) clearTimeout(confirmTimer);
      confirmPending = false;
      clearBtn.textContent = 'Очистить хранилище';
      await clearAllPersistentHiddenNews();
    };

    document.getElementById('use-newsfilter-close-manage-panel-btn')!.onclick = () => {
      panel.style.display = 'none';
    };
  };

  const confirmAndHideSelectedNews = async () => {
    const selectedItems = document.querySelectorAll('.use-newsfilter-newsitem-selected');
    if (selectedItems.length === 0) return;

    lastHiddenItems = [];
    const itemsToHide: HiddenNewsItem[] = [];

    selectedItems.forEach((raw) => {
      const item = raw as HTMLElement;
      const { appID, newsID, gameName, newsTitle } = getNewsItemDetails(item);
      if (newsID && !persistentlyHiddenItems.some((h) => h.id === newsID)) {
        itemsToHide.push({
          id: newsID,
          appID,
          gameName: gameName || 'Неизвестная игра',
          newsTitle,
          dateHidden: Date.now(),
        });
      }
      item.classList.add('use-newsfilter-fading-out');
      item.classList.remove('use-newsfilter-newsitem-selected');
      const area = item.querySelector('.use-newsfilter-checkbox-area') as HTMLElement | null;
      if (area) area.style.display = 'none';
      setTimeout(() => {
        applyPersistentHideStyle(item, newsID);
        item.classList.remove('use-newsfilter-fading-out');
      }, 350);
    });

    if (itemsToHide.length > 0) {
      const uniqueNew = itemsToHide.filter((n) => !persistentlyHiddenItems.some((e) => e.id === n.id));
      persistentlyHiddenItems.push(...uniqueNew);
      lastHiddenItems = uniqueNew;
      await saveHidden();
      updatePersistentHiddenCountDisplay();
    }

    updateSelectedCount();
    const undoBtn = document.getElementById('use-newsfilter-undo-button');
    if (undoBtn && lastHiddenItems.length > 0) {
      undoBtn.style.display = 'block';
      if (undoTimeoutId) clearTimeout(undoTimeoutId);
      undoTimeoutId = setTimeout(() => {
        undoBtn.style.display = 'none';
      }, 6000);
    }
  };

  const undoLastPersistentHide = async () => {
    if (lastHiddenItems.length === 0) return;
    const idsToRestore = new Set(lastHiddenItems.map((i) => i.id));
    persistentlyHiddenItems = persistentlyHiddenItems.filter((i) => !idsToRestore.has(i.id));
    await saveHidden();
    updatePersistentHiddenCountDisplay();

    findAllNewsItems().forEach((el) => {
      const item = el as HTMLElement;
      const { newsID } = getNewsIdsFromLink(item);
      if (newsID && idsToRestore.has(newsID)) {
        item.style.display = '';
        item.classList.remove('use-newsfilter-newsitem-persistently-hidden', 'use-newsfilter-fading-out');
        const area = item.querySelector('.use-newsfilter-checkbox-area') as HTMLElement | null;
        if (area) area.style.display = 'flex';
        const cb = item.querySelector('.use-newsfilter-checkbox') as HTMLInputElement | null;
        if (cb) cb.checked = false;
        toggleTemporaryHide(item, false);
      }
    });

    lastHiddenItems = [];
    const undoBtn = document.getElementById('use-newsfilter-undo-button');
    if (undoBtn) undoBtn.style.display = 'none';
    if (isManagePanelOpen()) populateHiddenList();
    updateSelectedCount();
  };

  const toggleShowPersistentlyHidden = () => {
    showPersistentlyHidden = !showPersistentlyHidden;
    const btn = document.getElementById('use-newsfilter-toggle-persistent-button');
    if (btn) btn.textContent = showPersistentlyHidden ? 'Спрятать скрытое' : 'Показать скрытое';

    findAllNewsItems().forEach((el) => {
      const item = el as HTMLElement;
      const { newsID } = getNewsIdsFromLink(item);
      if (!newsID) return;
      applyPersistentHideStyle(item, newsID);
      const area = item.querySelector('.use-newsfilter-checkbox-area') as HTMLElement | null;
      if (area) {
        area.style.display = persistentlyHiddenItems.some((h) => h.id === newsID) ? 'none' : 'flex';
      }
    });
  };

  const createControls = async () => {
    if (document.getElementById('use-newsfilter-controls-container')) return;
    const ctn = document.createElement('div');
    ctn.id = 'use-newsfilter-controls-container';
    ctn.className = 'use-newsfilter-controls-container';

    const storageCount = document.createElement('div');
    storageCount.className = 'use-newsfilter-storage-count';
    storageCount.innerHTML = `В хранилище: <span id="use-newsfilter-storage-count-span">${persistentlyHiddenItems.length}</span>`;

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.id = 'use-newsfilter-undo-button';
    undoBtn.className = 'use-newsfilter-button';
    undoBtn.textContent = 'Отменить';
    undoBtn.style.display = 'none';
    undoBtn.onclick = undoLastPersistentHide;

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.id = 'use-newsfilter-toggle-persistent-button';
    toggleBtn.className = 'use-newsfilter-button';
    toggleBtn.textContent = 'Показать скрытое';
    toggleBtn.onclick = toggleShowPersistentlyHidden;

    const manageBtn = document.createElement('button');
    manageBtn.type = 'button';
    manageBtn.id = 'use-newsfilter-manage-button';
    manageBtn.className = 'use-newsfilter-button';
    manageBtn.textContent = 'Хранилище';
    manageBtn.onclick = () => {
      const panel = document.getElementById('use-newsfilter-manage-panel');
      if (panel) {
        populateHiddenList();
        panel.style.display = 'flex';
      }
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.id = 'use-newsfilter-confirm-hide-button';
    confirmBtn.className = 'use-newsfilter-button';
    confirmBtn.textContent = 'Скрыть выбранные (0)';
    confirmBtn.disabled = true;
    confirmBtn.onclick = confirmAndHideSelectedNews;

    ctn.append(storageCount, undoBtn, toggleBtn, manageBtn, confirmBtn);
    document.body.appendChild(ctn);

    const savedPos = await idbGet<{ top: string; left: string }>(PANEL_POS_KEY);
    if (savedPos?.top && savedPos?.left) {
      ctn.style.top = savedPos.top;
      ctn.style.left = savedPos.left;
      ctn.style.right = 'auto';
    }

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    ctn.style.cursor = 'grab';
    ctn.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button')) return;
      isDragging = true;
      const rect = ctn.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      ctn.style.cursor = 'grabbing';
      ctn.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const newLeft = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - ctn.offsetWidth));
      const newTop = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - ctn.offsetHeight));
      ctn.style.left = `${newLeft}px`;
      ctn.style.top = `${newTop}px`;
      ctn.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      ctn.style.cursor = 'grab';
      ctn.style.userSelect = 'auto';
      idbSet(PANEL_POS_KEY, { top: ctn.style.top, left: ctn.style.left });
    });

    createManageHiddenPanel();
  };

  setTimeout(async () => {
    await loadHiddenAndMigrate();
    addNewsCheckboxes(findAllNewsItems());
    await createControls();
    updatePersistentHiddenCountDisplay();
    updateSelectedCount();

    let obsTimer: ReturnType<typeof setTimeout> | null = null;
    const newsObserver = new MutationObserver((mutations) => {
      const hasNew = mutations.some(
        (m) =>
          m.type === 'childList' &&
          Array.from(m.addedNodes).some(
            (n) => n instanceof HTMLElement && !n.classList.contains('use-newsfilter-checkbox-area')
          )
      );
      if (hasNew) {
        if (obsTimer) clearTimeout(obsTimer);
        obsTimer = setTimeout(() => {
          addNewsCheckboxes(findAllNewsItems());
        }, 120);
      }
    });

    if (document.body) {
      newsObserver.observe(document.body, { childList: true, subtree: true });
    }
  }, 900);
}
