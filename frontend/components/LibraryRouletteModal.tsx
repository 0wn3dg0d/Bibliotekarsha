import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ffi } from 'millennium';
import { TIER_INFO, formatLocDetail } from '../config/tiers';
import {
  AppFilter,
  AppOverview,
  Collection,
  getAllUserCollectionsSafe,
  getCollectionStore,
  isRatable,
  libraryApps,
} from '../lib/steam';
import { GLOBAL_SCOPE } from '../modules/library-filter/filter-patch';
import { isScopeFilterActive, matchesGameMeta } from '../stores/filters';
import { cachedMeta, onMetaUpdate, requestAllLibraryMeta } from '../stores/localization';
import { ensureTagsLoaded, getTagName } from '../stores/tags';

const fetchUrl = ffi('fetch_url');

interface LibraryRouletteModalProps {
  appFilter?: AppFilter;
  onClose: () => void;
}

interface RouletteCollection {
  id: string;
  name: string;
  isFavorite: boolean;
  isUncategorized: boolean;
  totalApps: number;
  matchedAppIds: number[];
}

interface RouletteGameItem {
  appId: number;
  name: string;
  posterUrl: string;
  fallbackPosterUrl: string;
  playtimeMinutes: number;
  reviewPercent: number;
  reviewCount: number;
  releaseYear: string;
  releaseTimestamp: number;
  tagIds: number[];
  collections: string[];
}

interface ExtraGameDetails {
  description: string;
  releaseDate: string;
  publishers: string;
  developers: string;
  headerUrl?: string;
}

const extraDetailsCache = new Map<number, ExtraGameDetails>();

const SYSTEM_COLLECTION_IDS = new Set([
  'hidden',
  'all-collections',
  'desktop-focused',
  'local-games',
  'uncategorized',
  'type-games',
  'type-tools',
  'type-music',
  'type-videos',
  'type-software',
]);

const ITEM_WIDTH = 164;
const REEL_SLOTS = 80;
const WINNER_SLOT_INDEX = 62;
const GRID_PAGE_SIZE = 60;

const ROULETTE_STYLES = `
  .bib-rl-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
  .bib-rl-scroll::-webkit-scrollbar-track { background: #0d1117; border-radius: 4px; }
  .bib-rl-scroll::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
  .bib-rl-scroll::-webkit-scrollbar-thumb:hover { background: #58a6ff; }

  .bib-rl-btn {
    background: #21262d;
    color: #c9d1d9;
    border: 1px solid #30363d;
    padding: 6px 12px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.1s ease;
  }
  .bib-rl-btn:hover:not(:disabled) {
    background: #30363d;
    border-color: #58a6ff;
    color: #ffffff;
  }
  .bib-rl-btn:active:not(:disabled) { transform: translateY(1px); }
  .bib-rl-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .bib-rl-btn-spin {
    background: linear-gradient(180deg, #2ea043 0%, #238636 100%);
    border: 1px solid #3fb950;
    color: #ffffff;
    font-weight: 700;
    font-size: 14px;
    padding: 11px 16px;
    letter-spacing: 0.4px;
    box-shadow: 0 4px 14px rgba(35, 134, 54, 0.35);
  }
  .bib-rl-btn-spin:hover:not(:disabled) {
    background: linear-gradient(180deg, #3fb950 0%, #2ea043 100%);
    border-color: #56d364;
  }

  .bib-rl-btn-blue {
    background: linear-gradient(90deg, #47bfff 0%, #1a44c2 100%);
    border: 1px solid #66c0f4;
    color: #ffffff;
  }
  .bib-rl-btn-blue:hover:not(:disabled) {
    filter: brightness(1.12);
    border-color: #9be0ff;
  }

  .bib-rl-col-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    font-size: 12.5px;
    border: 1px solid transparent;
    transition: background-color 0.12s ease, border-color 0.12s ease;
  }
  .bib-rl-col-row:hover {
    background: rgba(88, 166, 255, 0.12);
    border-color: rgba(88, 166, 255, 0.25);
  }
  .bib-rl-col-row.selected {
    background: rgba(88, 166, 255, 0.16);
    color: #f0f6fc;
  }

  .bib-rl-selector {
    position: absolute;
    left: 50%;
    top: -4px;
    bottom: -4px;
    width: 4px;
    background: #f9826c;
    transform: translateX(-50%);
    box-shadow: 0 0 12px 3px rgba(249, 130, 108, 0.85);
    border-radius: 2px;
    pointer-events: none;
    z-index: 4;
    animation: bibRlPulse 1.3s infinite ease-in-out;
  }
  @keyframes bibRlPulse {
    0%, 100% { opacity: 1; transform: translateX(-50%) scaleY(1.04); }
    50% { opacity: 0.7; transform: translateX(-50%) scaleY(0.98); }
  }

  .bib-rl-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
  }
  .bib-rl-card:hover {
    transform: translateY(-3px);
    border-color: #58a6ff;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.45);
  }
  .bib-rl-card.active {
    border-color: #f9826c;
    box-shadow: 0 0 0 1px #f9826c;
  }

  .bib-rl-input, .bib-rl-select {
    background: #0d1117;
    border: 1px solid #30363d;
    color: #c9d1d9;
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 12px;
    outline: none;
  }
  .bib-rl-input:focus, .bib-rl-select:focus {
    border-color: #58a6ff;
  }
`;

