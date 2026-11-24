import { EarlyAccessMode, GameMeta, LocTier, TIERS } from '../config/tiers';

export interface SmartFilterState {
  languages: Set<LocTier>;
  earlyAccess: EarlyAccessMode;
  years: Set<string>;
  reviewCountMin: number | null;
  reviewCountMax: number | null;
  ratingMin: number | null;
  ratingMax: number | null;
  activeTags: Record<number, number>;
  hiddenTags: Set<number>;
}

export interface FilterPreset {
  name: string;
  languages: LocTier[];
  earlyAccess?: EarlyAccessMode;
  years: string[];
  reviewCountMin: number | null;
  reviewCountMax: number | null;
  ratingMin: number | null;
  ratingMax: number | null;
  activeTags: Record<number, number>;
  hiddenTags: number[];
}

const PRESETS_KEY = 'bibliotekarsha_presets_v1';

const scopedStates = new Map<string, SmartFilterState>();
let globalCollectionsFilter: SmartFilterState | null = null;
const listeners = new Set<(scope: string) => void>();

function createDefaultState(): SmartFilterState {
  return {
    languages: new Set<LocTier>(TIERS),
    earlyAccess: 'all',
    years: new Set<string>(),
    reviewCountMin: null,
    reviewCountMax: null,
    ratingMin: null,
    ratingMax: null,
    activeTags: {},
    hiddenTags: new Set<number>(),
  };
}

function cloneState(src: SmartFilterState): SmartFilterState {
  return {
    languages: new Set<LocTier>(src.languages),
    earlyAccess: src.earlyAccess,
    years: new Set<string>(src.years),
    reviewCountMin: src.reviewCountMin,
    reviewCountMax: src.reviewCountMax,
    ratingMin: src.ratingMin,
    ratingMax: src.ratingMax,
    activeTags: { ...src.activeTags },
    hiddenTags: new Set<number>(src.hiddenTags),
  };
}

function isStateActive(state: SmartFilterState | null | undefined): boolean {
  if (!state) return false;
  if (state.languages.size !== TIERS.length) return true;
  if (state.earlyAccess !== 'all') return true;
  if (state.years.size > 0) return true;
  if (state.reviewCountMin !== null || state.reviewCountMax !== null) return true;
  if (state.ratingMin !== null || state.ratingMax !== null) return true;
  if (Object.keys(state.activeTags).length > 0) return true;
  if (state.hiddenTags.size > 0) return true;
  return false;
}

export function getFilterState(scope: string): SmartFilterState {
  let st = scopedStates.get(scope);
  if (!st) {
    if (scope.startsWith('collection:') && globalCollectionsFilter) {
      st = cloneState(globalCollectionsFilter);
    } else {
      st = createDefaultState();
    }
    scopedStates.set(scope, st);
  }
  return st;
}

