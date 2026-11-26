import { fetchViaBackend } from '../../shared/ipc';

export interface ZogStoreMatch {
  title: string;
  path: string;
  percentage: number;
}

export interface ZogLocalizationItem {
  name: string;
  size: string;
  link: string;
}

export interface ZogGameDetails {
  title: string;
  url: string;
  localizations: ZogLocalizationItem[];
}

const ENG_ALPHABET_MAP: Record<string, number> = {
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10,
  k: 11, l: 12, m: 13, n: 14, o: 15, p: 16, q: 17, r: 18, s: 19,
  t: 20, u: 21, v: 22, w: 23, x: 24, y: 25, z: 26, '#': 0,
};

const RUS_ALPHABET_MAP: Record<string, number> = {
  а: 1, б: 2, в: 3, г: 4, д: 5, е: 6, ё: 6, ж: 7, з: 8, и: 9,
  й: 9, к: 10, л: 11, м: 12, н: 13, о: 14, п: 15, р: 16, с: 17,
  т: 18, у: 19, ф: 20, х: 21, ц: 22, ч: 23, ш: 24, щ: 25, э: 26,
  ю: 27, я: 28,
};

function levenshtein(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(newValue, lastValue, costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function calcSimilarity(str1: string, str2: string): number {
  const longer = str1.length >= str2.length ? str1 : str2;
  const shorter = str1.length >= str2.length ? str2 : str1;
  if (longer.length === 0) return 100;
  return Math.round(((longer.length - levenshtein(longer, shorter)) / longer.length) * 100);
}

function cleanStr(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zа-яё0-9 _'\-!]/gi, '')
    .toLowerCase()
    .trim();
}

export async function getEnglishGameNameFromSteam(appId: string): Promise<string | null> {
  if (!appId) return null;
  const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(
    JSON.stringify({
      ids: [{ appid: parseInt(appId, 10) }],
      context: { language: 'english', country_code: 'US' },
      data_request: { include_basic_info: true },
    })
  )}`;
  const res = await fetchViaBackend(url);
  if (!res.ok || !res.body) return null;
  try {
    const data = JSON.parse(res.body);
    return data?.response?.store_items?.[0]?.name || null;
  } catch {
    return null;
  }
}

export async function searchGamesOnZogStore(appId: string, fallbackName: string): Promise<ZogStoreMatch[]> {
  const engName = await getEnglishGameNameFromSteam(appId);
  const queryName = (engName || fallbackName || '').trim();
  if (!queryName) return [];

  const isRussian = /[а-яё]/i.test(queryName);
  const activeMap = isRussian ? RUS_ALPHABET_MAP : ENG_ALPHABET_MAP;
  const articles = ['the', 'a', 'an'];
  const words = queryName.toLowerCase().split(/\s+/).filter(Boolean);
  const searchLetters = new Set<string>();

  if (!isRussian && words.length > 1 && articles.includes(words[0])) {
    searchLetters.add(words[0][0]);
    if (activeMap[words[1][0]] !== undefined) searchLetters.add(words[1][0]);
  } else {
    const firstChar = queryName.toLowerCase().charAt(0);
    searchLetters.add(Object.prototype.hasOwnProperty.call(activeMap, firstChar) ? firstChar : '#');
  }

  const found: { title: string; path: string }[] = [];
  const seenPaths = new Set<string>();

  for (const letter of searchLetters) {
    const isNonAlpha = letter === '#';
    const pageNum = activeMap[letter];
    if (pageNum === undefined) continue;
    const baseUrl = isNonAlpha
      ? 'https://www.zoneofgames.ru/games/eng/'
      : isRussian
      ? 'https://www.zoneofgames.ru/games/rus/'
      : 'https://www.zoneofgames.ru/games/eng/';
    const url = `${baseUrl}${pageNum}/`;

    const res = await fetchViaBackend(url, { Referer: 'https://www.zoneofgames.ru/' });
    if (!res.ok || !res.body) continue;

    const doc = new DOMParser().parseFromString(res.body, 'text/html');
    doc.querySelectorAll('td.gameinfoblock a').forEach((link) => {
      const path = link.getAttribute('href');
      if (path && !seenPaths.has(path)) {
        const rawTitle = (link.textContent || '').trim();
        const articleMatch = rawTitle.match(/,\s+(The|An|A)$/i);
        const title = articleMatch ? `${articleMatch[1]} ${rawTitle.replace(articleMatch[0], '').trim()}` : rawTitle;
        found.push({ title, path });
        seenPaths.add(path);
      }
    });
  }

  const cleanQuery = cleanStr(queryName);
  return found
    .map((item) => {
      const cleanItem = cleanStr(item.title);
      return {
        title: item.title,
        path: item.path,
        percentage: calcSimilarity(cleanQuery, cleanItem),
        _starts: cleanItem.startsWith(cleanQuery),
      };
    })
    .filter((m) => m.percentage > 45 || m._starts)
    .sort((a, b) => {
      if (a._starts && !b._starts) return -1;
      if (!a._starts && b._starts) return 1;
      return b.percentage - a.percentage;
    })
    .slice(0, 6)
    .map(({ title, path, percentage }) => ({ title, path, percentage }));
}

export async function fetchZogLocalizations(gamePath: string): Promise<ZogGameDetails> {
  const fullUrl = gamePath.startsWith('http') ? gamePath : `https://www.zoneofgames.ru${gamePath}`;
  const res = await fetchViaBackend(fullUrl, { Referer: 'https://www.zoneofgames.ru/' });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const doc = new DOMParser().parseFromString(res.body, 'text/html');
  const localizations: ZogLocalizationItem[] = [];

  const translationLabel = Array.from(doc.querySelectorAll('b')).find(
    (b) => (b.textContent || '').trim() === 'Переводы:'
  );
  if (translationLabel) {
    const table = translationLabel.closest('table');
    if (table) {
      table.querySelectorAll('tr').forEach((row) => {
        const linkEl = row.querySelector('a');
        const href = linkEl?.getAttribute('href');
        if (linkEl && href) {
          localizations.push({
            name: (linkEl.textContent || '').trim(),
            size: (row.querySelector('td:last-child')?.textContent || '').trim(),
            link: href.startsWith('http') ? href : `https://www.zoneofgames.ru${href}`,
          });
        }
      });
    }
  }

  const gameTitle = (doc.querySelector('td.blockstyle > b > font')?.textContent || '').trim() || 'Выбранная игра';
  return { title: gameTitle, url: fullUrl, localizations };
}
