import {
  StoreWebkitConfig,
  fetchViaBackend,
  idbGet,
  idbSet,
  injectStyleOnce,
} from '../../shared/ipc';

interface RegionMeta {
  name: string;
  code: number;
  iso: string;
}

interface RegionConfig {
  cc: string;
  nameRU: string;
  nameEN: string;
  steamCurrencyId: number;
  iso: string;
}

interface CurrencyRule {
  strSymbol: string;
  bSuffixSymbol?: boolean;
  bSpaceForSymbol?: boolean;
  bWholeUnitsOnly?: boolean;
  strDecimalSymbol?: string;
  strThousandsSeparator?: string;
}

interface MatrixRow {
  usd_price?: number;
  convert_method?: number;
  currency_prices?: Array<{ currency_code: number; price: number }>;
}

interface TableRowData {
  cc: string;
  regionName: string;
  localFormat: string;
  actualBase: number | null;
  recNuancedBase: number | null;
  recParityBase: number | null;
  recFxBase: number | null;
  actualLocalCents: number | null;
  recNuancedLocalCents: number | null;
  recParityLocalCents: number | null;
  recFxLocalCents: number | null;
}

interface LastTableState {
  data: TableRowData[];
  gameBasePriceBase: number | null;
  isUSD: boolean;
  baseCc: string;
  baseIso: string;
}

const REGIONS_RU: Record<string, RegionMeta> = {
  US: { name: 'Доллар США', code: 1, iso: 'usd' },
  DE: { name: 'Евро', code: 3, iso: 'eur' },
  AR: { name: 'Лат. Ам. - Доллар США', code: 1, iso: 'usd' },
  AU: { name: 'Австралийский доллар', code: 21, iso: 'aud' },
  BR: { name: 'Бразильский реал', code: 7, iso: 'brl' },
  GB: { name: 'Британский фунт', code: 2, iso: 'gbp' },
  CA: { name: 'Канадский доллар', code: 20, iso: 'cad' },
  CL: { name: 'Чилийское песо', code: 25, iso: 'clp' },
  CN: { name: 'Китайский юань', code: 23, iso: 'cny' },
  AZ: { name: 'СНГ - Доллар США', code: 1, iso: 'usd' },
  CO: { name: 'Колумбийское песо', code: 27, iso: 'cop' },
  CR: { name: 'Коста-риканский колон', code: 40, iso: 'crc' },
  HK: { name: 'Гонконгский доллар', code: 29, iso: 'hkd' },
  IN: { name: 'Индийская рупия', code: 24, iso: 'inr' },
  ID: { name: 'Индонезийская рупия', code: 10, iso: 'idr' },
  IL: { name: 'Израильский новый шекель', code: 35, iso: 'ils' },
  JP: { name: 'Японская иена', code: 8, iso: 'jpy' },
  KZ: { name: 'Казахстанский тенге', code: 37, iso: 'kzt' },
  KW: { name: 'Кувейтский динар', code: 38, iso: 'kwd' },
  MY: { name: 'Малазийский ринггит', code: 11, iso: 'myr' },
  MX: { name: 'Мексиканское песо', code: 19, iso: 'mxn' },
  NZ: { name: 'Новозеландский доллар', code: 22, iso: 'nzd' },
  NO: { name: 'Норвежская крона', code: 9, iso: 'nok' },
  PE: { name: 'Перуанский соль', code: 26, iso: 'pen' },
  PH: { name: 'Филиппинское песо', code: 12, iso: 'php' },
  PL: { name: 'Польский злотый', code: 6, iso: 'pln' },
  QA: { name: 'Катарский риал', code: 39, iso: 'qar' },
  RU: { name: 'Российский рубль', code: 5, iso: 'rub' },
  SA: { name: 'Саудовский риал', code: 31, iso: 'sar' },
  SG: { name: 'Сингапурский доллар', code: 13, iso: 'sgd' },
  ZA: { name: 'Южноафриканский рэнд', code: 28, iso: 'zar' },
  PK: { name: 'Юж. Азия - Доллар США', code: 1, iso: 'usd' },
  KR: { name: 'Южнокорейская вона', code: 16, iso: 'krw' },
  CH: { name: 'Швейцарский франк', code: 4, iso: 'chf' },
  TW: { name: 'Тайваньский доллар', code: 30, iso: 'twd' },
  TH: { name: 'Тайский бат', code: 14, iso: 'thb' },
  TR: { name: 'MENA - Доллар США', code: 1, iso: 'usd' },
  AE: { name: 'Дирхам ОАЭ', code: 32, iso: 'aed' },
  UA: { name: 'Украинская гривна', code: 18, iso: 'uah' },
  UY: { name: 'Уругвайское песо', code: 41, iso: 'uyu' },
  VN: { name: 'Вьетнамский донг', code: 15, iso: 'vnd' },
};

const REGIONS_EN: Record<string, RegionMeta> = {
  US: { name: 'United States Dollar', code: 1, iso: 'usd' },
  DE: { name: 'Euro', code: 3, iso: 'eur' },
  AR: { name: 'Latin America - USD', code: 1, iso: 'usd' },
  AU: { name: 'Australian Dollar', code: 21, iso: 'aud' },
  BR: { name: 'Brazilian Real', code: 7, iso: 'brl' },
  GB: { name: 'British Pound', code: 2, iso: 'gbp' },
  CA: { name: 'Canadian Dollar', code: 20, iso: 'cad' },
  CL: { name: 'Chilean Peso', code: 25, iso: 'clp' },
  CN: { name: 'Chinese Yuan Renminbi', code: 23, iso: 'cny' },
  AZ: { name: 'CIS - USD', code: 1, iso: 'usd' },
  CO: { name: 'Colombian Peso', code: 27, iso: 'cop' },
  CR: { name: 'Costa Rican Colon', code: 40, iso: 'crc' },
  HK: { name: 'Hong Kong Dollar', code: 29, iso: 'hkd' },
  IN: { name: 'Indian Rupee', code: 24, iso: 'inr' },
  ID: { name: 'Indonesian Rupiah', code: 10, iso: 'idr' },
  IL: { name: 'Israeli New Shekel', code: 35, iso: 'ils' },
  JP: { name: 'Japanese Yen', code: 8, iso: 'jpy' },
  KZ: { name: 'Kazakhstani Tenge', code: 37, iso: 'kzt' },
  KW: { name: 'Kuwaiti Dinar', code: 38, iso: 'kwd' },
  MY: { name: 'Malaysian Ringgit', code: 11, iso: 'myr' },
  MX: { name: 'Mexican Peso', code: 19, iso: 'mxn' },
  NZ: { name: 'New Zealand Dollar', code: 22, iso: 'nzd' },
  NO: { name: 'Norwegian Krone', code: 9, iso: 'nok' },
  PE: { name: 'Peruvian Sol', code: 26, iso: 'pen' },
  PH: { name: 'Philippine Peso', code: 12, iso: 'php' },
  PL: { name: 'Polish Zloty', code: 6, iso: 'pln' },
  QA: { name: 'Qatari Riyal', code: 39, iso: 'qar' },
  RU: { name: 'Russian Ruble', code: 5, iso: 'rub' },
  SA: { name: 'Saudi Riyal', code: 31, iso: 'sar' },
  SG: { name: 'Singapore Dollar', code: 13, iso: 'sgd' },
  ZA: { name: 'South African Rand', code: 28, iso: 'zar' },
  PK: { name: 'South Asia - USD', code: 1, iso: 'usd' },
  KR: { name: 'South Korean Won', code: 16, iso: 'krw' },
  CH: { name: 'Swiss Franc', code: 4, iso: 'chf' },
  TW: { name: 'New Taiwan Dollar', code: 30, iso: 'twd' },
  TH: { name: 'Thai Baht', code: 14, iso: 'thb' },
  TR: { name: 'MENA - USD', code: 1, iso: 'usd' },
  AE: { name: 'UAE Dirham', code: 32, iso: 'aed' },
  UA: { name: 'Ukrainian Hryvnia', code: 18, iso: 'uah' },
  UY: { name: 'Uruguayan Peso', code: 41, iso: 'uyu' },
  VN: { name: 'Vietnamese Dong', code: 15, iso: 'vnd' },
};

