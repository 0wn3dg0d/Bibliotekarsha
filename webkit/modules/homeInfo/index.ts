import {
  StoreWebkitConfig,
  fetchViaBackend,
  idbGet,
  idbSet,
  injectStyleOnce,
} from '../../shared/ipc';

interface HomeItemRef {
  type: 'app' | 'sub';
  id: string;
}

interface HomeGameMeta {
  type: 'app' | 'sub';
  id: number;
  name?: string;
  assets?: any;
  is_early_access?: boolean;
  review_count?: number;
  percent_positive?: number;
  short_description?: string;
  publishers?: string;
  developers?: string;
  franchises?: string;
  tagids: number[];
  language_support_russian?: any;
  language_support_english?: any;
  release_date: string;
}

const API_URL = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1';
const TAGS_CACHE_KEY = 'SteamEnhancer_TagsCache_v4';
const TAGS_TTL = 744 * 60 * 60 * 1000;
const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const LINK_SELECTOR = "a[href*='/app/'], a[href*='/sub/'], a[data-appid]";

const HOME_INFO_CSS = `
  .mushroom-tooltip {
    position: absolute;
    background: linear-gradient(to bottom, #e3eaef, #c7d5e0);
    color: #30455a;
    padding: 12px;
    border-radius: 2px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.75);
    font-size: 12px;
    max-width: 310px;
    display: none;
    z-index: 10005;
    opacity: 0;
    transition: opacity 0.25s ease-in-out;
    pointer-events: none;
    font-family: "Motiva Sans", Arial, sans-serif;
  }
  .mushroom-tooltip .tooltip-arrow {
    position: absolute;
    right: -9px;
    top: 32px;
    width: 0;
    height: 0;
    border-top: 10px solid transparent;
    border-bottom: 10px solid transparent;
    border-left: 10px solid #E1E8ED;
  }
  .mushroom-positive { color: #2B80E9; font-weight: 600; }
  .mushroom-mixed { color: #997a00; font-weight: 600; }
  .mushroom-negative { color: #E53E3E; font-weight: 600; }
  .mushroom-no-reviews { color: #6e7680; }
  .mushroom-language-yes { color: #2B80E9; }
  .mushroom-language-no { color: #E53E3E; }
  .mushroom-early-access-yes { color: #2B80E9; font-weight: 600; }
  .mushroom-early-access-no { color: #6e7680; }
  .mushroom-tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 6px;
  }
  .mushroom-tag {
    background-color: #96a3ae;
    color: #e3eaef;
    padding: 0 5px;
    border-radius: 2px;
    font-size: 11px;
    line-height: 19px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
    margin-bottom: 2px;
  }
  .use-img-loading {
    position: relative;
    display: inline-block;
    min-width: 120px;
    min-height: 45px;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
  .use-img-loading::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top: 2px solid #67c1f5;
    border-radius: 50%;
    animation: bshHomeSpin 1s linear infinite;
  }
  @keyframes bshHomeSpin {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
  }
`;

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractIdAndType(element: Element): HomeItemRef | null {
  const htmlEl = element as HTMLElement;
  if (htmlEl.dataset?.appid) return { type: 'app', id: htmlEl.dataset.appid };
  const href = (element as HTMLAnchorElement).href || element.getAttribute('href') || '';
  const appMatch = href.match(/\/app\/(\d+)/);
  if (appMatch) return { type: 'app', id: appMatch[1] };
  const subMatch = href.match(/\/sub\/(\d+)/);
  if (subMatch) return { type: 'sub', id: subMatch[1] };
  return null;
}

function getReviewClass(percent?: number, totalReviews?: number): string {
  if (!totalReviews || totalReviews === 0) return 'mushroom-no-reviews';
  if ((percent || 0) >= 70) return 'mushroom-positive';
  if ((percent || 0) >= 40) return 'mushroom-mixed';
  return 'mushroom-negative';
}

function formatLangSupport(langObj: any): { text: string; cls: string } {
  if (!langObj) return { text: 'Отсутствует', cls: 'mushroom-language-no' };
  let text = '';
  if (langObj.supported) text += '<br>Интерфейс: ✔ ';
  if (langObj.full_audio) text += '<br>Озвучка: ✔ ';
  if (langObj.subtitles) text += '<br>Субтитры: ✔';
  if (!text) return { text: 'Отсутствует', cls: 'mushroom-language-no' };
  return { text, cls: 'mushroom-language-yes' };
}

