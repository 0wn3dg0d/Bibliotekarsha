import { pluginConfig } from 'millennium';

export interface StoreWebkitSettings {
  enabled: boolean;
  showButton: boolean;
  defaultRegion: string;
  gamePage: boolean;
  autoLoadReviews: boolean;
  storeNfo: boolean;
  nfoAutoLoad: boolean;
  earlyAccess: boolean;
  priceAnalyzer: boolean;
  picsCheck: boolean;
  picsTargetRegion: string;
  giftHelper: boolean;
  gameNotes: boolean;
  incognitoWishlist: boolean;
  externalLinks: boolean;
  newsFilter: boolean;
  homeInfo: boolean;
  homeInfoEnglish: boolean;
  homeYoutubeFix: boolean;
  widgetFixer: boolean;
  ignoredCleaner: boolean;
  catalogTooltip: boolean;
  catalogTooltipEnglish: boolean;
  catalogFilters: boolean;
  catalogMassTools: boolean;
  wishlistGiftHelper: boolean;
  salesMaster: boolean;
  salesMasterAutoSearch: boolean;
  salesMasterAutoInsertTitle: boolean;
}

export type IncognitoSettings = StoreWebkitSettings;

export const DEFAULT_INCOGNITO_SETTINGS: StoreWebkitSettings = {
  enabled: true,
  showButton: false,
  defaultRegion: 'US',
  gamePage: true,
  autoLoadReviews: false,
  storeNfo: true,
  nfoAutoLoad: true,
  earlyAccess: true,
  priceAnalyzer: true,
  picsCheck: true,
  picsTargetRegion: 'RU',
  giftHelper: true,
  gameNotes: true,
  incognitoWishlist: true,
  externalLinks: true,
  newsFilter: true,
  homeInfo: true,
  homeInfoEnglish: false,
  homeYoutubeFix: true,
  widgetFixer: true,
  ignoredCleaner: true,
  catalogTooltip: true,
  catalogTooltipEnglish: false,
  catalogFilters: true,
  catalogMassTools: true,
  wishlistGiftHelper: true,
  salesMaster: true,
  salesMasterAutoSearch: false,
  salesMasterAutoInsertTitle: false,
};

export const INCOGNITO_REGIONS: Record<string, string> = {
  US: 'США (USD)',
  KZ: 'Казахстан (KZT)',
  UA: 'Украина (UAH)',
  DE: 'Европа (EUR)',
  GB: 'Великобритания (GBP)',
  CH: 'Швейцария (CHF)',
  JP: 'Япония (JPY)',
  TR: 'MENA / Турция (USD)',
  AZ: 'СНГ (USD)',
  BR: 'Бразилия (BRL)',
  CN: 'Китай (CNY)',
  KR: 'Южная Корея (KRW)',
};

let currentSettings: StoreWebkitSettings = { ...DEFAULT_INCOGNITO_SETTINGS };
const listeners = new Set<() => void>();

export function getIncognitoSettings(): StoreWebkitSettings {
  return currentSettings;
}

export function subscribeIncognito(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function syncIncognitoToPluginConfig(): Promise<void> {
  try {
    const saved = await pluginConfig.get<Partial<StoreWebkitSettings>>('incognito');
    if (saved && typeof saved === 'object') {
      currentSettings = { ...DEFAULT_INCOGNITO_SETTINGS, ...saved };
      listeners.forEach((fn) => fn());
    } else {
      await pluginConfig.set('incognito', currentSettings);
    }
  } catch {}
}

export async function updateIncognitoSettings(patch: Partial<StoreWebkitSettings>): Promise<void> {
  currentSettings = { ...currentSettings, ...patch };
  try {
    await pluginConfig.set('incognito', currentSettings);
  } catch {}
  listeners.forEach((fn) => fn());
}

syncIncognitoToPluginConfig();
