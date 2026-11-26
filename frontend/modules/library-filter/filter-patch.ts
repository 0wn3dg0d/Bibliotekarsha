import {
  AppFilter,
  AppOverview,
  Collection,
  getAllUserCollectionsSafe,
  getUIStore,
  isRatable,
} from '../../lib/steam';
import { isScopeFilterActive, matchesGameMeta } from '../../stores/filters';
import { cachedMeta, requestMeta } from '../../stores/localization';
import { throttle } from '../../utils/throttle';

export const GLOBAL_SCOPE = 'global';

const dynamicCollections = (): Collection[] =>
  getAllUserCollectionsSafe().filter((c) => c.bIsDynamic);

const dynFilterCache = new WeakMap<object, { ts: number; isDyn: boolean }>();

function isDynamicCollectionFilter(inst: unknown): boolean {
  if (!inst || typeof inst !== 'object') return false;

  const ui = getUIStore();
  if (ui && (inst === ui.currentAppFilter || inst === ui.collectionsAppFilter)) {
    return false;
  }

  const now = Date.now();
  const cached = dynFilterCache.get(inst);
  if (cached && now - cached.ts < 500) {
    return cached.isDyn;
  }

  const anyInst = inst as any;
  let isDyn = false;
  for (const col of dynamicCollections() as any[]) {
    if (
      col?.m_filter === inst ||
      col?.filter === inst ||
      col?.m_dynamicFilter === inst
    ) {
      isDyn = true;
      break;
    }
    if (
      anyInst.m_filterSpec &&
      (col?.m_filterSpec === anyInst.m_filterSpec ||
        col?.filterSpec === anyInst.m_filterSpec ||
        col?.m_filter?.m_filterSpec === anyInst.m_filterSpec)
    ) {
      isDyn = true;
      break;
    }
  }

  dynFilterCache.set(inst, { ts: now, isDyn });
  return isDyn;
}

function nudgeFilter(filter: any): void {
  if (!filter) return;
  const groups = filter?.m_filterSpec?.filterGroups;
  if (Array.isArray(groups) && groups.length > 0) {
    const nonEmpty = groups.find((g: any) => Array.isArray(g?.rgOptions) && g.rgOptions.length > 0);
    if (nonEmpty) {
      nonEmpty.rgOptions.splice(0, nonEmpty.rgOptions.length, ...nonEmpty.rgOptions);
      return;
    }
    if (Array.isArray(groups[0]?.rgOptions)) {
      groups[0].rgOptions.push(-999999);
      groups[0].rgOptions.pop();
      return;
    }
  }
  if (filter?.m_filterSpec && typeof filter.m_filterSpec.strSearchText === 'string') {
    const orig = filter.m_filterSpec.strSearchText;
    filter.m_filterSpec.strSearchText = orig + ' ';
    filter.m_filterSpec.strSearchText = orig;
  }
}

export const rematchLibrary = throttle(() => {
  const ui = getUIStore() as any;
  if (!ui) return;
  nudgeFilter(ui.currentAppFilter);
  if (ui.collectionsAppFilter && ui.collectionsAppFilter !== ui.currentAppFilter) {
    nudgeFilter(ui.collectionsAppFilter);
  }
}, 150);

function passesGlobalFilter(app: AppOverview): boolean {
  if (!isScopeFilterActive(GLOBAL_SCOPE)) return true;
  if (!isRatable(app)) return false;
  const meta = cachedMeta(app.appid);
  if (!meta) {
    requestMeta(app.appid);
    return false;
  }
  return matchesGameMeta(GLOBAL_SCOPE, meta);
}

type MatchMethod = 'MatchesImpl' | 'MatchesScoredImpl';
type MatchFn = (this: AppFilter, app: AppOverview) => boolean | number;
type Patchable = Record<MatchMethod, MatchFn> & { BIsEmpty?: () => boolean };

let restorePatch: (() => void) | null = null;

function prototypeChain(instance: object): object[] {
  const chain: object[] = [];
  for (let proto = Object.getPrototypeOf(instance); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto))
    chain.push(proto);
  return chain;
}

const hasOwn = (target: object, key: string) => Object.prototype.hasOwnProperty.call(target, key);

function baseClassDefining(instance: object, method: MatchMethod): Patchable | null {
  const owners = prototypeChain(instance).filter((proto) => hasOwn(proto, method));
  return (owners[owners.length - 1] as Patchable | undefined) ?? null;
}

export function installFilterPatch(): boolean {
  if (restorePatch) return true;
  const filter = getUIStore()?.collectionsAppFilter;
  if (!filter) return false;
  const target = baseClassDefining(filter, 'MatchesImpl');
  if (!target) return false;

  const originals = {
    MatchesImpl: target.MatchesImpl,
    MatchesScoredImpl: target.MatchesScoredImpl,
    BIsEmpty: target.BIsEmpty,
  };

  const wrap = (name: MatchMethod, miss: boolean | number) => {
    const original = originals[name];
    target[name] = function (app) {
      const result = original.call(this, app);
      if (!result || !isScopeFilterActive(GLOBAL_SCOPE) || isDynamicCollectionFilter(this)) {
        return result;
      }
      return passesGlobalFilter(app) ? result : miss;
    };
  };
  wrap('MatchesImpl', false);
  wrap('MatchesScoredImpl', 0);

  if (typeof originals.BIsEmpty === 'function') {
    target.BIsEmpty = function () {
      if (isScopeFilterActive(GLOBAL_SCOPE) && !isDynamicCollectionFilter(this)) {
        return false;
      }
      return originals.BIsEmpty!.call(this);
    };
  }

  restorePatch = () => {
    target.MatchesImpl = originals.MatchesImpl;
    target.MatchesScoredImpl = originals.MatchesScoredImpl;
    if (originals.BIsEmpty) target.BIsEmpty = originals.BIsEmpty;
    restorePatch = null;
  };
  return true;
}

export function uninstallFilterPatch(): boolean {
  if (!restorePatch) return false;
  restorePatch();
  return true;
}