export function initCommunityHomeInfoModule(cfg: StoreWebkitConfig): void {
  if (!cfg.homeInfo) return;
  if (!window.location.hostname.includes('steamcommunity.com')) return;
  if (!window.location.pathname.includes('/home')) return;

  injectStyleOnce('bsh-home-info-css', HOME_INFO_CSS);

  const collectedIds = new Set<string>();
  const gameDataMap: Record<string, HomeGameMeta> = {};
  let tooltipEl: HTMLDivElement | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let memoryTags: Record<string, string> | null = null;

  const loadSteamTags = async (): Promise<Record<string, string>> => {
    if (memoryTags) return memoryTags;
    const cached = await idbGet<{ data: Record<string, string>; timestamp: number }>(TAGS_CACHE_KEY);
    if (cached?.data && Date.now() - cached.timestamp < TAGS_TTL) {
      memoryTags = cached.data;
      return cached.data;
    }

    const res = await fetchViaBackend('https://store.steampowered.com/search/?l=russian');
    if (res.ok && res.body) {
      try {
        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const tags: Record<string, string> = {};
        doc.querySelectorAll('[data-param="tags"][data-value][data-loc]').forEach((el) => {
          const val = el.getAttribute('data-value');
          const loc = el.getAttribute('data-loc');
          if (val && loc) tags[val] = loc;
        });
        if (Object.keys(tags).length > 0) {
          memoryTags = tags;
          await idbSet(TAGS_CACHE_KEY, { data: tags, timestamp: Date.now() });
          return tags;
        }
      } catch {}
    }
    return cached?.data || {};
  };

  const cleanupSpinners = (loadingElements: Array<{ element: Element; info: HomeItemRef; img: HTMLImageElement }>) => {
    loadingElements.forEach((item) => {
      if (!item.element.classList.contains('use-img-loading')) return;
      const dir = item.info.type === 'sub' ? 'subs' : 'apps';
      item.element.classList.remove('use-img-loading');
      item.img.src = `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/${dir}/${item.info.id}/capsule_231x87.jpg`;
      item.img.style.opacity = '1';
      item.img.onerror = () => {
        if (!item.img.dataset.retriedFallback) {
          item.img.dataset.retriedFallback = 'true';
          item.img.src = `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/${dir}/${item.info.id}/header.jpg`;
        }
      };
    });
  };

  const processGameData = (
    data: any,
    loadingElements: Array<{ element: Element; info: HomeItemRef; img: HTMLImageElement }>
  ) => {
    const processedKeys = new Set<string>();
    const items = data?.response?.store_items;

    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        const type: 'app' | 'sub' = item.item_type === 1 ? 'sub' : 'app';
        const id = Number(item.id);
        const key = `${type}_${id}`;
        processedKeys.add(key);

        gameDataMap[key] = {
          type,
          id,
          name: item.name,
          assets: item.assets,
          is_early_access: Boolean(item.is_early_access),
          review_count: item.reviews?.summary_filtered?.review_count,
          percent_positive: item.reviews?.summary_filtered?.percent_positive,
          short_description: item.basic_info?.short_description,
          publishers: item.basic_info?.publishers?.map((p: any) => p.name).join(', '),
          developers: item.basic_info?.developers?.map((d: any) => d.name).join(', '),
          franchises: item.basic_info?.franchises?.map((f: any) => f.name).join(', '),
          tagids: Array.isArray(item.tagids) ? item.tagids : [],
          language_support_russian: item.supported_languages?.find(
            (l: any) => (l.name && l.name.toLowerCase() === 'russian') || l.elanguage === 8
          ),
          language_support_english: item.supported_languages?.find(
            (l: any) => (l.name && l.name.toLowerCase() === 'english') || l.elanguage === 0
          ),
          release_date: item.release?.steam_release_date
            ? new Date(item.release.steam_release_date * 1000).toLocaleDateString('ru-RU')
            : 'Нет данных',
        };

        const selector = type === 'app' ? `a[href*='/app/${id}'], a[data-appid="${id}"]` : `a[href*='/sub/${id}']`;
        const dir = type === 'sub' ? 'subs' : 'apps';

        document.querySelectorAll(selector).forEach((link) => {
          const img = link.querySelector('img') as HTMLImageElement | null;
          const srcAttr = img?.getAttribute('src');
          if (img && (link.classList.contains('use-img-loading') || !srcAttr || srcAttr === BLANK_GIF)) {
            const fallbackImg = item.assets?.small_capsule
              ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/${dir}/${id}/${item.assets.small_capsule}`
              : item.assets?.header
              ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/${dir}/${id}/${item.assets.header}`
              : `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/${dir}/${id}/header.jpg`;

            img.onload = () => {
              link.classList.remove('use-img-loading');
              img.style.opacity = '1';
            };
            img.onerror = () => {
              link.classList.remove('use-img-loading');
              img.style.opacity = '1';
            };
            img.src = fallbackImg;

            setTimeout(() => {
              link.classList.remove('use-img-loading');
              img.style.opacity = '1';
            }, 2000);
          }
        });
      });
    }

    loadingElements.forEach((it) => {
      if (!processedKeys.has(`${it.info.type}_${it.info.id}`)) {
        cleanupSpinners([it]);
      }
    });
  };

  const fetchGameData = async (
    items: HomeItemRef[],
    loadingElements: Array<{ element: Element; info: HomeItemRef; img: HTMLImageElement }>
  ) => {
    const inputJson = {
      ids: items.map((info) =>
        info.type === 'sub' ? { packageid: parseInt(info.id, 10) } : { appid: parseInt(info.id, 10) }
      ),
      context: { language: 'russian', country_code: 'US', steam_realm: 1 },
      data_request: {
        include_assets: true,
        include_release: true,
        include_basic_info: true,
        include_reviews: true,
        include_supported_languages: true,
        include_tag_count: 10,
      },
    };

    const res = await fetchViaBackend(`${API_URL}?input_json=${encodeURIComponent(JSON.stringify(inputJson))}`);
    if (res.ok && res.body) {
      try {
        processGameData(JSON.parse(res.body), loadingElements);
        return;
      } catch {}
    }
    cleanupSpinners(loadingElements);
  };

  const collectAndFetch = () => {
    const elements = document.querySelectorAll(LINK_SELECTOR);
    const newItems: HomeItemRef[] = [];
    const loadingElements: Array<{ element: Element; info: HomeItemRef; img: HTMLImageElement }> = [];

    elements.forEach((el) => {
      const info = extractIdAndType(el);
      if (!info) return;
      const key = `${info.type}_${info.id}`;
      const img = el.querySelector('img') as HTMLImageElement | null;

      if (!collectedIds.has(key)) {
        newItems.push(info);
        collectedIds.add(key);
      }

      const srcAttr = img?.getAttribute('src');
      if (img && (!srcAttr || srcAttr === '' || srcAttr === BLANK_GIF) && !el.classList.contains('use-img-loading')) {
        el.classList.add('use-img-loading');
        img.src = BLANK_GIF;
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease';
        loadingElements.push({ element: el, info, img });
      }
    });

    if (newItems.length > 0) {
      (async () => {
        for (let i = 0; i < newItems.length; i += 50) {
          const batch = newItems.slice(i, i + 50);
          const batchKeys = new Set(batch.map((b) => `${b.type}_${b.id}`));
          const batchLoading = loadingElements.filter((le) => batchKeys.has(`${le.info.type}_${le.info.id}`));
          await fetchGameData(batch, batchLoading);
          if (i + 50 < newItems.length) {
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      })();
    } else if (loadingElements.length > 0) {
      cleanupSpinners(loadingElements);
    }
  };

  const displayGameInfo = async (element: Element, data: HomeGameMeta) => {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'mushroom-tooltip';
      tooltipEl.innerHTML = '<div class="tooltip-arrow"></div><div class="tooltip-content"></div>';
      document.body.appendChild(tooltipEl);
    }

    const content = tooltipEl.querySelector('.tooltip-content')!;
    const ruLang = formatLangSupport(data.language_support_russian);
    const enLang = cfg.homeInfoEnglish ? formatLangSupport(data.language_support_english) : null;
    const reviewCls = getReviewClass(data.percent_positive, data.review_count);
    const eaCls = data.is_early_access ? 'mushroom-early-access-yes' : 'mushroom-early-access-no';

    const dir = data.type === 'sub' ? 'subs' : 'apps';
    const headerUrl = data.assets?.header
      ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/${dir}/${data.id}/${data.assets.header}`
      : `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/${dir}/${data.id}/header.jpg`;

    const tagsData = await loadSteamTags();
    const tagsHtml = (data.tagids || [])
      .slice(0, 5)
      .map((tid) => `<div class="mushroom-tag">${escapeHtml(tagsData[String(tid)] || `Тег #${tid}`)}</div>`)
      .join('');

    content.innerHTML = `
      <div style="margin-bottom: 8px;"><strong>Название:</strong> ${escapeHtml(data.name || 'Нет данных')}</div>
      <div style="margin-bottom: 8px;"><img src="${escapeHtml(headerUrl)}" alt="" style="width: 55%; height: auto; border-radius: 2px;"></div>
      <div style="margin-bottom: 6px;"><strong>Дата выхода:</strong> ${escapeHtml(data.release_date)}</div>
      <div><strong>Издатели:</strong> <span class="${!data.publishers ? 'mushroom-no-reviews' : ''}">${escapeHtml(data.publishers || 'Нет данных')}</span></div>
      <div><strong>Разработчики:</strong> <span class="${!data.developers ? 'mushroom-no-reviews' : ''}">${escapeHtml(data.developers || 'Нет данных')}</span></div>
      <div style="margin-bottom: 6px;"><strong>Серия игр:</strong> <span class="${!data.franchises ? 'mushroom-no-reviews' : ''}">${escapeHtml(data.franchises || 'Нет данных')}</span></div>
      <div style="margin-bottom: 6px;"><strong>Отзывы:</strong> ${data.review_count || 0} <span class="${reviewCls}">(${data.percent_positive || 0}% положит.)</span></div>
      <div style="margin-bottom: 6px;"><strong>Ранний доступ:</strong> <span class="${eaCls}">${data.is_early_access ? 'Да' : 'Нет'}</span></div>
      <div style="margin-bottom: 6px;"><strong>Русский язык:</strong> <span class="${ruLang.cls}">${ruLang.text}</span></div>
      ${enLang ? `<div style="margin-bottom: 6px;"><strong>Английский язык:</strong> <span class="${enLang.cls}">${enLang.text}</span></div>` : ''}
      ${tagsHtml ? `<div style="margin-bottom: 6px;"><strong>Метки:</strong><div class="mushroom-tags-container">${tagsHtml}</div></div>` : ''}
      <div><strong>Описание:</strong> <span class="${!data.short_description ? 'mushroom-no-reviews' : ''}">${escapeHtml(data.short_description || 'Нет данных')}</span></div>
    `;

    tooltipEl.style.display = 'block';
    const blotterDay = document.querySelector('.blotter_day');
    const elRect = element.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();

    const rawLeft = blotterDay ? blotterDay.getBoundingClientRect().left - tipRect.width - 8 : elRect.left - tipRect.width - 12;
    tooltipEl.style.left = `${Math.max(8, rawLeft)}px`;
    tooltipEl.style.top = `${Math.max(8, elRect.top + window.scrollY - 35)}px`;
    tooltipEl.style.opacity = '0';

    requestAnimationFrame(() => {
      if (tooltipEl) tooltipEl.style.opacity = '1';
    });

    element.addEventListener(
      'mouseleave',
      () => {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (!tooltipEl) return;
          tooltipEl.style.opacity = '0';
          setTimeout(() => {
            if (tooltipEl && tooltipEl.style.opacity === '0') tooltipEl.style.display = 'none';
          }, 260);
        }, 180);
      },
      { once: true }
    );
  };

  const handleHover = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const gameEl = target?.closest(LINK_SELECTOR);
    if (!gameEl) return;

    const info = extractIdAndType(gameEl);
    if (!info) return;
    const key = `${info.type}_${info.id}`;

    if (hoverTimer) clearTimeout(hoverTimer);
    if (hideTimer) clearTimeout(hideTimer);

    if (gameDataMap[key]) {
      hoverTimer = setTimeout(() => {
        displayGameInfo(gameEl, gameDataMap[key]);
      }, 280);
    }
  };

  setTimeout(() => {
    collectAndFetch();
    document.addEventListener('mouseover', handleHover);

    let obsDebounce: ReturnType<typeof setTimeout> | null = null;
    const obs = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.addedNodes.length > 0)) {
        if (obsDebounce) clearTimeout(obsDebounce);
        obsDebounce = setTimeout(collectAndFetch, 350);
      }
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  }, 1500);
}
