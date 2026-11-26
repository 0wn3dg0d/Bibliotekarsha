import { StoreWebkitConfig, idbGet, idbSet, injectStyleOnce } from '../../shared/ipc';
import { createStoreModules } from './stores';
import { SM_CSS } from './styles';
import { SmFilters, SmOfferItem, SmSortState, SmStoreStatus } from './types';
import {
  smCalculateMissingValues,
  smCopyTextSafe,
  smDebounce,
  smExchangeRates,
  smFetchExchangeRates,
  smGetEnglishSteamGameName,
  smGetSteamGameName,
  smLogError,
  smScrapeSteamPageOffers,
} from './utils';

const SM_PREFIX = 'salesMaster_v1_';
const KEY_EXCLUSIONS = `${SM_PREFIX}exclusions`;
const KEY_FILTERS = `${SM_PREFIX}filters`;
const KEY_SORT = `${SM_PREFIX}sort`;
const KEY_CURRENCY = `${SM_PREFIX}currencyMode`;

export function initStoreSalesMasterModule(cfg: StoreWebkitConfig): void {
  if (!cfg.salesMaster) return;
  if (!window.location.pathname.includes('/app/')) return;

  injectStyleOnce('bsh-salesmaster-css', SM_CSS);

  let currentSearchQuery = '';
  let openSeq = 0;
  let queryEditedManually = false;
  let steamPageOffersCache: SmOfferItem[] = [];
  let selectedSteamItem: SmOfferItem | null = null;
  let currentResults: SmOfferItem[] = [];
  let storesStatus: Record<string, SmStoreStatus> = {};
  let activeRequests = 0;
  let isMinimized = false;

  let currentSort: SmSortState = { field: 'price', direction: 'asc' };
  let exclusionKeywords: string[] = [];
  let currentCurrencyMode: 'RUB' | 'USD' = 'RUB';
  let currentFilters: SmFilters = {
    priceMin: '',
    priceMax: '',
    discountPercentMin: '',
    discountPercentMax: '',
    discountAmountMin: '',
    discountAmountMax: '',
    hasDiscount: false,
    stores: {},
  };

  const storeModules = createStoreModules({
    setSteamOffersCache: (items) => {
      steamPageOffersCache = items;
    },
  });

  storeModules.forEach((s) => {
    currentFilters.stores[s.id] = true;
  });

  const loadPersistedState = async () => {
    const [savedExcl, savedFilters, savedSort, savedCurr] = await Promise.all([
      idbGet<string[]>(KEY_EXCLUSIONS),
      idbGet<Partial<SmFilters>>(KEY_FILTERS),
      idbGet<SmSortState>(KEY_SORT),
      idbGet<'RUB' | 'USD'>(KEY_CURRENCY),
    ]);
    if (Array.isArray(savedExcl)) exclusionKeywords = savedExcl;
    if (savedFilters && typeof savedFilters === 'object') {
      currentFilters = {
        ...currentFilters,
        ...savedFilters,
        stores: { ...currentFilters.stores, ...(savedFilters.stores || {}) },
      };
    }
    if (savedSort?.field) currentSort = savedSort;
    if (savedCurr === 'USD' || savedCurr === 'RUB') currentCurrencyMode = savedCurr;
  };

  let modal: HTMLDivElement | null = null;
  let searchBtn: HTMLButtonElement | null = null;
  let resultsDiv: HTMLDivElement | null = null;
  let filtersPanel: HTMLDivElement | null = null;
  let exclusionTagsDiv: HTMLDivElement | null = null;
  let exclusionTagsListDiv: HTMLDivElement | null = null;
  let excludeInput: HTMLInputElement | null = null;
  let sortButtonsContainer: HTMLDivElement | null = null;
  let filterStoreCheckboxesContainer: HTMLDivElement | null = null;

  const getCurrencySymbol = () => (currentCurrencyMode === 'USD' ? '$' : '₽');

  const updateStatus = (message: string, isLoading = false) => {
    const el = document.getElementById('salesMasterHeaderStatus');
    if (el) el.innerHTML = message + (isLoading ? ' <span class="sm-spinner"></span>' : '');
    if (searchBtn) {
      searchBtn.disabled = isLoading;
      if (!isLoading) searchBtn.textContent = 'Обновить %';
    }
  };

  const updateCurrencyToggleButton = () => {
    const btn = document.getElementById('smCurrencyToggleBtn');
    if (!btn) return;
    btn.textContent = currentCurrencyMode === 'USD' ? 'RUB' : 'USD';
    btn.title = currentCurrencyMode === 'USD' ? 'Переключиться на рубли' : 'Переключиться на доллары США';
  };

  const highlightErrorStores = () => {
    if (!filterStoreCheckboxesContainer) return;
    storeModules.forEach((store) => {
      const cbWrap = filterStoreCheckboxesContainer
        ?.querySelector(`#smStoreFilter-${store.id}`)
        ?.closest('.smFilterCheckbox');
      if (!cbWrap) return;
      const st = storesStatus[store.id];
      cbWrap.classList.toggle('sm-store-error', st?.status === 'error');
    });
  };

  const applySort = (field: SmSortState['field'], direction: SmSortState['direction']) => {
    const mult = direction === 'asc' ? 1 : -1;
    currentResults.sort((a, b) => {
      if (field === 'name') {
        return (a.productName || '').localeCompare(b.productName || '', 'ru') * mult;
      }
      let valA = 0;
      let valB = 0;
      if (field === 'price') {
        valA = a.currentPrice ?? (direction === 'asc' ? Infinity : -Infinity);
        valB = b.currentPrice ?? (direction === 'asc' ? Infinity : -Infinity);
      } else if (field === 'discountPercent') {
        valA = a.discountPercent ?? -1;
        valB = b.discountPercent ?? -1;
      } else if (field === 'discountAmount') {
        valA = a.discountAmount ?? (direction === 'desc' ? -Infinity : Infinity);
        valB = b.discountAmount ?? (direction === 'desc' ? -Infinity : Infinity);
      }
      if (valA < valB) return -1 * mult;
      if (valA > valB) return 1 * mult;
      return (a.currentPrice ?? Infinity) - (b.currentPrice ?? Infinity);
    });
  };

  const updateSortButtonsState = () => {
    if (!sortButtonsContainer) return;
    sortButtonsContainer.querySelectorAll('.sortBtn').forEach((raw) => {
      const btn = raw as HTMLButtonElement;
      const f = btn.dataset.sort as SmSortState['field'];
      let base = 'Цена';
      if (f === 'discountPercent') base = '% Скидки';
      else if (f === 'discountAmount') base = `Скидка ${getCurrencySymbol()}`;
      else if (f === 'name') base = 'Название';
      if (f === currentSort.field) {
        btn.classList.add('active');
        btn.textContent = `${base} ${currentSort.direction === 'asc' ? '▲' : '▼'}`;
      } else {
        btn.classList.remove('active');
        btn.textContent = base;
      }
    });
    const resetBtn = document.getElementById('salesMasterResetSortBtn');
    resetBtn?.classList.toggle('active', currentSort.field === 'price' && currentSort.direction === 'asc');
  };

  const applyFilters = () => {
    if (!resultsDiv) return;
    const rawTitle = (document.getElementById('smTitleFilterInput') as HTMLInputElement | null)?.value.trim() || '';
    const parseNum = (v: string, fb: number) => {
      const n = parseFloat(v);
      return isNaN(n) ? fb : n;
    };

    const keywords = exclusionKeywords.map((k) => k.toLowerCase());
    const pMin = parseNum(currentFilters.priceMin, 0);
    const pMax = parseNum(currentFilters.priceMax, Infinity);
    const dpMin = parseNum(currentFilters.discountPercentMin, 0);
    const dpMax = parseNum(currentFilters.discountPercentMax, 100);
    const daMin = parseNum(currentFilters.discountAmountMin, 0);
    const daMax = parseNum(currentFilters.discountAmountMax, Infinity);
    const hasDiscountFilter = Boolean(currentFilters.hasDiscount);
    const currencyRate = currentCurrencyMode === 'USD' && smExchangeRates?.rub?.usd ? smExchangeRates.rub.usd : 1;

    const orGroups = rawTitle
      .split(/\{или\}/gi)
      .map((g) => g.trim())
      .filter(Boolean);

    const matchesTitle = (title: string) => {
      if (orGroups.length === 0) return true;
      return orGroups.some((group) => {
        const parts = group.split(/\{не\}/gi);
        const mustHave = parts[0]
          .split(/\{и\}/gi)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        const mustNot = parts
          .slice(1)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        return mustHave.every((t) => title.includes(t)) && mustNot.every((t) => !title.includes(t));
      });
    };

    let visibleCount = 0;
    resultsDiv.querySelectorAll('.salesMasterItem').forEach((raw) => {
      const el = raw as HTMLElement;
      const idx = parseInt(el.dataset.resultIndex || '-1', 10);
      const item = currentResults[idx];
      if (!item) {
        el.classList.add('hidden-by-filter');
        return;
      }

      const title = (item.productName || '').toLowerCase();
      let hide = false;

      if (!matchesTitle(title)) hide = true;
      if (!hide && currentFilters.stores[item.storeId] === false) hide = true;
      if (!hide && keywords.length > 0) {
        const txt = `${title} ${(item.sellerName || '').toLowerCase()}`;
        if (keywords.some((k) => txt.includes(k))) hide = true;
      }

      const convPrice = item.currentPrice !== null ? item.currentPrice * currencyRate : null;
      if (!hide && convPrice !== null && (convPrice < pMin || convPrice > pMax)) hide = true;
      if (!hide && convPrice === null && (pMin > 0 || pMax < Infinity)) hide = true;

      const discP = item.discountPercent ?? 0;
      if (!hide && (discP < dpMin || discP > dpMax)) hide = true;

      const discA = (item.discountAmount ?? 0) * currencyRate;
      if (!hide && (discA < daMin || discA > daMax)) hide = true;

      if (!hide && hasDiscountFilter && (!item.discountPercent || item.discountPercent <= 0)) hide = true;

      el.classList.toggle('hidden-by-filter', hide);
      if (!hide) visibleCount++;
    });

    if (activeRequests === 0) {
      const total = currentResults.length;
      const errCount = Object.values(storesStatus).filter((s) => s.status === 'error').length;
      let msg = total > 0 ? `Показано ${visibleCount} из ${total} предложений.` : 'Предложений не найдено.';
      if (errCount > 0) msg += ` (${errCount} маг. с ошибками)`;
      updateStatus(msg, false);
    }
  };

  const renderExclusionTags = () => {
    if (!exclusionTagsListDiv) return;
    exclusionTagsListDiv.innerHTML = '';
    exclusionKeywords.forEach((kw) => {
      const tag = document.createElement('span');
      tag.className = 'smExclusionTag';
      tag.textContent = kw;
      tag.title = `Удалить "${kw}"`;
      tag.onclick = () => {
        exclusionKeywords = exclusionKeywords.filter((k) => k !== kw);
        idbSet(KEY_EXCLUSIONS, exclusionKeywords);
        renderExclusionTags();
        applyFilters();
      };
      exclusionTagsListDiv!.appendChild(tag);
    });
  };

  const addExclusionKeyword = (raw?: string) => {
    const kw = (raw !== undefined ? raw : excludeInput?.value || '').trim().toLowerCase();
    if (!kw || exclusionKeywords.includes(kw)) return;
    exclusionKeywords.push(kw);
    idbSet(KEY_EXCLUSIONS, exclusionKeywords);
    if (raw === undefined && excludeInput) excludeInput.value = '';
    renderExclusionTags();
    applyFilters();
  };

  const showContextMenu = (event: MouseEvent) => {
    const selectedText = window.getSelection()?.toString().trim();
    if (!selectedText) return;
    event.preventDefault();
    event.stopPropagation();

    document.getElementById('smContextMenu')?.remove();
    const menu = document.createElement('div');
    menu.id = 'smContextMenu';
    menu.innerHTML = `
      <div class="sm-context-menu-item" data-action="filter-and">Добавить в фильтр с {и}</div>
      <div class="sm-context-menu-item" data-action="filter-or">Добавить в фильтр с {или}</div>
      <div class="sm-context-menu-item" data-action="filter-not">Добавить в фильтр с {не}</div>
      <div class="sm-context-menu-separator"></div>
      <div class="sm-context-menu-item" data-action="exclude">Добавить в исключения</div>
      <div class="sm-context-menu-separator"></div>
      <div class="sm-context-menu-item" data-action="copy">Копировать текст</div>
    `;
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - rect.width - 6)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - rect.height - 6)}px`;

    menu.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.sm-context-menu-item') as HTMLElement | null;
      if (!item) return;
      const action = item.dataset.action;
      const filterInput = document.getElementById('smTitleFilterInput') as HTMLInputElement | null;

      if (action === 'filter-and' || action === 'filter-or' || action === 'filter-not') {
        const op = action === 'filter-and' ? 'и' : action === 'filter-or' ? 'или' : 'не';
        if (filterInput) {
          const cur = filterInput.value.trim();
          filterInput.value = cur ? `${cur} {${op}} ${selectedText}` : selectedText;
          applyFilters();
        }
      } else if (action === 'exclude') {
        addExclusionKeyword(selectedText);
      } else if (action === 'copy') {
        smCopyTextSafe(selectedText);
      }
      menu.remove();
    });

    const close = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', close, true);
      }
    };
    setTimeout(() => document.addEventListener('click', close, true), 0);
  };

  const renderResults = () => {
    if (!resultsDiv) return;
    resultsDiv.innerHTML = '';
    if (currentResults.length === 0 && activeRequests === 0) {
      applyFilters();
      return;
    }

    const frag = document.createDocumentFragment();
    const isUsd = currentCurrencyMode === 'USD';
    const rubToUsd = smExchangeRates?.rub?.usd || null;

    currentResults.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = `salesMasterItem${item.storeId === 'steam_current_page' ? ' steam-page-offer' : ''}`;
      card.dataset.store = item.storeId;
      card.dataset.resultIndex = String(index);

      const link = document.createElement('a');
      link.href = item.productUrl || item.storeUrl || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer nofollow';
      link.draggable = false;
      link.addEventListener('click', (e) => {
        if ((window.getSelection()?.toString().trim().length || 0) > 0) e.preventDefault();
      });

      const imgWrap = document.createElement('div');
      imgWrap.className = 'sm-card-image-wrapper';
      const img = document.createElement('img');
      img.src = item.imageUrl || 'https://i.imgur.com/yF0hawg.jpeg';
      img.alt = item.productName || '';
      img.loading = 'lazy';
      img.onerror = () => {
        img.onerror = null;
        img.src = 'https://i.imgur.com/yF0hawg.jpeg';
      };
      imgWrap.appendChild(img);
      link.appendChild(imgWrap);

      const priceDiv = document.createElement('div');
      priceDiv.className = 'sm-price-container';
      const curSpan = document.createElement('span');
      curSpan.className = 'sm-current-price';
      if (isUsd) {
        curSpan.textContent =
          item.currentPrice !== null && rubToUsd ? `$${(item.currentPrice * rubToUsd).toFixed(2)}` : 'Нет цены';
      } else {
        curSpan.textContent =
          item.currentPrice !== null ? `${Math.round(item.currentPrice).toLocaleString('ru-RU')} ₽` : 'Нет цены';
      }
      priceDiv.appendChild(curSpan);

      if (item.discountPercent && item.discountPercent > 0) {
        const badge = document.createElement('span');
        badge.className = 'sm-discount-badge';
        badge.textContent = `-${Math.round(item.discountPercent)}%`;
        priceDiv.appendChild(badge);
        if (item.originalPrice !== null) {
          const origSpan = document.createElement('span');
          origSpan.className = 'sm-original-price';
          origSpan.textContent =
            isUsd && rubToUsd
              ? `$${(item.originalPrice * rubToUsd).toFixed(2)}`
              : `${Math.round(item.originalPrice).toLocaleString('ru-RU')} ₽`;
          priceDiv.appendChild(origSpan);
        }
      }
      link.appendChild(priceDiv);

      const titleDiv = document.createElement('div');
      titleDiv.className = 'sm-title';
      titleDiv.textContent = item.productName || 'Без названия';
      titleDiv.title = item.productName || '';
      titleDiv.addEventListener('contextmenu', showContextMenu);
      link.appendChild(titleDiv);

      const storeInfo = document.createElement('div');
      storeInfo.className = 'sm-store-info-container';
      const storeDiv = document.createElement('div');
      storeDiv.className = 'sm-store-name';
      storeDiv.textContent = item.storeName;
      storeInfo.appendChild(storeDiv);

      if ((item.storeId === 'platimarket' || item.storeId === 'ggsel') && item.sellerId && item.sellerName) {
        const sellerSpan = document.createElement('span');
        sellerSpan.className = 'sm-seller-link';
        sellerSpan.textContent = `Продавец: ${item.sellerName}`;
        sellerSpan.addEventListener('contextmenu', showContextMenu);
        sellerSpan.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const url =
            item.storeId === 'ggsel'
              ? `https://ggsel.net/sellers/${item.sellerId}`
              : `https://plati.market/seller/${encodeURIComponent(String(item.sellerName))}/${item.sellerId}`;
          window.open(url, '_blank');
        };
        storeInfo.appendChild(sellerSpan);
      }
      link.appendChild(storeInfo);

      const buyBtn = document.createElement('div');
      buyBtn.className = 'sm-buyButton';
      buyBtn.textContent = 'Перейти';
      link.appendChild(buyBtn);

      card.appendChild(link);
      frag.appendChild(card);
    });

    resultsDiv.appendChild(frag);
    applyFilters();
  };

  const triggerSearch = async (isReSearch = false, initialSearch = false) => {
    await Promise.allSettled([
      smFetchExchangeRates('rub'),
      smFetchExchangeRates('usd'),
      smFetchExchangeRates('eur'),
      smFetchExchangeRates('kzt'),
      smFetchExchangeRates('gbp'),
      smFetchExchangeRates('uah'),
    ]);

    const gameName = currentSearchQuery;
    if (!gameName) {
      updateStatus('Не удалось определить название игры.');
      return;
    }

    if (!isReSearch) {
      currentResults = [];
      if (resultsDiv) resultsDiv.innerHTML = '';
      storesStatus = {};
      highlightErrorStores();
    } else {
      currentResults = currentResults.filter((r) => r.storeId === 'steam_current_page');
      Object.keys(storesStatus).forEach((k) => {
        if (k !== 'steam_current_page') delete storesStatus[k];
      });
    }

    updateStatus(`Поиск "${gameName}"...`, true);
    activeRequests = 0;

    let finalSteamResults: SmOfferItem[] = [];
    const steamMod = storeModules.find((m) => m.id === 'steam_current_page');
    if (steamMod && currentFilters.stores[steamMod.id] !== false) {
      storesStatus[steamMod.id] = { name: steamMod.name, status: 'pending', error: null };
      try {
        if (steamPageOffersCache.length === 0) await steamMod.fetch(gameName, true);
        finalSteamResults =
          isReSearch && selectedSteamItem
            ? [selectedSteamItem]
            : steamPageOffersCache.filter((i) => i.type === 'sub' || i.type === 'bundle');
        storesStatus[steamMod.id].status = 'success';
      } catch (e: any) {
        storesStatus[steamMod.id].status = 'error';
        storesStatus[steamMod.id].error = e?.message || 'Ошибка Steam';
      }
    }

    currentResults = [...finalSteamResults];
    if (initialSearch && cfg.salesMasterAutoInsertTitle) {
      const inp = document.getElementById('smTitleFilterInput') as HTMLInputElement | null;
      if (inp && !inp.value && currentSearchQuery) inp.value = currentSearchQuery;
    }
    if (currentResults.length > 0) {
      applySort(currentSort.field, currentSort.direction);
      renderResults();
    }

    const flushPartialRender = smDebounce(() => {
      applySort(currentSort.field, currentSort.direction);
      renderResults();
      highlightErrorStores();
    }, 250);

    const otherMods = storeModules.filter((m) => m.id !== 'steam_current_page');
    let totalStores = 0;
    const promises = otherMods.map((mod) => {
      if (currentFilters.stores[mod.id] === false) {
        storesStatus[mod.id] = { name: mod.name, status: 'skipped', error: null };
        return Promise.resolve([] as SmOfferItem[]);
      }
      totalStores++;
      activeRequests++;
      storesStatus[mod.id] = { name: mod.name, status: 'pending', error: null };

      return mod
        .fetch(gameName)
        .then((res) => {
          storesStatus[mod.id].status = 'success';
          if (res.length > 0) {
            currentResults.push(...res);
            flushPartialRender();
          }
          return res;
        })
        .catch((err: any) => {
          storesStatus[mod.id].status = 'error';
          storesStatus[mod.id].statusCode = err?.status || null;
          storesStatus[mod.id].error = err?.message || 'Ошибка';
          smLogError(mod.name, storesStatus[mod.id].error || '', err);
          return [] as SmOfferItem[];
        })
        .finally(() => {
          activeRequests--;
          const done = Object.values(storesStatus).filter((s) => s.status !== 'pending' && s.status !== 'skipped').length;
          if (activeRequests > 0) {
            updateStatus(`Загрузка... (${done}/${totalStores}) · найдено ${currentResults.length}`, true);
          }
        });
    });

    await Promise.all(promises);
    highlightErrorStores();
    applySort(currentSort.field, currentSort.direction);
    renderResults();
  };

  const showEditQueryModal = async () => {
    document.getElementById('smEditQueryModal')?.remove();
    const allOffers = await smScrapeSteamPageOffers();
    const em = document.createElement('div');
    em.id = 'smEditQueryModal';
    em.innerHTML = `
      <div class="sm-edit-query-content">
        <h4 style="margin-top:0;color:#67c1f5;">Изменить поисковый запрос</h4>
        <div class="sm-edit-columns">
          <div class="sm-edit-column">
            <div style="font-size:12px;color:#8f98a0;margin-bottom:6px;">Издания (${allOffers.editions.length})</div>
            <ul id="sm-edit-editions-list" class="sm-edit-list"></ul>
          </div>
          <div class="sm-edit-column">
            <div style="font-size:12px;color:#8f98a0;margin-bottom:6px;">DLC (${allOffers.dlc.length})</div>
            <ul id="sm-edit-dlc-list" class="sm-edit-list"></ul>
          </div>
        </div>
        <input type="text" id="smEditQueryInput" style="width:100%;padding:10px;font-size:15px;background:#1a2635;border:1px solid #3a4f6a;color:#c6d4df;border-radius:3px;margin-bottom:16px;">
        <div style="text-align:right;display:flex;gap:10px;justify-content:flex-end;">
          <button type="button" id="smEditQueryCancelBtn" class="salesMasterBtn">Отмена</button>
          <button type="button" id="smEditQuerySaveBtn" class="salesMasterBtn" style="background:rgba(77,136,255,0.8);border-color:#4d88ff;color:#fff;">Искать по выбранному</button>
        </div>
      </div>
    `;
    document.body.appendChild(em);

    const inp = document.getElementById('smEditQueryInput') as HTMLInputElement;
    inp.value = currentSearchQuery;
    inp.focus();

    const fillList = (ulId: string, list: typeof allOffers.editions) => {
      const ul = document.getElementById(ulId)!;
      if (list.length === 0) {
        ul.innerHTML = '<li style="color:#6e7a88;cursor:default;">Нет данных</li>';
        return;
      }
      list.forEach((it) => {
        const li = document.createElement('li');
        li.dataset.id = it.id;
        li.dataset.type = it.type;
        const priceStr = it.price !== null ? `${Math.round(it.price).toLocaleString('ru-RU')} ₽` : 'N/A';
        li.innerHTML = `<span class="sm-edit-title-text">${it.title}</span><span class="sm-edit-price">${priceStr}</span>`;
        li.onclick = () => {
          em.querySelectorAll('li.selected').forEach((s) => s.classList.remove('selected'));
          li.classList.add('selected');
          inp.value = it.title;
        };
        ul.appendChild(li);
      });
    };

    fillList('sm-edit-editions-list', allOffers.editions);
    fillList('sm-edit-dlc-list', allOffers.dlc);

    const save = () => {
      queryEditedManually = true;
      currentSearchQuery = inp.value.trim();
      const sel = em.querySelector('li.selected') as HTMLElement | null;
      selectedSteamItem = null;
      if (sel) {
        const found = [...allOffers.editions, ...allOffers.dlc].find(
          (o) => o.id === sel.dataset.id && o.type === sel.dataset.type
        );
        if (found) {
          selectedSteamItem = smCalculateMissingValues({
            storeId: 'steam_current_page',
            storeName: 'Steam',
            storeUrl: 'https://store.steampowered.com',
            productName: found.title,
            productUrl: window.location.href,
            imageUrl:
              (document.querySelector('#gameHeaderImageCtn img.game_header_image_full') as HTMLImageElement | null)
                ?.src || null,
            currentPrice: found.price,
            originalPrice: found.originalPrice,
            discountPercent: found.discountPercent,
            discountAmount: null,
            currency: 'RUB',
            isAvailable: true,
            type: found.type,
          });
        }
      }
      em.remove();
      triggerSearch(true, false);
    };

    document.getElementById('smEditQueryCancelBtn')!.onclick = () => em.remove();
    document.getElementById('smEditQuerySaveBtn')!.onclick = save;
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') save();
    };
  };

  const positionSidePanels = () => {
    requestAnimationFrame(() => {
      const header = document.getElementById('salesMasterHeader');
      const resCtn = document.getElementById('salesMasterResultsContainer');
      if (!header || !resCtn || !filtersPanel || !exclusionTagsDiv) return;

      const topOffset = header.getBoundingClientRect().bottom + 12;
      const avail = `calc(100vh - ${topOffset}px - 20px)`;
      filtersPanel.style.top = `${topOffset}px`;
      filtersPanel.style.maxHeight = avail;
      filtersPanel.style.visibility = 'visible';

      exclusionTagsDiv.style.top = `${topOffset}px`;
      exclusionTagsDiv.style.maxHeight = avail;
      exclusionTagsDiv.style.visibility = 'visible';

      const padL = filtersPanel.offsetWidth + 24;
      const padR = exclusionTagsDiv.offsetWidth + 24;
      header.style.paddingLeft = `${padL}px`;
      header.style.paddingRight = `${padR}px`;
      resCtn.style.paddingLeft = `${padL}px`;
      resCtn.style.paddingRight = `${padR}px`;
    });
  };

  const hideModal = () => {
    const restoreBtn = document.getElementById('salesMasterRestoreBtn');
    if (restoreBtn) restoreBtn.style.display = 'none';
    isMinimized = false;
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  const createModal = () => {
    if (document.getElementById('salesMasterModal')) return;
    modal = document.createElement('div');
    modal.id = 'salesMasterModal';

    const container = document.createElement('div');
    container.id = 'salesMasterContainer';

    const header = document.createElement('div');
    header.id = 'salesMasterHeader';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'salesMasterBtn';
    editBtn.title = 'Изменить поисковый запрос / выбрать издание или DLC';
    editBtn.textContent = '✎';
    editBtn.onclick = showEditQueryModal;

    searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.id = 'salesMasterSearchGoBtn';
    searchBtn.className = 'salesMasterBtn';
    searchBtn.textContent = 'Обновить %';
    searchBtn.onclick = () => triggerSearch(false, true);

    const statusEl = document.createElement('div');
    statusEl.id = 'salesMasterHeaderStatus';

    const spacer = document.createElement('div');
    spacer.style.flexGrow = '1';

    const rightControls = document.createElement('div');
    rightControls.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const insertBtn = document.createElement('button');
    insertBtn.type = 'button';
    insertBtn.className = 'salesMasterBtn smInsertTitleBtn';
    insertBtn.textContent = 'Название >';
    insertBtn.onclick = () => {
      const inp = document.getElementById('smTitleFilterInput') as HTMLInputElement | null;
      if (inp) {
        inp.value = currentSearchQuery || smGetSteamGameName();
        applyFilters();
      }
    };

    const filterWrap = document.createElement('div');
    filterWrap.id = 'smTitleFilterWrapper';
    filterWrap.innerHTML = `
      <div id="smTitleFilterGroup">
        <input type="text" id="smTitleFilterInput" placeholder="Фильтр ({и} {или} {не})...">
        <button type="button" id="smToggleFilterHelpBtn" class="salesMasterBtn sm-filter-help-btn" title="Операторы фильтра">▾</button>
      </div>
      <div id="smFilterHelpPanel">
        <div class="sm-filter-help-operators">
          <button type="button" class="salesMasterBtn sm-operator-btn" data-op="{и}">И</button>
          <button type="button" class="salesMasterBtn sm-operator-btn" data-op="{или}">ИЛИ</button>
          <button type="button" class="salesMasterBtn sm-operator-btn" data-op="{не}">НЕ</button>
        </div>
        <div class="sm-filter-help-text" style="font-size:12px;color:#8f98a0;">
          Примеры: <code>Witcher 3 {и} Deluxe</code> · <code>Witcher {или} Ведьмак</code> · <code>Witcher {не} GOTY</code>
        </div>
      </div>
    `;

    const currBtn = document.createElement('button');
    currBtn.type = 'button';
    currBtn.id = 'smCurrencyToggleBtn';
    currBtn.className = 'salesMasterBtn';
    currBtn.onclick = () => {
      currentCurrencyMode = currentCurrencyMode === 'RUB' ? 'USD' : 'RUB';
      idbSet(KEY_CURRENCY, currentCurrencyMode);
      updateCurrencyToggleButton();
      updateSortButtonsState();
      renderResults();
    };

    sortButtonsContainer = document.createElement('div');
    sortButtonsContainer.id = 'salesMasterSortButtons';
    const resetSortBtn = document.createElement('button');
    resetSortBtn.type = 'button';
    resetSortBtn.id = 'salesMasterResetSortBtn';
    resetSortBtn.className = 'salesMasterBtn';
    resetSortBtn.title = 'Сбросить сортировку';
    resetSortBtn.textContent = '↺';
    resetSortBtn.onclick = () => {
      currentSort = { field: 'price', direction: 'asc' };
      idbSet(KEY_SORT, currentSort);
      applySort('price', 'asc');
      updateSortButtonsState();
      renderResults();
    };
    sortButtonsContainer.appendChild(resetSortBtn);

    (['price', 'discountPercent', 'discountAmount', 'name'] as const).forEach((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'salesMasterBtn sortBtn';
      b.dataset.sort = f;
      b.onclick = () => {
        const defDir: Record<string, 'asc' | 'desc'> = {
          price: 'asc',
          discountPercent: 'desc',
          discountAmount: 'desc',
          name: 'asc',
        };
        const dir: 'asc' | 'desc' =
          currentSort.field === f ? (currentSort.direction === 'asc' ? 'desc' : 'asc') : defDir[f];
        currentSort = { field: f, direction: dir };
        idbSet(KEY_SORT, currentSort);
        applySort(f, dir);
        updateSortButtonsState();
        renderResults();
      };
      sortButtonsContainer!.appendChild(b);
    });

    rightControls.append(insertBtn, filterWrap, currBtn, sortButtonsContainer);
    header.append(editBtn, searchBtn, statusEl, spacer, rightControls);
    container.appendChild(header);

    const resultsCtn = document.createElement('div');
    resultsCtn.id = 'salesMasterResultsContainer';
    resultsDiv = document.createElement('div');
    resultsDiv.id = 'salesMasterResults';
    resultsCtn.appendChild(resultsDiv);
    container.appendChild(resultsCtn);

    filtersPanel = document.createElement('div');
    filtersPanel.id = 'salesMasterFiltersPanel';
    filtersPanel.innerHTML = `
      <div class="smFilterGroup"><h4>Цена</h4><div class="smFilterRangeInputs"><input type="number" id="smFilterPriceMin" placeholder="от" min="0"><input type="number" id="smFilterPriceMax" placeholder="до" min="0"></div></div>
      <div class="smFilterGroup"><h4>Скидка, %</h4><div class="smFilterRangeInputs"><input type="number" id="smFilterDiscountPercentMin" placeholder="от" min="0" max="100"><input type="number" id="smFilterDiscountPercentMax" placeholder="до" min="0" max="100"></div></div>
      <div class="smFilterGroup"><h4>Скидка</h4><div class="smFilterRangeInputs"><input type="number" id="smFilterDiscountAmountMin" placeholder="от" min="0"><input type="number" id="smFilterDiscountAmountMax" placeholder="до" min="0"></div></div>
      <div class="smFilterGroup"><h4>Опции</h4><div class="smFilterCheckbox"><label><input type="checkbox" id="smFilterHasDiscount"> Только со скидкой</label></div></div>
      <div class="smFilterGroup">
        <h4>Магазины</h4>
        <div class="smStoreSelectAllControls">
          <span class="smStoreSelectAllLink" id="smSelectAllStores">Отметить всё</span> |
          <span class="smStoreSelectAllLink" id="smDeselectAllStores">Снять всё</span>
        </div>
        <div id="smFilterStoreCheckboxes"></div>
      </div>
      <button type="button" id="smResetAllFiltersBtn" class="salesMasterBtn">Сбросить фильтры</button>
    `;

    exclusionTagsDiv = document.createElement('div');
    exclusionTagsDiv.id = 'salesMasterExclusionTags';
    exclusionTagsDiv.innerHTML = `
      <div class="smExclusionInputGroup">
        <input type="text" id="salesMasterExcludeInput" placeholder="Исключить слово">
        <button type="button" id="salesMasterAddExcludeBtn" title="Добавить">+</button>
      </div>
      <div class="smExclusionActions">
        <button type="button" id="smExportExclusionsBtn" class="salesMasterBtn smExclusionActionBtn" title="Копировать список исключений">←</button>
        <button type="button" id="smImportExclusionsBtn" class="salesMasterBtn smExclusionActionBtn" title="Импорт списка исключений">→</button>
      </div>
      <div id="salesMasterExclusionTagsList"></div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'salesMasterCloseBtn';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = hideModal;

    const minBtn = document.createElement('button');
    minBtn.type = 'button';
    minBtn.id = 'salesMasterMinimizeBtn';
    minBtn.textContent = '—';
    minBtn.onclick = () => {
      if (modal) modal.style.display = 'none';
      const rb = document.getElementById('salesMasterRestoreBtn');
      if (rb) rb.style.display = 'flex';
      document.body.style.overflow = '';
      isMinimized = true;
    };

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.id = 'salesMasterRestoreBtn';
    restoreBtn.innerHTML = '<span>&#x25A3;</span> Развернуть SalesMaster';
    restoreBtn.onclick = () => {
      if (modal) modal.style.display = 'block';
      restoreBtn.style.display = 'none';
      document.body.style.overflow = 'hidden';
      isMinimized = false;
    };
    document.body.appendChild(restoreBtn);

    modal.append(filtersPanel, exclusionTagsDiv, closeBtn, minBtn, container);
    document.body.appendChild(modal);

    excludeInput = document.getElementById('salesMasterExcludeInput') as HTMLInputElement;
    exclusionTagsListDiv = document.getElementById('salesMasterExclusionTagsList') as HTMLDivElement;
    filterStoreCheckboxesContainer = document.getElementById('smFilterStoreCheckboxes') as HTMLDivElement;

    excludeInput.onkeydown = (e) => {
      if (e.key === 'Enter') addExclusionKeyword();
    };
    document.getElementById('salesMasterAddExcludeBtn')!.onclick = () => addExclusionKeyword();

    document.getElementById('smExportExclusionsBtn')!.onclick = async () => {
      const str = exclusionKeywords.join(',');
      if (!str) return;
      await smCopyTextSafe(str);
      const b = document.getElementById('smExportExclusionsBtn')!;
      b.textContent = '✓';
      setTimeout(() => (b.textContent = '←'), 1200);
    };

    document.getElementById('smImportExclusionsBtn')!.onclick = () => {
      document.getElementById('smImportModal')?.remove();
      const im = document.createElement('div');
      im.id = 'smImportModal';
      im.innerHTML = `
        <div class="smImportModalContent">
          <h4 style="margin-top:0;color:#67c1f5;text-align:center;">Импорт исключений</h4>
          <textarea id="smImportTextarea" placeholder="Слова через запятую..."></textarea>
          <div class="smImportModalActions">
            <button type="button" id="smImpAdd" class="salesMasterBtn">Добавить</button>
            <button type="button" id="smImpOver" class="salesMasterBtn" style="background:#c9302c;border-color:#ac2925;color:#fff;">Перезаписать</button>
            <button type="button" id="smImpCancel" class="salesMasterBtn">Отмена</button>
          </div>
        </div>
      `;
      document.body.appendChild(im);
      const doImport = (overwrite: boolean) => {
        const raw = (document.getElementById('smImportTextarea') as HTMLTextAreaElement).value;
        const list = raw
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        exclusionKeywords = overwrite ? Array.from(new Set(list)) : Array.from(new Set([...exclusionKeywords, ...list]));
        idbSet(KEY_EXCLUSIONS, exclusionKeywords);
        renderExclusionTags();
        applyFilters();
        im.remove();
      };
      document.getElementById('smImpAdd')!.onclick = () => doImport(false);
      document.getElementById('smImpOver')!.onclick = () => doImport(true);
      document.getElementById('smImpCancel')!.onclick = () => im.remove();
    };

    const debouncedApply = smDebounce(applyFilters, 350);
    document.getElementById('smTitleFilterInput')!.addEventListener('input', debouncedApply);
    document.getElementById('smToggleFilterHelpBtn')!.onclick = () => {
      const p = document.getElementById('smFilterHelpPanel')!;
      p.style.display = p.style.display === 'block' ? 'none' : 'block';
    };
    document.querySelectorAll('.sm-operator-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const inp = document.getElementById('smTitleFilterInput') as HTMLInputElement;
        const op = (b as HTMLElement).dataset.op || '';
        inp.value = `${inp.value} ${op} `.trimStart();
        inp.focus();
        applyFilters();
      });
    });

    (
      [
        ['smFilterPriceMin', 'priceMin'],
        ['smFilterPriceMax', 'priceMax'],
        ['smFilterDiscountPercentMin', 'discountPercentMin'],
        ['smFilterDiscountPercentMax', 'discountPercentMax'],
        ['smFilterDiscountAmountMin', 'discountAmountMin'],
        ['smFilterDiscountAmountMax', 'discountAmountMax'],
      ] as const
    ).forEach(([id, key]) => {
      const inp = document.getElementById(id) as HTMLInputElement;
      inp.value = currentFilters[key] || '';
      inp.addEventListener('input', () => {
        currentFilters[key] = inp.value;
        idbSet(KEY_FILTERS, currentFilters);
        debouncedApply();
      });
    });

    const discCb = document.getElementById('smFilterHasDiscount') as HTMLInputElement;
    discCb.checked = currentFilters.hasDiscount;
    discCb.onchange = () => {
      currentFilters.hasDiscount = discCb.checked;
      idbSet(KEY_FILTERS, currentFilters);
      applyFilters();
    };

    document.getElementById('smSelectAllStores')!.onclick = () => {
      storeModules.forEach((s) => (currentFilters.stores[s.id] = true));
      filterStoreCheckboxesContainer?.querySelectorAll('input').forEach((c) => (c.checked = true));
      idbSet(KEY_FILTERS, currentFilters);
      applyFilters();
    };
    document.getElementById('smDeselectAllStores')!.onclick = () => {
      storeModules.forEach((s) => (currentFilters.stores[s.id] = false));
      filterStoreCheckboxesContainer?.querySelectorAll('input').forEach((c) => (c.checked = false));
      idbSet(KEY_FILTERS, currentFilters);
      applyFilters();
    };
    document.getElementById('smResetAllFiltersBtn')!.onclick = () => {
      currentFilters = {
        priceMin: '',
        priceMax: '',
        discountPercentMin: '',
        discountPercentMax: '',
        discountAmountMin: '',
        discountAmountMax: '',
        hasDiscount: false,
        stores: Object.fromEntries(storeModules.map((s) => [s.id, true])),
      };
      idbSet(KEY_FILTERS, currentFilters);
      [
        'smFilterPriceMin',
        'smFilterPriceMax',
        'smFilterDiscountPercentMin',
        'smFilterDiscountPercentMax',
        'smFilterDiscountAmountMin',
        'smFilterDiscountAmountMax',
      ].forEach((id) => ((document.getElementById(id) as HTMLInputElement).value = ''));
      discCb.checked = false;
      filterStoreCheckboxesContainer?.querySelectorAll('input').forEach((c) => (c.checked = true));
      applyFilters();
    };

    storeModules.forEach((store) => {
      const div = document.createElement('div');
      div.className = 'smFilterCheckbox';
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = `smStoreFilter-${store.id}`;
      cb.checked = currentFilters.stores[store.id] !== false;
      cb.onchange = () => {
        currentFilters.stores[store.id] = cb.checked;
        idbSet(KEY_FILTERS, currentFilters);
        applyFilters();
      };
      label.append(cb, document.createTextNode(` ${store.name}`));

      div.appendChild(label);
      filterStoreCheckboxesContainer!.appendChild(div);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.style.display === 'block') {
        const cm = document.getElementById('smContextMenu');
        const im = document.getElementById('smImportModal');
        const em = document.getElementById('smEditQueryModal');
        if (cm) cm.remove();
        else if (im) im.remove();
        else if (em) em.remove();
        else hideModal();
      }
    });
  };

  const showModal = async () => {
    const seq = ++openSeq;
    queryEditedManually = false;
    await loadPersistedState();
    if (seq !== openSeq) return;
    if (!modal) createModal();

    if (isMinimized) {
      const rb = document.getElementById('salesMasterRestoreBtn');
      if (rb) rb.style.display = 'none';
      isMinimized = false;
    }

    currentSearchQuery = smGetSteamGameName();
    steamPageOffersCache = [];
    selectedSteamItem = null;
    currentResults = [];
    if (resultsDiv) resultsDiv.innerHTML = '';

    const titleInp = document.getElementById('smTitleFilterInput') as HTMLInputElement | null;
    if (titleInp) titleInp.value = '';

    document.body.style.overflow = 'hidden';
    if (modal) modal.style.display = 'block';

    renderExclusionTags();
    updateSortButtonsState();
    updateCurrencyToggleButton();
    positionSidePanels();

    updateStatus('Определение английского названия игры...', true);
    const englishName = await smGetEnglishSteamGameName();
    if (seq !== openSeq || !modal || modal.style.display === 'none') return;

    if (!queryEditedManually && englishName) {
      currentSearchQuery = englishName;
    }

    if (cfg.salesMasterAutoSearch) {
      triggerSearch(false, true);
    } else {
      updateStatus(`Нажмите «Обновить %» для поиска "${currentSearchQuery}"`);
    }
  };

  const addButton = () => {
    const actionsCtn = document.querySelector('#queueActionsCtn');
    if (!actionsCtn || actionsCtn.querySelector('.salesMaster_button')) return;

    const wrap = document.createElement('div');
    wrap.className = 'salesMaster_button queue_control_button';
    wrap.style.marginLeft = '3px';
    wrap.innerHTML =
      '<div class="btnv6_blue_hoverfade btn_medium" style="height: 32px; padding: 0 8px; font-size: 16px; font-weight: bold;" title="SalesMaster — поиск скидок в других магазинах"><span>%</span></div>';
    wrap.querySelector('div')!.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showModal();
    });

    const shareBtn = actionsCtn.querySelector('#shareBtn');
    const ignoreBtn = actionsCtn.querySelector('#ignoreBtn');
    if (shareBtn) shareBtn.insertAdjacentElement('afterend', wrap);
    else if (ignoreBtn) ignoreBtn.insertAdjacentElement('afterend', wrap);
    else actionsCtn.appendChild(wrap);
  };

  setTimeout(addButton, 550);
  const obs = new MutationObserver(() => {
    if (!document.querySelector('.salesMaster_button')) addButton();
  });
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
}