export function subscribeFilters(fn: (scope: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(scope: string): void {
  listeners.forEach((fn) => fn(scope));
}

export function isScopeFilterActive(scope: string): boolean {
  return isStateActive(getFilterState(scope));
}

export function isAnyCollectionFilterActive(): boolean {
  if (isStateActive(globalCollectionsFilter)) return true;
  for (const [key, st] of scopedStates.entries()) {
    if (key.startsWith('collection:') && isStateActive(st)) return true;
  }
  return false;
}

export function applyScopeToAllCollections(sourceScope: string): void {
  const copy = cloneState(getFilterState(sourceScope));
  globalCollectionsFilter = isStateActive(copy) ? copy : null;

  for (const key of Array.from(scopedStates.keys())) {
    if (key.startsWith('collection:')) {
      scopedStates.set(key, cloneState(copy));
    }
  }
  emit('collection:*');
}

export function clearAllCollectionsFilters(): void {
  const hadAny = isAnyCollectionFilterActive();
  globalCollectionsFilter = null;
  for (const key of Array.from(scopedStates.keys())) {
    if (key.startsWith('collection:')) {
      scopedStates.delete(key);
    }
  }
  if (hadAny) {
    emit('collection:*');
  }
}

export function toggleLanguageFilter(scope: string, tier: LocTier): void {
  const state = getFilterState(scope);
  if (state.languages.has(tier)) state.languages.delete(tier);
  else state.languages.add(tier);
  emit(scope);
}

export function setEarlyAccessFilter(scope: string, mode: EarlyAccessMode): void {
  const state = getFilterState(scope);
  const next = state.earlyAccess === mode ? 'all' : mode;
  if (state.earlyAccess === next) return;
  state.earlyAccess = next;
  emit(scope);
}

export function toggleYearFilter(scope: string, year: string): void {
  const state = getFilterState(scope);
  if (state.years.has(year)) state.years.delete(year);
  else state.years.add(year);
  emit(scope);
}

export function clearYearFilter(scope: string): void {
  const state = getFilterState(scope);
  if (state.years.size === 0) return;
  state.years.clear();
  emit(scope);
}

export function setRangeFilters(
  scope: string,
  patch: {
    reviewCountMin?: number | null;
    reviewCountMax?: number | null;
    ratingMin?: number | null;
    ratingMax?: number | null;
  }
): void {
  const state = getFilterState(scope);
  let changed = false;

  if ('reviewCountMin' in patch) {
    const next = patch.reviewCountMin ?? null;
    if (state.reviewCountMin !== next) {
      state.reviewCountMin = next;
      changed = true;
    }
  }
  if ('reviewCountMax' in patch) {
    const next = patch.reviewCountMax ?? null;
    if (state.reviewCountMax !== next) {
      state.reviewCountMax = next;
      changed = true;
    }
  }
  if ('ratingMin' in patch) {
    const next = patch.ratingMin ?? null;
    if (state.ratingMin !== next) {
      state.ratingMin = next;
      changed = true;
    }
  }
  if ('ratingMax' in patch) {
    const next = patch.ratingMax ?? null;
    if (state.ratingMax !== next) {
      state.ratingMax = next;
      changed = true;
    }
  }

  if (changed) {
    emit(scope);
  }
}

export function setActiveTag(scope: string, tagId: number, maxPos: number): void {
  const state = getFilterState(scope);
  const clamped = Math.max(1, Math.min(20, maxPos));
  if (!state.hiddenTags.has(tagId) && state.activeTags[tagId] === clamped) return;
  state.hiddenTags.delete(tagId);
  state.activeTags[tagId] = clamped;
  emit(scope);
}

export function removeActiveTag(scope: string, tagId: number): void {
  const state = getFilterState(scope);
  if (!(tagId in state.activeTags)) return;
  delete state.activeTags[tagId];
  emit(scope);
}

export function addHiddenTag(scope: string, tagId: number): void {
  const state = getFilterState(scope);
  if (state.hiddenTags.has(tagId) && !(tagId in state.activeTags)) return;
  delete state.activeTags[tagId];
  state.hiddenTags.add(tagId);
  emit(scope);
}

export function removeHiddenTag(scope: string, tagId: number): void {
  const state = getFilterState(scope);
  if (!state.hiddenTags.has(tagId)) return;
  state.hiddenTags.delete(tagId);
  emit(scope);
}

export function resetScopeFilters(scope: string): void {
  const wasActive = isScopeFilterActive(scope);
  if (scope.startsWith('collection:') && globalCollectionsFilter) {
    scopedStates.set(scope, createDefaultState());
    if (wasActive) emit(scope);
    return;
  }
  scopedStates.delete(scope);
  if (wasActive) {
    emit(scope);
  }
}

export function getSavedPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function savePresetFromScope(scope: string, name: string): FilterPreset[] {
  const cleanName = name.trim();
  if (!cleanName) return getSavedPresets();
  const st = getFilterState(scope);
  const preset: FilterPreset = {
    name: cleanName,
    languages: Array.from(st.languages),
    earlyAccess: st.earlyAccess,
    years: Array.from(st.years),
    reviewCountMin: st.reviewCountMin,
    reviewCountMax: st.reviewCountMax,
    ratingMin: st.ratingMin,
    ratingMax: st.ratingMax,
    activeTags: { ...st.activeTags },
    hiddenTags: Array.from(st.hiddenTags),
  };
  const existing = getSavedPresets().filter((p) => p.name.toLowerCase() !== cleanName.toLowerCase());
  const updated = [preset, ...existing];
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

export function deleteSavedPreset(name: string): FilterPreset[] {
  const updated = getSavedPresets().filter((p) => p.name !== name);
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

export function applyPresetToScope(scope: string, preset: FilterPreset): void {
  const next: SmartFilterState = {
    languages: new Set<LocTier>(preset.languages ?? TIERS),
    earlyAccess: preset.earlyAccess ?? 'all',
    years: new Set<string>(preset.years ?? []),
    reviewCountMin: preset.reviewCountMin ?? null,
    reviewCountMax: preset.reviewCountMax ?? null,
    ratingMin: preset.ratingMin ?? null,
    ratingMax: preset.ratingMax ?? null,
    activeTags: { ...(preset.activeTags ?? {}) },
    hiddenTags: new Set<number>(preset.hiddenTags ?? []),
  };
  scopedStates.set(scope, next);
  emit(scope);
}

export type FilterCategory = 'language' | 'earlyAccess' | 'years' | 'reviewCount' | 'rating' | 'tags';

export function matchesGameMeta(scope: string, meta: GameMeta, exclude?: FilterCategory): boolean {
  const state = getFilterState(scope);

  if (exclude !== 'language') {
    if (state.languages.size === 0) return false;
    if (!state.languages.has(meta.tier)) return false;
  }

  if (exclude !== 'earlyAccess' && state.earlyAccess !== 'all') {
    if (state.earlyAccess === 'ea_only' && !meta.isEarlyAccess) return false;
    if (state.earlyAccess === 'ea_was' && (meta.isEarlyAccess || !meta.hasOriginalReleaseDate)) return false;
    if (state.earlyAccess === 'ea_hide' && meta.isEarlyAccess) return false;
  }

  if (exclude !== 'years' && state.years.size > 0) {
    if (!state.years.has(meta.releaseYear)) return false;
  }

  if (exclude !== 'reviewCount') {
    if (state.reviewCountMin !== null && meta.reviewCount < state.reviewCountMin) return false;
    if (state.reviewCountMax !== null && meta.reviewCount > state.reviewCountMax) return false;
  }

  if (exclude !== 'rating') {
    if (state.ratingMin !== null && meta.reviewPercent < state.ratingMin) return false;
    if (state.ratingMax !== null && meta.reviewPercent > state.ratingMax) return false;
  }

  if (exclude !== 'tags') {
    if (state.hiddenTags.size > 0 && meta.tagIds.length > 0) {
      for (const hid of state.hiddenTags) {
        if (meta.tagIds.includes(hid)) return false;
      }
    }
    const activeEntries = Object.entries(state.activeTags);
    if (activeEntries.length > 0) {
      if (meta.tagIds.length === 0) return false;
      for (const [idStr, maxPos] of activeEntries) {
        const idx = meta.tagIds.indexOf(Number(idStr));
        if (idx === -1 || idx >= maxPos) return false;
      }
    }
  }

  return true;
}
