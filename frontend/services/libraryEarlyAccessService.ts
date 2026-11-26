import { ffi } from 'millennium';

const fetchUrl = ffi('fetch_url');

const EAORDATE_URL =
  'https://gist.githubusercontent.com/0wn3dg0d/58a8e35f3d34014ea749a22d02f7e203/raw/eaordate.json';
const EA_DB_NAME = 'BibliotekarshaLibraryEaDB_v2';
const EA_STORE_NAME = 'kv';
const EA_CACHE_KEY = 'eaordate_list_v1';
const CACHE_DURATION = 180 * 24 * 60 * 60 * 1000;
const APP_EA_TTL = 30 * 24 * 60 * 60 * 1000;

export interface LibraryEarlyAccessInfo {
  hasEarlyAccess: boolean;
  isReleased: boolean;
  message: string;
}

const appEaCache = new Map<number, Promise<LibraryEarlyAccessInfo>>();
let memoryOrdateList: Array<{ appid: number; ordate: string }> | null = null;

function openEaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(EA_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(EA_STORE_NAME)) {
        req.result.createObjectStore(EA_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openEaDB();
    return await new Promise<T | undefined>((resolve) => {
      const tx = db.transaction(EA_STORE_NAME, 'readonly');
      const req = tx.objectStore(EA_STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

async function idbSet(key: string, value: any): Promise<void> {
  try {
    const db = await openEaDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(EA_STORE_NAME, 'readwrite');
      tx.objectStore(EA_STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function getOrdateList(): Promise<Array<{ appid: number; ordate: string }>> {
  if (memoryOrdateList) return memoryOrdateList;

  const cached = await idbGet<{ timestamp: number; data: Array<{ appid: number; ordate: string }> }>(EA_CACHE_KEY);
  if (cached && Array.isArray(cached.data) && Date.now() - cached.timestamp < CACHE_DURATION) {
    memoryOrdateList = cached.data;
    return cached.data;
  }

  try {
    const raw = await fetchUrl(JSON.stringify({ url: EAORDATE_URL, method: 'GET' }));
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed?.ok && parsed?.body) {
      const data = JSON.parse(parsed.body);
      if (Array.isArray(data)) {
        memoryOrdateList = data;
        await idbSet(EA_CACHE_KEY, { timestamp: Date.now(), data });
        return data;
      }
    }
  } catch {}

  return [];
}

function getYearForm(n: number): string {
  n = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'лет';
  if (n1 === 1) return 'год';
  if (n1 >= 2 && n1 <= 4) return 'года';
  return 'лет';
}

function getMonthForm(n: number): string {
  n = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'месяцев';
  if (n1 === 1) return 'месяц';
  if (n1 >= 2 && n1 <= 4) return 'месяца';
  return 'месяцев';
}

function parseSteamDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();

  const numericParts = clean.split('.');
  if (numericParts.length === 3) {
    const d = parseInt(numericParts[0], 10);
    const m = parseInt(numericParts[1], 10) - 1;
    const y = parseInt(numericParts[2], 10);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
  }

  const monthsMap: Record<string, number> = {
    янв: 0, фев: 1, мар: 2, апр: 3, мая: 4, май: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const cleanedStr = clean.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = cleanedStr.split(' ');
  if (parts.length >= 3) {
    if (/^\d+$/.test(parts[0])) {
      const day = parseInt(parts[0], 10);
      const monthKey = parts[1].substring(0, 3).toLowerCase();
      const year = parseInt(parts[2], 10);
      if (monthKey in monthsMap && !isNaN(day) && !isNaN(year)) {
        return new Date(year, monthsMap[monthKey], day);
      }
    } else if (/^\d+$/.test(parts[1])) {
      const monthKey = parts[0].substring(0, 3).toLowerCase();
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (monthKey in monthsMap && !isNaN(day) && !isNaN(year)) {
        return new Date(year, monthsMap[monthKey], day);
      }
    }
  }

  const dt = new Date(clean);
  return isNaN(dt.getTime()) ? null : dt;
}

function calculateDuration(startDate: Date, endDate: Date): string {
  let diffMonths =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  if (endDate.getDate() < startDate.getDate()) diffMonths--;
  if (diffMonths < 0) diffMonths = 0;

  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${getYearForm(years)}`);
  if (months > 0) parts.push(`${months} ${getMonthForm(months)}`);
  return parts.length > 0 ? parts.join(' и ') : 'менее месяца';
}

async function fetchStorePageEaDates(
  appId: number
): Promise<{ ok: boolean; earlyDate: Date | null; releaseDate: Date | null }> {
  try {
    const raw = await fetchUrl(
      JSON.stringify({
        url: `https://store.steampowered.com/app/${appId}/?l=russian`,
        method: 'GET',
        headers: {
          Cookie: 'birthtime=568022401; lastagecheckage=1-January-1988; wants_mature_content=1; Steam_Language=russian',
        },
      })
    );
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed?.ok || !parsed?.body) return { ok: false, earlyDate: null, releaseDate: null };

    const html: string = parsed.body;
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const earlyMatch = text.match(/Дата выпуска в раннем доступе:\s*(\d+\s+\S+\s+\d{4})/i);
    const releaseMatch = text.match(/Дата выхода:\s*(\d+\s+\S+\s+\d{4})/i);

    return {
      ok: true,
      earlyDate: earlyMatch ? parseSteamDate(earlyMatch[1]) : null,
      releaseDate: releaseMatch ? parseSteamDate(releaseMatch[1]) : null,
    };
  } catch {
    return { ok: false, earlyDate: null, releaseDate: null };
  }
}

export function getLibraryEarlyAccessInfo(appId: number): Promise<LibraryEarlyAccessInfo> {
  if (!appEaCache.has(appId)) {
    appEaCache.set(
      appId,
      (async (): Promise<LibraryEarlyAccessInfo> => {
        const cacheKey = `app_ea_${appId}`;
        const cachedApp = await idbGet<{ timestamp: number; info: LibraryEarlyAccessInfo }>(cacheKey);
        if (cachedApp && Date.now() - cachedApp.timestamp < APP_EA_TTL) {
          return cachedApp.info;
        }

        const saveAndReturn = async (info: LibraryEarlyAccessInfo) => {
          await idbSet(cacheKey, { timestamp: Date.now(), info });
          return info;
        };

        try {
          const input = JSON.stringify({
            ids: [{ appid: appId }],
            context: { language: 'russian', country_code: 'US', steam_realm: 1 },
            data_request: { include_basic_info: true, include_release: true, include_tag_count: 5 },
          });
          const apiUrl = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(
            input
          )}`;

          const [itemRaw, ordateList] = await Promise.all([
            fetchUrl(JSON.stringify({ url: apiUrl, method: 'GET' })),
            getOrdateList(),
          ]);

          const parsedResp = typeof itemRaw === 'string' ? JSON.parse(itemRaw) : itemRaw;
          if (!parsedResp?.ok || !parsedResp?.body) {
            appEaCache.delete(appId);
            return { hasEarlyAccess: false, isReleased: false, message: '' };
          }
          const itemJson = JSON.parse(parsedResp.body);
          const item = itemJson?.response?.store_items?.[0];

          const isEarlyAccessNow =
            Boolean(item?.is_early_access) ||
            (Array.isArray(item?.categories?.supported_player_categoryids) &&
              item.categories.supported_player_categoryids.includes(20)) ||
            (Array.isArray(item?.tagids) && item.tagids.includes(493));

          const rel = item?.release || {};
          const fullUnix = Number(rel.steam_release_date || 0);

          if (isEarlyAccessNow) {
            if (fullUnix > 0) {
              const duration = calculateDuration(new Date(fullUnix * 1000), new Date());
              return saveAndReturn({
                hasEarlyAccess: true,
                isReleased: false,
                message: `В раннем доступе уже ${duration}`,
              });
            }
            return saveAndReturn({
              hasEarlyAccess: true,
              isReleased: false,
              message: 'Игра находится в раннем доступе',
            });
          }

          const ordateEntry = ordateList.find((x) => Number(x.appid) === appId);
          if (ordateEntry) {
            const startDate = parseSteamDate(ordateEntry.ordate);
            const endDate = fullUnix > 0 ? new Date(fullUnix * 1000) : new Date();
            if (startDate && startDate < endDate) {
              return saveAndReturn({
                hasEarlyAccess: true,
                isReleased: true,
                message: `Вышла спустя ${calculateDuration(startDate, endDate)} раннего доступа`,
              });
            }
            return saveAndReturn({
              hasEarlyAccess: true,
              isReleased: true,
              message: 'Вышла из раннего доступа (срок неизвестен)',
            });
          }

          const storeDates = await fetchStorePageEaDates(appId);
          if (storeDates.earlyDate) {
            const endDate = storeDates.releaseDate || (fullUnix > 0 ? new Date(fullUnix * 1000) : new Date());
            if (storeDates.earlyDate < endDate) {
              return saveAndReturn({
                hasEarlyAccess: true,
                isReleased: true,
                message: `Вышла спустя ${calculateDuration(storeDates.earlyDate, endDate)} раннего доступа`,
              });
            }
            return saveAndReturn({
              hasEarlyAccess: true,
              isReleased: true,
              message: 'Вышла из раннего доступа (срок неизвестен)',
            });
          }

          if (!storeDates.ok) {
            appEaCache.delete(appId);
            return { hasEarlyAccess: false, isReleased: false, message: '' };
          }

          return saveAndReturn({ hasEarlyAccess: false, isReleased: false, message: '' });
        } catch {
          appEaCache.delete(appId);
          return { hasEarlyAccess: false, isReleased: false, message: '' };
        }
      })()
    );
  }
  return appEaCache.get(appId)!;
}
