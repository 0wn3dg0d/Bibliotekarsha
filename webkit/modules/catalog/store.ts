import { fetchViaBackend, getActiveSteamId64, idbGet, idbSet } from '../../shared/ipc';

export interface CatalogGameData {
  id: number;
  is_early_access: boolean;
  has_original_release_date: boolean;
  review_count: number;
  percent_positive: number;
  short_description?: string;
  publishers?: string;
  developers?: string;
  franchises?: string;
  tagids: number[];
  language_support_russian?: { supported?: boolean; full_audio?: boolean; subtitles?: boolean };
  language_support_english?: { supported?: boolean; full_audio?: boolean; subtitles?: boolean };
  type?: number;
  parent_appid?: number;
  has_demo: boolean;
  has_playtest: boolean;
}

export const ROW_SELECTOR = 'a.search_result_row[data-ds-appid]';
const API_URL = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1';
const TAGS_CACHE_KEY = 'SteamEnhancer_TagsCache_v4';
const TAGS_TTL = 744 * 60 * 60 * 1000;
const OWNED_TTL = 6 * 60 * 60 * 1000;

export const catalogGameCache = new Map<string, CatalogGameData>();
export const catalogCollectedStats = new Map<number, { reviews: number; rating: number; fetched: boolean }>();
export const catalogIgnoredApps = new Set<number>();

const pendingAppIds = new Set<string>();
const dataUpdateListeners = new Set<() => void>();
const rowHydrateListeners = new Set<(row: HTMLElement, data: CatalogGameData) => void>();

let allTagsCache: Record<string, string> = {};
let ownedAppsSet = new Set<number>();
let userDataLoadedPromise: Promise<void> | null = null;

export function getAllCatalogTags(): Record<string, string> {
  return allTagsCache;
}

export function getOwnedAppsSet(): Set<number> {
  return ownedAppsSet;
}

export function onCatalogDataUpdated(fn: () => void): () => void {
  dataUpdateListeners.add(fn);
  return () => dataUpdateListeners.delete(fn);
}

export function onCatalogRowHydrated(fn: (row: HTMLElement, data: CatalogGameData) => void): () => void {
  rowHydrateListeners.add(fn);
  return () => rowHydrateListeners.delete(fn);
}

function notifyDataUpdated(): void {
  dataUpdateListeners.forEach((fn) => fn());
}

export function resolveSteamSessionId(): string {
  const fromGlobal = (window as any).g_sessionID;
  if (typeof fromGlobal === 'string' && fromGlobal.length > 0) return fromGlobal;
  const m = document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export async function loadCatalogTags(): Promise<Record<string, string>> {
  if (Object.keys(allTagsCache).length > 0) return allTagsCache;

  const cached = await idbGet<{ data: Record<string, string>; timestamp: number }>(TAGS_CACHE_KEY);
  if (cached?.data && Date.now() - cached.timestamp < TAGS_TTL) {
    allTagsCache = cached.data;
    return allTagsCache;
  }

  const localTags: Record<string, string> = {};
  document.querySelectorAll('[data-param="tags"][data-value][data-loc]').forEach((el) => {
    const val = el.getAttribute('data-value');
    const loc = el.getAttribute('data-loc');
    if (val && loc) localTags[val] = loc;
  });

  if (Object.keys(localTags).length > 50 && /[а-яё]/i.test(Object.values(localTags).slice(0, 15).join(' '))) {
    allTagsCache = localTags;
    await idbSet(TAGS_CACHE_KEY, { data: localTags, timestamp: Date.now() });
    return allTagsCache;
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
        allTagsCache = tags;
        await idbSet(TAGS_CACHE_KEY, { data: tags, timestamp: Date.now() });
        return allTagsCache;
      }
    } catch {}
  }

  allTagsCache = cached?.data || localTags;
  return allTagsCache;
}

