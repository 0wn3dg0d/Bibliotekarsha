import { getReactInstance } from 'millennium';
import { BibliotekarshaModule } from '../../core/types';
import { getCollectionByIdSafe, isRatable } from '../../lib/steam';
import { isScopeFilterActive, matchesGameMeta, subscribeFilters } from '../../stores/filters';
import { cachedMeta, onMetaUpdate, requestManyMeta } from '../../stores/localization';
import { observeThrottled } from '../../utils/dom';

const BADGE_CLASS = 'bibliotekarsha-col-badge';

function getCollectionInfoFromFiber(el: Element): { id: string; totalCount?: number } | null {
  let fiber: any;
  try {
    fiber = getReactInstance(el);
  } catch {
    return null;
  }
  for (let d = 0; fiber && d < 16; d++, fiber = fiber.return) {
    const p = fiber.memoizedProps;
    if (!p) continue;
    const rawId = p.strId || p.strCollectionId || p.strTargetId || p.collection?.id;
    if (typeof rawId === 'string' && rawId !== 'all-games') {
      return { id: rawId, totalCount: typeof p.nTotalCount === 'number' ? p.nTotalCount : undefined };
    }
  }
  return null;
}

function initSidebarCollections(doc: Document): () => void {
  const updateAllBadges = () => {
    const headers = doc.querySelectorAll<HTMLElement>('[class*="SectionHeaderContent"]');

    headers.forEach((headerEl) => {
      const nameEl = headerEl.querySelector<HTMLElement>('[class*="SectionName"]');
      const countEl = headerEl.querySelector<HTMLElement>('[class*="SectionCount"]');
      if (!nameEl || !countEl) return;

      const info = getCollectionInfoFromFiber(nameEl);
      let badge = headerEl.querySelector<HTMLElement>('.' + BADGE_CLASS);

      if (!info) {
        if (badge) badge.remove();
        return;
      }

      const scope = 'collection:' + info.id;
      if (!isScopeFilterActive(scope)) {
        if (badge) badge.remove();
        return;
      }

      const collection = getCollectionByIdSafe(info.id);
      if (!collection) {
        if (badge) badge.remove();
        return;
      }

      let apps: any[] = [];
      try {
        apps = (collection.visibleApps ?? collection.allApps ?? []).filter(isRatable);
      } catch {
        apps = [];
      }

      const total = apps.length || info.totalCount || 0;
      const missingIds: number[] = [];
      let matched = 0;

      for (const app of apps) {
        const meta = cachedMeta(app.appid);
        if (!meta) {
          missingIds.push(app.appid);
        } else if (matchesGameMeta(scope, meta)) {
          matched++;
        }
      }

      if (missingIds.length > 0) {
        requestManyMeta(missingIds);
      }

      if (!badge) {
        badge = doc.createElement('span');
        badge.className = BADGE_CLASS;
        badge.style.marginLeft = '6px';
        badge.style.padding = '1px 6px';
        badge.style.borderRadius = '3px';
        badge.style.fontSize = '11px';
        badge.style.fontWeight = '700';
        badge.style.lineHeight = '1.2';
        badge.style.flexShrink = '0';
        countEl.insertAdjacentElement('afterend', badge);
      }

      const isEmpty = matched === 0;
      badge.textContent = matched + '/' + total;
      badge.title = 'Bibliotekarsha: подходит ' + matched + ' из ' + total + ' игр';
      badge.style.backgroundColor = isEmpty ? 'rgba(248, 81, 73, 0.25)' : 'rgba(102, 192, 244, 0.22)';
      badge.style.color = isEmpty ? '#ff8e8e' : '#66c0f4';
      badge.style.border = isEmpty ? '1px solid rgba(248, 81, 73, 0.5)' : '1px solid rgba(102, 192, 244, 0.5)';
    });
  };

  const stopFilters = subscribeFilters((changedScope) => {
    if (changedScope.startsWith('collection:')) {
      updateAllBadges();
    }
  });

  const stopMeta = onMetaUpdate(() => {
    updateAllBadges();
  });

  const stopObserver = observeThrottled(doc, updateAllBadges, 200);

  return () => {
    stopObserver();
    stopFilters();
    stopMeta();
    doc.querySelectorAll('.' + BADGE_CLASS).forEach((el) => el.remove());
  };
}

export const sidebarCollectionsModule: BibliotekarshaModule = {
  id: 'sidebar-collections',
  name: 'Двойные счётчики в списке коллекций',
  description: 'Показывает бейдж подходит/всего рядом с каждой коллекцией в левом меню при активном фильтре.',
  defaultEnabled: true,
  mountDocument: initSidebarCollections,
};
