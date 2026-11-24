import { definePlugin } from 'millennium';
import { ALL_MODULES } from './modules/registry';
import { requestAllLibraryMeta } from './stores/localization';
import { isModuleEnabled, subscribeSettings } from './stores/settings';
import { ensureTagsLoaded } from './stores/tags';

export default definePlugin(() => {
  ensureTagsLoaded();

  const activeGlobalCleanups = new Map<string, () => void>();
  const activeDocCleanups = new Map<Document, Map<string, () => void>>();
  let lastKnownLibCount = 0;

  const syncGlobalModules = () => {
    for (const mod of ALL_MODULES) {
      if (!mod.mountGlobal) continue;
      const shouldRun = isModuleEnabled(mod.id, mod.defaultEnabled);
      const isRunning = activeGlobalCleanups.has(mod.id);
      if (shouldRun && !isRunning) {
        try {
          activeGlobalCleanups.set(mod.id, mod.mountGlobal());
        } catch {}
      } else if (!shouldRun && isRunning) {
        try {
          activeGlobalCleanups.get(mod.id)?.();
        } catch {}
        activeGlobalCleanups.delete(mod.id);
      }
    }
  };

  const syncDocumentModules = (doc: Document) => {
    let docMap = activeDocCleanups.get(doc);
    if (!docMap) {
      docMap = new Map<string, () => void>();
      activeDocCleanups.set(doc, docMap);
    }
    for (const mod of ALL_MODULES) {
      if (!mod.mountDocument) continue;
      const shouldRun = isModuleEnabled(mod.id, mod.defaultEnabled);
      const isRunning = docMap.has(mod.id);
      if (shouldRun && !isRunning) {
        try {
          docMap.set(mod.id, mod.mountDocument(doc));
        } catch {}
      } else if (!shouldRun && isRunning) {
        try {
          docMap.get(mod.id)?.();
        } catch {}
        docMap.delete(mod.id);
      }
    }
  };

  syncGlobalModules();

  const unsubSettings = subscribeSettings(() => {
    syncGlobalModules();
    for (const doc of Array.from(activeDocCleanups.keys())) {
      syncDocumentModules(doc);
    }
  });

  const tick = async () => {
    const popup = window.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0');
    const doc = popup?.m_popup?.document;
    if (doc) {
      syncDocumentModules(doc);
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
      unsubSettings();
      activeGlobalCleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch {}
      });
      activeGlobalCleanups.clear();
      activeDocCleanups.forEach((docMap) => {
        docMap.forEach((cleanup) => {
          try {
            cleanup();
          } catch {}
        });
      });
      activeDocCleanups.clear();
    },
  };
});
