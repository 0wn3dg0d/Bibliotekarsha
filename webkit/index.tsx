import { initStoreSalesMasterModule } from './modules/salesMaster';
import { initWishlistGiftHelperModule } from './modules/wishlistGiftHelper';
import { initStoreCatalogModules } from './modules/catalog';
import { initCommunityHomeInfoModule } from './modules/homeInfo';
import { initCommunityHomeYoutubeFixModule } from './modules/homeYoutubeFix';
import { initAccountIgnoredCleanerModule } from './modules/ignoredCleaner';
import { initStoreNewsFilterModule } from './modules/newsFilter';
import { initWidgetFixerModule } from './modules/widgetFixer';
import { initStoreExternalLinksModule } from './modules/externalLinks';
import { initStoreGameNotesModule } from './modules/gameNotes';
import { initStoreGiftHelperModule } from './modules/giftHelper';
import { initStoreIncognitoWishlistModule } from './modules/incognitoWishlist';
import { initStorePicsCheckModule } from './modules/pics';
import { initStorePriceAnalyzerModule } from './modules/priceAnalyzer';
import { initStoreEarlyAccessModule } from './modules/earlyAccess';
import { initGamePageModule } from './modules/gamePage';
import { bypassAndRender, detectBlockedPage, isSteamHost } from './modules/incognito';
import { initStoreNfoModule } from './modules/nfo';
import { StoreWebkitConfig, readStoreWebkitConfig } from './shared/ipc';

function runStoreModules(cfg: StoreWebkitConfig): void {
  initGamePageModule(cfg);
  initStoreNfoModule(cfg);
  initStoreEarlyAccessModule(cfg);
  initStorePriceAnalyzerModule(cfg);
  initStorePicsCheckModule(cfg);
  initStoreExternalLinksModule(cfg);
  initStoreGiftHelperModule(cfg);
  initStoreGameNotesModule(cfg);
  initStoreIncognitoWishlistModule(cfg);
  initStoreNewsFilterModule(cfg);
  initCommunityHomeInfoModule(cfg);
  initCommunityHomeYoutubeFixModule(cfg);
  initWidgetFixerModule(cfg);
  initAccountIgnoredCleanerModule(cfg);
  initStoreCatalogModules(cfg);
  initWishlistGiftHelperModule(cfg);
  initStoreSalesMasterModule(cfg);
}

export default async function WebkitMain() {
  if (!isSteamHost(window.location.hostname)) return;

  const cfg = await readStoreWebkitConfig();
  (window as any).__BSH_RUN_STORE_MODULES = () => runStoreModules(cfg);

  let modulesStarted = false;
  const startModulesOnce = () => {
    if (modulesStarted || (window as any).__BSH_INCOGNITO_BYPASSING || (cfg.enabled && detectBlockedPage())) return;
    modulesStarted = true;
    runStoreModules(cfg);
  };

  const tryTriggerBypass = () => {
    if (!cfg.enabled) return false;
    if ((window as any).__BSH_INCOGNITO_ACTIVE || (window as any).__BSH_INCOGNITO_BYPASSING) return true;
    if (detectBlockedPage()) {
      bypassAndRender(window.location.href, cfg, () => {
        (window as any).__BSH_CATALOG_INITIALIZED = false;
        runStoreModules(cfg);
      });
      return true;
    }
    return false;
  };

  if (tryTriggerBypass()) return;

  if (document.readyState === 'loading') {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        if (!tryTriggerBypass()) startModulesOnce();
      },
      { once: true }
    );
  } else {
    startModulesOnce();
  }

  let checks = 0;
  const timer = setInterval(() => {
    checks++;
    if (tryTriggerBypass() || checks >= 48) {
      clearInterval(timer);
    }
  }, 250);

  window.addEventListener(
    'load',
    () => {
      if (tryTriggerBypass()) clearInterval(timer);
    },
    { once: true }
  );
}