export function ensureCatalogUserData(): Promise<void> {
  if (userDataLoadedPromise) return userDataLoadedPromise;

  userDataLoadedPromise = (async () => {
    const steamId = await getActiveSteamId64();
    const ownedCacheKey = steamId ? `SteamEnhancer_OwnedApps_${steamId}` : '';

    try {
      const res = await fetch(`https://store.steampowered.com/dynamicstore/userdata/?_t=${Date.now()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.rgOwnedApps)) {
          const ownedList = data.rgOwnedApps.map(Number).filter((n: number) => n > 0);
          ownedAppsSet = new Set(ownedList);
          if (ownedCacheKey) {
            await idbSet(ownedCacheKey, { data: ownedList, timestamp: Date.now() });
          }
        }
        if (data?.rgIgnoredApps && typeof data.rgIgnoredApps === 'object') {
          catalogIgnoredApps.clear();
          Object.keys(data.rgIgnoredApps).forEach((k) => {
            const id = Number(k);
            if (id > 0) catalogIgnoredApps.add(id);
          });
        }
        return;
      }
    } catch {}

    if (ownedCacheKey) {
      const cached = await idbGet<{ data: number[]; timestamp: number }>(ownedCacheKey);
      if (cached?.data && Date.now() - cached.timestamp < OWNED_TTL) {
        ownedAppsSet = new Set(cached.data);
      }
    }
  })();

  return userDataLoadedPromise;
}

function hydrateRow(row: HTMLElement, data: CatalogGameData): void {
  row.dataset.bshGameInfo = '1';
  if (data.type === 4 && data.parent_appid && ownedAppsSet.has(data.parent_appid)) {
    row.classList.add('es_highlighted_dlcforya');
  }
  rowHydrateListeners.forEach((fn) => fn(row, data));
}

async function fetchBatch(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  ids.forEach((id) => pendingAppIds.add(String(id)));

  const inputJson = {
    ids: ids.map((appid) => ({ appid })),
    context: { language: 'russian', country_code: 'US', steam_realm: 1 },
    data_request: {
      include_assets: true,
      include_release: true,
      include_reviews: true,
      include_basic_info: true,
      include_supported_languages: true,
      include_included_items: true,
      include_tag_count: 20,
    },
  };

  try {
    const res = await fetchViaBackend(`${API_URL}?input_json=${encodeURIComponent(JSON.stringify(inputJson))}`);
    if (!res.ok || !res.body) return;

    await ensureCatalogUserData();
    const data = JSON.parse(res.body);
    const items: any[] = data?.response?.store_items || [];

    items.forEach((item) => {
      const appId = Number(item.id);
      if (!appId) return;
      const appIdStr = String(appId);

      const reviews = Number(item.reviews?.summary_filtered?.review_count) || 0;
      const rating = Number(item.reviews?.summary_filtered?.percent_positive) || 0;

      catalogCollectedStats.set(appId, { reviews, rating, fetched: true });

      const gameData: CatalogGameData = {
        id: appId,
        is_early_access: Boolean(item.is_early_access),
        has_original_release_date: Boolean(item.release?.original_release_date || item.release?.original_steam_release_date),
        review_count: reviews,
        percent_positive: rating,
        short_description: item.basic_info?.short_description,
        publishers: item.basic_info?.publishers?.map((p: any) => p.name).join(', '),
        developers: item.basic_info?.developers?.map((d: any) => d.name).join(', '),
        franchises: item.basic_info?.franchises?.map((f: any) => f.name).join(', '),
        tagids: Array.isArray(item.tagids) ? item.tagids : [],
        language_support_russian: item.supported_languages?.find((l: any) => l.elanguage === 8),
        language_support_english: item.supported_languages?.find((l: any) => l.elanguage === 0),
        type: item.type,
        parent_appid: item.related_items?.parent_appid ? Number(item.related_items.parent_appid) : undefined,
        has_demo: Boolean(
          item.related_items?.demo_appid ||
            item.related_items?.demos ||
            item.related_items?.standalone_demos ||
            item.related_items?.standalone_demo_appid
        ),
        has_playtest: Boolean(item.related_items?.playtests),
      };

      catalogGameCache.set(appIdStr, gameData);
      const row = document.querySelector(`a.search_result_row[data-ds-appid="${appIdStr}"]`) as HTMLElement | null;
      if (row) hydrateRow(row, gameData);
    });

    notifyDataUpdated();
  } catch (e) {
    console.warn('[Bibliotekarsha Catalog] Ошибка загрузки метаданных:', e);
  } finally {
    ids.forEach((id) => pendingAppIds.delete(String(id)));
  }
}

export async function collectAndFetchCatalogAppIds(): Promise<void> {
  await ensureCatalogUserData();
  const rows = document.querySelectorAll(ROW_SELECTOR);
  const newIds: number[] = [];
  let hydratedFromCache = 0;

  rows.forEach((raw) => {
    const row = raw as HTMLElement;
    const appIdStr = row.dataset.dsAppid;
    if (!appIdStr || appIdStr.includes(',')) return;

    const cached = catalogGameCache.get(appIdStr);
    if (cached) {
      if (row.dataset.bshGameInfo !== '1') {
        hydrateRow(row, cached);
        hydratedFromCache++;
      }
    } else if (!pendingAppIds.has(appIdStr)) {
      const parsed = parseInt(appIdStr, 10);
      if (parsed > 0) newIds.push(parsed);
    }
  });

  if (hydratedFromCache > 0) {
    notifyDataUpdated();
  }

  const uniqueNew = Array.from(new Set(newIds));
  for (let i = 0; i < uniqueNew.length; i += 50) {
    await fetchBatch(uniqueNew.slice(i, i + 50));
    if (i + 50 < uniqueNew.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}