const RPA_REGIONS: RegionConfig[] = Object.entries(REGIONS_RU).map(([key, value]) => ({
  cc: key === 'EU' ? 'DE' : key,
  nameRU: value.name,
  nameEN: REGIONS_EN[key]?.name || value.name,
  steamCurrencyId: value.code,
  iso: value.iso,
}));

const STEAM_API_URL = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/';
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 300;

const MATRIX_CACHE_KEY = 'bsh_rpa_steam_pricing_matrix_v1';
const MATRIX_CACHE_TTL = 24 * 60 * 60 * 1000;
const RATES_CACHE_KEY = 'bsh_rpa_usd_rates_v1';
const RATES_CACHE_TTL = 6 * 60 * 60 * 1000;

const STEAM_CURRENCY_RULES: Record<number, CurrencyRule> = {
  1: { strSymbol: '$' },
  2: { strSymbol: '£' },
  3: { strSymbol: '€' },
  4: { strSymbol: 'CHF' },
  5: { strSymbol: 'руб.', bSuffixSymbol: true, bWholeUnitsOnly: true, bSpaceForSymbol: true, strDecimalSymbol: ',', strThousandsSeparator: ' ' },
  6: { strSymbol: 'zł', bSuffixSymbol: true, strDecimalSymbol: ',', strThousandsSeparator: ' ' },
  7: { strSymbol: 'R$', bSpaceForSymbol: true, strDecimalSymbol: ',', strThousandsSeparator: '.' },
  8: { strSymbol: '¥', bWholeUnitsOnly: true, bSpaceForSymbol: true },
  9: { strSymbol: 'kr', bSuffixSymbol: true, bSpaceForSymbol: true, strDecimalSymbol: ',', strThousandsSeparator: '.' },
  10: { strSymbol: 'Rp', bWholeUnitsOnly: true, bSpaceForSymbol: true, strDecimalSymbol: '.', strThousandsSeparator: ' ' },
  11: { strSymbol: 'RM' },
  12: { strSymbol: 'P' },
  13: { strSymbol: 'S$' },
  14: { strSymbol: '฿' },
  15: { strSymbol: '₫', bWholeUnitsOnly: true, bSuffixSymbol: true, strDecimalSymbol: ',', strThousandsSeparator: '.' },
  16: { strSymbol: '₩', bWholeUnitsOnly: true, bSpaceForSymbol: true },
  17: { strSymbol: 'TL', bSuffixSymbol: true, bSpaceForSymbol: true, strDecimalSymbol: ',', strThousandsSeparator: '.' },
  18: { strSymbol: '₴', bSuffixSymbol: true, bWholeUnitsOnly: true, strDecimalSymbol: ',', strThousandsSeparator: ' ' },
  19: { strSymbol: 'Mex$', bSpaceForSymbol: true },
  20: { strSymbol: 'CDN$', bSpaceForSymbol: true },
  21: { strSymbol: 'A$', bSpaceForSymbol: true },
  22: { strSymbol: 'NZ$', bSpaceForSymbol: true },
  23: { strSymbol: '¥', bSpaceForSymbol: true },
  24: { strSymbol: '₹', bSpaceForSymbol: true, bWholeUnitsOnly: true },
  25: { strSymbol: 'CLP$', bSpaceForSymbol: true, bWholeUnitsOnly: true, strDecimalSymbol: ',', strThousandsSeparator: '.' },
  26: { strSymbol: 'S/.' },
  27: { strSymbol: 'COL$', bSpaceForSymbol: true, bWholeUnitsOnly: true, strDecimalSymbol: ',', strThousandsSeparator: '.' },
  28: { strSymbol: 'R', bSpaceForSymbol: true, strDecimalSymbol: '.', strThousandsSeparator: ' ' },
  29: { strSymbol: 'HK$', bSpaceForSymbol: true },
  30: { strSymbol: 'NT$', bWholeUnitsOnly: true, bSpaceForSymbol: true },
  31: { strSymbol: 'SR', bSuffixSymbol: true, bSpaceForSymbol: true },
  32: { strSymbol: 'AED', bSuffixSymbol: true, bSpaceForSymbol: true },
  33: { strSymbol: 'kr', bSpaceForSymbol: true, bSuffixSymbol: true },
  34: { strSymbol: 'ARS$', bSpaceForSymbol: true, strDecimalSymbol: ',', strThousandsSeparator: '.' },
  35: { strSymbol: '₪' },
  36: { strSymbol: 'Br' },
  37: { strSymbol: '₸', bSuffixSymbol: true, bWholeUnitsOnly: true, strDecimalSymbol: ',', strThousandsSeparator: ' ' },
  38: { strSymbol: 'KD', bSuffixSymbol: true, bSpaceForSymbol: true },
  39: { strSymbol: 'QR', bSuffixSymbol: true, bSpaceForSymbol: true },
  40: { strSymbol: '₡', bWholeUnitsOnly: true, strDecimalSymbol: ',', strThousandsSeparator: '.' },
  41: { strSymbol: '$U', bWholeUnitsOnly: true, strDecimalSymbol: ',', strThousandsSeparator: '.' },
  42: { strSymbol: 'лв', bSuffixSymbol: true, bSpaceForSymbol: true },
  43: { strSymbol: 'kn', bSuffixSymbol: true, bSpaceForSymbol: true },
  44: { strSymbol: 'Kč', bSuffixSymbol: true, bSpaceForSymbol: true },
  45: { strSymbol: 'kr.', bSuffixSymbol: true, bSpaceForSymbol: true },
  46: { strSymbol: 'Ft', bSuffixSymbol: true, bSpaceForSymbol: true },
  47: { strSymbol: 'lei', bSuffixSymbol: true, bSpaceForSymbol: true },
};