function getTargetDocument(): Document {
  return window.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0')?.m_popup?.document || document;
}

function formatDateFromUnix(ts?: number): string {
  if (!ts || ts <= 0) return '';
  const d = new Date(ts * 1000);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function formatPlaytime(minutes: number): string {
  if (!minutes || minutes <= 0) return 'Не запускалась';
  if (minutes < 60) return `${minutes} мин.`;
  return `${(minutes / 60).toFixed(1)} ч.`;
}

function navigateToLibraryApp(appId: number, onAfter?: () => void): void {
  try {
    const w = window as any;
    if (typeof w.MainWindowBrowserManager?.m_history?.push === 'function') {
      w.MainWindowBrowserManager.m_history.push(`/library/app/${appId}`);
      onAfter?.();
      return;
    }
    if (typeof w.SteamClient?.URL?.ExecuteSteamURL === 'function') {
      w.SteamClient.URL.ExecuteSteamURL(`steam://nav/games/details/${appId}`);
      onAfter?.();
      return;
    }
  } catch {}

  try {
    const doc = getTargetDocument();
    const a = doc.createElement('a');
    a.href = `steam://nav/games/details/${appId}`;
    doc.body.appendChild(a);
    a.click();
    a.remove();
  } catch {}
  onAfter?.();
}

function executeSteamUrl(url: string): void {
  try {
    const w = window as any;
    if (typeof w.SteamClient?.URL?.ExecuteSteamURL === 'function') {
      w.SteamClient.URL.ExecuteSteamURL(url);
      return;
    }
  } catch {}
  try {
    const doc = getTargetDocument();
    const a = doc.createElement('a');
    a.href = url;
    doc.body.appendChild(a);
    a.click();
    a.remove();
  } catch {}
}

async function fetchExtraDetails(appId: number): Promise<ExtraGameDetails | null> {
  if (extraDetailsCache.has(appId)) return extraDetailsCache.get(appId)!;

  const queryForCountry = async (cc: string): Promise<any | null> => {
    const input = JSON.stringify({
      ids: [{ appid: appId }],
      context: { language: 'russian', country_code: cc, steam_realm: 1 },
      data_request: {
        include_assets: true,
        include_release: true,
        include_basic_info: true,
      },
    });
    const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(input)}`;
    const raw = await fetchUrl(JSON.stringify({ url, method: 'GET' }));
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed?.ok || !parsed?.body) return null;
    const json = JSON.parse(parsed.body);
    return json?.response?.store_items?.[0] || null;
  };

  try {
    let item = await queryForCountry('US');
    if (!item || !item.name) {
      item = await queryForCountry('RU');
    }
    if (!item) return null;

    const relTs = item.release?.original_release_date || item.release?.steam_release_date;
    const headerUrl = item.assets?.header
      ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/${item.assets.header}`
      : undefined;

    const details: ExtraGameDetails = {
      description: String(item.basic_info?.short_description || '').replace(/\r?\n/g, ' ').trim(),
      releaseDate: formatDateFromUnix(relTs),
      publishers: (item.basic_info?.publishers || []).map((p: any) => p.name).filter(Boolean).join(', '),
      developers: (item.basic_info?.developers || []).map((d: any) => d.name).filter(Boolean).join(', '),
      headerUrl,
    };
    extraDetailsCache.set(appId, details);
    return details;
  } catch {
    return null;
  }
}

function appPassesLibraryFilters(app: AppOverview, appFilter?: AppFilter): boolean {
  if (appFilter && typeof appFilter.MatchesImpl === 'function') {
    try {
      if (!appFilter.MatchesImpl(app)) return false;
    } catch {}
  }
  if (isScopeFilterActive(GLOBAL_SCOPE)) {
    const meta = cachedMeta(app.appid);
    if (meta && !matchesGameMeta(GLOBAL_SCOPE, meta)) return false;
  }
  return true;
}

