import { StoreWebkitConfig, injectStyleOnce } from '../../shared/ipc';
import { initCatalogFilters } from './filters';
import { MassToolsHandle, initCatalogMassTools } from './massTools';
import { collectAndFetchCatalogAppIds, ensureCatalogUserData, loadCatalogTags } from './store';
import { CATALOG_CSS } from './styles';
import { initCatalogTooltip } from './tooltip';

export function initStoreCatalogModules(cfg: StoreWebkitConfig): void {
  if (!window.location.hostname.includes('store.steampowered.com')) return;
  if (!window.location.pathname.includes('/search')) return;

  if ((window as any).__BSH_CATALOG_INITIALIZED) return;
  const anyEnabled = Boolean(cfg.catalogTooltip || cfg.catalogFilters || cfg.catalogMassTools);
  if (!anyEnabled) return;
  (window as any).__BSH_CATALOG_INITIALIZED = true;

  injectStyleOnce('bsh-catalog-styles', CATALOG_CSS);

  let massTools: MassToolsHandle | null = null;

  const start = async () => {
    await Promise.all([loadCatalogTags(), ensureCatalogUserData()]);

    if (cfg.catalogFilters) {
      initCatalogFilters();
    }
    if (cfg.catalogMassTools) {
      massTools = initCatalogMassTools();
    }
    if (cfg.catalogTooltip) {
      initCatalogTooltip(cfg);
    }

    collectAndFetchCatalogAppIds();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver((mutations) => {
      let relevant = false;
      for (const m of mutations) {
        if (m.type !== 'childList' || m.addedNodes.length === 0) continue;
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLElement) {
            if (
              node.classList.contains('steam-hider-checkbox') ||
              node.classList.contains('sth-log-msg') ||
              node.classList.contains('orb-log-msg') ||
              node.classList.contains('bsh-catalog-tooltip') ||
              node.id.startsWith('sth-') ||
              node.id.startsWith('orb-')
            ) {
              continue;
            }
            relevant = true;
            break;
          }
        }
        if (relevant) break;
      }

      if (relevant) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          collectAndFetchCatalogAppIds();
          massTools?.onNewDomRows();
        }, 250);
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  setTimeout(() => {
    start();
  }, 1200);
}
