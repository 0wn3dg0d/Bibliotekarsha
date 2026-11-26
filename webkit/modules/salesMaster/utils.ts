import { fetchViaBackend, idbGet, idbSet } from '../../shared/ipc';
import { SmOfferItem, SmScrapedSteamOffer } from './types';

const RATES_TTL = 6 * 60 * 60 * 1000;
export const smExchangeRates: Record<string, Record<string, number>> = {};
const ratePromises: Record<string, Promise<Record<string, number>>> = {};

export function smLogError(storeName: string, message: string, error: unknown = null): void {
  console.error(`[SalesMaster][${storeName}] ${message}`, error || '');
}

export function smDebounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function smParsePrice(priceStr: unknown): number | null {
  if (priceStr === null || priceStr === undefined || priceStr === '') return null;
  const match = String(priceStr).match(/\d[\d\s.,]*\d|\d/);
  if (!match) return null;
  const raw = match[0].replace(/\s+/g, '');
  let normalized = raw;
  const hasDot = raw.includes('.');
  const hasComma = raw.includes(',');
  if (hasDot && hasComma) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      normalized = raw.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = raw.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = raw.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      normalized = raw.replace(/,/g, '');
    } else {
      normalized = raw.replace(',', '.');
    }
  } else if (hasDot) {
    const parts = raw.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0] !== '0')) {
      normalized = raw.replace(/\./g, '');
    }
  }
  const price = parseFloat(normalized);
  return isNaN(price) ? null : price;
}

export function smParsePercent(percentStr: unknown): number | null {
  if (percentStr === null || percentStr === undefined || percentStr === '') return null;
  const match = String(percentStr).match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const percent = parseFloat(match[1].replace(',', '.'));
  return isNaN(percent) ? null : percent;
}

