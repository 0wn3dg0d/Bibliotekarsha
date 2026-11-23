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

let lastGlobalActive = false;

const dynamicCollections = (): Collection[] =>
  getAllUserCollectionsSafe().filter((c) => c.bIsDynamic);

export const rematchLibrary = throttle(() => {
  const isNowActive = isScopeFilterActive(GLOBAL_SCOPE);
  if (!isNowActive && !lastGlobalActive) return;
  lastGlobalActive = isNowActive;

  const filter = getUIStore()?.currentAppFilter;
  const groups = filter?.m_filterSpec?.filterGroups;
  if (groups && groups.length > 0 && groups[0]?.rgOptions) {
    groups[0].rgOptions.splice(0, groups[0].rgOptions.length, ...groups[0].rgOptions);
  }
  for (const collection of dynamicCollections()) {
    try {
      collection.UpdateAllApps();
    } catch {}
  }
}, 250);

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
type Patchable = Record<MatchMethod, MatchFn>;

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

  const originals = { MatchesImpl: target.MatchesImpl, MatchesScoredImpl: target.MatchesScoredImpl };
  const wrap = (name: MatchMethod, miss: boolean | number) => {
    const original = originals[name];
    target[name] = function (app) {
      const result = original.call(this, app);
      return result && !passesGlobalFilter(app) ? miss : result;
    };
  };
  wrap('MatchesImpl', false);
  wrap('MatchesScoredImpl', 0);

  restorePatch = () => {
    target.MatchesImpl = originals.MatchesImpl;
    target.MatchesScoredImpl = originals.MatchesScoredImpl;
    restorePatch = null;
  };
  return true;
}

export function uninstallFilterPatch(): boolean {
  if (!restorePatch) return false;
  restorePatch();
  return true;
}
