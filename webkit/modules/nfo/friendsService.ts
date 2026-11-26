import { fetchAuthenticatedSteamUrl, fetchViaBackend } from '../../shared/ipc';

export interface FriendPlaytimeItem {
  steamid: string;
  name: string;
  hours: number;
  profile: string;
  avatar?: string;
}

export interface AchievementsStats {
  hasAchievements: boolean;
  platinumPercent?: string;
  averageAdjustedPercent?: string;
  error?: string;
}

export interface FriendCardEntry {
  idKey: string;
  steamid?: string;
  accountId?: string;
  name: string;
  profile: string;
  avatar?: string;
  hours: number;
  statusClass?: string;
}

export interface AllFriendsSummary {
  recent: FriendCardEntry[];
  ever: FriendCardEntry[];
  own: FriendCardEntry[];
  wishlist: FriendCardEntry[];
  playtimes: FriendPlaytimeItem[];
}

interface MiniProfileInfo {
  persona_name: string;
  avatar_url: string;
}

const STEAM_ID_BASE = 76561197960265728n;
const summaryCache = new Map<string, Promise<AllFriendsSummary>>();
const miniProfileCache = new Map<string, Promise<MiniProfileInfo | null>>();

function steamId64ToAccountId(steamid: string): string {
  try {
    return (BigInt(steamid) - STEAM_ID_BASE).toString();
  } catch {
    return '';
  }
}

async function getMiniProfile(steamid: string): Promise<MiniProfileInfo | null> {
  if (!miniProfileCache.has(steamid)) {
    miniProfileCache.set(
      steamid,
      (async () => {
        const accountId = steamId64ToAccountId(steamid);
        if (!accountId) return null;
        const res = await fetchViaBackend(`https://steamcommunity.com/miniprofile/${accountId}/json`);
        if (!res.ok || !res.body) return null;
        try {
          const data = JSON.parse(res.body);
          if (data?.persona_name) {
            return {
              persona_name: String(data.persona_name),
              avatar_url: String(data.avatar_url || ''),
            };
          }
        } catch {}
        return null;
      })()
    );
  }
  return miniProfileCache.get(steamid)!;
}

