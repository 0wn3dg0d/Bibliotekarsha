import { ffi } from 'millennium';

const fetchUrl = ffi('fetch_url');

export interface LibHltbEntry {
  game_id: number;
  game_name: string;
  comp_main: number;
  comp_main_count: number;
  comp_plus: number;
  comp_plus_count: number;
  comp_100: number;
  comp_100_count: number;
  comp_all: number;
  comp_all_count: number;
  percentage?: number;
}

export interface LibHltbResult {
  status: 'ok' | 'matches' | 'not_found' | 'error';
  entry?: LibHltbEntry;
  matches?: LibHltbEntry[];
  error?: string;
}

export interface LibFriendPlaytime {
  name: string;
  hours: number;
  profile: string;
}

export interface LibAchievementsStats {
  hasAchievements: boolean;
  platinumPercent?: string;
  averageAdjustedPercent?: string;
  error?: string;
}

export interface LibFriendsAndAchResult {
  playtimes: LibFriendPlaytime[];
  achievements: LibAchievementsStats;
}

const HLTB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const LIB_HLTB_DB = 'BibliotekarshaLibraryNfoDB_v1';
const LIB_HLTB_STORE = 'kv';
const LIB_HLTB_ENDPOINT_KEY = 'hltb_working_endpoint_v1';
let memoryHltbEndpoint: string | null = null;

function openLibNfoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LIB_HLTB_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(LIB_HLTB_STORE)) {
        req.result.createObjectStore(LIB_HLTB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedHltbEndpoint(): Promise<string> {
  if (memoryHltbEndpoint) return memoryHltbEndpoint;
  try {
    const db = await openLibNfoDB();
    const saved = await new Promise<string | undefined>((resolve) => {
      const tx = db.transaction(LIB_HLTB_STORE, 'readonly');
      const req = tx.objectStore(LIB_HLTB_STORE).get(LIB_HLTB_ENDPOINT_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
    if (typeof saved === 'string' && saved.startsWith('/api/')) {
      memoryHltbEndpoint = saved;
      return saved;
    }
  } catch {}
  return '/api/find';
}

async function saveCachedHltbEndpoint(ep: string): Promise<void> {
  memoryHltbEndpoint = ep;
  try {
    const db = await openLibNfoDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(LIB_HLTB_STORE, 'readwrite');
      tx.objectStore(LIB_HLTB_STORE).put(ep, LIB_HLTB_ENDPOINT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

async function backendRequest(opts: {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  use_steam_auth?: boolean;
}): Promise<{ ok: boolean; status: number; body: string; error?: string }> {
  try {
    const raw = await fetchUrl(
      JSON.stringify({
        url: opts.url,
        method: opts.method || 'GET',
        headers: {
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          ...(opts.headers || {}),
        },
        body: opts.body,
        use_steam_auth: Boolean(opts.use_steam_auth),
      })
    );
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      ok: Boolean(parsed?.ok),
      status: Number(parsed?.status) || 0,
      body: String(parsed?.body || ''),
      error: parsed?.error,
    };
  } catch (e: any) {
    return { ok: false, status: 0, body: '', error: e?.message || String(e) };
  }
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1
      );
    }
  }
  return dp[m][n];
}

function calcSimilarity(str1: string, str2: string): number {
  const len = Math.max(str1.length, str2.length);
  if (len === 0) return 100;
  return Math.round(((len - levenshtein(str1, str2)) / len) * 100);
}

function cleanTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zа-яё0-9 _'\-!]/gi, '')
    .toLowerCase()
    .trim();
}

function findPossibleMatches(gameName: string, data: LibHltbEntry[]): LibHltbEntry[] {
  const cleanGame = cleanTitle(gameName);
  return data
    .map((item) => {
      const cleanItem = cleanTitle(item.game_name || '');
      const pct = calcSimilarity(cleanGame, cleanItem);
      const starts = cleanItem.startsWith(cleanGame);
      return { ...item, percentage: pct, _starts: starts };
    })
    .filter((item) => (item.percentage || 0) > 50 || item._starts)
    .sort((a, b) => {
      if (a._starts && !b._starts) return -1;
      if (!a._starts && b._starts) return 1;
      return (b.percentage || 0) - (a.percentage || 0);
    })
    .slice(0, 5);
}

export function formatLibHltbTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} м.`;
  if (minutes >= 30) return `${hours + 1} ч.`;
  return `${hours} ч.`;
}

async function getHltbToken(endpoint: string): Promise<{ token: string; hpKey?: string; hpVal?: string } | null> {
  const res = await backendRequest({
    url: `https://howlongtobeat.com${endpoint}/init?t=${Date.now()}`,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': HLTB_UA,
      Referer: 'https://howlongtobeat.com/',
    },
  });
  if (!res.ok || !res.body) return null;
  try {
    const parsed = JSON.parse(res.body);
    if (!parsed?.token) return null;
    return { token: parsed.token, hpKey: parsed.hpKey, hpVal: parsed.hpVal };
  } catch {
    return null;
  }
}