export async function smFetchExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
  const lower = baseCurrency.toLowerCase();
  if (smExchangeRates[lower] && Object.keys(smExchangeRates[lower]).length > 0) {
    return smExchangeRates[lower];
  }
  if (ratePromises[lower]) return ratePromises[lower];

  ratePromises[lower] = (async () => {
    const cacheKey = `bsh_sm_rates_${lower}`;
    const cached = await idbGet<{ ts: number; rates: Record<string, number> }>(cacheKey);
    if (cached?.rates && Date.now() - cached.ts < RATES_TTL) {
      smExchangeRates[lower] = cached.rates;
      return cached.rates;
    }

    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${lower}.json`;
    let json: any = null;
    try {
      const direct = await fetch(url);
      if (direct.ok) json = await direct.json();
    } catch {}
    if (!json) {
      const res = await fetchViaBackend(url);
      if (res.ok && res.body) json = JSON.parse(res.body);
    }
    if (!json) {
      delete ratePromises[lower];
      if (cached?.rates) {
        smExchangeRates[lower] = cached.rates;
        return cached.rates;
      }
      throw new Error('Rates fetch failed');
    }
    const rates = json?.[lower];
    if (!rates || typeof rates !== 'object') {
      delete ratePromises[lower];
      throw new Error(`Нет курсов для ${baseCurrency}`);
    }

    smExchangeRates[lower] = rates;
    await idbSet(cacheKey, { ts: Date.now(), rates });
    return rates;
  })();

  return ratePromises[lower];
}

const SM_CURRENCY_MAP: Array<{ symbols: string[]; code: string }> = [
  { symbols: ['CDN$', 'CAD'], code: 'CAD' },
  { symbols: ['NZ$', 'NZD'], code: 'NZD' },
  { symbols: ['HK$', 'HKD'], code: 'HKD' },
  { symbols: ['Mex$', 'MXN'], code: 'MXN' },
  { symbols: ['NT$', 'TWD'], code: 'TWD' },
  { symbols: ['CLP$', 'CLP'], code: 'CLP' },
  { symbols: ['ARS$', 'ARS'], code: 'ARS' },
  { symbols: ['A$', 'AUD'], code: 'AUD' },
  { symbols: ['S$', 'SGD'], code: 'SGD' },
  { symbols: ['R$', 'BRL'], code: 'BRL' },
  { symbols: ['$', 'USD'], code: 'USD' },
  { symbols: ['€', 'EUR'], code: 'EUR' },
  { symbols: ['£', 'GBP'], code: 'GBP' },
  { symbols: ['zł', 'PLN'], code: 'PLN' },
  { symbols: ['CHF'], code: 'CHF' },
  { symbols: ['₸', 'KZT'], code: 'KZT' },
  { symbols: ['₴', 'UAH'], code: 'UAH' },
  { symbols: ['JPY'], code: 'JPY' },
  { symbols: ['¥', 'CNY'], code: 'CNY' },
  { symbols: ['₩', 'KRW'], code: 'KRW' },
  { symbols: ['₹', 'INR'], code: 'INR' },
  { symbols: ['₪', 'ILS'], code: 'ILS' },
  { symbols: ['฿', 'THB'], code: 'THB' },
  { symbols: ['₫', 'VND'], code: 'VND' },
  { symbols: ['TL', 'TRY'], code: 'TRY' },
  { symbols: ['kr', 'NOK'], code: 'NOK' },
];

function detectCurrencyCode(priceString?: string | null, hintCurrency?: string | null): string {
  if (priceString) {
    for (const c of SM_CURRENCY_MAP) {
      if (c.symbols.some((s) => priceString.includes(s))) {
        return c.code;
      }
    }
    if (priceString.includes('₽') || /руб/i.test(priceString)) {
      return 'RUB';
    }
  }

  const hint = (hintCurrency || '').trim().toUpperCase();
  if (hint === 'CIS') return 'USD';
  if (hint === 'RUB' || hint === 'RUR') return 'RUB';
  if (hint && SM_CURRENCY_MAP.some((c) => c.code === hint)) return hint;

  return 'RUB';
}

async function resolveRateToRub(currencyCode: string): Promise<number | null> {
  const lower = currencyCode.toLowerCase();
  if (lower === 'rub') return 1;

  const directCached = smExchangeRates[lower]?.rub;
  if (directCached) return directCached;
  const invCached = smExchangeRates.rub?.[lower];
  if (invCached) return 1 / invCached;

  try {
    const rates = await smFetchExchangeRates(lower);
    if (rates?.rub) return rates.rub;
  } catch {}

  const invAfter = smExchangeRates.rub?.[lower];
  return invAfter ? 1 / invAfter : null;
}

export async function smProcessPriceString(priceString?: string | null): Promise<number | null> {
  if (!priceString || typeof priceString !== 'string') return null;
  const lower = priceString.toLowerCase();
  if (lower.includes('n/a') || lower.includes('free') || priceString.trim() === '') return null;

  const price = smParsePrice(priceString);
  if (price === null) return null;

  const currencyCode = detectCurrencyCode(priceString);
  const rate = await resolveRateToRub(currencyCode);
  if (!rate) return null;
  return price * rate;
}

export async function smProcessItemCurrency(
  itemData: SmOfferItem,
  priceString?: string | null
): Promise<SmOfferItem | null> {
  if (itemData.currentPrice === null) {
    itemData.currency = 'RUB';
    return itemData;
  }

  const currencyCode = detectCurrencyCode(priceString, itemData.currency);
  if (currencyCode !== 'RUB') {
    const rate = await resolveRateToRub(currencyCode);
    if (!rate) return null;
    itemData.currentPrice = itemData.currentPrice * rate;
    if (itemData.originalPrice !== null) {
      itemData.originalPrice = itemData.originalPrice * rate;
    }
    if (itemData.discountAmount !== null) {
      itemData.discountAmount = itemData.discountAmount * rate;
    }
  }

  itemData.currency = 'RUB';
  return itemData;
}

export function smCalculateMissingValues(item: SmOfferItem): SmOfferItem {
  const price = item.currentPrice;
  let original = item.originalPrice;
  let percent = item.discountPercent;
  let amount = item.discountAmount;

  if (price === null) return item;

  if (percent !== null && original === null) {
    original = percent > 0 && percent < 100 ? price / (1 - percent / 100) : price;
  }
  if (original !== null && percent === null) {
    percent = original > price ? ((original - price) / original) * 100 : 0;
  }
  if (amount !== null && original === null) {
    original = price + amount;
  }
  if (amount !== null && percent === null && original !== null && original > 0) {
    percent = (amount / original) * 100;
  }
  if (original !== null && amount === null) {
    amount = original > price ? original - price : 0;
  }

  item.originalPrice = typeof original === 'number' ? parseFloat(original.toFixed(2)) : null;
  item.discountPercent = typeof percent === 'number' ? parseFloat(percent.toFixed(1)) : null;
  item.discountAmount = typeof amount === 'number' ? parseFloat(amount.toFixed(2)) : null;

  if (item.discountPercent !== null && item.discountPercent <= 0) {
    item.discountPercent = 0;
    item.discountAmount = 0;
    if (item.originalPrice === null) item.originalPrice = price;
  }
  if (item.originalPrice === null) {
    item.originalPrice = price;
    item.discountPercent = 0;
    item.discountAmount = 0;
  }
  return item;
}

export function smGetSteamGameName(): string {
  const el = document.querySelector('#appHubAppName, .apphub_AppName');
  return el?.textContent?.trim() || '';
}

const smEnglishNameCache = new Map<string, string>();

export async function smGetEnglishSteamGameName(): Promise<string> {
  const fallback = smGetSteamGameName();
  const match = window.location.pathname.match(/\/app\/(\d+)/);
  if (!match) return fallback;

  const appId = match[1];
  if (smEnglishNameCache.has(appId)) {
    return smEnglishNameCache.get(appId) || fallback;
  }

  const queryApi = async (countryCode: string): Promise<string> => {
    const req = {
      ids: [{ appid: parseInt(appId, 10) }],
      context: { language: 'english', country_code: countryCode, steam_realm: 1 },
      data_request: { include_basic_info: true },
    };
    const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(
      JSON.stringify(req)
    )}`;
    const res = await fetchViaBackend(url);
    if (!res.ok || !res.body) return '';
    try {
      const json = JSON.parse(res.body);
      const item = json?.response?.store_items?.[0];
      return typeof item?.name === 'string' ? item.name.trim() : '';
    } catch {
      return '';
    }
  };

  let engName = await queryApi('US');
  if (!engName) {
    engName = await queryApi('RU');
  }

  if (engName) {
    smEnglishNameCache.set(appId, engName);
    return engName;
  }
  return fallback;
}

