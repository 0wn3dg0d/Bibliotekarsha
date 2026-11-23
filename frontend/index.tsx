import { definePlugin } from 'millennium';
import { initCollectionFilter } from './features/collection-filter';
import { initLibraryFilter } from './features/library-filter';
import { initSidebarCollections } from './features/sidebar-collections';
import { initStatRow } from './features/stat-row';
import { requestAllLibraryMeta } from './stores/localization';
import { ensureTagsLoaded } from './stores/tags';

function attachToDocument(doc: Document): () => void {
  const cleanups = [initLibraryFilter(doc), initSidebarCollections(doc), initStatRow(doc)];
  return () => cleanups.forEach((fn) => fn());
}

export default definePlugin(() => {
  ensureTagsLoaded();
  const cleanupCollectionFilter = initCollectionFilter();
  const docCleanups = new Map<Document, () => void>();
  let lastKnownLibCount = 0;

  const tick = async () => {
    const popup = window.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0');
    const doc = popup?.m_popup?.document;
    if (doc && !docCleanups.has(doc)) {
      docCleanups.set(doc, attachToDocument(doc));
    }
    const count = await requestAllLibraryMeta();
    if (count > lastKnownLibCount) {
      lastKnownLibCount = count;
    }
  };

  const interval = setInterval(tick, 2000);
  tick();

  return {
    title: 'Bibliotekarsha',
    onDismount() {
      clearInterval(interval);
      cleanupCollectionFilter();
      docCleanups.forEach((cleanup) => cleanup());
      docCleanups.clear();
    },
  };
});
