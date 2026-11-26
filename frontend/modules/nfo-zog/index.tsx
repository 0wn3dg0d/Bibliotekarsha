import { useEffect, useState } from 'react';
import { registerNfoSection } from '../../core/nfo-registry';
import { BibliotekarshaModule } from '../../core/types';
import { getGameNames, smartFetch } from '../../services/net';

const alphabetMap: Record<string, number> = {
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10,
  k: 11, l: 12, m: 13, n: 14, o: 15, p: 16, q: 17, r: 18, s: 19,
  t: 20, u: 21, v: 22, w: 23, x: 24, y: 25, z: 26, '#': 0,
};

const russianAlphabetMap: Record<string, number> = {
  а: 1, б: 2, в: 3, г: 4, д: 5, е: 6, ё: 6, ж: 7, з: 8, и: 9,
  й: 9, к: 10, л: 11, м: 12, н: 13, о: 14, п: 15, р: 16, с: 17,
  т: 18, у: 19, ф: 20, х: 21, ц: 22, ч: 23, ш: 24, щ: 25, э: 26,
  ю: 27, я: 28,
};

const zogSessionCache = new Map<number, any>();

function levenshtein(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(newValue, lastValue, costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function similarity(str1: string, str2: string): number {
  let longer = str1;
  let shorter = str2;
  if (str1.length < str2.length) {
    longer = str2;
    shorter = str1;
  }
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

async function findGamesOnZog(gameName: string) {
  const isRussian = /[а-яё]/i.test(gameName);
  const activeMap = isRussian ? russianAlphabetMap : alphabetMap;
  const articles = ['the', 'a', 'an'];
  const words = gameName.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searchLetters = new Set<string>();

  if (!isRussian && articles.includes(words[0]) && words.length > 1) {
    searchLetters.add(words[0][0]);
    if (activeMap[words[1][0]] !== undefined) searchLetters.add(words[1][0]);
  } else {
    const firstChar = gameName.trim().toLowerCase().charAt(0);
    searchLetters.add(Object.prototype.hasOwnProperty.call(activeMap, firstChar) ? firstChar : '#');
  }

  const allGames: Array<{ title: string; path: string }> = [];
  const uniquePaths = new Set<string>();
  let anyFetched = false;

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

    const res = await smartFetch(url, { headers: { Referer: 'https://www.zoneofgames.ru/' } });
    if (!res.ok || !res.text) continue;
    anyFetched = true;
    const doc = new DOMParser().parseFromString(res.text, 'text/html');
    doc.querySelectorAll('td.gameinfoblock a').forEach((link) => {
      const path = link.getAttribute('href');
      if (path && !uniquePaths.has(path)) {
        const rawTitle = (link.textContent || '').trim();
        const articleMatch = rawTitle.match(/,\s+(The|An|A)$/i);
        const title = articleMatch ? `${articleMatch[1]} ${rawTitle.replace(articleMatch[0], '').trim()}` : rawTitle;
        allGames.push({ title, path });
        uniquePaths.add(path);
      }
    });
  }

  if (!anyFetched && searchLetters.size > 0) {
    throw new Error('ZOG network error');
  }
  return allGames;
}

function ZogSectionView({ appId }: { appId: number }) {
  const [status, setStatus] = useState<string>('Поиск в базе Zone of Games...');
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedLocs, setSelectedLocs] = useState<{
    title: string;
    url: string;
    localizations: Array<{ name: string; size: string; link: string }>;
  } | null>(null);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const handleRefresh = () => {
    zogSessionCache.delete(appId);
    setRetryTick((n) => n + 1);
  };

  const loadLocalizations = async (gamePath: string, allRanked: any[]) => {
    setLoadingLocs(true);
    const fullUrl = `https://www.zoneofgames.ru${gamePath}`;
    try {
      const res = await smartFetch(fullUrl, { headers: { Referer: 'https://www.zoneofgames.ru/' } });
      if (!res.ok || !res.text) throw new Error('Failed');
      const doc = new DOMParser().parseFromString(res.text, 'text/html');
      const localizations: Array<{ name: string; size: string; link: string }> = [];
      const translationLabel = Array.from(doc.querySelectorAll('b')).find((b) => b.textContent?.trim() === 'Переводы:');
      if (translationLabel) {
        const table = translationLabel.closest('table');
        table?.querySelectorAll('tr').forEach((row) => {
          const linkEl = row.querySelector('a');
          if (linkEl?.getAttribute('href')) {
            localizations.push({
              name: (linkEl.textContent || '').trim(),
              size: (row.querySelector('td:last-child')?.textContent || '').trim(),
              link: `https://www.zoneofgames.ru${linkEl.getAttribute('href')}`,
            });
          }
        });
      }
      const gameTitle = doc.querySelector('td.blockstyle > b > font')?.textContent?.trim() || 'Страница игры на ZOG';
      const result = { title: gameTitle, url: fullUrl, localizations };
      setSelectedLocs(result);
      zogSessionCache.set(appId, { matches: allRanked, selectedLocs: result });
    } catch {
      setError('Ошибка загрузки списка русификаторов.');
    } finally {
      setLoadingLocs(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (zogSessionCache.has(appId)) {
        const cached = zogSessionCache.get(appId);
        setMatches(cached.matches || []);
        setSelectedLocs(cached.selectedLocs || null);
        setError(cached.error || null);
        return;
      }

      setError(null);
      setMatches([]);
      setSelectedLocs(null);
      setStatus('Определение названия игры...');

      const names = await getGameNames(appId);
      const searchName = names.englishName || names.localName;
      if (!cancelled) setStatus(`Поиск «${searchName}» на ZOG...`);

      try {
        const rawGames = await findGamesOnZog(searchName);
        if (cancelled) return;

        const cleanTarget = cleanStr(searchName);
        const ranked = rawGames
          .map((item) => {
            const cleanItem = cleanStr(item.title);
            return {
              ...item,
              percentage: similarity(cleanTarget, cleanItem),
              startsWith: cleanItem.startsWith(cleanTarget),
            };
          })
          .filter((item) => item.percentage > 45 || item.startsWith)
          .sort((a, b) => {
            if (a.startsWith && !b.startsWith) return -1;
            if (!a.startsWith && b.startsWith) return 1;
            return b.percentage - a.percentage;
          })
          .slice(0, 15);

        if (ranked.length === 0) {
          const msg = 'Игра не найдена в базе Zone of Games.';
          setError(msg);
          zogSessionCache.set(appId, { error: msg });
          return;
        }

        setMatches(ranked);
        zogSessionCache.set(appId, { matches: ranked, selectedLocs: null });

        const exact = ranked.find((r) => r.percentage === 100);
        if (exact) {
          await loadLocalizations(exact.path, ranked);
        }
      } catch {
        if (!cancelled) {
          setError('Ошибка соединения с Zone of Games.');
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [appId, retryTick]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', color: '#8f98a0' }}>
        <span>{error}</span>
        <button type="button" onClick={handleRefresh} className="bib-nfo-pill-btn" title="Повторить запрос">
          ⟳
        </button>
      </div>
    );
  }

  if (loadingLocs) {
    return <div style={{ color: '#8f98a0' }}>Загрузка русификаторов...</div>;
  }

  if (selectedLocs) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <a
            href={selectedLocs.url}
            target="_blank"
            rel="noreferrer"
            className="bib-nfo-link" style={{ fontWeight: 700, fontSize: '14px' }}
          >
            {selectedLocs.title} ↗
          </a>
          {matches.length > 1 && (
            <button
              type="button"
              onClick={() => setSelectedLocs(null)}
              className="bib-nfo-pill-btn"
            >
              Другие совпадения
            </button>
          )}
        </div>

        {selectedLocs.localizations.length === 0 ? (
          <div style={{ color: '#8f98a0' }}>Русификаторы для этой игры отсутствуют.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {selectedLocs.localizations.map((loc, idx) => (
              <a
                key={idx}
                href={loc.link}
                target="_blank"
                rel="noreferrer"
                className="bib-nfo-item-row"
              >
                <span>{loc.name}</span>
                {loc.size && (
                  <span style={{ color: '#66c0f4', fontSize: '11px', flexShrink: 0 }}>{loc.size}</span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (matches.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ color: '#a3d5f7', fontSize: '12px', marginBottom: '4px' }}>
          Возможные совпадения ({matches.length}):
        </div>
        {matches.map((m) => (
          <div
            key={m.path}
            onClick={() => loadLocalizations(m.path, matches)}
            className="bib-nfo-item-row" style={{ cursor: 'pointer' }}
          >
            <span style={{ color: '#e2e8f0' }}>{m.title}</span>
            <span
              style={{
                fontSize: '11px',
                color: '#66c0f4',
                backgroundColor: 'rgba(102, 192, 244, 0.14)',
                padding: '1px 6px',
                borderRadius: '3px',
                flexShrink: 0,
              }}
            >
              {m.percentage}%
            </span>
          </div>
        ))}
      </div>
    );
  }

  return <div style={{ color: '#8f98a0' }}>{status}</div>;
}

export const nfoZogModule: BibliotekarshaModule = {
  id: 'nfo-zog',
  name: 'NFO: Русификаторы (Zone of Games)',
  description: 'Поиск игры на ZoneOfGames.ru и вывод доступных русификаторов в окне NFO.',
  defaultEnabled: true,
  mountGlobal: () =>
    registerNfoSection({
      id: 'zog',
      title: 'Zone of Games',
      subtitle: 'Русификаторы',
      order: 20,
      render: (appId: number) => <ZogSectionView appId={appId} />,
    }),
};