export async function smCopyTextSafe(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function smScrapeSteamPageOffers(): Promise<{
  editions: SmScrapedSteamOffer[];
  dlc: SmScrapedSteamOffer[];
}> {
  const processOffer = async (element: Element, isDLC: boolean): Promise<SmScrapedSteamOffer | null> => {
    let title = '';
    let priceText: string | undefined;
    let originalPriceText: string | undefined;
    let discountPercent = 0;
    let id = '';
    let type: 'sub' | 'bundle' | 'dlc' = 'sub';

    if (isDLC) {
      const appid = (element as HTMLElement).dataset.dsAppid || '';
      const dlcNameEl = element.querySelector('.game_area_dlc_name');
      if (dlcNameEl) {
        const clone = dlcNameEl.cloneNode(true) as HTMLElement;
        clone.querySelector('.dlc_highlight_reason_container')?.remove();
        title = clone.textContent?.trim() || '';
      }
      const priceCtn = element.querySelector('.game_area_dlc_price');
      if (!priceCtn) return null;
      const discountBlock = priceCtn.querySelector('.discount_block');
      if (discountBlock) {
        priceText = discountBlock.querySelector('.discount_final_price')?.textContent?.trim();
        originalPriceText = discountBlock.querySelector('.discount_original_price')?.textContent?.trim();
        discountPercent = smParsePercent(discountBlock.querySelector('.discount_pct')?.textContent) || 0;
      } else {
        priceText = priceCtn.textContent?.trim();
      }
      id = appid;
      type = 'dlc';
    } else {
      const purchaseDiv = element.querySelector(
        '.game_area_purchase_game, .game_area_purchase_game_dropdown_subscription'
      );
      if (!purchaseDiv) return null;
      const titleEl = purchaseDiv.querySelector('h2.title');
      if (!titleEl) return null;
      const clone = titleEl.cloneNode(true) as HTMLElement;
      clone.querySelector('.bundle_label')?.remove();
      title = (clone.textContent || '')
        .trim()
        .replace(/^(Купить|Buy)\s+/, '')
        .replace(/\s*—\s*НАБОР.*/, '')
        .trim();

      const discountBlock = purchaseDiv.querySelector('.discount_block');
      const priceBlock = purchaseDiv.querySelector('.game_purchase_price.price');
      if (discountBlock) {
        priceText = discountBlock.querySelector('.discount_final_price')?.textContent?.trim();
        originalPriceText = discountBlock.querySelector('.discount_original_price')?.textContent?.trim();
        discountPercent = smParsePercent(discountBlock.querySelector('.discount_pct')?.textContent) || 0;
      } else if (priceBlock) {
        priceText = priceBlock.textContent?.trim();
      }

      const subInput = purchaseDiv.querySelector('input[name="subid"]') as HTMLInputElement | null;
      const bundleInput = purchaseDiv.querySelector('input[name="bundleid"]') as HTMLInputElement | null;
      id = subInput?.value || bundleInput?.value || '';
      type = subInput ? 'sub' : 'bundle';
    }

    if (!id || !title) return null;
    const price = await smProcessPriceString(priceText);
    const originalPrice = await smProcessPriceString(originalPriceText);
    return { id, title, price, originalPrice, priceText, originalPriceText, discountPercent, type };
  };

  const editions = (
    await Promise.all(
      Array.from(document.querySelectorAll('.game_area_purchase_game_wrapper')).map((w) => processOffer(w, false))
    )
  ).filter((x): x is SmScrapedSteamOffer => x !== null);

  const dlc = (
    await Promise.all(
      Array.from(document.querySelectorAll('#gameAreaDLCSection .game_area_dlc_row')).map((r) => processOffer(r, true))
    )
  ).filter((x): x is SmScrapedSteamOffer => x !== null);

  return { editions, dlc };
}
