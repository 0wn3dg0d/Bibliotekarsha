import React, { useEffect, useMemo, useState } from 'react';
import { afterPatch, findModule, findModuleExport, replacePatch, type Patch } from 'millennium';
import { formatLocDetail } from '../../config/tiers';
import { BibliotekarshaModule } from '../../core/types';
import { getLibraryPath } from '../../lib/steam';
import {
  isScopeFilterActive,
  matchesGameMeta,
  resetScopeFilters,
  subscribeFilters,
} from '../../stores/filters';
import { cachedMeta, onMetaUpdate, requestManyMeta } from '../../stores/localization';
import { SmartFilterModal } from '../../components/SmartFilterModal';

function getCurrentCollectionScope(): { scope: string; title: string } {
  const path = getLibraryPath() || '';
  const match = path.match(/\/library\/collection\/([^/?#]+)/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    return { scope: `collection:${id}`, title: `Коллекция` };
  }
  return { scope: 'collection:current', title: 'Текущая коллекция' };
}

function CollectionFilterButton({ appIds }: { appIds: number[] }) {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [modalOpen, setModalOpen] = useState(false);

  const { scope, title } = getCurrentCollectionScope();

  useEffect(() => {
    if (appIds.length > 0) {
      requestManyMeta(appIds);
    }
  }, [appIds.join(',')]);

  useEffect(() => {
    const unsubF = subscribeFilters((changedScope) => {
      if (changedScope === scope || changedScope === 'collection:*') rerender();
    });
    const unsubM = onMetaUpdate(() => {
      if (modalOpen) rerender();
    });
    return () => {
      unsubF();
      unsubM();
    };
  }, [scope, modalOpen]);

  const active = isScopeFilterActive(scope);

  const { collectionGames, totalMatched } = useMemo(() => {
    const games: any[] = [];
    let matched = 0;

    for (const id of appIds) {
      const meta = cachedMeta(id);
      if (!meta) continue;
      games.push(meta);
      if (matchesGameMeta(scope, meta)) {
        matched++;
      }
    }
    return { collectionGames: games, totalMatched: matched };
  }, [appIds.join(','), scope, active, modalOpen]);

  return (
    <>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          marginLeft: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            requestManyMeta(appIds);
            setModalOpen(true);
          }}
          title="Открыть фильтры Bibliotekarsha для этой коллекции"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 11px',
            height: '28px',
            borderRadius: '3px',
            border: active ? '1px solid #66c0f4' : '1px solid rgba(255,255,255,0.14)',
            backgroundColor: active ? 'rgba(102, 192, 244, 0.22)' : 'rgba(103, 112, 123, 0.25)',
            color: active ? '#ffffff' : '#dfe3e6',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <span>Bibliotekarsha</span>
          {active && (
            <span
              style={{
                backgroundColor: '#66c0f4',
                color: '#0e141b',
                borderRadius: '8px',
                padding: '0 6px',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {totalMatched}/{appIds.length}
            </span>
          )}
        </button>

        {active && (
          <button
            type="button"
            onClick={() => resetScopeFilters(scope)}
            title="Сбросить фильтр коллекции"
            style={{
              height: '28px',
              padding: '0 8px',
              borderRadius: '3px',
              border: '1px solid rgba(255,255,255,0.14)',
              backgroundColor: 'rgba(167, 67, 67, 0.35)',
              color: '#ff9b9b',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        )}
      </div>

      {modalOpen && (
        <SmartFilterModal
          scope={scope}
          scopeTitle={title}
          games={collectionGames}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

let cachedSortingDropdownClass: any = null;
let cachedCapsuleMemo: any = null;
let cachedSubscriptClass: string | undefined;

const activePatches: Patch[] = [];
const patchedInstances = new Set<any>();

function resolveSteamModules(): void {
  if (!cachedSortingDropdownClass) {
    cachedSortingDropdownClass = findModuleExport(
      (e: any) => typeof e === 'function' && e.prototype?.OnChange && e.toString().includes('onSortChangeCallback')
    );
  }
  if (!cachedCapsuleMemo) {
    const capsuleModule = findModule((m: any) =>
      Object.values(m).some((v: any) => typeof v === 'function' && v.prototype?.BHasVerticalCapsule)
    );
    cachedCapsuleMemo =
      capsuleModule &&
      (Object.values(capsuleModule).find((v: any) => typeof v === 'object' && v !== null && typeof v.type === 'function') as any);
  }
  if (!cachedSubscriptClass) {
    cachedSubscriptClass = findModule((m: any) => m.LibraryItemBoxSubscript && m.LibraryItemBox)?.LibraryItemBoxSubscript;
  }
}

function forceUpdateCollectionViews(): void {
  for (const inst of Array.from(patchedInstances)) {
    try {
      if (inst?.updater?.isMounted && !inst.updater.isMounted(inst)) {
        patchedInstances.delete(inst);
        continue;
      }
      let curr = inst._reactInternals?.return || inst._reactInternalFiber?.return;
      let passedGrid = false;
      let updatedParent = false;
      for (let depth = 0; curr && depth < 30; depth++, curr = curr.return) {
        if (Array.isArray(curr.memoizedProps?.appOverviews)) {
          passedGrid = true;
        }
        if (passedGrid && typeof curr.stateNode?.forceUpdate === 'function') {
          curr.stateNode.forceUpdate();
          updatedParent = true;
        }
      }
      if (!updatedParent) inst.forceUpdate?.();
    } catch {
      patchedInstances.delete(inst);
    }
  }
}

function findCollectionGridFiber(dropdownInstance: any): any | null {
  let curr = dropdownInstance?._reactInternals?.return || dropdownInstance?._reactInternalFiber?.return;
  let fallback: any = null;

  for (let depth = 0; curr && depth < 10; depth++, curr = curr.return) {
    const sectionsA = curr.sibling?.pendingProps?.childSections;
    const sectionsB = curr.alternate?.sibling?.pendingProps?.childSections;
    if (Array.isArray(sectionsA)) {
      if (!(sectionsA as any)._bibFiltered) return curr.sibling;
      fallback = fallback || curr.sibling;
    }
    if (Array.isArray(sectionsB)) {
      if (!(sectionsB as any)._bibFiltered) return curr.alternate.sibling;
      fallback = fallback || curr.alternate.sibling;
    }
  }
  return fallback;
}

function filterCollectionSections(zeFiber: any, scope: string): number[] {
  const rawOverviews = zeFiber?.pendingProps?.appOverviews;
  const allAppIds: number[] = Array.isArray(rawOverviews) ? rawOverviews.map((a: any) => a.appid) : [];

  if (allAppIds.length > 0) {
    setTimeout(() => requestManyMeta(allAppIds), 0);
  }

  const sections: any[] | undefined = zeFiber?.pendingProps?.childSections;
  if (!Array.isArray(sections) || sections.length === 0 || (sections as any)._bibFiltered) {
    return allAppIds;
  }
  Object.defineProperty(sections, '_bibFiltered', { value: true, enumerable: false });

  if (!isScopeFilterActive(scope)) {
    return allAppIds;
  }

  for (const sec of sections) {
    if (!Array.isArray(sec?.children)) continue;
    sec.children = sec.children.filter((item: any) => {
      const appId = item?.m_overview?.appid;
      if (typeof appId !== 'number') return true;
      const meta = cachedMeta(appId);
      if (!meta) return false;
      return matchesGameMeta(scope, meta);
    });
  }

  return allAppIds;
}

function initCollectionFilter(): () => void {
  if (activePatches.length > 0) return () => {};

  let throttleTimer: any = null;

  try {
    resolveSteamModules();

    if (cachedSortingDropdownClass?.prototype) {
      activePatches.push(replacePatch(cachedSortingDropdownClass.prototype, 'shouldComponentUpdate', () => true));

      const renderPatch: Patch = replacePatch(
        cachedSortingDropdownClass.prototype,
        'render',
        function (this: any, args: any[]): any {
          patchedInstances.add(this);
          if (!this._bibMobxRender) {
            const self = this;
            const origDefineProperty = Object.defineProperty;
            Object.defineProperty = function (target: any, prop: PropertyKey, attributes: PropertyDescriptor) {
              if (target === self && prop === 'render' && typeof attributes.value === 'function') {
                self._bibMobxRender = attributes.value;
                return target;
              }
              return origDefineProperty.call(Object, target, prop, attributes);
            } as typeof Object.defineProperty;

            try {
              return renderPatch.original.apply(this, args);
            } finally {
              Object.defineProperty = origDefineProperty;
            }
          }

          const vdom = this._bibMobxRender.apply(this, args);
          const zeFiber = findCollectionGridFiber(this);
          if (!zeFiber || !Array.isArray(vdom?.props?.children)) {
            patchedInstances.delete(this);
            return vdom;
          }

          const { scope } = getCurrentCollectionScope();
          const appIds = filterCollectionSections(zeFiber, scope);

          const children = vdom.props.children;
          const existingIdx = children.findIndex((c: any) => c?.key === 'bibliotekarsha-bar');
          const controlEl = <CollectionFilterButton key="bibliotekarsha-bar" appIds={appIds} />;
          if (existingIdx >= 0) {
            children[existingIdx] = controlEl;
          } else {
            children.push(controlEl);
          }

          return vdom;
        }
      );
      activePatches.push(renderPatch);
    }

    if (cachedCapsuleMemo?.type && cachedSubscriptClass) {
      activePatches.push(
        afterPatch(cachedCapsuleMemo, 'type', ([props]: [any], vdom: any) => {
          const { scope } = getCurrentCollectionScope();
          if (
            !isScopeFilterActive(scope) ||
            props?.context !== 1 ||
            typeof props?.app?.appid !== 'number' ||
            !Array.isArray(vdom?.props?.children)
          ) {
            return vdom;
          }
          const meta = cachedMeta(props.app.appid);
          if (!meta) return vdom;
          vdom.props.children.splice(1, 0, <div className={cachedSubscriptClass}>{formatLocDetail(meta)}</div>);
          return vdom;
        })
      );
    }
  } catch {}

  const unsubFilters = subscribeFilters((changedScope) => {
    if (changedScope.startsWith('collection:')) {
      forceUpdateCollectionViews();
    }
  });

  const unsubMeta = onMetaUpdate(() => {
    const { scope } = getCurrentCollectionScope();
    if (!isScopeFilterActive(scope) || throttleTimer) return;
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      forceUpdateCollectionViews();
    }, 300);
  });

  return () => {
    if (throttleTimer) clearTimeout(throttleTimer);
    unsubFilters();
    unsubMeta();
    activePatches.splice(0).forEach((p) => p.unpatch());
    for (const inst of patchedInstances) {
      try {
        delete inst.render;
        delete inst._bibMobxRender;
      } catch {}
    }
    patchedInstances.clear();
  };
}

export const collectionFilterModule: BibliotekarshaModule = {
  id: 'collection-filter',
  name: 'Фильтрация внутри коллекций',
  description: 'Добавляет кнопку Bibliotekarsha в шапку каждой коллекции рядом со списком сортировки.',
  defaultEnabled: true,
  mountGlobal: initCollectionFilter,
};