const RPA_CSS = `
  @keyframes rpa_spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .rpa_spinner {
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #fff;
    width: 0.9em;
    height: 0.9em;
    animation: rpa_spin 1s linear infinite;
    display: inline-block;
    vertical-align: middle;
    margin-left: 8px;
  }
  #rpaLeftSidebar::-webkit-scrollbar { width: 6px; }
  #rpaLeftSidebar::-webkit-scrollbar-track { background: #1e2c3a; border-radius: 3px; }
  #rpaLeftSidebar::-webkit-scrollbar-thumb { background-color: #4b6f9c; border-radius: 3px; }
  #rpaLeftSidebar h4 {
    color: #67c1f5;
    font-size: 15px;
    margin-top: 0;
    margin-bottom: 10px;
    border-bottom: 1px solid #2a3f5a;
    padding-bottom: 6px;
  }
  #rpaLeftSidebar .summary-item { margin-bottom: 12px; }
  #rpaLeftSidebar .summary-label {
    display: block;
    font-weight: 700;
    color: #67c1f5;
    margin-bottom: 3px;
    font-size: 13px;
  }
  #rpaLeftSidebar .summary-value { display: block; color: #e5e5e5; font-size: 14px; }
  #rpaLeftSidebar .summary-sub-value { display: block; font-size: 11px; margin-top: 2px; opacity: 0.9; }

  #rpaResultsArea::-webkit-scrollbar { width: 8px; height: 8px; }
  #rpaResultsArea::-webkit-scrollbar-track { background: #1e2c3a; border-radius: 4px; }
  #rpaResultsArea::-webkit-scrollbar-thumb {
    background-color: #4b6f9c;
    border-radius: 4px;
    border: 2px solid #1e2c3a;
  }
  #rpaResultsArea::-webkit-scrollbar-thumb:hover { background-color: #67c1f5; }

  .rpaTable {
    width: auto;
    min-width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    white-space: nowrap;
    background-color: #1e2c3a;
    border-radius: 3px;
  }
  .rpaTable th, .rpaTable td {
    border: 1px solid #2a3f5a;
    padding: 6px 8px;
    text-align: right;
  }
  .rpaTable th {
    background-color: #23313f;
    color: #a0b1c3;
    font-weight: 500;
    position: sticky;
    top: 0;
    z-index: 1;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.15s ease, color 0.15s ease;
  }
  .rpaTable th:hover { background-color: #2a3f5a; color: #fff; }
  .rpaTable tbody tr:hover td { background-color: rgba(103, 193, 245, 0.08); }
  .rpaTable th.col-region, .rpaTable td.col-region { text-align: left; }
  .rpaTable td.positive { color: lightgreen; }
  .rpaTable td.negative { color: salmon; }
  .rpaTable td.neutral { color: #c6d4df; }
  .rpaTable tr.highlight-base td {
    background-color: rgba(103, 193, 245, 0.17) !important;
    font-weight: 700;
  }
`;

function formatSteamPrice(priceInCents: number, currencyCode: number): string {
  const defaultRules: CurrencyRule = {
    strSymbol: '',
    bSuffixSymbol: false,
    bSpaceForSymbol: false,
    bWholeUnitsOnly: false,
    strDecimalSymbol: '.',
    strThousandsSeparator: ',',
  };
  const rules: CurrencyRule = { ...defaultRules, ...(STEAM_CURRENCY_RULES[currencyCode] || {}) };
  let price = Math.round(priceInCents);
  const isNegative = price < 0;
  if (isNegative) price = -price;

  const dropDecimals = Boolean(rules.bWholeUnitsOnly && price % 100 === 0);
  const parts: Array<string | number> = [];

  for (let i = 0; i < 2; i++) {
    if (!dropDecimals) parts.push(price % 10);
    price = Math.floor(price / 10);
  }
  if (!dropDecimals && rules.strDecimalSymbol) {
    parts.push(rules.strDecimalSymbol);
  }

  let digitCount = 0;
  do {
    if (digitCount > 0 && digitCount % 3 === 0 && rules.strThousandsSeparator) {
      parts.push(rules.strThousandsSeparator);
    }
    parts.push(price % 10);
    price = Math.floor(price / 10);
    digitCount++;
  } while (price > 0);

  const formattedNumber = parts.reverse().join('');
  const space = rules.bSpaceForSymbol ? ' ' : '';
  const minus = isNegative ? '-' : '';
  return rules.bSuffixSymbol
    ? `${minus}${formattedNumber}${space}${rules.strSymbol}`
    : `${minus}${rules.strSymbol}${space}${formattedNumber}`;
}

let memoryPricingMatrix: MatrixRow[] | null = null;
let memoryUsdRates: Record<string, number> | null = null;

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
}

async function fetchExchangeRates(signal?: AbortSignal): Promise<Record<string, number> | null> {
  checkAborted(signal);
  if (memoryUsdRates) return memoryUsdRates;

  const cached = await idbGet<{ timestamp: number; rates: Record<string, number> }>(RATES_CACHE_KEY);
  if (cached && cached.rates && Date.now() - cached.timestamp < RATES_CACHE_TTL) {
    memoryUsdRates = cached.rates;
    return cached.rates;
  }

  const res = await fetchViaBackend(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
  );
  checkAborted(signal);

  if (res.ok && res.body) {
    const json = JSON.parse(res.body);
    if (json?.usd && typeof json.usd === 'object') {
      memoryUsdRates = json.usd;
      await idbSet(RATES_CACHE_KEY, { timestamp: Date.now(), rates: json.usd });
      return json.usd;
    }
  }
  return cached?.rates || null;
}

