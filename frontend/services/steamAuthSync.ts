import { ChromeDevToolsProtocol, ffi } from 'millennium';
import {
  getCurrentAccount,
  reportAccountFromAuthSync,
  subscribeAccountChange,
} from './accountContext';

const setSteamAuth = ffi('set_steam_auth');

async function syncSteamCommunityAuth(forceReset = false): Promise<void> {
  try {
    let cookies: any[] = [];
    for (const [method, params] of [
      ['Network.getAllCookies', {}],
      ['Storage.getCookies', {}],
      ['Network.getCookies', { urls: ['https://steamcommunity.com', 'https://store.steampowered.com'] }],
    ] as [string, Record<string, any>][]) {
      try {
        const res: any = await (ChromeDevToolsProtocol as any).send(method, params);
        const list = res?.cookies || res?.result?.cookies;
        if (Array.isArray(list) && list.length > 0) {
          cookies = list;
          break;
        }
      } catch {}
    }

    const commCookies = cookies.filter((c: any) => (c.domain || '').includes('steamcommunity.com'));
    const cookieHeader = commCookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
    const loginCookie = commCookies.find((c: any) => c.name === 'steamLoginSecure');
    const idMatch = loginCookie?.value ? String(loginCookie.value).match(/^(\d{17})/) : null;
    const cookieSteamId = idMatch ? idMatch[1] : '';
    const knownAccountId = getCurrentAccount().steamId64;

    if (knownAccountId && cookieSteamId && cookieSteamId !== knownAccountId) {
      if (forceReset) {
        await setSteamAuth(
          JSON.stringify({
            cookie: '',
            steamId64: knownAccountId,
            reset: true,
          })
        );
      }
      return;
    }

    const steamId64 = cookieSteamId || knownAccountId;

    if (steamId64 && (!knownAccountId || knownAccountId === steamId64)) {
      reportAccountFromAuthSync(steamId64);
    }

    if (forceReset || cookieHeader || steamId64) {
      await setSteamAuth(
        JSON.stringify({
          cookie: cookieHeader,
          steamId64,
          reset: forceReset,
        })
      );
    }
  } catch (e) {
    console.warn('[Bibliotekarsha Auth] Ошибка синхронизации:', e);
  }
}

subscribeAccountChange((acc, prevId) => {
  if (acc.steamId64 !== prevId) {
    if (!acc.steamId64) {
      setSteamAuth(JSON.stringify({ reset: true, cookie: '', steamId64: '' })).catch(() => {});
    } else {
      syncSteamCommunityAuth(true);
      setTimeout(() => syncSteamCommunityAuth(false), 2500);
      setTimeout(() => syncSteamCommunityAuth(false), 6000);
    }
  }
});

setTimeout(() => syncSteamCommunityAuth(false), 1000);
setTimeout(() => syncSteamCommunityAuth(false), 4500);
setInterval(() => syncSteamCommunityAuth(false), 60_000);
