import './services/steamAuthSync';
import { definePlugin } from 'millennium';
import { ALL_MODULES } from './modules/registry';
import { requestAllLibraryMeta } from './stores/localization';
import { isModuleEnabled, subscribeSettings } from './stores/settings';
import { ensureTagsLoaded } from './stores/tags';

export default definePlugin(() => {
  ensureTagsLoaded();

  const activeGlobalCleanups = new Map<string, () => void>();
  const activeDocCleanups = new Map<Document, Map<string, () => void>>();
  let metaSyncTick = 0;

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

  const pruneClosedDocuments = () => {
    for (const [doc, docMap] of Array.from(activeDocCleanups.entries())) {
      const win = doc.defaultView;
      if (!win || win.closed) {
        docMap.forEach((cleanup) => {
          try {
            cleanup();
          } catch {}
        });
        activeDocCleanups.delete(doc);
      }
    }
  };

  const unsubSettings = subscribeSettings(() => {
    pruneClosedDocuments();
    syncGlobalModules();
    for (const doc of Array.from(activeDocCleanups.keys())) {
      syncDocumentModules(doc);
    }
  });

  const tick = async () => {
    pruneClosedDocuments();
    const popup = window.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0');
    const doc = popup?.m_popup?.document;
    if (doc && doc.defaultView && !doc.defaultView.closed) {
      syncDocumentModules(doc);
    }
    if (metaSyncTick === 0 || metaSyncTick % 8 === 0) {
      await requestAllLibraryMeta();
    }
    metaSyncTick++;
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
