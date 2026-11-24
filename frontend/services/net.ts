import { callable } from 'millennium';

const backendFetch = callable<[{ options_json: string }], string>('fetch_url');

export interface SmartFetchResponse {
  ok: boolean;
  status: number;
  text: string;
}

export async function smartFetch(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string }
): Promise<SmartFetchResponse> {
  try {
    const raw = await backendFetch({
      options_json: JSON.stringify({
        url,
        method: options?.method || 'GET',
        headers: options?.headers || {},
        body: options?.body || '',
      }),
    });
    const parsed = JSON.parse(raw);
    return {
      ok: Boolean(parsed?.ok),
      status: Number(parsed?.status) || 0,
      text: typeof parsed?.body === 'string' ? parsed.body : '',
    };
  } catch {
    try {
      const res = await fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body,
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    } catch {
      return { ok: false, status: 0, text: '' };
    }
  }
}

const namesCache = new Map<number, { englishName: string; localName: string }>();

export async function getGameNames(appId: number): Promise<{ englishName: string; localName: string }> {
  if (namesCache.has(appId)) return namesCache.get(appId)!;

  let localName = '';
  try {
    const overview = (window as any).appStore?.GetAppOverviewByAppID?.(appId);
    if (overview?.display_name) localName = overview.display_name;
  } catch {}

  let englishName = '';
  try {
    const req = {
      ids: [{ appid: appId }],
      context: { language: 'english', country_code: 'US', steam_realm: 1 },
      data_request: { include_basic_info: true },
    };
    const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(
      JSON.stringify(req)
    )}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      englishName = json?.response?.store_items?.[0]?.name || '';
    }
  } catch {}

  const result = {
    englishName: englishName || localName || `App #${appId}`,
    localName: localName || englishName || `App #${appId}`,
  };
  namesCache.set(appId, result);
  return result;
}