async function fetchSteamPricingMatrix(signal?: AbortSignal): Promise<MatrixRow[]> {
  checkAborted(signal);
  if (memoryPricingMatrix) return memoryPricingMatrix;

  const cached = await idbGet<{ timestamp: number; data: MatrixRow[] }>(MATRIX_CACHE_KEY);
  if (cached && Array.isArray(cached.data) && cached.data.length > 0 && Date.now() - cached.timestamp < MATRIX_CACHE_TTL) {
    memoryPricingMatrix = cached.data;
    return cached.data;
  }

  const res = await fetchViaBackend('https://partner.steamgames.com/pricing/explorer', {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    Referer: 'https://partner.steamgames.com/',
  });
  checkAborted(signal);

  if (!res.ok || !res.body) {
    if (cached?.data?.length) return cached.data;
    throw new Error(`Сетевая ошибка матрицы Steam (HTTP ${res.status})`);
  }

  let searchStr = res.body;
  for (let i = 0; i < 3; i++) {
    searchStr = searchStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  let offset = 0;
  while (true) {
    const startIdx = searchStr.indexOf('"data":[', offset);
    if (startIdx === -1) break;
    const arrayStart = startIdx + 7;
    let openBrackets = 0;
    let endIdx = -1;
    let inString = false;

    for (let i = arrayStart; i < searchStr.length; i++) {
      const ch = searchStr[i];
      if (ch === '"' && searchStr[i - 1] !== '\\') inString = !inString;
      if (!inString) {
        if (ch === '[') openBrackets++;
        else if (ch === ']') {
          openBrackets--;
          if (openBrackets === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      const jsonArrayStr = searchStr.substring(arrayStart, endIdx + 1);
      try {
        const arr = JSON.parse(jsonArrayStr);
        if (Array.isArray(arr) && arr.length > 0 && arr[0].usd_price !== undefined && arr[0].convert_method !== undefined) {
          memoryPricingMatrix = arr;
          await idbSet(MATRIX_CACHE_KEY, { timestamp: Date.now(), data: arr });
          return arr;
        }
      } catch {}
    }
    offset = startIdx + 8;
  }

  if (cached?.data?.length) return cached.data;
  throw new Error('Не удалось извлечь матрицу цен из кода Steam.');
}

function getRecommendedPriceCentsFromMatrix(
  matrix: MatrixRow[],
  baseUsdCents: number,
  currencyCode: number,
  convertMethod: number
): number | null {
  if (currencyCode === 1 && (convertMethod === 1 || convertMethod === 2 || convertMethod === 3)) {
    return baseUsdCents;
  }

  const filtered = matrix.filter((m) => m.convert_method === convertMethod);
  if (!filtered.length) return null;

  let closestRow = filtered[0];
  let minDiff = Math.abs((filtered[0].usd_price || 0) - baseUsdCents);

  for (const row of filtered) {
    const diff = Math.abs((row.usd_price || 0) - baseUsdCents);
    if (diff < minDiff) {
      minDiff = diff;
      closestRow = row;
    }
  }

  const cp = closestRow?.currency_prices?.find((c) => c.currency_code === currencyCode);
  return cp ? cp.price : null;
}

function getAppIdFromUrl(): string | null {
  const match = window.location.pathname.match(/\/app\/(\d+)/);
  return match ? match[1] : null;
}

function getPriceInCents(purchaseOption: any): number | null {
  if (purchaseOption?.discount_pct > 0 && purchaseOption?.original_price_in_cents) {
    return parseInt(String(purchaseOption.original_price_in_cents), 10);
  }
  if (purchaseOption?.final_price_in_cents) {
    return parseInt(String(purchaseOption.final_price_in_cents), 10);
  }
  return null;
}

function getDisplayFormattedPrice(purchaseOption: any): string {
  if (purchaseOption) {
    if (purchaseOption.discount_pct > 0 && purchaseOption.formatted_original_price) {
      return String(purchaseOption.formatted_original_price);
    }
    if (purchaseOption.formatted_final_price) {
      return String(purchaseOption.formatted_final_price);
    }
  }
  return 'N/A';
}

async function fetchItemData(appid: string, countryCode: string, signal?: AbortSignal): Promise<any | null> {
  checkAborted(signal);
  const lang = localStorage.getItem('rpa_base_currency') === 'US' ? 'english' : 'russian';
  const inputJson = JSON.stringify({
    ids: [{ appid: parseInt(appid, 10) }],
    context: { country_code: countryCode, steam_realm: 1, language: lang },
    data_request: { include_all_purchase_options: true, include_basic_info: true },
  });
  const url = `${STEAM_API_URL}?input_json=${encodeURIComponent(inputJson)}`;

  const res = await fetchViaBackend(url);
  checkAborted(signal);

  if (!res.ok || !res.body) {
    throw new Error(`Steam API error: ${res.status} for ${countryCode}`);
  }
  const data = JSON.parse(res.body);
  if (data?.response?.store_items?.length > 0) {
    return data.response.store_items[0];
  }
  return null;
}

function calcDiff(actual: number | null, compare: number | null): number | null {
  if (actual === null || compare === null || compare === 0) return null;
  return ((actual - compare) / compare) * 100;
}

export function initStorePriceAnalyzerModule(cfg: StoreWebkitConfig): void {
  if (!cfg.priceAnalyzer) return;
  if (!window.location.pathname.includes('/app/')) return;

  injectStyleOnce('bsh-rpa-styles', RPA_CSS);

  let modal: HTMLDivElement | null = null;
  let currentAppId: string | null = null;
  let progressBarFill: HTMLDivElement | null = null;
  let fetchController: AbortController | null = null;
  let lastTableState: LastTableState | null = null;
  let currentSort = { col: 'actualBase', asc: true };

  const getCurrencySelect = () => document.getElementById('rpaCurrencySelect') as HTMLSelectElement | null;
  const getFetchBtn = () => document.getElementById('rpaFetchDataButton') as HTMLButtonElement | null;

  const updateProgressBar = (percentage: number) => {
    if (progressBarFill) {
      progressBarFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
    const progressBarContainer = document.getElementById('rpaProgressBarContainer');
    if (progressBarContainer) {
      progressBarContainer.style.display = percentage > 0 && percentage < 100 ? 'flex' : 'none';
    }
  };

  const updateModalStatus = (message: string, isLoading = false) => {
    const statusDiv = document.getElementById('rpaStatusDiv');
    const fetchBtn = getFetchBtn();
    if (statusDiv) {
      statusDiv.innerHTML = isLoading ? `${message} <span class="rpa_spinner"></span>` : message;
    }
    if (fetchBtn) fetchBtn.disabled = isLoading;
  };

  const updateLanguage = () => {
    const baseVal = getCurrencySelect()?.value || localStorage.getItem('rpa_base_currency') || 'RU';
    const isUSD = baseVal === 'US';

    const priorBtn = document.getElementById('rpaPriorButton');
    if (priorBtn) priorBtn.textContent = isUSD ? 'Price Analyzer' : 'Анализатор цен';

    const modalTitle = document.getElementById('rpaModalTitle');
    if (modalTitle) modalTitle.textContent = isUSD ? 'Regional Price Analyzer' : 'Анализатор цен Steam';

    const fetchBtn = getFetchBtn();
    if (fetchBtn) fetchBtn.textContent = isUSD ? 'Fetch Data' : 'Сбор данных';

    const summaryDiv = document.getElementById('rpaSummaryDiv');
    if (summaryDiv) {
      summaryDiv.innerHTML = isUSD
        ? '<p>Click "Fetch Data" to begin.</p>'
        : '<p>Нажмите «Сбор данных» для начала.</p>';
    }

    const resultsDiv = document.getElementById('rpaResultsDiv');
    if (resultsDiv) resultsDiv.innerHTML = '';

    updateModalStatus(isUSD ? 'Ready.' : 'Готов.');
  };

  const closeModal = () => {
    if (fetchController) {
      fetchController.abort();
      fetchController = null;
    }
    if (modal) modal.style.display = 'none';
    updateProgressBar(0);
  };

  const renderTable = () => {
    if (!lastTableState) return;
    const { data, gameBasePriceBase, isUSD, baseCc, baseIso } = lastTableState;
    const container = document.getElementById('rpaResultsDiv');
    if (!container) return;
    container.innerHTML = '';

    const { col: sortCol, asc: sortAsc } = currentSort;

    data.sort((a, b) => {
      let valA: string | number | null = null;
      let valB: string | number | null = null;

      if (sortCol === 'region') {
        valA = a.regionName;
        valB = b.regionName;
      } else if (sortCol === 'actualBase') {
        valA = a.actualBase;
        valB = b.actualBase;
      } else if (sortCol === 'diffBase') {
        valA = calcDiff(a.actualBase, gameBasePriceBase);
        valB = calcDiff(b.actualBase, gameBasePriceBase);
      } else if (sortCol === 'recN') {
        valA = a.recNuancedBase;
        valB = b.recNuancedBase;
      } else if (sortCol === 'diffN') {
        valA = calcDiff(a.actualLocalCents, a.recNuancedLocalCents);
        valB = calcDiff(b.actualLocalCents, b.recNuancedLocalCents);
      } else if (sortCol === 'recP') {
        valA = a.recParityBase;
        valB = b.recParityBase;
      } else if (sortCol === 'diffP') {
        valA = calcDiff(a.actualLocalCents, a.recParityLocalCents);
        valB = calcDiff(b.actualLocalCents, b.recParityLocalCents);
      } else if (sortCol === 'recF') {
        valA = a.recFxBase;
        valB = b.recFxBase;
      } else if (sortCol === 'diffF') {
        valA = calcDiff(a.actualLocalCents, a.recFxLocalCents);
        valB = calcDiff(b.actualLocalCents, b.recFxLocalCents);
      }

      if (valA === null) return 1;
      if (valB === null) return -1;
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    const table = document.createElement('table');
    table.className = 'rpaTable';
    const thead = table.createTHead();
    const hr = thead.insertRow();

    const headers = isUSD
      ? [
          { id: 'rank', t: '#' },
          { id: 'region', t: 'Region (CC)' },
          { id: 'local', t: 'Local Price' },
          { id: 'actualBase', t: 'Price (USD)' },
          { id: 'diffBase', t: 'Diff vs US (%)' },
          { id: 'recN', t: 'Nuanced (USD)' },
          { id: 'diffN', t: 'Diff N. (%)' },
          { id: 'recP', t: 'Parity (USD)' },
          { id: 'diffP', t: 'Diff P. (%)' },
          { id: 'recF', t: 'FX (USD)' },
          { id: 'diffF', t: 'Diff FX (%)' },
        ]
      : [
          { id: 'rank', t: '№' },
          { id: 'region', t: 'Регион (Код)' },
          { id: 'local', t: 'Цена (Лок)' },
          { id: 'actualBase', t: `Цена (${baseIso})` },
          { id: 'diffBase', t: `Разница с ${baseIso} (%)` },
          { id: 'recN', t: `Valve (${baseIso})` },
          { id: 'diffN', t: 'Разница Valve (%)' },
          { id: 'recP', t: `ППС (${baseIso})` },
          { id: 'diffP', t: 'Разница ППС (%)' },
          { id: 'recF', t: `Курс (${baseIso})` },
          { id: 'diffF', t: 'Разница Курс (%)' },
        ];

    headers.forEach((h) => {
      const th = document.createElement('th');
      th.textContent = h.t + (currentSort.col === h.id ? (currentSort.asc ? ' ▲' : ' ▼') : '');
      if (h.id === 'region') th.className = 'col-region';
      th.onclick = () => {
        if (h.id === 'rank' || h.id === 'local') return;
        if (currentSort.col === h.id) currentSort.asc = !currentSort.asc;
        else {
          currentSort.col = h.id;
          currentSort.asc = true;
        }
        renderTable();
      };
      hr.appendChild(th);
    });

    const formatBase = (val: number | null) =>
      val !== null ? (isUSD ? `$${val.toFixed(2)}` : `${val.toFixed(2)} ${baseIso}`) : 'N/A';

    const formatDiff = (actual: number | null, compare: number | null, isSelf: boolean) => {
      if (isSelf) return { t: isUSD ? 'Base' : '-', c: 'neutral' };
      const diff = calcDiff(actual, compare);
      if (diff === null) return { t: 'N/A', c: 'neutral' };
      return {
        t: `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`,
        c: diff < -0.1 ? 'positive' : diff > 0.1 ? 'negative' : 'neutral',
      };
    };

    const tbody = table.createTBody();
    data.forEach((rp, i) => {
      const tr = tbody.insertRow();
      if (rp.cc === baseCc) tr.classList.add('highlight-base');

      tr.insertCell().textContent = String(i + 1);
      const tdReg = tr.insertCell();
      tdReg.textContent = `${rp.regionName} (${rp.cc})`;
      tdReg.className = 'col-region';

      tr.insertCell().textContent = rp.localFormat;
      tr.insertCell().textContent = formatBase(rp.actualBase);

      const dBase = formatDiff(rp.actualBase, gameBasePriceBase, rp.cc === baseCc);
      const tdBase = tr.insertCell();
      tdBase.textContent = dBase.t;
      tdBase.className = dBase.c;

      tr.insertCell().textContent = formatBase(rp.recNuancedBase);
      const dN = formatDiff(rp.actualLocalCents, rp.recNuancedLocalCents, false);
      const tdN = tr.insertCell();
      tdN.textContent = dN.t;
      tdN.className = dN.c;

      tr.insertCell().textContent = formatBase(rp.recParityBase);
      const dP = formatDiff(rp.actualLocalCents, rp.recParityLocalCents, false);
      const tdP = tr.insertCell();
      tdP.textContent = dP.t;
      tdP.className = dP.c;

      tr.insertCell().textContent = formatBase(rp.recFxBase);
      const dF = formatDiff(rp.actualLocalCents, rp.recFxLocalCents, false);
      const tdF = tr.insertCell();
      tdF.textContent = dF.t;
      tdF.className = dF.c;
    });

    container.appendChild(table);
  };

  const handleFetchData = async () => {
    if (!currentAppId) return;
    if (fetchController) fetchController.abort();
    fetchController = new AbortController();
    const signal = fetchController.signal;

    const baseCc = getCurrencySelect()?.value || 'RU';
    const isUSD = baseCc === 'US';
    const baseRegionConfig = RPA_REGIONS.find((r) => r.cc === baseCc) || RPA_REGIONS[0];
    const baseIso = baseRegionConfig.iso.toUpperCase();

    updateProgressBar(0);
    updateModalStatus(isUSD ? 'Initializing...' : 'Инициализация...', true);

    const summaryDiv = document.getElementById('rpaSummaryDiv');
    const resultsDiv = document.getElementById('rpaResultsDiv');
    if (summaryDiv) summaryDiv.innerHTML = `<h4>${isUSD ? 'Summary:' : 'Сводная информация:'}</h4>`;
    if (resultsDiv) resultsDiv.innerHTML = '';

    let pricingMatrix: MatrixRow[];
    try {
      updateModalStatus(isUSD ? 'Fetching Steam Matrices...' : 'Получение матрицы цен Steam...', true);
      pricingMatrix = await fetchSteamPricingMatrix(signal);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        updateModalStatus((isUSD ? 'Matrix Error: ' : 'Ошибка матрицы: ') + (e?.message || String(e)), false);
      }
      return;
    }

    updateProgressBar(5);

    let usData: any;
    try {
      updateModalStatus(isUSD ? 'Fetching Base US Price...' : 'Запрос базовой цены (США)...', true);
      usData = await fetchItemData(currentAppId, 'US', signal);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        updateModalStatus(
          (isUSD ? 'Error fetching US price: ' : 'Ошибка при запросе цены для США: ') + (e?.message || String(e)),
          false
        );
      }
      updateProgressBar(0);
      return;
    }

    if (!usData?.best_purchase_option?.final_price_in_cents) {
      updateModalStatus(
        isUSD
          ? 'Game is free or unavailable in US.'
          : 'Игра бесплатна или недоступна в США (Анализ невозможен).',
        false
      );
      updateProgressBar(0);
      return;
    }

    const baseUsdCents = getPriceInCents(usData.best_purchase_option);
    if (baseUsdCents === null) {
      updateModalStatus(isUSD ? 'Cannot determine US price.' : 'Не удалось определить цену в США.', false);
      updateProgressBar(0);
      return;
    }
    const gameUsdPriceNum = baseUsdCents / 100;

    let baseRegionData = usData;
    if (!isUSD) {
      try {
        updateModalStatus(`Запрос фактической цены (${baseCc})...`, true);
        baseRegionData = await fetchItemData(currentAppId, baseCc, signal);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          updateModalStatus(`Ошибка при запросе базовой цены: ${e?.message || String(e)}`, false);
        }
        updateProgressBar(0);
        return;
      }
    }

    let gameBaseActualCents: number | null = null;
    if (baseRegionData?.best_purchase_option?.final_price_in_cents) {
      gameBaseActualCents = getPriceInCents(baseRegionData.best_purchase_option);
    }

    if (summaryDiv) {
      const labelBaseUsd = isUSD ? 'Base US Price (for calculation):' : 'Базовая цена в США (для расчета):';
      summaryDiv.innerHTML += `<div class="summary-item"><span class="summary-label">${labelBaseUsd}</span><span class="summary-value">$${gameUsdPriceNum.toFixed(2)}</span></div>`;

      if (!isUSD && gameBaseActualCents !== null) {
        const actualBaseNum = gameBaseActualCents / 100;
        const recNuancedCents = getRecommendedPriceCentsFromMatrix(
          pricingMatrix,
          baseUsdCents,
          baseRegionConfig.steamCurrencyId,
          1
        );
        const regionNameLabel = baseCc === 'RU' ? 'в РФ' : `(${baseCc})`;

        if (recNuancedCents !== null) {
          const recNuancedNum = recNuancedCents / 100;
          const diff = actualBaseNum - recNuancedNum;
          const diffPercent = recNuancedNum !== 0 ? (diff / recNuancedNum) * 100 : 0;
          let subValueStr = '(соответствует рекомендуемой)';
          let subValueColor = '#c6d4df';

          const diffFormatted = formatSteamPrice(Math.round(Math.abs(diff) * 100), baseRegionConfig.steamCurrencyId);
          if (diff < -0.01) {
            subValueColor = 'lightgreen';
            subValueStr = `(на ${diffFormatted} / ${Math.abs(diffPercent).toFixed(1)}% ДЕШЕВЛЕ рекомендуемой)`;
          } else if (diff > 0.01) {
            subValueColor = 'salmon';
            subValueStr = `(на ${diffFormatted} / ${diffPercent.toFixed(1)}% ДОРОЖЕ рекомендуемой)`;
          }

          summaryDiv.innerHTML += `<div class="summary-item"><span class="summary-label">Рекомендуемая цена Steam ${regionNameLabel}:</span><span class="summary-value">${formatSteamPrice(recNuancedCents, baseRegionConfig.steamCurrencyId)}</span></div>`;
          summaryDiv.innerHTML += `<div class="summary-item"><span class="summary-label">Фактическая цена ${regionNameLabel}:</span><span class="summary-value">${formatSteamPrice(gameBaseActualCents, baseRegionConfig.steamCurrencyId)}<br><span class="summary-sub-value" style="color:${subValueColor};">${subValueStr}</span></span></div>`;
        } else {
          summaryDiv.innerHTML += `<div class="summary-item"><span class="summary-label">Рекомендуемая цена Steam ${regionNameLabel}:</span><span class="summary-value">Не найдена в матрице</span></div>`;
        }
      }
    }

    updateModalStatus(isUSD ? 'Fetching Exchange Rates...' : 'Запрос курсов валют...', true);
    let usdRates: Record<string, number> | null = null;
    try {
      usdRates = await fetchExchangeRates(signal);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
    }

    const totalRegions = RPA_REGIONS.length;
    let processedCount = 0;
    const rawTableData: TableRowData[] = [];

    for (let i = 0; i < totalRegions; i += BATCH_SIZE) {
      if (signal.aborted) return;
      const batch = RPA_REGIONS.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      updateModalStatus(
        isUSD ? `Processing batch ${batchNum}...` : `Сбор цен: группа ${batchNum}...`,
        true
      );

      const batchResults = await Promise.allSettled(
        batch.map((region) =>
          fetchItemData(currentAppId!, region.cc, signal)
            .then((data) => ({ region, data }))
            .catch(() => ({ region, data: null }))
        )
      );
      if (signal.aborted) return;

      for (const result of batchResults) {
        processedCount++;
        updateProgressBar(5 + Math.round((processedCount / totalRegions) * 85));

        if (result.status !== 'fulfilled' || !result.value.data?.best_purchase_option) continue;
        const { region, data: regionData } = result.value;
        const purchaseOption = regionData.best_purchase_option;
        const priceInCents = getPriceInCents(purchaseOption);
        const displayFormattedPrice = getDisplayFormattedPrice(purchaseOption);

        if (priceInCents === null || priceInCents < 0) continue;

        const localPriceNum = priceInCents / 100;
        const recNuancedCents = getRecommendedPriceCentsFromMatrix(
          pricingMatrix,
          baseUsdCents,
          region.steamCurrencyId,
          1
        );
        const recParityCents = getRecommendedPriceCentsFromMatrix(
          pricingMatrix,
          baseUsdCents,
          region.steamCurrencyId,
          2
        );
        const recFxCents = getRecommendedPriceCentsFromMatrix(
          pricingMatrix,
          baseUsdCents,
          region.steamCurrencyId,
          3
        );

        let priceInBase: number | null = null;
        let recNuancedBase: number | null = null;
        let recParityBase: number | null = null;
        let recFxBase: number | null = null;

        const regionIso = region.iso.toLowerCase();
        const baseIsoLower = baseIso.toLowerCase();

        if (usdRates) {
          const toUsd = (amount: number | null) => {
            if (amount === null) return null;
            if (regionIso === 'usd') return amount;
            return usdRates![regionIso] ? amount / usdRates![regionIso] : null;
          };

          const priceInUsd = toUsd(localPriceNum);
          const rNUsd = toUsd(recNuancedCents !== null ? recNuancedCents / 100 : null);
          const rPUsd = toUsd(recParityCents !== null ? recParityCents / 100 : null);
          const rFUsd = toUsd(recFxCents !== null ? recFxCents / 100 : null);

          if (baseIsoLower === 'usd') {
            priceInBase = priceInUsd;
            recNuancedBase = rNUsd;
            recParityBase = rPUsd;
            recFxBase = rFUsd;
          } else {
            const rateBase = usdRates[baseIsoLower];
            if (rateBase) {
              if (priceInUsd !== null) priceInBase = priceInUsd * rateBase;
              if (rNUsd !== null) recNuancedBase = rNUsd * rateBase;
              if (rPUsd !== null) recParityBase = rPUsd * rateBase;
              if (rFUsd !== null) recFxBase = rFUsd * rateBase;
            }
          }
        }

        rawTableData.push({
          cc: region.cc,
          regionName: isUSD ? region.nameEN : region.nameRU,
          localFormat: displayFormattedPrice,
          actualBase: priceInBase,
          recNuancedBase,
          recParityBase,
          recFxBase,
          actualLocalCents: priceInCents,
          recNuancedLocalCents: recNuancedCents,
          recParityLocalCents: recParityCents,
          recFxLocalCents: recFxCents,
        });
      }

      if (i + BATCH_SIZE < totalRegions && !signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    updateProgressBar(98);

    if (rawTableData.length > 0) {
      rawTableData.sort((a, b) => (a.actualBase ?? Number.MAX_VALUE) - (b.actualBase ?? Number.MAX_VALUE));
      const baseRowIndex = rawTableData.findIndex((r) => r.cc === baseCc);
      const gameBasePriceBase = baseRowIndex !== -1 ? rawTableData[baseRowIndex].actualBase : null;

      if (summaryDiv) {
        if (!isUSD && baseRowIndex !== -1) {
          const placeLabel = baseCc === 'RU' ? 'РФ' : baseIso;
          summaryDiv.innerHTML += `<div class="summary-item"><span class="summary-label">Место ${placeLabel} в мировом рейтинге цен:</span><span class="summary-value">${baseRowIndex + 1} из ${rawTableData.length}</span></div>`;
        } else if (isUSD) {
          const cheapest = rawTableData[0];
          const mostExp = rawTableData[rawTableData.length - 1];
          if (cheapest.actualBase !== null) {
            summaryDiv.innerHTML += `<div class="summary-item"><span class="summary-label">Cheapest (USD):</span><span class="summary-value">$${cheapest.actualBase.toFixed(2)} (${cheapest.regionName})</span></div>`;
          }
          if (mostExp.actualBase !== null) {
            summaryDiv.innerHTML += `<div class="summary-item"><span class="summary-label">Most Expensive (USD):</span><span class="summary-value">$${mostExp.actualBase.toFixed(2)} (${mostExp.regionName})</span></div>`;
          }
          if (baseRowIndex !== -1) {
            summaryDiv.innerHTML += `<div class="summary-item"><span class="summary-label">US Price Rank:</span><span class="summary-value">${baseRowIndex + 1} of ${rawTableData.length}</span></div>`;
          }
        }
      }

      lastTableState = { data: rawTableData, gameBasePriceBase, isUSD, baseCc, baseIso };
      currentSort = { col: 'actualBase', asc: true };
      renderTable();
    } else if (resultsDiv) {
      resultsDiv.innerHTML = `<p style="text-align:center; margin-top:20px; color: #8f98a0;">${
        isUSD ? 'Data unavailable.' : 'Не удалось получить цены.'
      }</p>`;
    }

    updateModalStatus(isUSD ? 'Analysis complete.' : 'Анализ завершён.', false);
    updateProgressBar(100);
    setTimeout(() => updateProgressBar(0), 2000);
    fetchController = null;
  };

  const createModal = () => {
    if (document.getElementById('rpaRegionalPriceModal')) {
      modal = document.getElementById('rpaRegionalPriceModal') as HTMLDivElement;
      return;
    }

    modal = document.createElement('div');
    modal.id = 'rpaRegionalPriceModal';
    Object.assign(modal.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(21, 33, 45, 0.985)',
      color: '#c6d4df',
      zIndex: '100001',
      display: 'none',
      flexDirection: 'column',
      fontFamily: '"Motiva Sans", Sans-serif, Arial',
      padding: '0',
    });

    const headerBar = document.createElement('div');
    headerBar.id = 'rpaHeaderBar';
    Object.assign(headerBar.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 20px',
      backgroundColor: '#17202d',
      borderBottom: '1px solid #2a3f5a',
      flexShrink: '0',
    });

    const title = document.createElement('h3');
    title.id = 'rpaModalTitle';
    title.textContent = 'Анализатор цен Steam';
    Object.assign(title.style, { margin: '0', color: '#67c1f5', fontSize: '18px', fontWeight: '500' });

    const gameNameDisplay = document.createElement('p');
    gameNameDisplay.id = 'rpaGameNameDisplay';
    Object.assign(gameNameDisplay.style, {
      margin: '0 0 0 20px',
      fontSize: '16px',
      color: '#e5e5e5',
      fontWeight: 'bold',
      flexGrow: '1',
      textAlign: 'center',
    });

    const rightControls = document.createElement('div');
    rightControls.style.display = 'flex';
    rightControls.style.alignItems = 'center';

    const currencySelect = document.createElement('select');
    currencySelect.id = 'rpaCurrencySelect';
    Object.assign(currencySelect.style, {
      background: '#1a2430',
      color: '#67c1f5',
      border: '1px solid #2a3f5a',
      borderRadius: '3px',
      padding: '4px 8px',
      marginRight: '15px',
      fontSize: '13px',
      outline: 'none',
      cursor: 'pointer',
    });

    Object.entries(REGIONS_RU).forEach(([cc, data]) => {
      const opt = document.createElement('option');
      opt.value = cc;
      opt.textContent = `База: ${data.name} (${data.iso.toUpperCase()})`;
      currencySelect.appendChild(opt);
    });
    currencySelect.value = localStorage.getItem('rpa_base_currency') || 'RU';
    currencySelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      localStorage.setItem('rpa_base_currency', target.value);
      updateLanguage();
    });

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.innerHTML = '&times;';
    Object.assign(closeButton.style, {
      background: 'none',
      border: 'none',
      color: '#8f98a0',
      fontSize: '30px',
      cursor: 'pointer',
      lineHeight: '1',
      padding: '0 8px',
    });
    closeButton.onmouseover = () => (closeButton.style.color = '#fff');
    closeButton.onmouseout = () => (closeButton.style.color = '#8f98a0');
    closeButton.addEventListener('click', closeModal);

    rightControls.appendChild(currencySelect);
    rightControls.appendChild(closeButton);
    headerBar.appendChild(title);
    headerBar.appendChild(gameNameDisplay);
    headerBar.appendChild(rightControls);
    modal.appendChild(headerBar);

    const controlsBar = document.createElement('div');
    controlsBar.id = 'rpaControlsBar';
    Object.assign(controlsBar.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      padding: '10px 20px',
      backgroundColor: '#1a2430',
      borderBottom: '1px solid #23313f',
      flexShrink: '0',
    });

    const fetchButton = document.createElement('button');
    fetchButton.type = 'button';
    fetchButton.textContent = 'Сбор данных';
    fetchButton.id = 'rpaFetchDataButton';
    Object.assign(fetchButton.style, {
      padding: '8px 20px',
      backgroundColor: '#76b72a',
      color: 'white',
      border: '1px solid #5c9e1f',
      borderRadius: '3px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      textShadow: '1px 1px 0px rgba(0,0,0,0.3)',
      fontWeight: '500',
      cursor: 'pointer',
      fontSize: '14px',
      lineHeight: '1.5',
    });
    fetchButton.onmouseover = () => (fetchButton.style.backgroundColor = '#85c83a');
    fetchButton.onmouseout = () => (fetchButton.style.backgroundColor = '#76b72a');
    fetchButton.onmousedown = () => (fetchButton.style.backgroundColor = '#6aa424');
    fetchButton.onmouseup = () => (fetchButton.style.backgroundColor = '#85c83a');
    fetchButton.addEventListener('click', handleFetchData);
    controlsBar.appendChild(fetchButton);

    const progressBarContainer = document.createElement('div');
    progressBarContainer.id = 'rpaProgressBarContainer';
    Object.assign(progressBarContainer.style, {
      flexGrow: '1',
      height: '10px',
      backgroundColor: '#2a3f5a',
      borderRadius: '5px',
      overflow: 'hidden',
      display: 'none',
    });

    progressBarFill = document.createElement('div');
    progressBarFill.id = 'rpaProgressBarFill';
    Object.assign(progressBarFill.style, {
      width: '0%',
      height: '100%',
      backgroundColor: '#67c1f5',
      borderRadius: '5px',
      transition: 'width 0.2s ease-out',
    });
    progressBarContainer.appendChild(progressBarFill);
    controlsBar.appendChild(progressBarContainer);

    const statusDiv = document.createElement('div');
    statusDiv.id = 'rpaStatusDiv';
    Object.assign(statusDiv.style, {
      minWidth: '250px',
      textAlign: 'right',
      fontSize: '13px',
      color: '#8f98a0',
    });
    controlsBar.appendChild(statusDiv);
    modal.appendChild(controlsBar);

    const mainContentWrapper = document.createElement('div');
    mainContentWrapper.id = 'rpaMainContentWrapper';
    Object.assign(mainContentWrapper.style, {
      display: 'flex',
      flexGrow: '1',
      overflow: 'hidden',
      padding: '15px 20px',
    });

    const leftSidebar = document.createElement('div');
    leftSidebar.id = 'rpaLeftSidebar';
    Object.assign(leftSidebar.style, {
      width: '280px',
      flexShrink: '0',
      paddingRight: '15px',
      borderRight: '1px solid #23313f',
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: '#4b6f9c #1e2c3a',
    });
    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'rpaSummaryDiv';
    leftSidebar.appendChild(summaryDiv);
    mainContentWrapper.appendChild(leftSidebar);

    const resultsArea = document.createElement('div');
    resultsArea.id = 'rpaResultsArea';
    Object.assign(resultsArea.style, {
      flexGrow: '1',
      overflow: 'auto',
      paddingLeft: '15px',
      scrollbarWidth: 'thin',
      scrollbarColor: '#4b6f9c #1e2c3a',
    });
    const resultsDiv = document.createElement('div');
    resultsDiv.id = 'rpaResultsDiv';
    resultsArea.appendChild(resultsDiv);
    mainContentWrapper.appendChild(resultsArea);

    modal.appendChild(mainContentWrapper);
    document.body.appendChild(modal);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
        closeModal();
      }
    });

    updateLanguage();
  };

  const openModal = () => {
    if (!modal) createModal();
    currentAppId = getAppIdFromUrl();
    const isUSD = (getCurrencySelect()?.value || 'RU') === 'US';

    if (!currentAppId) {
      alert(isUSD ? '[RPA] AppID not found.' : '[RPA] Не удалось определить AppID игры.');
      return;
    }

    const titleEl = document.querySelector('#appHubAppName, .apphub_AppName');
    const gameName = titleEl?.textContent?.trim() || `App #${currentAppId}`;
    const gameNameDisplay = document.getElementById('rpaGameNameDisplay');
    if (gameNameDisplay) gameNameDisplay.textContent = gameName;

    if (modal) modal.style.display = 'flex';
    updateLanguage();
    const fetchBtn = getFetchBtn();
    if (fetchBtn) fetchBtn.disabled = false;
    updateProgressBar(0);
  };

  const injectPriorButton = (): boolean => {
    if (document.getElementById('rpaPriorButton')) return true;
    const allWrappers = Array.from(document.querySelectorAll('.game_area_purchase_game_wrapper'));
    if (!allWrappers.length) return false;

    let targetWrapper = allWrappers[0];
    for (const wrapper of allWrappers) {
      if (wrapper.querySelector('.game_purchase_action .price, .game_purchase_action .discount_block')) {
        targetWrapper = wrapper;
        break;
      }
    }

    const isUSD = localStorage.getItem('rpa_base_currency') === 'US';
    const priorButton = document.createElement('button');
    priorButton.type = 'button';
    priorButton.id = 'rpaPriorButton';
    priorButton.textContent = isUSD ? 'Price Analyzer' : 'Анализатор цен';
    priorButton.className = 'btnv6_blue_hoverfade btn_medium';
    Object.assign(priorButton.style, {
      marginRight: '10px',
      marginBottom: '10px',
      height: '32px',
      padding: '0 15px',
      lineHeight: '32px',
      cursor: 'pointer',
    });
    priorButton.addEventListener('click', openModal);

    const buttonContainer = document.createElement('div');
    buttonContainer.appendChild(priorButton);
    if (targetWrapper.parentNode) {
      targetWrapper.parentNode.insertBefore(buttonContainer, targetWrapper);
    }

    createModal();
    return true;
  };

  if (!injectPriorButton()) {
    const obs = new MutationObserver((_m, o) => {
      if (injectPriorButton()) o.disconnect();
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      injectPriorButton();
    }, 10000);
  }
}