async function loadFromAppUserDetails(appId: string): Promise<AllFriendsSummary | null> {
  try {
    const resp = await fetch(`https://store.steampowered.com/api/appuserdetails/?appids=${appId}`, {
      credentials: 'include',
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const data = json?.[appId]?.data;
    if (!data || (!Array.isArray(data.friendsown) && !Array.isArray(data.friendswant))) {
      return null;
    }

    const rawOwn: any[] = Array.isArray(data.friendsown) ? data.friendsown : [];
    const rawWant: any[] = Array.isArray(data.friendswant) ? data.friendswant : [];

    const toCard = (f: any): FriendCardEntry => ({
      idKey: String(f.steamid),
      steamid: String(f.steamid),
      accountId: steamId64ToAccountId(String(f.steamid)),
      name: `ID ${String(f.steamid).slice(-5)}`,
      profile: `https://steamcommunity.com/profiles/${f.steamid}`,
      hours: (Number(f.playtime_total) || 0) / 60,
    });

    const own = rawOwn.map(toCard);
    const wishlist = rawWant.map(toCard);
    const recent = rawOwn.filter((f) => Number(f.playtime_twoweeks) > 0).map(toCard);
    const ever = rawOwn.filter((f) => Number(f.playtime_total) > 0).map(toCard);

    const sortedPlayed = [...ever].sort((a, b) => b.hours - a.hours);
    const maxHours = sortedPlayed.length > 0 ? sortedPlayed[0].hours : 0;
    const topFriends = sortedPlayed.filter((f) => f.hours === maxHours).slice(0, 3);

    await Promise.all(
      topFriends.map(async (f) => {
        if (!f.steamid) return;
        const mp = await getMiniProfile(f.steamid);
        if (mp) {
          f.name = mp.persona_name;
          f.avatar = mp.avatar_url;
        }
      })
    );

    const playtimes: FriendPlaytimeItem[] = sortedPlayed.map((f) => ({
      steamid: f.steamid || '',
      name: f.name,
      hours: f.hours,
      profile: f.profile,
      avatar: f.avatar,
    }));

    return { recent, ever, own, wishlist, playtimes };
  } catch {
    return null;
  }
}

function parseFriendBlockElement(el: Element): FriendCardEntry | null {
  const block = el as HTMLElement;
  const contentBlock = block.querySelector('.friendBlockContent');
  const linkEl = block.querySelector('a.friendBlockLinkOverlay') as HTMLAnchorElement | null;
  if (!contentBlock || !linkEl) return null;

  const profile = linkEl.getAttribute('href') || linkEl.href || '';
  const accountId = block.dataset.miniprofile || '';
  const avatar = (block.querySelector('.playerAvatar img') as HTMLImageElement | null)?.src || '';
  const name = (contentBlock.firstChild?.textContent || '').trim() || 'Друг';

  const timeText = (contentBlock.querySelector('.friendSmallText')?.textContent || '').trim();
  let hours = 0;
  if (timeText) {
    const parts = timeText.split('/');
    const relevant = parts.length > 1 ? parts[1] : parts[0];
    const m = relevant.match(/(\d+[,.]?\d*)\s*(?:ч|hrs)\.?/i);
    if (m && m[1]) {
      hours = parseFloat(m[1].replace(',', '.')) || 0;
    }
  }

  const statusClass = block.classList.contains('in-game')
    ? 'friend_status_in-game'
    : block.classList.contains('online')
    ? 'friend_status_online'
    : 'friend_status_offline';

  return {
    idKey: accountId || profile,
    accountId,
    name,
    profile,
    avatar,
    hours,
    statusClass,
  };
}

function dedupeCards(lists: FriendCardEntry[][]): FriendCardEntry[] {
  const map = new Map<string, FriendCardEntry>();
  for (const list of lists) {
    for (const item of list) {
      if (!map.has(item.idKey)) map.set(item.idKey, item);
    }
  }
  return Array.from(map.values());
}

async function loadFromCommunityFriendsThatPlay(appId: string): Promise<AllFriendsSummary | null> {
  const urls = [
    `https://steamcommunity.com/profiles/{{STEAM_ID64}}/friendsthatplay/${appId}?l=russian`,
    `https://steamcommunity.com/my/friendsthatplay/${appId}?l=russian`,
  ];

  let html = '';
  for (const url of urls) {
    const res = await fetchAuthenticatedSteamUrl(url);
    if (res.ok && res.body && res.body.includes('friendListSectionHeader')) {
      html = res.body;
      break;
    }
    console.warn(
      `[Bibliotekarsha Friends] ${url} -> status=${res.status}, auth_injected=${res.auth_injected}, len=${res.body?.length || 0}`
    );
  }
  if (!html) return null;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const headers = doc.querySelectorAll('.mainSectionHeader.friendListSectionHeader');

  const keywords = {
    recent: ['последние 2 недели', 'последних 2 недель', 'in the last 2 weeks'],
    ever: ['когда-либо игравшие', 'previously'],
    own: ['имеющие', 'in their library'],
    wishlist: ['которые хотят', 'who want'],
  };

  let rawRecent: FriendCardEntry[] = [];
  let rawEver: FriendCardEntry[] = [];
  let rawOwnOnly: FriendCardEntry[] = [];
  let rawWishlist: FriendCardEntry[] = [];

  headers.forEach((header) => {
    const text = (header.textContent || '').trim().toLowerCase();
    const container = header.nextElementSibling;
    if (!container || !container.matches('.profile_friends')) return;

    const cards = Array.from(container.querySelectorAll('.friendBlock'))
      .map(parseFriendBlockElement)
      .filter((x): x is FriendCardEntry => x !== null);

    if (keywords.recent.some((k) => text.includes(k))) rawRecent = cards;
    else if (keywords.ever.some((k) => text.includes(k))) rawEver = cards;
    else if (keywords.own.some((k) => text.includes(k))) rawOwnOnly = cards;
    else if (keywords.wishlist.some((k) => text.includes(k))) rawWishlist = cards;
  });

  const ever = dedupeCards([rawRecent, rawEver]);
  const own = dedupeCards([rawRecent, rawEver, rawOwnOnly]);
  const playtimes: FriendPlaytimeItem[] = ever
    .filter((f) => f.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .map((f) => ({
      steamid: f.steamid || '',
      name: f.name,
      hours: f.hours,
      profile: f.profile,
      avatar: f.avatar,
    }));

  return {
    recent: rawRecent,
    ever,
    own,
    wishlist: rawWishlist,
    playtimes,
  };
}

export async function getFriendsSummary(appId: string): Promise<AllFriendsSummary> {
  if (!summaryCache.has(appId)) {
    summaryCache.set(
      appId,
      (async () => {
        const isIncognito = Boolean((window as any).__BSH_INCOGNITO_ACTIVE);
        if (!isIncognito) {
          const fast = await loadFromAppUserDetails(appId);
          if (fast) return fast;
        }
        const comm = await loadFromCommunityFriendsThatPlay(appId);
        if (comm) return comm;
        const fallbackFast = isIncognito ? await loadFromAppUserDetails(appId) : null;
        return fallbackFast || { recent: [], ever: [], own: [], wishlist: [], playtimes: [] };
      })()
    );
  }
  return summaryCache.get(appId)!;
}

export async function getGlobalAchievementsStats(appId: string): Promise<AchievementsStats> {
  const apiUrl = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}`;
  const res = await fetchViaBackend(apiUrl);

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
}

async function buildAvatarGridHtml(entries: FriendCardEntry[]): Promise<string> {
  const subset = entries.slice(0, 6);
  const resolved = await Promise.all(
    subset.map(async (entry) => {
      if (entry.avatar) return entry;
      if (entry.steamid) {
        const mp = await getMiniProfile(entry.steamid);
        if (mp) return { ...entry, name: mp.persona_name, avatar: mp.avatar_url };
      }
      return entry;
    })
  );

  const items = resolved
    .filter((e) => Boolean(e.avatar))
    .map((entry) => {
      const hrs = entry.hours > 0 ? ` (${entry.hours.toFixed(1)} ч.)` : '';
      return `
        <a href="${entry.profile}" target="_blank"
           class="friend_block_holder ${entry.statusClass || 'friend_status_offline'}"
           ${entry.accountId ? `data-miniprofile="${entry.accountId}"` : ''}
           title="${entry.name.replace(/"/g, '&quot;')}${hrs}"
           style="display:inline-block;margin:0 4px 4px 0;">
          <div class="friend_block_avatar" style="display:inline-block;">
            <img src="${entry.avatar}" style="width:32px;height:32px;border-radius:2px;display:block;" />
          </div>
        </a>
      `;
    })
    .join('');

  return `<div class="friend_blocks_grid">${items}</div>`;
}

export async function restoreIncognitoFriendsSidebar(appId: string): Promise<void> {
  const recommendationBlock = document.querySelector('.recommendation_reasons') as HTMLElement | null;
  const isIncognito = Boolean((window as any).__BSH_INCOGNITO_ACTIVE);
  const hasNativeData =
    recommendationBlock &&
    (recommendationBlock.querySelector('.friend_blocks_grid') ||
      (recommendationBlock.innerText || '').trim().length > 0);

  if (!isIncognito && hasNativeData) return;

  const targetContainer = document.querySelector('.rightcol.game_meta_data');
  if (!targetContainer) return;

  const block = recommendationBlock || document.createElement('div');
  block.className = 'block responsive_apppage_details_right recommendation_reasons';
  block.style.display = 'block';
  block.innerHTML = `<p class="reason info" style="text-align:center;">Загрузка данных о друзьях (Bibliotekarsha)...</p>`;
  if (!recommendationBlock) {
    targetContainer.prepend(block);
  }

  const data = await getFriendsSummary(appId);
  let html = '';

  if (data.recent.length > 0) {
    html += `<p class="reason for">Друзей, игравших недавно: ${data.recent.length}</p>${await buildAvatarGridHtml(data.recent)}<hr>`;
  }
  if (data.ever.length > 0) {
    html += `<p class="reason for"><a href="https://steamcommunity.com/my/friendsthatplay/${appId}" target="_blank">Друзей, когда-либо игравших в игру: ${data.ever.length}</a></p>${await buildAvatarGridHtml(data.ever)}<hr>`;
  }
  if (data.own.length > 0) {
    html += `<p class="reason for"><a href="https://steamcommunity.com/my/friendsthatplay/${appId}" target="_blank">Друзей, имеющих игру в библиотеке: ${data.own.length}</a></p>${await buildAvatarGridHtml(data.own)}<hr>`;
  }
  if (data.wishlist.length > 0) {
    html += `<p class="reason for"><a href="https://steamcommunity.com/my/friendsthatplay/${appId}" target="_blank">Друзей, которые хотят эту игру: ${data.wishlist.length}</a></p>${await buildAvatarGridHtml(data.wishlist)}<hr>`;
  }

  block.innerHTML =
    html.length > 0 ? html.replace(/<hr>$/, '') : `<p class="reason info">Нет данных о действиях друзей с этой игрой.</p>`;
}
