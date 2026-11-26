import { fetchViaBackend, idbGet, idbSet, requestViaBackend } from '../../shared/ipc';

export interface HltbEntry {
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

export interface HltbSearchResult {
  status: 'ok' | 'matches' | 'not_found' | 'error';
  entry?: HltbEntry;
  matches?: HltbEntry[];
  error?: string;
}

const HLTB_ENDPOINT_KEY = 'use_hltb_api_endpoint_v6';
const HLTB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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

function findPossibleMatches(gameName: string, data: HltbEntry[]): HltbEntry[] {
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

export function formatHltbTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} м.`;
  if (minutes >= 30) return `${hours + 1} ч.`;
  return `${hours} ч.`;
}

async function getHltbToken(endpoint: string): Promise<{ token: string; hpKey?: string; hpVal?: string } | null> {
  const initUrl = `https://howlongtobeat.com${endpoint}/init?t=${Date.now()}`;
  const res = await fetchViaBackend(initUrl, {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': HLTB_UA,
    Referer: 'https://howlongtobeat.com/',
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
  const home = await fetchViaBackend('https://howlongtobeat.com/', {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': HLTB_UA,
    Referer: 'https://howlongtobeat.com/',
  });
  if (!home.ok || !home.body) return ['/api/find', '/api/site'];

  const chunkMatches = Array.from(home.body.matchAll(/["'](\/_next\/static\/[^"']+\.js)["']/g));
  const scriptsToFetch = Array.from(new Set(chunkMatches.map((m) => m[1])));

  const apiPaths = new Set<string>();
  const responses = await Promise.all(
    scriptsToFetch.map((src) =>
      fetchViaBackend('https://howlongtobeat.com' + (src.startsWith('/') ? src : '/' + src), {
        Accept: '*/*',
        'User-Agent': HLTB_UA,
        Referer: 'https://howlongtobeat.com/',
      })
    )
  );

  for (const resp of responses) {
    if (!resp.body) continue;
    const matches = Array.from(resp.body.matchAll(/["'`](\/api\/[a-zA-Z0-9_\/%\-]+)["'`]/g));
    for (const m of matches) apiPaths.add(m[1]);
  }

  const withInit: string[] = [];
  for (const path of apiPaths) {
    if (!path.endsWith('/init') && apiPaths.has(`${path}/init`)) {
      withInit.push(path);
    }
  }
  withInit.sort();

  const extras = ['/api/find', '/api/locate', '/api/seek', '/api/site', '/api/s'];
  return Array.from(new Set([...withInit, ...extras]));
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

function buildPayload(terms: string[], tokenAuth: { token: string; hpKey?: string; hpVal?: string }) {
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
  if (tokenAuth.hpKey && tokenAuth.hpVal) {
    payload[tokenAuth.hpKey] = tokenAuth.hpVal;
  }
  return payload;
}

async function postSearch(
  endpoint: string,
  terms: string[],
  tokenAuth: { token: string; hpKey?: string; hpVal?: string }
) {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'User-Agent': HLTB_UA,
    Origin: 'https://howlongtobeat.com',
    Referer: 'https://howlongtobeat.com/',
    'x-auth-token': tokenAuth.token,
  };
  if (tokenAuth.hpKey) headers['x-hp-key'] = tokenAuth.hpKey;
  if (tokenAuth.hpVal) headers['x-hp-val'] = tokenAuth.hpVal;

  return requestViaBackend({
    url: `https://howlongtobeat.com${endpoint}`,
    method: 'POST',
    headers,
    body: JSON.stringify(buildPayload(terms, tokenAuth)),
  });
}

export async function searchHltbForGame(appId: string, gameName: string): Promise<HltbSearchResult> {
  const cached = await idbGet<string>(HLTB_ENDPOINT_KEY);
  const triedStatuses: string[] = [];

  const tryEndpoint = async (endpoint: string) => {
    const auth = await getHltbToken(endpoint);
    if (!auth) {
      triedStatuses.push(`${endpoint}:no-init`);
      return null;
    }
    const res = await postSearch(endpoint, makeTerms(gameName), auth);
    if (res.ok && res.body && !res.body.trim().startsWith('<')) {
      try {
        const parsed = JSON.parse(res.body);
        if (parsed && typeof parsed === 'object' && ('data' in parsed || 'count' in parsed)) {
          return { endpoint, auth, data: parsed as { count: number; data: HltbEntry[] } };
        }
      } catch {}
    }
    triedStatuses.push(`${endpoint}:${res.status}`);
    return null;
  };

  let working: { endpoint: string; auth: { token: string; hpKey?: string; hpVal?: string }; data: { count: number; data: HltbEntry[] } } | null = null;

  if (cached) {
    working = await tryEndpoint(cached);
  }

  if (!working) {
    const candidates = await discoverHltbEndpoints();
    for (const ep of candidates) {
      if (ep === cached) continue;
      working = await tryEndpoint(ep);
      if (working) {
        await idbSet(HLTB_ENDPOINT_KEY, ep);
        break;
      }
    }
  }

  if (!working) {
    return {
      status: 'error',
      error: `HLTB недоступен (${triedStatuses.slice(0, 4).join(', ')})`,
    };
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
    const steamRes = await fetchViaBackend(steamApiUrl);
    if (steamRes.ok && steamRes.body) {
      try {
        const steamJson = JSON.parse(steamRes.body);
        const engName = steamJson?.response?.store_items?.[0]?.name;
        if (engName && engName !== gameName) {
          activeName = engName;
          const secondRes = await postSearch(working.endpoint, makeTerms(engName), working.auth);
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
