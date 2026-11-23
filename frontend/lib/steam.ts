import React from 'react';
import { findClassModule, findModule, findModuleExport, getReactInstance } from 'millennium';

export interface AppOverview {
  appid: number;
  BIsModOrShortcut?(): boolean;
}

export interface FilterGroup {
  rgOptions: any[];
  bAcceptUnion: boolean;
}

export interface AppFilter {
  MatchesImpl(app: AppOverview): boolean;
  MatchesScoredImpl(app: AppOverview): number;
  SelectOption(group: number, option: any, selected: boolean): void;
  BIsSelected(group: number, option: any): boolean;
  m_filterSpec?: { strSearchText?: string; filterGroups?: FilterGroup[] };
}

export interface Collection {
  id: string;
  strName?: string;
  bIsDynamic: boolean;
  visibleApps?: AppOverview[];
  allApps?: AppOverview[];
  m_filter?: AppFilter;
  UpdateAllApps(): void;
}

export interface ReactRoot {
  render(node: React.ReactNode): void;
  unmount(): void;
}

export interface PopupContext {
  m_strName?: string;
  m_popup?: Window;
}

declare global {
  interface Window {
    SP_REACTDOM?: any;
    uiStore?: { collectionsAppFilter?: AppFilter; currentAppFilter?: AppFilter };
    collectionStore?: any;
    MainWindowBrowserManager?: { m_lastLocation?: { pathname?: string } };
    g_PopupManager?: { GetExistingPopup?(name: string): PopupContext | undefined };
  }
}

export const getUIStore = () => window.uiStore;
export const getCollectionStore = () => window.collectionStore;

export const isSteamApp = (appId: any): appId is number =>
  typeof appId === 'number' && Number.isInteger(appId) && appId > 0 && appId < 0x80000000;

export const isRatable = (app: AppOverview | undefined): app is AppOverview =>
  !!app && isSteamApp(app.appid) && !app.BIsModOrShortcut?.();

export function libraryApps(): AppOverview[] {
  try {
    return (getCollectionStore()?.allAppsCollection?.visibleApps ?? []).filter(isRatable);
  } catch {
    return [];
  }
}

export function getCollectionByIdSafe(id: string): Collection | null {
  try {
    const store = getCollectionStore();
    if (!store) return null;
    if (typeof store.GetCollection === 'function') {
      return store.GetCollection(id) ?? null;
    }
    if (store.m_mapCollections && typeof store.m_mapCollections.get === 'function') {
      return store.m_mapCollections.get(id) ?? null;
    }
    if (id === 'favorite' && store.favoriteCollection) {
      return store.favoriteCollection;
    }
  } catch {}
  return null;
}

export function getAllUserCollectionsSafe(): Collection[] {
  try {
    const store = getCollectionStore();
    if (!store) return [];
    if (store.m_mapCollections && typeof store.m_mapCollections.values === 'function') {
      return Array.from(store.m_mapCollections.values());
    }
  } catch {}
  return [];
}

export function getLibraryPath(): string | null {
  return window.MainWindowBrowserManager?.m_lastLocation?.pathname ?? null;
}

export function libraryAppIdFromPath(path: string | null): number | null {
  const match = path?.match(/\/library\/app\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function mountReact(host: Element, node: React.ReactNode): ReactRoot {
  const reactDom = window.SP_REACTDOM;
  const root = reactDom.createRoot(host);
  root.render(node);
  return root;
}

interface FiberLike {
  memoizedProps?: any;
  return?: FiberLike | null;
}

const MAX_FIBER_DEPTH = 40;

export function findFiberProps(el: Element, predicate: (props: any) => boolean): any {
  let fiber: FiberLike | null | undefined;
  try {
    fiber = getReactInstance(el) as FiberLike | null;
  } catch {
    return null;
  }
  for (let depth = 0; fiber && depth < MAX_FIBER_DEPTH; depth++, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (props && predicate(props)) return props;
  }
  return null;
}

export function classModuleFinder(...keys: string[]): () => Record<string, string> | null {
  let found: Record<string, string> | null = null;
  return () => {
    if (found) return found;
    try {
      const module = findClassModule((m: any) => keys.every((k) => typeof m[k] === 'string'));
      found = module ?? null;
    } catch {
      found = null;
    }
    return found;
  };
}

export { findModule, findModuleExport };
