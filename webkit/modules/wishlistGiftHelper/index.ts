import {
  StoreWebkitConfig,
  fetchViaBackend,
  getActiveSteamId64,
  idbGet,
  idbSet,
  injectStyleOnce,
} from '../../shared/ipc';

interface RegionCurrencyInfo {
  name: string;
  code: number;
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

interface PricingMatrices {
  valve: MatrixRow[];
  parity: MatrixRow[];
  fx: MatrixRow[];
}

interface RrcCompareEntry {
  status: 'lower' | 'equal' | 'higher';
  diff: number;
  diffPercent: number;
  recommendedCents: number;
  recommendedNum: number;
}

interface ExtractedGameData {
  appid: number;
  name: string;
  type?: number;
  imageUrl: string;
  releaseDateTimestamp: number | null;
  reviewScore: number;
  reviewPercent: number;
  reviewCount: number;
  reviewDesc: string;
  platforms: { windows: boolean; mac: boolean; linux: boolean };
  canGift: boolean;
  priceData: {
    formattedFinal: string;
    finalCents: number | null;
    formattedOriginal: string | null;
    originalCents: number | null;
    discountPercent: number;
  } | null;
  publishers: string;
  developers: string;
  franchises: string;
  is_early_access?: boolean;
  tagids: number[];
  short_description?: string;
  language_support_russian?: { supported?: boolean; full_audio?: boolean; subtitles?: boolean };
  has_demo: boolean;
  has_playtest: boolean;
  is_coming_soon: boolean;
  rrcInfo?: {
    valve: RrcCompareEntry | null;
    parity: RrcCompareEntry | null;
    fx: RrcCompareEntry | null;
  };
}

interface GamePairStore {
  myData: ExtractedGameData | null;
  friendData: ExtractedGameData | null;
  usData: ExtractedGameData | null;
}

const WGH_API_URL = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1';
const WGH_CURRENCY_API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/';
const WGH_BATCH_SIZE = 150;
const WGH_INITIAL_DELAY_MS = 600;
const WGH_IMAGE_BASE_URL = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/';
const WGH_TAGS_CACHE_KEY = 'SteamEnhancer_TagsCache_v4_wgh';
const WGH_SEARCH_URL = 'https://store.steampowered.com/search/?l=russian';
const MATRIX_CACHE_KEY = 'bsh_rpa_steam_pricing_matrix_v1';
const MATRIX_CACHE_TTL = 24 * 60 * 60 * 1000;
const RATES_CACHE_KEY = 'bsh_rpa_usd_rates_v1';
const RATES_CACHE_TTL = 6 * 60 * 60 * 1000;

const WGH_COUNTRY_CURRENCY_MAP: Record<string, RegionCurrencyInfo> = {
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

const WGH_CURRENCY_CODE_TO_COUNTRY: Record<number, string> = {
  ...Object.fromEntries(
    Object.entries(WGH_COUNTRY_CURRENCY_MAP).map(([country, data]) => [data.code, country])
  ),
  1: 'US',
};
const WGH_CURRENCY_CODE_TO_ISO: Record<number, string> = Object.fromEntries(
  Object.entries(WGH_COUNTRY_CURRENCY_MAP).map(([_, data]) => [data.code, data.iso])
);

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

const WGH_CSS = `
  .wghBtn {
    padding: 8px 14px;
    font-size: 13px;
    color: #c6d4df;
    border: 1px solid #4b6f9c;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background-color: rgba(42, 71, 94, 0.8);
    transition: background-color 0.2s, border-color 0.2s, color 0.2s;
  }
  .wghBtn:hover:not(:disabled) {
    background-color: rgba(67, 103, 133, 0.92);
    border-color: #67c1f5;
    color: #ffffff;
  }
  .wghBtn:disabled { opacity: 0.6; cursor: default; }
  .wghPrimaryBtn { background-color: rgba(77, 136, 255, 0.82); border-color: #4d88ff; color: #ffffff; font-weight: 600; }
  .wghPrimaryBtn:hover:not(:disabled) { background-color: rgba(51, 102, 204, 0.95); }
  .wghBtn.sortBtn.active { background-color: rgba(0, 123, 255, 0.85); border-color: #007bff; color: #ffffff; }
  #wghGiftModeBtn.active, #wghFilterToggleBtn.active { background-color: rgba(0, 123, 255, 0.85); border-color: #007bff; color: #ffffff; }
  .wghSelect {
    margin-left: 5px;
    background-color: #232e3d;
    color: #eee;
    border: 1px solid #4b6f9c;
    border-radius: 4px;
    height: 36px;
    padding: 0 8px;
    font-size: 13px;
    cursor: pointer;
    flex-shrink: 0;
    outline: none;
    max-width: 220px;
  }
  .wghSelect:focus { border-color: #67c1f5; }
  .wghGameCard {
    background-color: rgba(34, 41, 49, 0.92);
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    color: #c6d4df;
    font-size: 13px;
    border: 1px solid #333941;
    min-height: 500px;
  }
  .wghGameCard:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
    border-color: #4b6f9c;
  }
  .wghCardLink { text-decoration: none; color: inherit; display: block; }
  .wghCardImageWrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 292 / 136;
    margin-bottom: 8px;
    background-color: #11161d;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #333941;
  }
  .wghCardImageWrapper img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .wghCardDiscountBadge {
    position: absolute;
    bottom: 5px;
    right: 5px;
    background-color: #4c6b22;
    color: #beee11;
    padding: 2px 6px;
    font-size: 12px;
    border-radius: 3px;
    font-weight: 700;
    z-index: 1;
  }
  .wghCardContent { flex-grow: 1; display: flex; flex-direction: column; }
  .wghCardTitle {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.3;
    height: 2.6em;
    overflow: hidden;
    margin-bottom: 6px;
    color: #e5e5e5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    text-decoration: none;
  }
  .wghCardTitle:hover { color: #67c1f5; }
  .wghCardPrice { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; min-height: 22px; }
  .wghCurrentPrice { font-size: 17px; font-weight: 600; color: #a4d007; }
  .wghOriginalPrice { font-size: 13px; color: #8f98a0; text-decoration: line-through; }
  .wghCardReviews { font-size: 12.5px; margin-bottom: 8px; }
  .wghReviewPositive { color: #66c0f4; }
  .wghReviewMixed { color: #b99f62; }
  .wghReviewNegative { color: #e06c53; }
  .wghReviewNone { color: #8f98a0; }
  .wghCardInfoGrid { display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 12px; color: #8f98a0; margin-bottom: 8px; }
  .wghCardInfoItem { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; }
  .wghCardInfoItem span { color: #c6d4df; }
  .wghTagsContainer { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
  .wghTag { background-color: rgba(103, 193, 245, 0.14); color: #9db4c6; padding: 2px 7px; border-radius: 3px; font-size: 11.5px; }
  .wghDescButton {
    background: #354d63;
    color: #e5eef5;
    border: 1px solid #4b6f9c;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12.5px;
    margin-bottom: 6px;
    width: 100%;
    transition: background-color 0.15s ease;
  }
  .wghDescButton:hover { background: #4b6f9c; color: #ffffff; }
  .wghCardFooter { margin-top: auto; padding-top: 10px; border-top: 1px solid #3a4f6a; }
  .wghCannotGift { font-size: 12px; color: #ff8080; font-style: italic; margin-top: 4px; }
  .wghFriendPrice { font-size: 13px; color: #b0e0e6; margin-top: 4px; }
  .wghPriceDiff { font-size: 13px; font-weight: 700; margin-top: 2px; }
  .wghPriceDiffGood { color: #77dd77; }
  .wghPriceDiffBad { color: #ff6961; }
  @keyframes wghSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .wghSpinner {
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #fff;
    width: 1em;
    height: 1em;
    animation: wghSpin 1s linear infinite;
    display: inline-block;
    vertical-align: middle;
    margin-left: 8px;
  }
  .wghAccordionContainer { display: none; padding: 10px 0; border-bottom: 1px solid #3a4f6a; margin-bottom: 10px; flex-shrink: 0; }
  .wghAccordionContent, .wghFilterGrid { padding: 10px; border: 1px solid #3a4f6a; border-radius: 4px; background-color: rgba(42, 71, 94, 0.22); }
  .wghAccordionContent { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .wghFilterGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 10px; }
  .wghFilterGroup { display: flex; flex-direction: column; gap: 5px; }
  .wghFilterLabel { font-size: 12.5px; color: #c6d4df; }
  .wghRangeInput { display: flex; flex-direction: column; gap: 5px; }
  .wghRangeInput input { width: 100%; box-sizing: border-box; padding: 5px 7px; background: #17202d; border: 1px solid #3a4f6a; color: #c6d4df; border-radius: 3px; font-size: 12px; }
  .wghRadioGroup { display: flex; flex-direction: column; gap: 3px; font-size: 12px; }
  .wghRadioGroup label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .wghRrcInfo { display: flex; justify-content: space-between; align-items: center; padding: 3px 7px; border-radius: 3px; margin-bottom: 4px; font-size: 12px; }
  .wghRrcStatus { font-weight: 700; }
  .wghRrcDiff { font-size: 11.5px; }
  .wghRrc-lower { background-color: rgba(102, 192, 244, 0.18); border: 1px solid rgba(102, 192, 244, 0.35); color: #c6d4df; }
  .wghRrc-equal { background-color: rgba(92, 184, 92, 0.18); border: 1px solid rgba(92, 184, 92, 0.35); color: #dff0d8; }
  .wghRrc-higher { background-color: rgba(217, 83, 79, 0.18); border: 1px solid rgba(217, 83, 79, 0.35); color: #f2dede; }
  .wgh-tag-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); z-index: 100020; display: none; justify-content: center; align-items: center; font-family: "Motiva Sans", Arial, sans-serif; }
  .wgh-tag-modal { background: #1b2838; color: #c6d4df; padding: 20px; border-radius: 6px; width: 740px; max-width: 92vw; border: 1px solid #30363d; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.65); }
  .wgh-tag-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid #2a3a4d; padding-bottom: 10px; }
  .wgh-tag-header h3 { color: #66c0f4; margin: 0; font-size: 17px; }
  .wgh-tag-search { width: 100%; box-sizing: border-box; background: #1a2635; border: 1px solid #2a3a4d; border-radius: 4px; color: #c6d4df; font-size: 13px; padding: 8px; margin-bottom: 10px; }
  .wgh-tag-results { max-height: 150px; overflow-y: auto; border: 1px solid #2a3a4d; border-radius: 4px; }
  .wgh-tag-res-item { padding: 7px 10px; cursor: pointer; border-bottom: 1px solid #2a3a4d; font-size: 12.5px; }
  .wgh-tag-res-item:last-child { border-bottom: none; }
  .wgh-tag-res-item:hover { background: #2a3a4d; color: #ffffff; }
  .wgh-tag-cols { display: flex; gap: 16px; margin-top: 14px; }
  .wgh-tag-col { flex: 1; border: 1px solid #2a3a4d; border-radius: 4px; padding: 10px; background: #16202d; min-height: 140px; max-height: 240px; overflow-y: auto; }
  .wgh-tag-row { display: flex; align-items: center; gap: 8px; background: #2a3a4d; padding: 6px 8px; border-radius: 4px; margin-bottom: 6px; font-size: 12px; }
  .wgh-tag-row span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wgh-tag-row input { width: 52px; text-align: center; background: #1a2635; border: 1px solid #2a3a4d; color: #c6d4df; border-radius: 3px; padding: 3px; }
  .wgh-tag-del { background: #a74343; color: #fff; font-size: 11px; padding: 2px 7px; border-radius: 3px; border: none; cursor: pointer; }
  .wgh-tag-del:hover { background: #c45252; }
  #wghResultsContainer::-webkit-scrollbar { width: 8px; }
  #wghResultsContainer::-webkit-scrollbar-track { background: #17202d; border-radius: 4px; }
  #wghResultsContainer::-webkit-scrollbar-thumb { background-color: #4b6f9c; border-radius: 4px; border: 2px solid #17202d; }
  #wghResultsContainer::-webkit-scrollbar-thumb:hover { background-color: #67c1f5; }
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
  if (!dropDecimals && rules.strDecimalSymbol) parts.push(rules.strDecimalSymbol);

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

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getReviewClass(percent: number, count: number): string {
  if (count === 0) return 'wghReviewNone';
  if (percent >= 70) return 'wghReviewPositive';
  if (percent >= 40) return 'wghReviewMixed';
  return 'wghReviewNegative';
}

function getCustomReviewDescription(percent: number | null | undefined, count: number): string {
  if (count === 0 || percent === null || percent === undefined) return 'Нет обзоров';
  if (percent >= 95) return 'Крайне положительные';
  if (percent >= 80) return 'Очень положительные';
  if (percent >= 70) return 'В основном положительные';
  if (percent >= 40) return 'Смешанные';
  if (percent >= 20) return 'В основном отрицательные';
  if (percent >= 6) return 'Очень отрицательные';
  return 'Крайне отрицательные';
}

function findClosestUsdTier(matrix: MatrixRow[], targetUsdCents: number): MatrixRow | null {
  if (!matrix || matrix.length === 0) return null;
  let closest = matrix[0];
  let minDiff = Math.abs((matrix[0].usd_price || 0) - targetUsdCents);
  for (const row of matrix) {
    const diff = Math.abs((row.usd_price || 0) - targetUsdCents);
    if (diff < minDiff) {
      minDiff = diff;
      closest = row;
    }
  }
  return closest;
}

function getRecommendedPriceCentsFromMatrix(
  matrix: MatrixRow[],
  baseUsdCents: number,
  currencyCode: number
): number | null {
  if (currencyCode === 1) return baseUsdCents;
  const closestRow = findClosestUsdTier(matrix, baseUsdCents);
  const cp = closestRow?.currency_prices?.find((c) => c.currency_code === currencyCode);
  return cp ? cp.price : null;
}

export function initWishlistGiftHelperModule(cfg: StoreWebkitConfig): void {
  if (!cfg.wishlistGiftHelper) return;
  if (!window.location.pathname.includes('/wishlist/')) return;

  injectStyleOnce('bsh-wgh-styles', WGH_CSS);

  let allTags: Record<string, string> = {};
  const activeTagFilters: Record<string, number> = {};
  const hiddenTagFilters: Record<string, boolean> = {};
  let allAppIds: number[] = [];
  let gameDataStore: Record<string, GamePairStore> = {};
  let currentUserCountryCode = 'RU';
  let currentUserCurrencyCode = 5;
  let currentUserISOCurrencyCode = 'RUB';
  let currentSort = { field: 'price', direction: 'asc' as 'asc' | 'desc' };
  let currentFriendCountryCode: string | null = null;
  let exchangeRates: Record<string, number> | null = null;
  let giftModeActive = false;
  let steamPricingMatrices: PricingMatrices | null = null;

  let modal: HTMLDivElement | null = null;
  let resultsDiv: HTMLDivElement | null = null;
  let statusDiv: HTMLDivElement | null = null;
  let progressBar: HTMLDivElement | null = null;
  let giftProgressBar: HTMLDivElement | null = null;
  let sortButtonsContainer: HTMLDivElement | null = null;
  let giftModeContainer: HTMLDivElement | null = null;
  let filterAccordionContainer: HTMLDivElement | null = null;
  let giftIconBtn: HTMLButtonElement | null = null;
  let friendRegionSelect: HTMLSelectElement | null = null;
  let fetchFriendPricesBtn: HTMLButtonElement | null = null;
  let myRegionDisplay: HTMLElement | null = null;

  const updateStatus = (message: string, isLoading = false) => {
    if (statusDiv) {
      statusDiv.innerHTML = message + (isLoading ? ' <span class="wghSpinner"></span>' : '');
    }
    const collectBtn = document.getElementById('wghCollectBtn') as HTMLButtonElement | null;
    if (collectBtn) collectBtn.disabled = isLoading;
    if (fetchFriendPricesBtn) fetchFriendPricesBtn.disabled = isLoading;
  };

  const createProgressBar = (id: string): HTMLDivElement => {
    const barContainer = document.createElement('div');
    barContainer.id = id;
    barContainer.style.cssText =
      'width: 80%; max-width: 600px; height: 10px; background-color: #3a4f6a; border-radius: 5px; overflow: hidden; margin: 10px auto; display: none; flex-shrink: 0;';
    const barFill = document.createElement('div');
    barFill.className = 'wghProgressBarFill';
    barFill.style.cssText =
      'width: 0%; height: 100%; background-color: #67c1f5; border-radius: 5px; transition: width 0.3s ease-out;';
    barContainer.appendChild(barFill);
    return barContainer;
  };

  const showProgressBar = (barElement: HTMLDivElement | null, initialProgress = 0) => {
    if (!barElement) return;
    const fill = barElement.querySelector('.wghProgressBarFill') as HTMLElement | null;
    if (fill) fill.style.width = `${initialProgress}%`;
    barElement.style.display = 'block';
  };

  const updateProgressBar = (barElement: HTMLDivElement | null, progress: number) => {
    if (!barElement) return;
    const fill = barElement.querySelector('.wghProgressBarFill') as HTMLElement | null;
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  };

  const hideProgressBar = (barElement: HTMLDivElement | null) => {
    if (barElement) barElement.style.display = 'none';
  };

  const loadSteamTags = async (): Promise<Record<string, string>> => {
    const cached = await idbGet<{ data: Record<string, string>; timestamp: number }>(WGH_TAGS_CACHE_KEY);
    const now = Date.now();
    if (cached?.data && now - cached.timestamp < 744 * 60 * 60 * 1000) {
      return cached.data;
    }

    const res = await fetchViaBackend(WGH_SEARCH_URL);
    if (res.ok && res.body) {
      try {
        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const tags: Record<string, string> = {};
        doc.querySelectorAll('[data-param="tags"][data-value][data-loc]').forEach((el) => {
          const k = el.getAttribute('data-value');
          const v = el.getAttribute('data-loc');
          if (k && v) tags[k] = v;
        });
        if (Object.keys(tags).length > 0) {
          await idbSet(WGH_TAGS_CACHE_KEY, { data: tags, timestamp: now });
          return tags;
        }
      } catch {}
    }
    return cached?.data || {};
  };

  const fetchSteamPricingMatrix = async (): Promise<PricingMatrices> => {
    if (steamPricingMatrices) return steamPricingMatrices;

    const cached = await idbGet<{ timestamp: number; data: MatrixRow[] }>(MATRIX_CACHE_KEY);
    let rows: MatrixRow[] | null = null;
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0 && Date.now() - cached.timestamp < MATRIX_CACHE_TTL) {
      rows = cached.data;
    } else {
      const res = await fetchViaBackend('https://partner.steamgames.com/pricing/explorer', {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: 'https://partner.steamgames.com/',
      });
      if (!res.ok || !res.body) {
        if (cached?.data?.length) rows = cached.data;
        else throw new Error(`Ошибка загрузки матрицы цен (HTTP ${res.status})`);
      } else {
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
            try {
              const arr = JSON.parse(searchStr.substring(arrayStart, endIdx + 1));
              if (Array.isArray(arr) && arr.length > 0 && arr[0].usd_price !== undefined && arr[0].convert_method !== undefined) {
                rows = arr;
                await idbSet(MATRIX_CACHE_KEY, { timestamp: Date.now(), data: arr });
                break;
              }
            } catch {}
          }
          offset = startIdx + 8;
        }
      }
    }

    if (!rows || rows.length === 0) {
      throw new Error('Не удалось извлечь матрицы цен Steam.');
    }

    steamPricingMatrices = {
      valve: rows.filter((m) => m.convert_method === 1),
      parity: rows.filter((m) => m.convert_method === 2),
      fx: rows.filter((m) => m.convert_method === 3),
    };
    return steamPricingMatrices;
  };

  const detectUserRegion = () => {
    const w = window as any;
    let found = false;

    if (typeof w?.SSR?.renderContext?.queryData === 'string') {
      try {
        const qd = JSON.parse(w.SSR.renderContext.queryData);
        const walletInfo = qd?.queries?.find((q: any) => q?.queryKey?.[0] === 'CurrentUserWalletDetails')?.state?.data;
        if (walletInfo?.has_wallet && walletInfo?.currency_code && walletInfo?.wallet_country_code) {
          currentUserCurrencyCode = Number(walletInfo.currency_code);
          currentUserCountryCode = String(walletInfo.wallet_country_code);
          currentUserISOCurrencyCode = (WGH_CURRENCY_CODE_TO_ISO[currentUserCurrencyCode] || 'rub').toUpperCase();
          found = true;
        }
      } catch {}
    }

    if (!found && typeof w?.Config?.COUNTRY === 'string') {
      const entry = WGH_COUNTRY_CURRENCY_MAP[w.Config.COUNTRY];
      if (entry) {
        currentUserCountryCode = w.Config.COUNTRY;
        currentUserCurrencyCode = entry.code;
        currentUserISOCurrencyCode = entry.iso.toUpperCase();
        found = true;
      }
    }

    if (!found && w?.g_rgWalletInfo?.wallet_currency) {
      currentUserCurrencyCode = Number(w.g_rgWalletInfo.wallet_currency);
      currentUserCountryCode = WGH_CURRENCY_CODE_TO_COUNTRY[currentUserCurrencyCode] || 'RU';
      currentUserISOCurrencyCode = (WGH_CURRENCY_CODE_TO_ISO[currentUserCurrencyCode] || 'rub').toUpperCase();
      found = true;
    }

    if (!found) {
      currentUserCountryCode = 'RU';
      currentUserCurrencyCode = 5;
      currentUserISOCurrencyCode = 'RUB';
    }

    if (myRegionDisplay) {
      myRegionDisplay.textContent = `${currentUserCountryCode} (${currentUserISOCurrencyCode})`;
    }
  };

  const extractAppIdsFromPage = async (): Promise<number[]> => {
    const w = window as any;
    let appIds: number[] = [];
    let ownerSteamId = '';

    if (typeof w?.SSR?.renderContext?.queryData === 'string') {
      try {
        const qd = JSON.parse(w.SSR.renderContext.queryData);
        const queries: any[] = Array.isArray(qd?.queries) ? qd.queries : [];

        for (const q of queries) {
          const data = q?.state?.data;
          if (!data) continue;

          if (!ownerSteamId && Array.isArray(q?.queryKey)) {
            const idPart = q.queryKey.find((k: any) => typeof k === 'string' && /^7656\d{13}$/.test(k));
            if (idPart) ownerSteamId = idPart;
          }

          if (Array.isArray(data?.items) && data.items.length > 0 && data.items[0]?.appid) {
            const ids = data.items.map((it: any) => Number(it.appid)).filter((n: number) => n > 0);
            if (ids.length > appIds.length) appIds = ids;
          } else if (Array.isArray(data) && data.length > 0 && data[0]?.appid) {
            const ids = data.map((it: any) => Number(it.appid)).filter((n: number) => n > 0);
            if (ids.length > appIds.length) appIds = ids;
          }
        }
      } catch {}
    }

    if (appIds.length === 0) {
      const profileMatch = window.location.pathname.match(/\/wishlist\/profiles\/(7656\d{13})/);
      if (profileMatch) ownerSteamId = profileMatch[1];

      if (ownerSteamId) {
        try {
          const res = await fetchViaBackend(
            `https://api.steampowered.com/IWishlistService/GetWishlist/v1?steamid=${ownerSteamId}`
          );
          if (res.ok && res.body) {
            const json = JSON.parse(res.body);
            const items = json?.response?.items;
            if (Array.isArray(items) && items.length > 0) {
              appIds = items.map((it: any) => Number(it.appid)).filter((n: number) => n > 0);
            }
          }
        } catch {}
      }
    }

    const isVanityWishlistUrl = /\/wishlist\/id\/[^/]+/i.test(window.location.pathname);
    let canUseSelfUserdata = !isVanityWishlistUrl;
    if (canUseSelfUserdata && ownerSteamId) {
      const mySteamId = await getActiveSteamId64();
      if (mySteamId && ownerSteamId !== mySteamId) {
        canUseSelfUserdata = false;
      }
    }

    if (appIds.length === 0 && canUseSelfUserdata) {
      try {
        const res = await fetch(`https://store.steampowered.com/dynamicstore/userdata/?_t=${Date.now()}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.rgWishlist) && data.rgWishlist.length > 0) {
            appIds = data.rgWishlist.map(Number).filter((n: number) => n > 0);
          }
        }
      } catch {}
    }

    if (appIds.length === 0 && Array.isArray(w?.g_rgWishlistData)) {
      appIds = w.g_rgWishlistData.map((it: any) => Number(it.appid)).filter((n: number) => n > 0);
    }

    if (appIds.length === 0) {
      appIds = Array.from(document.querySelectorAll('a[href*="/app/"]'))
        .map((a) => Number((a as HTMLAnchorElement).href.match(/\/app\/(\d+)/)?.[1]))
        .filter((n) => n > 0);
    }

    return Array.from(new Set(appIds));
  };

  const fetchBatchGameData = async (appIdsBatch: number[], countryCode: string): Promise<any[]> => {
    const inputJson = {
      ids: appIdsBatch.map((appid) => ({ appid })),
      context: { language: 'russian', country_code: countryCode || 'RU', steam_realm: 1 },
      data_request: {
        include_assets: true,
        include_release: true,
        include_platforms: true,
        include_all_purchase_options: true,
        include_screenshots: true,
        include_trailers: true,
        include_ratings: true,
        include_tag_count: 20,
        include_reviews: true,
        include_basic_info: true,
        include_supported_languages: true,
        include_full_description: false,
        include_included_items: true,
        include_assets_without_overrides: true,
        apply_user_filters: false,
        include_links: true,
      },
    };
    const url = `${WGH_API_URL}?input_json=${encodeURIComponent(JSON.stringify(inputJson))}`;
    const res = await fetchViaBackend(url);
    if (!res.ok || !res.body) {
      throw new Error(`HTTP статус ${res.status} для региона ${countryCode}`);
    }
    const parsed = JSON.parse(res.body);
    return Array.isArray(parsed?.response?.store_items) ? parsed.response.store_items : [];
  };

  const processBatchData = (batchData: any[], dataType: 'myData' | 'friendData' | 'usData') => {
    if (!Array.isArray(batchData)) return;
    batchData.forEach((item) => {
      if (!item || !item.id || item.success !== 1) return;
      const appid = Number(item.id);
      if (!gameDataStore[appid]) {
        gameDataStore[appid] = { myData: null, friendData: null, usData: null };
      }
      const headerFileName = item.assets?.header;
      const imageUrl = headerFileName
        ? `${WGH_IMAGE_BASE_URL}${appid}/${headerFileName}`
        : `${WGH_IMAGE_BASE_URL}${appid}/header.jpg`;

      const purchaseOption = item.best_purchase_option;
      const priceData = purchaseOption
        ? {
            formattedFinal: String(purchaseOption.formatted_final_price || 'N/A'),
            finalCents: purchaseOption.final_price_in_cents ? parseInt(String(purchaseOption.final_price_in_cents), 10) : null,
            formattedOriginal: purchaseOption.formatted_original_price ? String(purchaseOption.formatted_original_price) : null,
            originalCents: purchaseOption.original_price_in_cents
              ? parseInt(String(purchaseOption.original_price_in_cents), 10)
              : null,
            discountPercent: Number(purchaseOption.discount_pct || 0),
          }
        : null;

      gameDataStore[appid][dataType] = {
        appid: Number(item.appid || appid),
        name: String(item.name || `App #${appid}`),
        type: item.type,
        imageUrl,
        releaseDateTimestamp: item.release?.steam_release_date ? Number(item.release.steam_release_date) : null,
        reviewScore: Number(item.reviews?.summary_filtered?.review_score || 0),
        reviewPercent: Number(item.reviews?.summary_filtered?.percent_positive || 0),
        reviewCount: Number(item.reviews?.summary_filtered?.review_count || 0),
        reviewDesc: String(item.reviews?.summary_filtered?.review_score_label || ''),
        platforms: {
          windows: Boolean(item.platforms?.windows),
          mac: Boolean(item.platforms?.mac),
          linux: Boolean(item.platforms?.steamos_linux),
        },
        canGift: Boolean(purchaseOption?.user_can_purchase_as_gift),
        priceData,
        publishers: (item.basic_info?.publishers || []).map((p: any) => p.name).join(', '),
        developers: (item.basic_info?.developers || []).map((d: any) => d.name).join(', '),
        franchises: (item.basic_info?.franchises || []).map((f: any) => f.name).join(', '),
        is_early_access: Boolean(item.is_early_access ?? item.release?.is_early_access),
        tagids: Array.isArray(item.tagids) ? item.tagids : [],
        short_description: item.basic_info?.short_description,
        language_support_russian: item.supported_languages?.find((l: any) => l.elanguage === 8),
        has_demo: Boolean(
          item.related_items?.demo_appid ||
            item.related_items?.demos ||
            item.related_items?.standalone_demos ||
            item.related_items?.standalone_demo_appid
        ),
        has_playtest: Boolean(item.related_items?.playtests),
        is_coming_soon: Boolean(item.is_coming_soon || item.release?.is_coming_soon),
      };
    });
  };

  const processRrcData = (targetDataField: 'myData' | 'friendData', targetCountryCode: string) => {
    if (!steamPricingMatrices) return;
    const currencyInfo = WGH_COUNTRY_CURRENCY_MAP[targetCountryCode];
    if (!currencyInfo || currencyInfo.code === 1) return;
    const currencyCode = currencyInfo.code;

    for (const appid of Object.keys(gameDataStore)) {
      const game = gameDataStore[appid];
      const targetData = game[targetDataField];
      if (targetData && game.usData && targetData.priceData && game.usData.priceData) {
        const usPriceCents = game.usData.priceData.originalCents ?? game.usData.priceData.finalCents;
        const targetPriceCents = targetData.priceData.originalCents ?? targetData.priceData.finalCents;

        if (usPriceCents !== null && usPriceCents > 0 && targetPriceCents !== null && targetPriceCents > 0) {
          const actualPriceNum = targetPriceCents / 100;
          const recNuanced = getRecommendedPriceCentsFromMatrix(steamPricingMatrices.valve, usPriceCents, currencyCode);
          const recParity = getRecommendedPriceCentsFromMatrix(steamPricingMatrices.parity, usPriceCents, currencyCode);
          const recFx = getRecommendedPriceCentsFromMatrix(steamPricingMatrices.fx, usPriceCents, currencyCode);

          const calc = (recCents: number | null): RrcCompareEntry | null => {
            if (recCents === null) return null;
            const recNum = recCents / 100;
            const diff = actualPriceNum - recNum;
            const diffPercent = recNum !== 0 ? (diff / recNum) * 100 : diff > 0 ? Infinity : -Infinity;
            let status: 'lower' | 'equal' | 'higher' = 'equal';
            if (diffPercent > 1) status = 'higher';
            if (diffPercent < -1) status = 'lower';
            return { status, diff, diffPercent, recommendedCents: recCents, recommendedNum: recNum };
          };

          targetData.rrcInfo = {
            valve: calc(recNuanced),
            parity: calc(recParity),
            fx: calc(recFx),
          };
        }
      }
    }
  };

  const fetchExchangeRates = async (baseCurrencyIso: string): Promise<Record<string, number>> => {
    const isoLower = baseCurrencyIso.toLowerCase();
    const cacheKey = `${RATES_CACHE_KEY}_${isoLower}`;
    const cached = await idbGet<{ timestamp: number; rates: Record<string, number> }>(cacheKey);
    if (cached?.rates && Date.now() - cached.timestamp < RATES_CACHE_TTL) {
      return cached.rates;
    }
    const res = await fetchViaBackend(`${WGH_CURRENCY_API_URL}${isoLower}.json`);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const json = JSON.parse(res.body);
    const rates = json?.[isoLower];
    if (!rates || typeof rates !== 'object') throw new Error('Курсы не найдены');
    await idbSet(cacheKey, { timestamp: Date.now(), rates });
    return rates;
  };

  const convertCurrency = (amount: number, fromCc: string, toCc: string): number | null => {
    if (fromCc === toCc) return amount;
    if (!exchangeRates) return null;
    const fromInfo = WGH_COUNTRY_CURRENCY_MAP[fromCc];
    const toInfo = WGH_COUNTRY_CURRENCY_MAP[toCc];
    if (!fromInfo || !toInfo) return null;
    if (fromInfo.code === toInfo.code) return amount;
    const toKey = toInfo.iso?.toLowerCase();
    if (!toKey || exchangeRates[toKey] === undefined) return null;
    return parseFloat((amount * exchangeRates[toKey]).toFixed(2));
  };

  const updateFilterPlaceholders = (visibleGamesData?: ExtractedGameData[]) => {
    const list =
      visibleGamesData ||
      Object.values(gameDataStore)
        .filter((g) => {
          if (!g?.myData) return false;
          const card = document.querySelector(`.wghGameCard[data-appid="${g.myData.appid}"]`) as HTMLElement | null;
          return Boolean(card && card.style.display !== 'none');
        })
        .map((g) => g.myData!);

    const fields = [
      'wghFilterReviewCountMin',
      'wghFilterReviewCountMax',
      'wghFilterRatingMin',
      'wghFilterRatingMax',
      'wghFilterPriceMin',
      'wghFilterPriceMax',
      'wghFilterDiscountMin',
      'wghFilterDiscountMax',
    ];

    if (list.length === 0) {
      fields.forEach((id) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.placeholder = 'N/A';
      });
      return;
    }

    let minRev = Infinity;
    let maxRev = 0;
    let minRat = 101;
    let maxRat = 0;
    let minPrice = Infinity;
    let maxPrice = 0;
    let minDisc = 101;
    let maxDisc = 0;

    list.forEach((it) => {
      if (it.reviewCount > 0) minRev = Math.min(minRev, it.reviewCount);
      maxRev = Math.max(maxRev, it.reviewCount);
      if (it.reviewCount > 0) {
        minRat = Math.min(minRat, it.reviewPercent);
        maxRat = Math.max(maxRat, it.reviewPercent);
      }
      if (it.priceData?.finalCents !== null && it.priceData?.finalCents !== undefined) {
        const p = it.priceData.finalCents / 100;
        minPrice = Math.min(minPrice, p);
        maxPrice = Math.max(maxPrice, p);
      }
      if ((it.priceData?.discountPercent || 0) > 0) {
        minDisc = Math.min(minDisc, it.priceData!.discountPercent);
        maxDisc = Math.max(maxDisc, it.priceData!.discountPercent);
      }
    });

    const setPh = (id: string, prefix: string, val: number, emptyCheck: number) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (!el) return;
      if (val !== Infinity && val !== emptyCheck) el.placeholder = `${prefix} ${Math.round(val)}`;
      else el.placeholder = 'N/A';
    };

    setPh('wghFilterReviewCountMin', 'От', minRev, Infinity);
    setPh('wghFilterReviewCountMax', 'До', maxRev, 0);
    setPh('wghFilterRatingMin', 'От', minRat === 101 ? 0 : minRat, 101);
    setPh('wghFilterRatingMax', 'До', maxRat, 0);
    setPh('wghFilterPriceMin', 'От', minPrice, Infinity);
    setPh('wghFilterPriceMax', 'До', maxPrice, 0);
    setPh('wghFilterDiscountMin', 'От', minDisc === 101 ? 0 : minDisc, 101);
    setPh('wghFilterDiscountMax', 'До', maxDisc, 0);
  };

  const applyFilters = () => {
    if (!resultsDiv) return;
    const getVal = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value || null;
    const getNum = (id: string) => {
      const v = getVal(id);
      return v !== null && v !== '' ? parseFloat(v) : null;
    };
    const getChecked = (id: string) => Boolean((document.getElementById(id) as HTMLInputElement | null)?.checked);
    const getRadio = (name: string) =>
      (document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement | null)?.value || 'any';

    const filters = {
      onlyDiscount: getChecked('wghFilterDiscounted'),
      hideNoPrice: getChecked('wghFilterNoPrice'),
      reviewCountMin: getNum('wghFilterReviewCountMin'),
      reviewCountMax: getNum('wghFilterReviewCountMax'),
      ratingMin: getNum('wghFilterRatingMin'),
      ratingMax: getNum('wghFilterRatingMax'),
      priceMin: getNum('wghFilterPriceMin'),
      priceMax: getNum('wghFilterPriceMax'),
      discountMin: getNum('wghFilterDiscountMin'),
      discountMax: getNum('wghFilterDiscountMax'),
      dateMin: getVal('wghFilterDateMin') ? new Date(getVal('wghFilterDateMin')!).getTime() : null,
      dateMax: getVal('wghFilterDateMax') ? new Date(getVal('wghFilterDateMax')!).getTime() : null,
      lang: getRadio('wghLangFilter'),
      ea: getRadio('wghEaFilter'),
      rrc: getRadio('wghRrcFilter'),
      release: getRadio('wghReleaseFilter'),
      demo: getRadio('wghDemoFilter'),
    };

    const cards = document.querySelectorAll('.wghGameCard');
    const visibleGamesData: ExtractedGameData[] = [];

    cards.forEach((raw) => {
      const card = raw as HTMLElement;
      const appid = card.dataset.appid || '';
      const gameData = gameDataStore[appid]?.myData;
      if (!gameData) {
        card.style.display = 'none';
        return;
      }

      let isVisible = true;
      if (filters.onlyDiscount && (!gameData.priceData || gameData.priceData.discountPercent <= 0)) isVisible = false;
      if (isVisible && filters.hideNoPrice && (!gameData.priceData || gameData.priceData.finalCents === null)) isVisible = false;
      if (isVisible && filters.reviewCountMin !== null && gameData.reviewCount < filters.reviewCountMin) isVisible = false;
      if (isVisible && filters.reviewCountMax !== null && gameData.reviewCount > filters.reviewCountMax) isVisible = false;
      if (isVisible && filters.ratingMin !== null && gameData.reviewPercent < filters.ratingMin) isVisible = false;
      if (isVisible && filters.ratingMax !== null && gameData.reviewPercent > filters.ratingMax) isVisible = false;

      if (isVisible && gameData.priceData) {
        if (gameData.priceData.finalCents !== null) {
          const price = gameData.priceData.finalCents / 100;
          if (filters.priceMin !== null && price < filters.priceMin) isVisible = false;
          if (isVisible && filters.priceMax !== null && price > filters.priceMax) isVisible = false;
        }
        const discount = gameData.priceData.discountPercent || 0;
        if (isVisible && filters.discountMin !== null && discount < filters.discountMin) isVisible = false;
        if (isVisible && filters.discountMax !== null && discount > filters.discountMax) isVisible = false;
      }

      if (isVisible && gameData.releaseDateTimestamp) {
        const itemDate = gameData.releaseDateTimestamp * 1000;
        if (filters.dateMin && itemDate < filters.dateMin) isVisible = false;
        if (isVisible && filters.dateMax && itemDate > filters.dateMax) isVisible = false;
      }

      if (isVisible && filters.lang !== 'any') {
        const lang = gameData.language_support_russian || {};
        const hasVoice = Boolean(lang.full_audio);
        const hasText = Boolean(lang.supported || lang.subtitles);
        if (filters.lang === 'text_only' && (!hasText || hasVoice)) isVisible = false;
        if (filters.lang === 'voice' && !hasVoice) isVisible = false;
        if (filters.lang === 'none' && (hasText || hasVoice)) isVisible = false;
      }

      if (isVisible && filters.ea !== 'any') {
        if (filters.ea === 'early_access' && !gameData.is_early_access) isVisible = false;
        if (filters.ea === 'released' && gameData.is_early_access) isVisible = false;
      }

      if (isVisible && filters.release !== 'any') {
        if (filters.release === 'released' && gameData.is_coming_soon) isVisible = false;
        if (filters.release === 'unreleased' && !gameData.is_coming_soon) isVisible = false;
      }

      if (isVisible && filters.demo !== 'any') {
        if (filters.demo === 'both' && !gameData.has_demo && !gameData.has_playtest) isVisible = false;
        if (filters.demo === 'demo' && !gameData.has_demo) isVisible = false;
        if (filters.demo === 'playtest' && !gameData.has_playtest) isVisible = false;
      }

      if (isVisible && filters.rrc !== 'any') {
        const rrcStatus = gameData.rrcInfo?.valve?.status;
        if (!rrcStatus || rrcStatus !== filters.rrc) isVisible = false;
      }

      if (isVisible && (Object.keys(activeTagFilters).length > 0 || Object.keys(hiddenTagFilters).length > 0)) {
        if (!gameData.tagids || gameData.tagids.length === 0) {
          if (Object.keys(activeTagFilters).length > 0) isVisible = false;
        } else {
          for (const tagId of Object.keys(hiddenTagFilters)) {
            if (gameData.tagids.includes(parseInt(tagId, 10))) {
              isVisible = false;
              break;
            }
          }
          if (isVisible) {
            for (const tagId of Object.keys(activeTagFilters)) {
              const requiredPos = activeTagFilters[tagId];
              const idx = gameData.tagids.indexOf(parseInt(tagId, 10));
              if (idx === -1 || idx >= requiredPos) {
                isVisible = false;
                break;
              }
            }
          }
        }
      }

      card.style.display = isVisible ? 'flex' : 'none';
      if (isVisible) visibleGamesData.push(gameData);
    });

    updateFilterPlaceholders(visibleGamesData);
  };

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleFilterApply = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      applyFilters();
    }, 300);
  };

  const compareItems = (
    a: ExtractedGameData | null,
    b: ExtractedGameData | null,
    field: string,
    direction: 'asc' | 'desc'
  ): number => {
    if (!a && !b) return 0;
    if (!a) return direction === 'asc' ? 1 : -1;
    if (!b) return direction === 'asc' ? -1 : 1;
    const mult = direction === 'asc' ? 1 : -1;
    let valA: number | string;
    let valB: number | string;

    switch (field) {
      case 'price':
        valA = a.priceData?.finalCents ?? (direction === 'asc' ? Infinity : -Infinity);
        valB = b.priceData?.finalCents ?? (direction === 'asc' ? Infinity : -Infinity);
        break;
      case 'discountPercent':
        valA = a.priceData?.discountPercent ?? -1;
        valB = b.priceData?.discountPercent ?? -1;
        break;
      case 'name':
        return (a.name || '').localeCompare(b.name || '', 'ru') * mult;
      case 'releaseDateTimestamp':
        valA = a.releaseDateTimestamp ?? (direction === 'asc' ? Infinity : 0);
        valB = b.releaseDateTimestamp ?? (direction === 'asc' ? Infinity : 0);
        break;
      case 'reviewPercent':
        valA = a.reviewPercent ?? -1;
        valB = b.reviewPercent ?? -1;
        break;
      default:
        return 0;
    }

    if (Number(valA) < Number(valB)) return -1 * mult;
    if (Number(valA) > Number(valB)) return 1 * mult;
    return (a.name || '').localeCompare(b.name || '', 'ru');
  };

  const updateSortButtonsState = () => {
    if (!sortButtonsContainer) return;
    sortButtonsContainer.querySelectorAll('.sortBtn').forEach((raw) => {
      const btn = raw as HTMLButtonElement;
      const f = btn.dataset.sort;
      const base = (btn.textContent || '').replace(/ [▲▼]$/, '');
      if (f === currentSort.field) {
        btn.classList.add('active');
        btn.textContent = `${base} ${currentSort.direction === 'asc' ? '▲' : '▼'}`;
      } else {
        btn.classList.remove('active');
        btn.textContent = base;
      }
    });
  };

  const showDescriptionModal = (title: string, description?: string) => {
    document.getElementById('wghDescriptionModal')?.remove();
    const m = document.createElement('div');
    m.id = 'wghDescriptionModal';
    m.style.cssText =
      'position: fixed; inset: 0; background-color: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 100030;';
    const box = document.createElement('div');
    box.style.cssText =
      'background-color: #1b2838; color: #c6d4df; padding: 22px; border-radius: 5px; max-width: 600px; width: 92%; max-height: 80vh; overflow-y: auto; border: 1px solid #4b6f9c; position: relative;';

    const closeB = document.createElement('button');
    closeB.type = 'button';
    closeB.innerHTML = '&times;';
    closeB.style.cssText =
      'position: absolute; top: 8px; right: 12px; background: none; border: none; color: #aaa; font-size: 26px; cursor: pointer;';
    closeB.onclick = () => m.remove();

    const h3 = document.createElement('h3');
    h3.textContent = title;
    h3.style.cssText = 'color: #67c1f5; margin-top: 0; padding-right: 24px;';

    const p = document.createElement('p');
    p.innerHTML = description || 'Описание отсутствует.';
    p.style.lineHeight = '1.6';

    box.append(closeB, h3, p);
    m.appendChild(box);
    document.body.appendChild(m);
    m.addEventListener('click', (e) => {
      if (e.target === m) m.remove();
    });
  };

  const createGameCard = (appid: string, game: GamePairStore): HTMLDivElement => {
    const myData = game.myData!;
    const friendData = game.friendData;
    const card = document.createElement('div');
    card.className = 'wghGameCard';
    card.dataset.appid = appid;
    card.dataset.canGiftApi = myData.canGift ? 'true' : 'false';

    const reviewClass = getReviewClass(myData.reviewPercent, myData.reviewCount);
    const releaseDateStr = myData.releaseDateTimestamp
      ? new Date(myData.releaseDateTimestamp * 1000).toLocaleDateString('ru-RU')
      : 'Неизвестно';

    let friendPriceStr = '';
    let priceDiffStr = '';
    let priceDiffClass = '';
    let friendRrcHtml = '';

    if (giftModeActive && friendData?.priceData && myData?.priceData && exchangeRates && currentFriendCountryCode) {
      const friendCents = friendData.priceData.finalCents;
      const myCents = myData.priceData.finalCents;
      if (friendCents !== null && myCents !== null) {
        const friendInMyCurr = convertCurrency(friendCents / 100, currentFriendCountryCode, currentUserCountryCode);
        if (friendInMyCurr !== null) {
          const myPrice = myCents / 100;
          const diff = friendInMyCurr - myPrice;
          const diffPercent = myPrice > 0 ? diff / myPrice : diff > 0 ? Infinity : -Infinity;
          friendPriceStr = `Цена друга: ${friendInMyCurr.toLocaleString('ru-RU', {
            style: 'currency',
            currency: currentUserISOCurrencyCode,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}`;
          priceDiffClass = diff <= 0.01 ? 'wghPriceDiffGood' : 'wghPriceDiffBad';
          priceDiffStr = `Разница: ${diff > 0 ? '+' : ''}${diff.toLocaleString('ru-RU', {
            style: 'currency',
            currency: currentUserISOCurrencyCode,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })} (${
            diffPercent === Infinity || diffPercent === -Infinity ? '∞' : `${(diffPercent * 100).toFixed(0)}%`
          })`;

          if (friendData.rrcInfo?.valve) {
            const fv = friendData.rrcInfo.valve;
            const fCurrCode = WGH_COUNTRY_CURRENCY_MAP[currentFriendCountryCode].code;
            const tMap: Record<string, string> = { lower: '<', equal: '=', higher: '>' };
            friendRrcHtml = `<div style="font-size:11px; color:#8f98a0; margin-top:3px;">Рек. друга (Valve): ${formatSteamPrice(
              fv.recommendedCents,
              fCurrCode
            )} (${tMap[fv.status]} на ${Math.abs(fv.diffPercent).toFixed(0)}%)</div>`;
          }
        } else {
          friendPriceStr = 'Цена друга: Ошибка конв.';
        }
      } else {
        friendPriceStr = 'Цена друга: N/A';
      }
    } else if (giftModeActive) {
      friendPriceStr = 'Цена друга: ...';
    }

    const tagsHtml = (myData.tagids || [])
      .slice(0, 5)
      .map((tagId) => `<div class="wghTag">${escapeHtml(allTags[String(tagId)] || `Тег #${tagId}`)}</div>`)
      .join('');

    let ruLangText = 'Отсутствует';
    if (myData.language_support_russian) {
      const parts: string[] = [];
      if (myData.language_support_russian.supported) parts.push('Интерфейс');
      if (myData.language_support_russian.full_audio) parts.push('Озвучка');
      if (myData.language_support_russian.subtitles) parts.push('Субтитры');
      if (parts.length > 0) ruLangText = parts.join(', ');
    }

    let rrcInfoHtml = '';
    if (myData.rrcInfo) {
      const buildRow = (label: string, data: RrcCompareEntry | null) => {
        if (!data) return '';
        const textMap: Record<string, string> = { lower: '<', equal: '=', higher: '>' };
        const diffText = `${data.diff > 0 ? '+' : ''}${formatSteamPrice(
          Math.round(data.diff * 100),
          currentUserCurrencyCode
        )} (${data.diffPercent.toFixed(0)}%)`;
        const recText = ` | ${formatSteamPrice(data.recommendedCents, currentUserCurrencyCode)}`;
        return `<div class="wghRrcInfo wghRrc-${data.status}">
          <span class="wghRrcStatus">${textMap[data.status]} ${label}${recText}</span>
          <span class="wghRrcDiff">${diffText}</span>
        </div>`;
      };
      rrcInfoHtml += buildRow('Valve', myData.rrcInfo.valve);
      rrcInfoHtml += buildRow('ППС', myData.rrcInfo.parity);
      rrcInfoHtml += buildRow('Курс', myData.rrcInfo.fx);
    }

    const descBtn = document.createElement('button');
    descBtn.type = 'button';
    descBtn.textContent = 'Описание';
    descBtn.className = 'wghDescButton';
    descBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      showDescriptionModal(myData.name, myData.short_description);
    };

    card.innerHTML = `
      <a href="https://store.steampowered.com/app/${appid}" target="_blank" rel="noreferrer" class="wghCardLink">
        <div class="wghCardImageWrapper">
          <img src="${myData.imageUrl}" alt="" loading="lazy">
          ${
            (myData.priceData?.discountPercent || 0) > 0
              ? `<div class="wghCardDiscountBadge">-${myData.priceData!.discountPercent}%</div>`
              : ''
          }
        </div>
      </a>
      <div class="wghCardContent">
        <a href="https://store.steampowered.com/app/${appid}" target="_blank" rel="noreferrer" class="wghCardTitle" title="${escapeHtml(
      myData.name
    )}">${escapeHtml(myData.name)}</a>
        <div class="wghCardPrice">
          ${
            myData.priceData?.formattedOriginal
              ? `<span class="wghOriginalPrice">${myData.priceData.formattedOriginal}</span>`
              : ''
          }
          <span class="wghCurrentPrice">${myData.priceData?.formattedFinal || 'N/A'}</span>
        </div>
        ${rrcInfoHtml}
        <div class="wghCardReviews ${reviewClass}" title="${myData.reviewCount.toLocaleString('ru-RU')} отзывов">${getCustomReviewDescription(
      myData.reviewPercent,
      myData.reviewCount
    )} (${myData.reviewPercent}%) | ${myData.reviewCount.toLocaleString('ru-RU')}</div>
        <div class="wghCardInfoGrid">
          <div class="wghCardInfoItem"><strong>Издатель:</strong> <span>${escapeHtml(myData.publishers || 'N/A')}</span></div>
          <div class="wghCardInfoItem"><strong>Разработчик:</strong> <span>${escapeHtml(myData.developers || 'N/A')}</span></div>
          <div class="wghCardInfoItem"><strong>Серия:</strong> <span>${escapeHtml(myData.franchises || 'N/A')}</span></div>
          <div class="wghCardInfoItem"><strong>Ранний доступ:</strong> <span>${myData.is_early_access ? 'Да' : 'Нет'}</span></div>
          <div class="wghCardInfoItem"><strong>Дата выхода:</strong> <span>${releaseDateStr}</span></div>
          <div class="wghCardInfoItem"><strong>Русский язык:</strong> <span>${ruLangText}</span></div>
        </div>
        <div class="wghTagsContainer">${tagsHtml}</div>
        <div class="wghCardFooter">
          ${myData.canGift ? '' : '<div class="wghCannotGift">Нельзя подарить</div>'}
          ${friendPriceStr ? `<div class="wghFriendPrice">${friendPriceStr}</div>` : ''}
          ${priceDiffStr ? `<div class="wghPriceDiff ${priceDiffClass}">${priceDiffStr}</div>` : ''}
          ${friendRrcHtml}
        </div>
      </div>
    `;

    const imgEl = card.querySelector('.wghCardImageWrapper img') as HTMLImageElement | null;
    if (imgEl) {
      imgEl.onerror = () => {
        imgEl.onerror = null;
        imgEl.src = `${WGH_IMAGE_BASE_URL}${appid}/header.jpg`;
      };
    }

    card.querySelector('.wghCardFooter')?.prepend(descBtn);
    return card;
  };

  const renderResults = () => {
    if (!resultsDiv) return;
    resultsDiv.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const ids = Object.keys(gameDataStore).sort((a, b) =>
      compareItems(gameDataStore[a]?.myData || null, gameDataStore[b]?.myData || null, currentSort.field, currentSort.direction)
    );
    ids.forEach((appid) => {
      if (gameDataStore[appid]?.myData) {
        fragment.appendChild(createGameCard(appid, gameDataStore[appid]));
      }
    });
    resultsDiv.appendChild(fragment);
    applyFilters();
  };

  const handleSort = (field: string) => {
    const defaults: Record<string, 'asc' | 'desc'> = {
      price: 'asc',
      discountPercent: 'desc',
      name: 'asc',
      releaseDateTimestamp: 'desc',
      reviewPercent: 'desc',
    };
    const nextDir: 'asc' | 'desc' =
      currentSort.field === field ? (currentSort.direction === 'asc' ? 'desc' : 'asc') : defaults[field] || 'asc';
    currentSort = { field, direction: nextDir };
    renderResults();
    updateSortButtonsState();
  };

  const hideGiftMode = (resetSelection = false) => {
    giftModeActive = false;
    currentFriendCountryCode = null;
    if (giftModeContainer) giftModeContainer.style.display = 'none';
    if (giftIconBtn) giftIconBtn.classList.remove('active');
    if (resetSelection && friendRegionSelect) friendRegionSelect.value = '';
    hideProgressBar(giftProgressBar);
    Object.values(gameDataStore).forEach((g) => {
      g.friendData = null;
    });
    renderResults();
  };

  const toggleGiftMode = () => {
    giftModeActive = !giftModeActive;
    if (giftModeContainer) giftModeContainer.style.display = giftModeActive ? 'block' : 'none';
    if (giftIconBtn) giftIconBtn.classList.toggle('active', giftModeActive);
    if (!giftModeActive) hideGiftMode(true);
    renderResults();
  };

  const fetchFriendData = async () => {
    const selected = friendRegionSelect?.value || '';
    if (!selected) {
      updateStatus('Выберите регион друга.');
      return;
    }
    if (allAppIds.length === 0) {
      updateStatus('Сначала нажмите «Собрать данные».');
      return;
    }

    currentFriendCountryCode = selected;
    const totalBatches = Math.ceil(allAppIds.length / WGH_BATCH_SIZE);
    updateStatus(`Запрос цен для региона ${currentFriendCountryCode}... (0/${totalBatches})`, true);
    showProgressBar(giftProgressBar, 0);

    Object.values(gameDataStore).forEach((g) => {
      g.friendData = null;
    });
    exchangeRates = null;

    try {
      const friendCurr = WGH_COUNTRY_CURRENCY_MAP[currentFriendCountryCode];
      const myCurr = WGH_COUNTRY_CURRENCY_MAP[currentUserCountryCode];
      if (friendCurr && myCurr && friendCurr.code !== myCurr.code) {
        updateStatus('Получение курсов валют...', true);
        try {
          exchangeRates = await fetchExchangeRates(friendCurr.iso);
        } catch {
          updateStatus('Не удалось получить курсы валют — сравнение цен будет неточным.');
          await new Promise((r) => setTimeout(r, 1500));
          exchangeRates = {};
        }
      } else {
        exchangeRates = {};
      }

      let doneBatches = 0;
      for (let i = 0; i < allAppIds.length; i += WGH_BATCH_SIZE) {
        const batch = allAppIds.slice(i, i + WGH_BATCH_SIZE);
        const batchData = await fetchBatchGameData(batch, currentFriendCountryCode);
        processBatchData(batchData, 'friendData');
        doneBatches++;
        updateProgressBar(giftProgressBar, (doneBatches / totalBatches) * 100);
        updateStatus(`Запрос цен для региона ${currentFriendCountryCode}... (${doneBatches}/${totalBatches})`, true);
        await new Promise((r) => setTimeout(r, 200));
      }

      processRrcData('friendData', currentFriendCountryCode);
      updateStatus(`Цены для региона ${currentFriendCountryCode} получены.`);
      renderResults();
      hideProgressBar(giftProgressBar);
    } catch (err: any) {
      updateStatus(`Ошибка при получении цен друга: ${err?.message || 'ошибка'}`);
      hideProgressBar(giftProgressBar);
      renderResults();
    }
  };

  const collectData = async () => {
    updateStatus('Извлечение AppID из списка желаемого...', true);
    if (resultsDiv) resultsDiv.innerHTML = '';
    gameDataStore = {};
    hideGiftMode(true);
    showProgressBar(progressBar, 0);

    try {
      allAppIds = await extractAppIdsFromPage();
      if (allAppIds.length === 0) {
        updateStatus('Не удалось найти игры в списке желаемого.');
        hideProgressBar(progressBar);
        return;
      }

      updateStatus('Получение матрицы цен Steam...', true);
      await fetchSteamPricingMatrix();

      const totalGames = allAppIds.length;
      const totalBatches = Math.ceil(totalGames / WGH_BATCH_SIZE);

      updateStatus(`Запрос данных для вашего региона (${currentUserCountryCode})... (0/${totalBatches})`, true);
      for (let i = 0; i < totalGames; i += WGH_BATCH_SIZE) {
        const batch = allAppIds.slice(i, i + WGH_BATCH_SIZE);
        const batchData = await fetchBatchGameData(batch, currentUserCountryCode);
        processBatchData(batchData, 'myData');
        const batchIdx = Math.ceil((i + batch.length) / WGH_BATCH_SIZE);
        updateProgressBar(progressBar, ((i + batch.length) / totalGames) * 50);
        updateStatus(`Запрос данных для вашего региона (${currentUserCountryCode})... (${batchIdx}/${totalBatches})`, true);
        await new Promise((r) => setTimeout(r, 200));
      }

      if (currentUserCountryCode !== 'US') {
        updateStatus(`Запрос данных из US для анализа РРЦ... (0/${totalBatches})`, true);
        for (let i = 0; i < totalGames; i += WGH_BATCH_SIZE) {
          const batch = allAppIds.slice(i, i + WGH_BATCH_SIZE);
          const usBatch = await fetchBatchGameData(batch, 'US');
          processBatchData(usBatch, 'usData');
          const batchIdx = Math.ceil((i + batch.length) / WGH_BATCH_SIZE);
          updateProgressBar(progressBar, 50 + ((i + batch.length) / totalGames) * 50);
          updateStatus(`Запрос данных из US... (${batchIdx}/${totalBatches})`, true);
          await new Promise((r) => setTimeout(r, 200));
        }
      } else {
        for (const appid of Object.keys(gameDataStore)) {
          if (gameDataStore[appid].myData) {
            gameDataStore[appid].usData = gameDataStore[appid].myData;
          }
        }
      }

      processRrcData('myData', currentUserCountryCode);
      updateStatus(`Данные для ${Object.keys(gameDataStore).length} игр получены.`);
      renderResults();
      hideProgressBar(progressBar);
      updateFilterPlaceholders();
    } catch (err: any) {
      updateStatus(`Ошибка при сборе данных: ${err?.message || 'ошибка'}`);
      hideProgressBar(progressBar);
    }
  };

  const renderTagFilters = () => {
    const activeCtn = document.getElementById('wgh-active-tag-filters-container');
    const hiddenCtn = document.getElementById('wgh-hidden-tag-filters-container');
    if (!activeCtn || !hiddenCtn) return;
    activeCtn.innerHTML = '';
    hiddenCtn.innerHTML = '';

    for (const tagId of Object.keys(activeTagFilters)) {
      const row = document.createElement('div');
      row.className = 'wgh-tag-row';
      row.innerHTML = `<span>${allTags[tagId] || `TagID: ${tagId}`}</span><input type="number" min="1" max="20" value="${activeTagFilters[tagId]}"><button type="button" class="wgh-tag-del">×</button>`;
      const inp = row.querySelector('input') as HTMLInputElement;
      inp.onchange = () => {
        let v = parseInt(inp.value, 10);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 20) v = 20;
        activeTagFilters[tagId] = v;
        inp.value = String(v);
      };
      (row.querySelector('.wgh-tag-del') as HTMLButtonElement).onclick = () => {
        delete activeTagFilters[tagId];
        renderTagFilters();
      };
      activeCtn.appendChild(row);
    }

    for (const tagId of Object.keys(hiddenTagFilters)) {
      const row = document.createElement('div');
      row.className = 'wgh-tag-row';
      row.innerHTML = `<span>${allTags[tagId] || `TagID: ${tagId}`}</span><button type="button" class="wgh-tag-del">×</button>`;
      (row.querySelector('.wgh-tag-del') as HTMLButtonElement).onclick = () => {
        delete hiddenTagFilters[tagId];
        renderTagFilters();
      };
      hiddenCtn.appendChild(row);
    }
  };

  const createTagModal = () => {
    if (document.getElementById('wgh-tag-filter-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'wgh-tag-filter-modal';
    overlay.className = 'wgh-tag-overlay';
    overlay.innerHTML = `
      <div class="wgh-tag-modal">
        <div class="wgh-tag-header">
          <h3>Настройка умных меток</h3>
          <button type="button" id="wgh-tag-close" style="background:none;border:none;color:#c6d4df;font-size:22px;cursor:pointer;">&times;</button>
        </div>
        <input type="text" id="wgh-tag-search" class="wgh-tag-search" placeholder="Введите название метки (от 2 букв)...">
        <div id="wgh-tag-search-results" class="wgh-tag-results"></div>
        <div class="wgh-tag-cols">
          <div class="wgh-tag-col">
            <div style="color:#56d364;font-size:12px;font-weight:700;margin-bottom:8px;">Требуемые (макс. позиция)</div>
            <div id="wgh-active-tag-filters-container"></div>
          </div>
          <div class="wgh-tag-col">
            <div style="color:#ff6961;font-size:12px;font-weight:700;margin-bottom:8px;">Исключённые метки</div>
            <div id="wgh-hidden-tag-filters-container"></div>
          </div>
        </div>
        <div style="margin-top:14px;text-align:right;">
          <button type="button" id="wgh-tag-apply" class="wghBtn wghPrimaryBtn">Применить и закрыть</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const searchInp = document.getElementById('wgh-tag-search') as HTMLInputElement;
    const resCtn = document.getElementById('wgh-tag-search-results')!;

    searchInp.addEventListener('input', () => {
      const q = searchInp.value.trim().toLowerCase();
      resCtn.innerHTML = '';
      if (q.length < 2) return;
      Object.entries(allTags)
        .filter(([id, name]) => name.toLowerCase().includes(q) && !activeTagFilters[id] && !hiddenTagFilters[id])
        .slice(0, 40)
        .forEach(([id, name]) => {
          const item = document.createElement('div');
          item.className = 'wgh-tag-res-item';
          item.textContent = name;
          item.onclick = () => {
            activeTagFilters[id] = 5;
            renderTagFilters();
            searchInp.value = '';
            resCtn.innerHTML = '';
          };
          resCtn.appendChild(item);
        });
    });

    document.getElementById('wgh-tag-close')!.onclick = () => (overlay.style.display = 'none');
    document.getElementById('wgh-tag-apply')!.onclick = () => {
      overlay.style.display = 'none';
      applyFilters();
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  };

  const hideModal = () => {
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  const createModal = () => {
    if (document.getElementById('wghModal')) return;
    modal = document.createElement('div');
    modal.id = 'wghModal';
    modal.style.cssText =
      'position: fixed; inset: 0; background-color: rgba(20, 20, 25, 0.95); backdrop-filter: blur(3px); z-index: 99999; display: none; color: #c6d4df; font-family: "Motiva Sans", Arial, sans-serif; overflow: hidden;';

    const ctn = document.createElement('div');
    ctn.style.cssText = 'height: 100%; display: flex; flex-direction: column; padding: 15px; box-sizing: border-box;';

    const header = document.createElement('div');
    header.style.cssText =
      'display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-bottom: 10px; border-bottom: 1px solid #3a4f6a; margin-bottom: 10px; flex-shrink: 0; padding-right: 45px;';

    const collectBtn = document.createElement('button');
    collectBtn.type = 'button';
    collectBtn.id = 'wghCollectBtn';
    collectBtn.className = 'wghBtn wghPrimaryBtn';
    collectBtn.textContent = 'Собрать данные';
    collectBtn.onclick = collectData;

    statusDiv = document.createElement('div');
    statusDiv.style.cssText =
      'flex-grow: 1; text-align: center; font-size: 13.5px; color: #aaa; min-height: 36px; display: flex; align-items: center; justify-content: center;';

    const filterToggleBtn = document.createElement('button');
    filterToggleBtn.type = 'button';
    filterToggleBtn.className = 'wghBtn';
    filterToggleBtn.title = 'Фильтры';
    filterToggleBtn.textContent = '🛠️';
    filterToggleBtn.onclick = () => {
      if (!filterAccordionContainer) return;
      const open = filterAccordionContainer.style.display !== 'block';
      filterAccordionContainer.style.display = open ? 'block' : 'none';
      filterToggleBtn.classList.toggle('active', open);
    };

    sortButtonsContainer = document.createElement('div');
    sortButtonsContainer.style.cssText = 'display: flex; gap: 5px; align-items: center; margin-left: auto; flex-wrap: wrap;';
    [
      ['price', 'Цена'],
      ['discountPercent', '% Скидки'],
      ['name', 'Название'],
      ['releaseDateTimestamp', 'Дата выхода'],
      ['reviewPercent', '% Отзывов'],
    ].forEach(([field, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wghBtn sortBtn';
      b.dataset.sort = field;
      b.textContent = label;
      b.onclick = () => handleSort(field);
      sortButtonsContainer!.appendChild(b);
    });

    giftIconBtn = document.createElement('button');
    giftIconBtn.type = 'button';
    giftIconBtn.id = 'wghGiftModeBtn';
    giftIconBtn.className = 'wghBtn';
    giftIconBtn.title = 'Режим помощника подарков';
    giftIconBtn.textContent = '🎁';
    giftIconBtn.onclick = toggleGiftMode;

    header.append(collectBtn, statusDiv, filterToggleBtn, sortButtonsContainer, giftIconBtn);
    ctn.appendChild(header);

    filterAccordionContainer = document.createElement('div');
    filterAccordionContainer.className = 'wghAccordionContainer';
    filterAccordionContainer.innerHTML = `
      <div class="wghFilterGrid">
        <div class="wghFilterGroup">
          <label class="wghFilterLabel"><input type="checkbox" id="wghFilterDiscounted"> Только со скидками</label>
          <label class="wghFilterLabel"><input type="checkbox" id="wghFilterNoPrice"> Скрыть без цены</label>
          <div style="margin-top: 6px;"><button type="button" id="wghOpenTagModalBtn" class="wghBtn">Умные метки...</button></div>
        </div>
        <div class="wghFilterGroup">
          <label class="wghFilterLabel">Кол-во обзоров</label>
          <div class="wghRangeInput"><input type="number" id="wghFilterReviewCountMin" placeholder="От"><input type="number" id="wghFilterReviewCountMax" placeholder="До"></div>
        </div>
        <div class="wghFilterGroup">
          <label class="wghFilterLabel">Рейтинг обзоров (%)</label>
          <div class="wghRangeInput"><input type="number" id="wghFilterRatingMin" placeholder="От"><input type="number" id="wghFilterRatingMax" placeholder="До"></div>
        </div>
        <div class="wghFilterGroup">
          <label class="wghFilterLabel">Цена</label>
          <div class="wghRangeInput"><input type="number" id="wghFilterPriceMin" placeholder="От"><input type="number" id="wghFilterPriceMax" placeholder="До"></div>
        </div>
        <div class="wghFilterGroup">
          <label class="wghFilterLabel">Скидка (%)</label>
          <div class="wghRangeInput"><input type="number" id="wghFilterDiscountMin" placeholder="От"><input type="number" id="wghFilterDiscountMax" placeholder="До"></div>
        </div>
        <div class="wghFilterGroup">
          <label class="wghFilterLabel">Дата выхода</label>
          <div class="wghRangeInput"><input type="date" id="wghFilterDateMin"><input type="date" id="wghFilterDateMax"></div>
        </div>
        <div class="wghFilterGroup">
          <label class="wghFilterLabel">Русский язык</label>
          <div class="wghRadioGroup">
            <label><input type="radio" name="wghLangFilter" value="any" checked>Все</label>
            <label><input type="radio" name="wghLangFilter" value="text_only">Только текст</label>
            <label><input type="radio" name="wghLangFilter" value="voice">Озвучка</label>
            <label><input type="radio" name="wghLangFilter" value="none">Без перевода</label>
          </div>
        </div>
        <div class="wghFilterGroup">
          <label class="wghFilterLabel">Ранний доступ</label>
          <div class="wghRadioGroup">
            <label><input type="radio" name="wghEaFilter" value="any" checked>Все</label>
            <label><input type="radio" name="wghEaFilter" value="early_access">Только</label>
            <label><input type="radio" name="wghEaFilter" value="released">Без</label>
          </div>
        </div>
        <div class="wghFilterGroup">
          <label class="wghFilterLabel">Статус релиза</label>
          <div class="wghRadioGroup">
            <label><input type="radio" name="wghReleaseFilter" value="any" checked>Все</label>
            <label><input type="radio" name="wghReleaseFilter" value="released">Вышедшие</label>
            <label><input type="radio" name="wghReleaseFilter" value="unreleased">Не вышедшие</label>
          </div>
        </div>
        <div class="wghFilterGroup">
          <label class="wghFilterLabel">Демо / Плейтесты</label>
          <div class="wghRadioGroup">
            <label><input type="radio" name="wghDemoFilter" value="any" checked>Все</label>
            <label><input type="radio" name="wghDemoFilter" value="both">Демо и плейтесты</label>
            <label><input type="radio" name="wghDemoFilter" value="demo">Только демо</label>
            <label><input type="radio" name="wghDemoFilter" value="playtest">Только плейтесты</label>
          </div>
        </div>
        <div class="wghFilterGroup">
          <label class="wghFilterLabel">Фильтр по РРЦ (Valve)</label>
          <div class="wghRadioGroup">
            <label><input type="radio" name="wghRrcFilter" value="any" checked>Все</label>
            <label><input type="radio" name="wghRrcFilter" value="lower">Дешевле РРЦ</label>
            <label><input type="radio" name="wghRrcFilter" value="equal">Равно РРЦ</label>
            <label><input type="radio" name="wghRrcFilter" value="higher">Дороже РРЦ</label>
          </div>
        </div>
      </div>
      <button type="button" id="wghResetFilters" class="wghBtn">Сбросить фильтры</button>
    `;

    giftModeContainer = document.createElement('div');
    giftModeContainer.className = 'wghAccordionContainer';
    const accContent = document.createElement('div');
    accContent.className = 'wghAccordionContent';

    const myRegBox = document.createElement('div');
    myRegBox.innerHTML = `Ваш регион: <strong id="wghMyRegionDisplay">${currentUserCountryCode} (${currentUserISOCurrencyCode})</strong>`;
    myRegBox.style.marginRight = '12px';
    myRegionDisplay = myRegBox.querySelector('strong');

    const regLabel = document.createElement('label');
    regLabel.textContent = 'Регион друга: ';

    friendRegionSelect = document.createElement('select');
    friendRegionSelect.className = 'wghSelect';
    friendRegionSelect.innerHTML = '<option value="">-- Выберите --</option>';
    Object.entries(WGH_COUNTRY_CURRENCY_MAP)
      .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'ru'))
      .forEach(([code, data]) => {
        if (code !== currentUserCountryCode) {
          const opt = document.createElement('option');
          opt.value = code;
          opt.textContent = `${data.name} (${code})`;
          friendRegionSelect!.appendChild(opt);
        }
      });

    fetchFriendPricesBtn = document.createElement('button');
    fetchFriendPricesBtn.type = 'button';
    fetchFriendPricesBtn.className = 'wghBtn wghPrimaryBtn';
    fetchFriendPricesBtn.textContent = 'Узнать цены';
    fetchFriendPricesBtn.onclick = fetchFriendData;

    accContent.append(myRegBox, regLabel, friendRegionSelect, fetchFriendPricesBtn);
    giftModeContainer.appendChild(accContent);

    const resultsScroll = document.createElement('div');
    resultsScroll.id = 'wghResultsContainer';
    resultsScroll.style.cssText = 'flex-grow: 1; overflow-y: auto; overflow-x: hidden; padding-right: 5px;';

    resultsDiv = document.createElement('div');
    resultsDiv.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; padding-top: 4px;';
    resultsScroll.appendChild(resultsDiv);

    progressBar = createProgressBar('wghMainProgress');
    giftProgressBar = createProgressBar('wghGiftProgress');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = hideModal;
    closeBtn.style.cssText =
      'position: absolute; top: 10px; right: 15px; font-size: 30px; color: #aaa; background: none; border: none; cursor: pointer; line-height: 1; z-index: 10002;';

    ctn.append(header, filterAccordionContainer, giftModeContainer, resultsScroll, progressBar, giftProgressBar);
    modal.append(closeBtn, ctn);
    document.body.appendChild(modal);

    updateSortButtonsState();
    createTagModal();

    const filterInputs = [
      'wghFilterReviewCountMin',
      'wghFilterReviewCountMax',
      'wghFilterRatingMin',
      'wghFilterRatingMax',
      'wghFilterPriceMin',
      'wghFilterPriceMax',
      'wghFilterDiscountMin',
      'wghFilterDiscountMax',
      'wghFilterDateMin',
      'wghFilterDateMax',
    ];
    filterInputs.forEach((id) => document.getElementById(id)?.addEventListener('input', scheduleFilterApply));
    ['wghFilterDiscounted', 'wghFilterNoPrice'].forEach((id) =>
      document.getElementById(id)?.addEventListener('change', scheduleFilterApply)
    );
    document
      .querySelectorAll('input[name="wghLangFilter"], input[name="wghEaFilter"], input[name="wghReleaseFilter"], input[name="wghDemoFilter"], input[name="wghRrcFilter"]')
      .forEach((r) => r.addEventListener('change', scheduleFilterApply));

    document.getElementById('wghResetFilters')?.addEventListener('click', () => {
      filterAccordionContainer?.querySelectorAll('input').forEach((raw) => {
        const inp = raw as HTMLInputElement;
        if (inp.type === 'checkbox') inp.checked = false;
        if (inp.type === 'number' || inp.type === 'date') inp.value = '';
        if (inp.type === 'radio' && inp.value === 'any') inp.checked = true;
      });
      Object.keys(activeTagFilters).forEach((k) => delete activeTagFilters[k]);
      Object.keys(hiddenTagFilters).forEach((k) => delete hiddenTagFilters[k]);
      scheduleFilterApply();
    });

    document.getElementById('wghOpenTagModalBtn')?.addEventListener('click', () => {
      const tm = document.getElementById('wgh-tag-filter-modal');
      if (tm) {
        tm.style.display = 'flex';
        renderTagFilters();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.style.display === 'block') {
        const dm = document.getElementById('wghDescriptionModal');
        const tm = document.getElementById('wgh-tag-filter-modal');
        if (dm) dm.remove();
        else if (tm && tm.style.display !== 'none') tm.style.display = 'none';
        else hideModal();
      }
    });
  };

  const showModal = () => {
    if (!modal) createModal();
    updateStatus('Нажмите «Собрать данные» для анализа списка желаемого.');
    if (resultsDiv) resultsDiv.innerHTML = '';
    gameDataStore = {};
    hideGiftMode(true);
    if (filterAccordionContainer) filterAccordionContainer.style.display = 'none';
    hideProgressBar(progressBar);
    hideProgressBar(giftProgressBar);
    document.body.style.overflow = 'hidden';
    if (modal) modal.style.display = 'block';
  };

  const addAnalyzeButton = (): boolean => {
    if (document.getElementById('wghAnalyzeButton')) return true;
    let titleBlock: Element | null = document.querySelector('div.G-xGsXlx-Sw-');
    if (!titleBlock) {
      for (const h2 of Array.from(document.querySelectorAll('h2'))) {
        if (h2.textContent && (h2.textContent.toUpperCase().includes('WISHLIST') || h2.textContent.toUpperCase().includes('СПИСОК ЖЕЛАЕМОГО'))) {
          titleBlock = h2.parentElement;
          break;
        }
      }
    }
    if (!titleBlock) return false;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'wghAnalyzeButton';
    btn.title = 'Помощник подарков в списке желаемого';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`;
    Object.assign(btn.style, {
      marginLeft: '14px',
      background: 'rgba(103, 193, 245, 0.12)',
      border: '1px solid rgba(103, 193, 245, 0.35)',
      color: '#67c1f5',
      borderRadius: '3px',
      cursor: 'pointer',
      padding: '5px 8px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      verticalAlign: 'middle',
    });
    btn.onclick = showModal;

    const h2Title = titleBlock.querySelector('h2') as HTMLElement | null;
    if (h2Title) {
      h2Title.style.display = 'inline-block';
      h2Title.after(btn);
    } else {
      titleBlock.appendChild(btn);
    }
    return true;
  };

  setTimeout(async () => {
    allTags = await loadSteamTags();
    detectUserRegion();
    if (!addAnalyzeButton()) {
      const obs = new MutationObserver((_m, o) => {
        if (addAnalyzeButton()) o.disconnect();
      });
      if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    }
  }, WGH_INITIAL_DELAY_MS);
}