async function discoverHltbEndpoints(): Promise<string[]> {
  const home = await backendRequest({
    url: 'https://howlongtobeat.com/',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': HLTB_UA,
      Referer: 'https://howlongtobeat.com/',
    },
  });
  if (!home.ok || !home.body) return ['/api/find', '/api/site'];

  const chunkMatches = Array.from(home.body.matchAll(/["'](\/_next\/static\/[^"']+\.js)["']/g));
  const scripts = Array.from(new Set(chunkMatches.map((m) => m[1])));
  const apiPaths = new Set<string>();

  const responses = await Promise.all(
    scripts.map((src) =>
      backendRequest({
        url: 'https://howlongtobeat.com' + (src.startsWith('/') ? src : '/' + src),
        headers: { Accept: '*/*', 'User-Agent': HLTB_UA, Referer: 'https://howlongtobeat.com/' },
      })
    )
  );

  for (const r of responses) {
    if (!r.body) continue;
    const matches = Array.from(r.body.matchAll(/["'`](\/api\/[a-zA-Z0-9_\/%\-]+)["'`]/g));
    for (const m of matches) apiPaths.add(m[1]);
  }

  const withInit: string[] = [];
  for (const path of apiPaths) {
    if (!path.endsWith('/init') && apiPaths.has(`${path}/init`)) {
      withInit.push(path);
    }
  }
  withInit.sort();
  return Array.from(new Set([...withInit, '/api/find', '/api/locate', '/api/seek', '/api/site']));
}

function makeTerms(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, "'")
    .replace(/[^a-zA-Zа-яёА-ЯЁ _0-9`~!@#$%^&*()_\-=+|\\\]}[{;:',<.>\/?]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

async function postHltbSearch(
  endpoint: string,
  terms: string[],
  auth: { token: string; hpKey?: string; hpVal?: string }
) {
  const payload: any = {
    searchType: 'games',
    searchTerms: terms,
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: 0, max: 0 },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  };
  if (auth.hpKey && auth.hpVal) {
    payload[auth.hpKey] = auth.hpVal;
  }

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'User-Agent': HLTB_UA,
    Origin: 'https://howlongtobeat.com',
    Referer: 'https://howlongtobeat.com/',
    'x-auth-token': auth.token,
  };
  if (auth.hpKey) headers['x-hp-key'] = auth.hpKey;
  if (auth.hpVal) headers['x-hp-val'] = auth.hpVal;

  return backendRequest({
    url: `https://howlongtobeat.com${endpoint}`,
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

export async function fetchLibraryHltb(appId: string, gameName: string): Promise<LibHltbResult> {
  const tried: string[] = [];

  const tryEp = async (ep: string) => {
    const auth = await getHltbToken(ep);
    if (!auth) {
      tried.push(`${ep}:no-init`);
      return null;
    }
    const res = await postHltbSearch(ep, makeTerms(gameName), auth);
    if (res.ok && res.body && !res.body.trim().startsWith('<')) {
      try {
        const parsed = JSON.parse(res.body);
        if (parsed && typeof parsed === 'object' && ('data' in parsed || 'count' in parsed)) {
          return { ep, auth, data: parsed as { count: number; data: LibHltbEntry[] } };
        }
      } catch {}
    }
    tried.push(`${ep}:${res.status}`);
    return null;
  };

  const currentEndpoint = await getCachedHltbEndpoint();
  let working = await tryEp(currentEndpoint);
  if (!working) {
    const candidates = await discoverHltbEndpoints();
    for (const ep of candidates) {
      if (ep === currentEndpoint) continue;
      working = await tryEp(ep);
      if (working) {
        await saveCachedHltbEndpoint(ep);
        break;
      }
    }
  }

  if (!working) {
    return { status: 'error', error: `HLTB недоступен (${tried.slice(0, 3).join(', ')})` };
  }

  let data = working.data;
  let activeName = gameName;

  if ((!data.count || data.count === 0) && /[а-яё]/i.test(gameName) && appId) {
    const steamApiUrl = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(
      JSON.stringify({
        ids: [{ appid: parseInt(appId, 10) }],
        context: { language: 'english', country_code: 'US', steam_realm: 1 },
        data_request: { include_basic_info: true },
      })
    )}`;
    const steamRes = await backendRequest({ url: steamApiUrl });
    if (steamRes.ok && steamRes.body) {
      try {
        const steamJson = JSON.parse(steamRes.body);
        const engName = steamJson?.response?.store_items?.[0]?.name;
        if (engName && engName !== gameName) {
          activeName = engName;
          const secondRes = await postHltbSearch(working.ep, makeTerms(engName), working.auth);
          if (secondRes.ok && secondRes.body) {
            data = JSON.parse(secondRes.body);
          }
        }
      } catch {}
    }
  }

  if (data.count > 0 && Array.isArray(data.data) && data.data.length > 0) {
    const matches = findPossibleMatches(activeName, data.data);
    if (matches.length === 1 || (matches[0] && (matches[0].percentage || 0) >= 92)) {
      return { status: 'ok', entry: matches[0], matches };
    }
    if (matches.length > 1) {
      return { status: 'matches', matches };
    }
    return { status: 'ok', entry: data.data[0] };
  }

  return { status: 'not_found' };
}

export async function fetchLibraryFriendsAndAchievements(appId: string): Promise<LibFriendsAndAchResult> {
  const [friendsResult, achResult] = await Promise.all([
    (async (): Promise<LibFriendPlaytime[]> => {
      const urls = [
        `https://steamcommunity.com/profiles/{{STEAM_ID64}}/friendsthatplay/${appId}?l=russian`,
        `https://steamcommunity.com/my/friendsthatplay/${appId}?l=russian`,
      ];
      let html = '';
      for (const url of urls) {
        const res = await backendRequest({
          url,
          use_steam_auth: true,
          headers: { Referer: 'https://steamcommunity.com/' },
        });
        if (res.ok && res.body && res.body.includes('friendListSectionHeader')) {
          html = res.body;
          break;
        }
      }
      if (!html) return [];

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const headers = doc.querySelectorAll('.mainSectionHeader.friendListSectionHeader');
      const playedKeywords = ['последние 2 недели', 'последних 2 недель', 'in the last 2 weeks', 'когда-либо игравшие', 'previously'];
      const map = new Map<string, LibFriendPlaytime>();

      headers.forEach((header) => {
        const title = (header.textContent || '').trim().toLowerCase();
        if (!playedKeywords.some((k) => title.includes(k))) return;
        const container = header.nextElementSibling;
        if (!container || !container.matches('.profile_friends')) return;

        container.querySelectorAll('.friendBlock').forEach((el) => {
          const contentBlock = el.querySelector('.friendBlockContent');
          const linkEl = el.querySelector('a.friendBlockLinkOverlay') as HTMLAnchorElement | null;
          if (!contentBlock || !linkEl) return;

          const profile = linkEl.getAttribute('href') || linkEl.href || '';
          if (map.has(profile)) return;

          const timeText = (contentBlock.querySelector('.friendSmallText')?.textContent || '').trim();
          let hours = 0;
          if (timeText) {
            const parts = timeText.split('/');
            const part = parts.length > 1 ? parts[1] : parts[0];
            const m = part.match(/(\d+[,.]?\d*)\s*(?:ч|hrs)\.?/i);
            if (m && m[1]) hours = parseFloat(m[1].replace(',', '.')) || 0;
          }
          if (hours > 0) {
            const name = (contentBlock.firstChild?.textContent || '').trim() || 'Друг';
            map.set(profile, { name, hours, profile });
          }
        });
      });

      return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
    })(),
    (async (): Promise<LibAchievementsStats> => {
      const res = await backendRequest({
        url: `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}`,
      });
      if (res.ok && res.body) {
        try {
          const data = JSON.parse(res.body);
          const list = data?.achievementpercentages?.achievements;
          if (!Array.isArray(list) || list.length === 0) {
            return { hasAchievements: false, error: 'Достижения отсутствуют' };
          }
          const percents = list.map((a: any) => Number(a.percent) || 0).filter((p: number) => p > 0);
          if (percents.length === 0) {
            return { hasAchievements: false, error: 'Нет данных по процентам' };
          }
          const maxPercent = Math.max(...percents);
          const minPercent = Math.min(...percents);
          const adjustment = 100 - maxPercent;
          const adjusted = percents.map((p: number) => p + adjustment);
          const avg = adjusted.reduce((sum: number, p: number) => sum + p, 0) / adjusted.length;
          return {
            hasAchievements: true,
            platinumPercent: (minPercent + adjustment).toFixed(1),
            averageAdjustedPercent: avg.toFixed(1),
          };
        } catch {}
      }
      return { hasAchievements: false, error: 'Достижения отсутствуют или ошибка API' };
    })(),
  ]);

  return { playtimes: friendsResult, achievements: achResult };
}