function collectLibraryCollections(appFilter?: AppFilter): {
  collections: RouletteCollection[];
  gamesById: Map<number, RouletteGameItem>;
} {
  const allLibraryApps = libraryApps();
  const matchedAppIds = new Set<number>();
  const appOverviewById = new Map<number, any>();

  for (const app of allLibraryApps) {
    appOverviewById.set(app.appid, app);
    if (appPassesLibraryFilters(app, appFilter)) {
      matchedAppIds.add(app.appid);
    }
  }

  const store = getCollectionStore();
  const rawCollections: Collection[] = [];
  const seenIds = new Set<string>();

  const isSystemColId = (id: string) =>
    SYSTEM_COLLECTION_IDS.has(id) ||
    id.startsWith('type-') ||
    id.startsWith('play-state-') ||
    id.startsWith('site-license');

  const pushCol = (col: Collection | null | undefined) => {
    if (!col || !col.id || seenIds.has(col.id)) return;
    if (col.id !== 'favorite' && isSystemColId(col.id)) return;
    seenIds.add(col.id);
    rawCollections.push(col);
  };

  if (store?.favoriteCollection) {
    pushCol(store.favoriteCollection);
  }
  if (Array.isArray(store?.userCollections)) {
    store.userCollections.forEach((c: Collection) => pushCol(c));
  }
  getAllUserCollectionsSafe().forEach((c) => pushCol(c));

  const categorizedAppIds = new Set<number>();
  const appToCollectionNames = new Map<number, string[]>();
  const collections: RouletteCollection[] = [];

  for (const col of rawCollections) {
    const isFav = col.id === 'favorite';
    const anyCol = col as any;
    const rawName =
      anyCol.displayName ||
      anyCol.m_strName ||
      col.strName ||
      anyCol.name ||
      (col.id.startsWith('from-tag-') ? col.id.slice('from-tag-'.length) : col.id);
    const name = isFav ? 'Избранное' : String(rawName).trim();
    const rawApps = (col.allApps ?? col.visibleApps ?? []).filter(isRatable);
    const matchedIds: number[] = [];
    const uniqueColIds = new Set<number>();

    for (const app of rawApps) {
      if (uniqueColIds.has(app.appid)) continue;
      uniqueColIds.add(app.appid);
      categorizedAppIds.add(app.appid);
      if (!appOverviewById.has(app.appid)) {
        appOverviewById.set(app.appid, app);
      }

      const list = appToCollectionNames.get(app.appid) || [];
      if (!list.includes(name)) list.push(name);
      appToCollectionNames.set(app.appid, list);

      if (matchedAppIds.has(app.appid)) {
        matchedIds.push(app.appid);
      }
    }

    if (uniqueColIds.size > 0) {
      collections.push({
        id: col.id,
        name,
        isFavorite: isFav,
        isUncategorized: false,
        totalApps: uniqueColIds.size,
        matchedAppIds: matchedIds,
      });
    }
  }

  collections.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return a.name.localeCompare(b.name, 'ru', { numeric: true, sensitivity: 'base' });
  });

  const uncatTotal: number[] = [];
  const uncatMatched: number[] = [];
  for (const app of allLibraryApps) {
    if (!categorizedAppIds.has(app.appid)) {
      uncatTotal.push(app.appid);
      if (matchedAppIds.has(app.appid)) uncatMatched.push(app.appid);
    }
  }
  if (uncatTotal.length > 0) {
    collections.push({
      id: '__uncategorized__',
      name: 'Без категории',
      isFavorite: false,
      isUncategorized: true,
      totalApps: uncatTotal.length,
      matchedAppIds: uncatMatched,
    });
  }

  const gamesById = new Map<number, RouletteGameItem>();
  for (const appId of matchedAppIds) {
    const ov = appOverviewById.get(appId);
    const meta = cachedMeta(appId);
    const displayName = String(ov?.display_name || ov?.name || `App #${appId}`);
    const relTs = Number(ov?.rt_original_release_date || ov?.rt_steam_release_date || 0);
    const yearStr =
      meta?.releaseYear ||
      (relTs > 0 ? String(new Date(relTs * 1000).getUTCFullYear()) : 'Без даты');

    gamesById.set(appId, {
      appId,
      name: displayName,
      posterUrl: `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
      fallbackPosterUrl: `/assets/${appId}/header.jpg`,
      playtimeMinutes: Number(ov?.minutes_playtime_forever || 0),
      reviewPercent: meta?.reviewPercent ?? Number(ov?.review_percentage || 0),
      reviewCount: meta?.reviewCount ?? 0,
      releaseYear: yearStr,
      releaseTimestamp: relTs,
      tagIds: meta?.tagIds || [],
      collections: appToCollectionNames.get(appId) || ['Без категории'],
    });
  }

  return { collections, gamesById };
}

export function LibraryRouletteModal({ appFilter, onClose }: LibraryRouletteModalProps) {
  const [tick, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [colSearch, setColSearch] = useState('');
  const [gridSearch, setGridSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('default');
  const [viewMode, setViewMode] = useState<'roulette' | 'collection'>('roulette');
  const [priorityByReviews, setPriorityByReviews] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [reelItems, setReelItems] = useState<RouletteGameItem[]>([]);
  const [selectedGame, setSelectedGame] = useState<RouletteGameItem | null>(null);
  const [extraDetails, setExtraDetails] = useState<ExtraGameDetails | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [gridLimit, setGridLimit] = useState(GRID_PAGE_SIZE);

  const reelRef = useRef<HTMLDivElement | null>(null);
  const reelContainerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const hasSpunRef = useRef(false);

  const dragSelectRef = useRef<{ active: boolean; targetChecked: boolean; lastIndex: number }>({
    active: false,
    targetChecked: true,
    lastIndex: -1,
  });

  useEffect(() => {
    requestAllLibraryMeta();
    ensureTagsLoaded().then(() => rerender());
    const unsubMeta = onMetaUpdate(() => rerender());

    const targetWin = getTargetDocument().defaultView || window;
    const stopDrag = () => {
      dragSelectRef.current.active = false;
      dragSelectRef.current.lastIndex = -1;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    targetWin.addEventListener('mouseup', stopDrag);
    window.addEventListener('mouseup', stopDrag);
    targetWin.addEventListener('keydown', onKey);

    return () => {
      unsubMeta();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      targetWin.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('mouseup', stopDrag);
      targetWin.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const { collections, gamesById } = useMemo(() => collectLibraryCollections(appFilter), [appFilter, tick]);

  const [selectedColIds, setSelectedColIds] = useState<Set<string>>(
    () => new Set(collections.map((c) => c.id))
  );

  const didInitSelection = useRef(collections.length > 0);
  const prevColsRef = useRef<Set<string>>(selectedColIds);
  useEffect(() => {
    if (!didInitSelection.current && collections.length > 0) {
      didInitSelection.current = true;
      setSelectedColIds(new Set(collections.map((c) => c.id)));
    }
  }, [collections]);

  const visibleCollections = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter((c) => c.name.toLowerCase().includes(q));
  }, [collections, colSearch]);

  const poolGames = useMemo(() => {
    const idSet = new Set<number>();
    for (const col of collections) {
      if (!selectedColIds.has(col.id)) continue;
      for (const id of col.matchedAppIds) idSet.add(id);
    }
    const list: RouletteGameItem[] = [];
    for (const id of idSet) {
      const g = gamesById.get(id);
      if (g) list.push(g);
    }
    return list;
  }, [collections, selectedColIds, gamesById]);

  useEffect(() => {
    const colsChanged = prevColsRef.current !== selectedColIds;
    prevColsRef.current = selectedColIds;
    if (colsChanged) {
      hasSpunRef.current = false;
    }
    if (spinning) return;
    if (hasSpunRef.current && !colsChanged) return;
    if (poolGames.length === 0) {
      setReelItems([]);
      return;
    }
    const preview: RouletteGameItem[] = [];
    const count = Math.min(24, Math.max(poolGames.length, 12));
    for (let i = 0; i < count; i++) {
      preview.push(poolGames[i % poolGames.length]);
    }
    setReelItems(preview);
    if (reelRef.current) {
      reelRef.current.style.transform = 'translateX(0px)';
    }
  }, [poolGames.length, selectedColIds]);

  useEffect(() => {
    if (!selectedGame) {
      setExtraDetails(null);
      setLoadingExtra(false);
      return;
    }
    let cancelled = false;
    setLoadingExtra(true);
    setExtraDetails(extraDetailsCache.get(selectedGame.appId) || null);

    fetchExtraDetails(selectedGame.appId).then((details) => {
      if (cancelled) return;
      setExtraDetails(details);
      setLoadingExtra(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedGame?.appId]);

  const handleColMouseDown = (index: number, colId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const currentlyChecked = selectedColIds.has(colId);
    const targetChecked = !currentlyChecked;

    dragSelectRef.current = {
      active: true,
      targetChecked,
      lastIndex: index,
    };

    setSelectedColIds((prev) => {
      const next = new Set(prev);
      if (targetChecked) next.add(colId);
      else next.delete(colId);
      return next;
    });
  };

  const handleColMouseEnter = (index: number) => {
    const drag = dragSelectRef.current;
    if (!drag.active) return;

    const from = drag.lastIndex >= 0 ? Math.min(drag.lastIndex, index) : index;
    const to = drag.lastIndex >= 0 ? Math.max(drag.lastIndex, index) : index;
    drag.lastIndex = index;

    setSelectedColIds((prev) => {
      const next = new Set(prev);
      for (let i = from; i <= to; i++) {
        const col = visibleCollections[i];
        if (!col) continue;
        if (drag.targetChecked) next.add(col.id);
        else next.delete(col.id);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedColIds((prev) => {
      const next = new Set(prev);
      visibleCollections.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const clearAllVisible = () => {
    if (!colSearch.trim()) {
      setSelectedColIds(new Set());
      return;
    }
    setSelectedColIds((prev) => {
      const next = new Set(prev);
      visibleCollections.forEach((c) => next.delete(c.id));
      return next;
    });
  };

  const pickWinner = (games: RouletteGameItem[]): RouletteGameItem => {
    if (!priorityByReviews) {
      return games[Math.floor(Math.random() * games.length)];
    }
    const weights = games.map((g) => Math.max(1, (g.reviewPercent / 100) * Math.log1p(g.reviewCount)));
    const total = weights.reduce((acc, w) => acc + w, 0);
    if (total <= 0) return games[Math.floor(Math.random() * games.length)];

    let r = Math.random() * total;
    for (let i = 0; i < games.length; i++) {
      r -= weights[i];
      if (r <= 0) return games[i];
    }
    return games[games.length - 1];
  };

  const handleSpin = () => {
    if (spinning || poolGames.length === 0) return;
    if (viewMode === 'collection') setViewMode('roulette');

    const winner = pickWinner(poolGames);

    const strip: RouletteGameItem[] = [];
    for (let i = 0; i < REEL_SLOTS; i++) {
      if (i === WINNER_SLOT_INDEX) {
        strip.push(winner);
      } else {
        strip.push(poolGames[Math.floor(Math.random() * poolGames.length)]);
      }
    }

    hasSpunRef.current = true;
    setSpinning(true);
    setSelectedGame(null);
    setReelItems(strip);

    requestAnimationFrame(() => {
      const reelEl = reelRef.current;
      const containerEl = reelContainerRef.current;
      if (!reelEl || !containerEl) {
        setSpinning(false);
        setSelectedGame(winner);
        return;
      }

      const containerWidth = containerEl.offsetWidth || 700;
      const jitter = Math.round((Math.random() - 0.5) * 60);
      const targetPos =
        WINNER_SLOT_INDEX * ITEM_WIDTH - containerWidth / 2 + ITEM_WIDTH / 2 + jitter;

      reelEl.style.transform = 'translateX(0px)';
      const startTime = performance.now();
      const duration = poolGames.length === 1 ? 1400 : 4400;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const currentX = targetPos * eased;
        reelEl.style.transform = `translateX(-${currentX}px)`;

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          animFrameRef.current = null;
          setSpinning(false);
          setSelectedGame(winner);
        }
      };

      animFrameRef.current = requestAnimationFrame(step);
    });
  };

  const sortedGridGames = useMemo(() => {
    const q = gridSearch.trim().toLowerCase();
    const list = q
      ? poolGames.filter((g) => g.name.toLowerCase().includes(q) || String(g.appId).includes(q))
      : [...poolGames];

    const smartScore = (g: RouletteGameItem) => (g.reviewPercent / 100) * Math.log1p(g.reviewCount);

    switch (sortBy) {
      case 'name_asc':
        list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        break;
      case 'name_desc':
        list.sort((a, b) => b.name.localeCompare(a.name, 'ru'));
        break;
      case 'year_desc':
        list.sort((a, b) => (Number(b.releaseYear) || 0) - (Number(a.releaseYear) || 0));
        break;
      case 'year_asc':
        list.sort((a, b) => (Number(a.releaseYear) || 9999) - (Number(b.releaseYear) || 9999));
        break;
      case 'rating_desc':
        list.sort((a, b) => smartScore(b) - smartScore(a));
        break;
      case 'rating_asc':
        list.sort((a, b) => smartScore(a) - smartScore(b));
        break;
      case 'playtime_asc':
        list.sort((a, b) => a.playtimeMinutes - b.playtimeMinutes);
        break;
      case 'playtime_desc':
        list.sort((a, b) => b.playtimeMinutes - a.playtimeMinutes);
        break;
    }
    return list;
  }, [poolGames, gridSearch, sortBy]);

  useEffect(() => {
    setGridLimit(GRID_PAGE_SIZE);
  }, [gridSearch, sortBy, selectedColIds]);

  const hasNativeFilters = Boolean(
    appFilter?.m_filterSpec?.strSearchText?.trim() ||
      appFilter?.m_filterSpec?.filterGroups?.some((g) => g.rgOptions?.length > 0)
  );
  const hasBshFilters = isScopeFilterActive(GLOBAL_SCOPE);

  const selectedMeta = selectedGame ? cachedMeta(selectedGame.appId) : null;
  const locColor = selectedMeta ? TIER_INFO[selectedMeta.tier].color : '#8b949e';

  const ratingColor =
    !selectedGame || selectedGame.reviewPercent <= 0
      ? { bg: 'rgba(255,255,255,0.06)', color: '#8b949e', border: '#30363d' }
      : selectedGame.reviewPercent >= 70
      ? { bg: 'rgba(35, 134, 54, 0.2)', color: '#56d364', border: 'rgba(86, 211, 100, 0.35)' }
      : selectedGame.reviewPercent >= 40
      ? { bg: 'rgba(187, 128, 9, 0.2)', color: '#e3b341', border: 'rgba(227, 179, 65, 0.4)' }
      : { bg: 'rgba(248, 81, 73, 0.16)', color: '#f85149', border: 'rgba(248, 81, 73, 0.35)' };

  const modalNode = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(7, 10, 15, 0.86)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px',
        fontFamily: '"Motiva Sans", Arial, sans-serif',
      }}
    >
      <style>{ROULETTE_STYLES}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '1220px',
          maxWidth: '96vw',
          height: '88vh',
          maxHeight: '92vh',
          backgroundColor: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '8px',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          color: '#c9d1d9',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            backgroundColor: '#0b0f13',
            borderBottom: '1px solid #21262d',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#58a6ff' }}>
              🎲 Рулетка библиотеки
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: 'rgba(88, 166, 255, 0.16)',
                border: '1px solid rgba(88, 166, 255, 0.4)',
                color: '#79c0ff',
                padding: '3px 10px',
                borderRadius: '12px',
              }}
            >
              В рулетке: {poolGames.length} игр
            </span>
            {(hasNativeFilters || hasBshFilters) && (
              <span
                title="Учитываются текущие фильтры библиотеки Steam и Bibliotekarsha"
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(86, 211, 100, 0.14)',
                  border: '1px solid rgba(86, 211, 100, 0.35)',
                  color: '#56d364',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                ✓ Учтены общие фильтры
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              disabled={poolGames.length === 0 || spinning}
              onClick={() => setViewMode(viewMode === 'roulette' ? 'collection' : 'roulette')}
              className="bib-rl-btn"
            >
              {viewMode === 'roulette'
                ? `Посмотреть подборку (${poolGames.length})`
                : 'Вернуться к рулетке'}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Закрыть (Esc)"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                fontSize: '26px',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '0 6px',
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div
            style={{
              width: '320px',
              flexShrink: 0,
              backgroundColor: '#161b22',
              borderRight: '1px solid #21262d',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 14px 10px',
                borderBottom: '1px solid #21262d',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#58a6ff' }}>
                  Коллекции ({selectedColIds.size}/{collections.length})
                </span>
              </div>

              <input
                type="text"
                className="bib-rl-input"
                placeholder="Поиск коллекции..."
                value={colSearch}
                onChange={(e) => setColSearch(e.target.value)}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="bib-rl-btn"
                  style={{ flex: 1 }}
                >
                  Выбрать все
                </button>
                <button
                  type="button"
                  onClick={clearAllVisible}
                  className="bib-rl-btn"
                  style={{ flex: 1 }}
                >
                  Убрать все
                </button>
              </div>

              <div style={{ fontSize: '11px', color: '#8b949e', lineHeight: 1.3 }}>
                Зажмите ЛКМ и проведите по списку, чтобы быстро выделить или снять сразу несколько коллекций.
              </div>
            </div>

            <div
              className="bib-rl-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {visibleCollections.length === 0 ? (
                <div style={{ color: '#8b949e', fontSize: '12px', padding: '16px', textAlign: 'center' }}>
                  Коллекции не найдены
                </div>
              ) : (
                visibleCollections.map((col, idx) => {
                  const isChecked = selectedColIds.has(col.id);
                  return (
                    <div
                      key={col.id}
                      onMouseDown={(e) => handleColMouseDown(idx, col.id, e)}
                      onMouseEnter={() => handleColMouseEnter(idx)}
                      className={`bib-rl-col-row ${isChecked ? 'selected' : ''}`}
                      title={`${col.name} — подходит ${col.matchedAppIds.length} из ${col.totalApps}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          style={{
                            pointerEvents: 'none',
                            accentColor: '#58a6ff',
                            width: '14px',
                            height: '14px',
                            margin: 0,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: col.isFavorite ? '#ffd700' : undefined,
                            fontWeight: col.isFavorite ? 600 : 400,
                          }}
                        >
                          {col.isFavorite ? `★ ${col.name}` : col.name}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          color: col.matchedAppIds.length > 0 ? '#8b949e' : '#484f58',
                          flexShrink: 0,
                        }}
                      >
                        ({col.matchedAppIds.length})
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderTop: '1px solid #21262d',
                backgroundColor: '#10151c',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                flexShrink: 0,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: '#c9d1d9',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={priorityByReviews}
                  onChange={(e) => setPriorityByReviews(e.target.checked)}
                  style={{ accentColor: '#58a6ff', width: '15px', height: '15px', margin: 0 }}
                />
                <span>Приоритет по отзывам</span>
              </label>

              <button
                type="button"
                disabled={spinning || poolGames.length === 0}
                onClick={handleSpin}
                className="bib-rl-btn bib-rl-btn-spin"
                style={{ width: '100%' }}
              >
                {spinning
                  ? 'КРУТИТСЯ...'
                  : poolGames.length > 0
                  ? `КРУТИТЬ! (${poolGames.length})`
                  : 'НЕТ ИГР В ПОДБОРКЕ'}
              </button>
            </div>
          </div>

          <div
            className="bib-rl-scroll"
            style={{
              flex: 1,
              padding: '18px 22px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              minWidth: 0,
            }}
          >
            {viewMode === 'roulette' ? (
              <div
                style={{
                  backgroundColor: '#0b0f13',
                  border: '1px solid #21262d',
                  borderRadius: '8px',
                  padding: '18px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
                  flexShrink: 0,
                }}
              >
                <div
                  ref={reelContainerRef}
                  style={{
                    width: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    height: '164px',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    backgroundColor: '#0d1117',
                    boxShadow: 'inset 0 0 18px rgba(0, 0, 0, 0.75)',
                  }}
                >
                  {reelItems.length === 0 ? (
                    <div
                      style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#8b949e',
                        fontSize: '14px',
                      }}
                    >
                      Выберите хотя бы одну коллекцию с играми слева
                    </div>
                  ) : (
                    <div
                      ref={reelRef}
                      style={{
                        display: 'flex',
                        height: '100%',
                        willChange: 'transform',
                        width: `${reelItems.length * ITEM_WIDTH}px`,
                      }}
                    >
                      {reelItems.map((item, idx) => (
                        <div
                          key={`${item.appId}_${idx}`}
                          style={{
                            width: `${ITEM_WIDTH}px`,
                            minWidth: `${ITEM_WIDTH}px`,
                            height: '100%',
                            padding: '8px',
                            boxSizing: 'border-box',
                            borderRight: '1px solid #21262d',
                            backgroundColor: '#161b22',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          <img
                            src={item.posterUrl}
                            alt={item.name}
                            onError={(e) => {
                              const img = e.currentTarget;
                              if (!img.dataset.fb) {
                                img.dataset.fb = '1';
                                img.src = item.fallbackPosterUrl;
                              }
                            }}
                            style={{
                              width: '100%',
                              height: '108px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                              backgroundColor: '#0d1117',
                            }}
                          />
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#c9d1d9',
                              textAlign: 'center',
                              width: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bib-rl-selector" />
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#0b0f13',
                  border: '1px solid #21262d',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  minHeight: selectedGame ? '280px' : '420px',
                  maxHeight: selectedGame ? '38vh' : '100%',
                  flex: selectedGame ? '0 0 auto' : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="bib-rl-input"
                    placeholder="Поиск игры в подборке..."
                    value={gridSearch}
                    onChange={(e) => setGridSearch(e.target.value)}
                    style={{ width: '240px' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#8b949e' }}>Сортировка:</span>
                    <select
                      className="bib-rl-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="default">По умолчанию</option>
                      <option value="name_asc">По имени (А-Я)</option>
                      <option value="name_desc">По имени (Я-А)</option>
                      <option value="year_desc">По году (сначала новые)</option>
                      <option value="year_asc">По году (сначала старые)</option>
                      <option value="rating_desc">Умный рейтинг (лучшие)</option>
                      <option value="rating_asc">Умный рейтинг (худшие)</option>
                      <option value="playtime_asc">Наиграно (меньше → больше)</option>
                      <option value="playtime_desc">Наиграно (больше → меньше)</option>
                    </select>
                  </div>
                </div>

                <div
                  className="bib-rl-scroll"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
                      if (gridLimit < sortedGridGames.length) {
                        setGridLimit((prev) => prev + GRID_PAGE_SIZE);
                      }
                    }
                  }}
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))',
                    gap: '12px',
                    alignContent: 'start',
                    paddingRight: '4px',
                  }}
                >
                  {sortedGridGames.slice(0, gridLimit).map((game) => (
                    <div
                      key={game.appId}
                      onClick={() => setSelectedGame(game)}
                      className={`bib-rl-card ${selectedGame?.appId === game.appId ? 'active' : ''}`}
                    >
                      <img
                        src={game.posterUrl}
                        alt={game.name}
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fb) {
                            img.dataset.fb = '1';
                            img.src = game.fallbackPosterUrl;
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '82px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          backgroundColor: '#0d1117',
                        }}
                      />
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: '#e6edf3',
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {game.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#8b949e', marginTop: 'auto' }}>
                        {game.reviewPercent > 0 ? `${game.reviewPercent}% · ` : ''}
                        {formatPlaytime(game.playtimeMinutes)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedGame ? (
              <div
                style={{
                  backgroundColor: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: '8px',
                  padding: '20px 22px',
                  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.5)',
                  position: 'relative',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedGame(null)}
                  title="Скрыть карточку"
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '14px',
                    background: 'transparent',
                    border: 'none',
                    color: '#8b949e',
                    fontSize: '22px',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <img
                    src={extraDetails?.headerUrl || selectedGame.posterUrl}
                    alt={selectedGame.name}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.dataset.fb) {
                        img.dataset.fb = '1';
                        img.src = selectedGame.fallbackPosterUrl;
                      }
                    }}
                    style={{
                      width: '300px',
                      maxWidth: '100%',
                      borderRadius: '6px',
                      border: '1px solid #21262d',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                    }}
                  />

                  <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '22px', color: '#f0f6fc', lineHeight: 1.25 }}>
                      {selectedGame.name}
                    </h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '5px',
                          fontSize: '13px',
                          fontWeight: 600,
                          backgroundColor: ratingColor.bg,
                          color: ratingColor.color,
                          border: `1px solid ${ratingColor.border}`,
                        }}
                      >
                        {selectedGame.reviewPercent > 0
                          ? `${selectedGame.reviewPercent}% (${selectedGame.reviewCount} отзывов)`
                          : 'Нет оценок'}
                      </span>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '5px',
                          fontSize: '12px',
                          backgroundColor: '#0d1117',
                          border: '1px solid #30363d',
                          color: '#c9d1d9',
                        }}
                      >
                        Наиграно: {formatPlaytime(selectedGame.playtimeMinutes)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => navigateToLibraryApp(selectedGame.appId, onClose)}
                        className="bib-rl-btn bib-rl-btn-blue"
                        style={{ padding: '9px 16px', fontSize: '13px' }}
                      >
                        Перейти в библиотеке
                      </button>
                      <button
                        type="button"
                        onClick={() => executeSteamUrl(`steam://run/${selectedGame.appId}`)}
                        className="bib-rl-btn bib-rl-btn-spin"
                        style={{ padding: '9px 16px', fontSize: '13px' }}
                      >
                        ▶ Запустить
                      </button>
                      <a
                        href={`https://store.steampowered.com/app/${selectedGame.appId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bib-rl-btn"
                        style={{
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '9px 14px',
                        }}
                      >
                        Магазин ↗
                      </a>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
                    gap: '20px',
                    marginTop: '18px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '13.5px', lineHeight: 1.55, color: '#9aa4b0' }}>
                      {loadingExtra
                        ? 'Загрузка описания из Steam...'
                        : extraDetails?.description || 'Описание отсутствует.'}
                    </div>

                    {selectedGame.tagIds.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {selectedGame.tagIds.slice(0, 12).map((tid) => (
                          <span
                            key={tid}
                            style={{
                              backgroundColor: 'rgba(88, 166, 255, 0.1)',
                              color: '#79c0ff',
                              border: '1px solid rgba(88, 166, 255, 0.22)',
                              padding: '3px 9px',
                              borderRadius: '12px',
                              fontSize: '11.5px',
                            }}
                          >
                            {getTagName(tid)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      backgroundColor: '#0d1117',
                      border: '1px solid #21262d',
                      borderRadius: '6px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      fontSize: '13px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: '#58a6ff', textTransform: 'uppercase' }}>
                        Русский язык
                      </div>
                      <div style={{ color: locColor, fontWeight: 600, marginTop: '2px' }}>
                        {formatLocDetail(selectedMeta)}
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid #21262d', paddingTop: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#58a6ff', textTransform: 'uppercase' }}>
                        Дата выхода
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        {extraDetails?.releaseDate || selectedGame.releaseYear}
                      </div>
                    </div>
                    {extraDetails?.developers && (
                      <div style={{ borderTop: '1px solid #21262d', paddingTop: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#58a6ff', textTransform: 'uppercase' }}>
                          Разработчик
                        </div>
                        <div style={{ marginTop: '2px' }}>{extraDetails.developers}</div>
                      </div>
                    )}
                    {extraDetails?.publishers && (
                      <div style={{ borderTop: '1px solid #21262d', paddingTop: '8px' }}>
                        <div style={{ fontSize: '11px', color: '#58a6ff', textTransform: 'uppercase' }}>
                          Издатель
                        </div>
                        <div style={{ marginTop: '2px' }}>{extraDetails.publishers}</div>
                      </div>
                    )}
                    <div style={{ borderTop: '1px solid #21262d', paddingTop: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#58a6ff', textTransform: 'uppercase' }}>
                        В коллекциях
                      </div>
                      <div style={{ marginTop: '2px', color: '#8b949e', fontSize: '12px' }}>
                        {selectedGame.collections.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              viewMode === 'roulette' && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#161b22',
                    border: '1px dashed #30363d',
                    borderRadius: '8px',
                    color: '#8b949e',
                    fontSize: '14px',
                    padding: '24px',
                    textAlign: 'center',
                  }}
                >
                  {spinning
                    ? 'Выбираем случайную игру...'
                    : 'Отметьте нужные коллекции слева (можно зажать ЛКМ и провести по списку) и нажмите «КРУТИТЬ!»'}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const reactDom = window.SP_REACTDOM;
  const targetBody = getTargetDocument().body;
  if (reactDom?.createPortal && targetBody) {
    return reactDom.createPortal(modalNode, targetBody);
  }
  return modalNode;
}
