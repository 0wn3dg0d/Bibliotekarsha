import {
  StoreWebkitConfig,
  fetchViaBackend,
  idbGet,
  idbSet,
  injectStyleOnce,
} from '../../shared/ipc';
import { fetchPicsPackagesDirect } from '../pics/cmClient';

const PGH_API_URL = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1';
const PGH_CURRENCY_API_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/';
const RATES_TTL = 6 * 60 * 60 * 1000;
const PICS_CACHE_PREFIX = 'bsh_pics_v2_sub_';
const PICS_CACHE_TTL = 24 * 60 * 60 * 1000;

const PGH_COUNTRY_CURRENCY_MAP: Record<string, { name: string; code: number; iso: string }> = {
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

const PGH_CSS = `
  .pgh_button { margin-left: 3px; }
  #pghModal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #1b2838;
    color: #c6d4df;
    padding: 20px;
    border-radius: 5px;
    border: 1px solid #67c1f5;
    box-shadow: 0 5px 25px rgba(0, 0, 0, 0.78);
    z-index: 100010;
    display: none;
    width: 420px;
    max-width: 92vw;
    font-family: "Motiva Sans", Sans-serif, Arial;
  }
  #pghModalHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  #pghModal h3 { margin: 0; color: #67c1f5; font-weight: 500; font-size: 16px; }
  #pghHelpBtn {
    background: none;
    border: none;
    color: #67c1f5;
    font-size: 18px;
    cursor: pointer;
    padding: 0 8px;
    line-height: 1;
    margin-right: 25px;
  }
  #pghHelpBtn:hover { color: #fff; }
  #pghHelpContent {
    display: none;
    background-color: #101822;
    border: 1px solid #2a3f5a;
    padding: 10px;
    border-radius: 3px;
    font-size: 12px;
    line-height: 1.5;
    margin-bottom: 15px;
    color: #8f98a0;
  }
  #pghModal label { display: block; margin-bottom: 5px; font-size: 14px; }
  #pghRegionSelect {
    width: 100%;
    padding: 8px 10px;
    margin-bottom: 15px;
    background-color: #2a3f5a;
    border: 1px solid #567d9c;
    color: #ebebeb;
    border-radius: 3px;
    font-size: 14px;
    cursor: pointer;
    outline: none;
  }
  #pghRegionSelect:focus { border-color: #67c1f5; background-color: #314b6a; }
  #pghRegionSelect option { background-color: #1b2838; color: #c6d4df; }
  #pghFetchBtn {
    display: block;
    width: 100%;
    padding: 10px;
    background-color: #67c1f5;
    color: #1b2838;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 15px;
    font-weight: bold;
    transition: background-color 0.2s;
    margin-bottom: 15px;
  }
  #pghFetchBtn:hover:not(:disabled) { background-color: #8ad3f7; }
  #pghFetchBtn:disabled { background-color: #556772; cursor: default; }
  #pghResult {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #3a4f6a;
    font-size: 13px;
    line-height: 1.5;
  }
  .pgh_status_loading { text-align: center; color: #8f98a0; }
  .pgh_status_error { color: #ff6961; font-weight: bold; }
  .pgh_result_block {
    padding: 10px;
    border-radius: 3px;
    margin-top: 10px;
    text-align: center;
    font-weight: bold;
    font-size: 14px;
  }
  .pgh_result_good { background-color: rgba(119, 221, 119, 0.1); border: 1px solid #77dd77; color: #dff0d8; }
  .pgh_result_warn { background-color: rgba(255, 179, 0, 0.1); border: 1px solid #ffb300; color: #ffe599; }
  .pgh_result_bad { background-color: rgba(255, 105, 97, 0.15); border: 1px solid #ff6961; color: #f2dede; }
  .pgh_pics_status {
    margin-top: 10px;
    font-size: 12px;
    padding: 8px;
    border-radius: 3px;
    text-align: center;
  }
  #pghCloseBtn {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 24px;
    color: #8f98a0;
    background: none;
    border: none;
    cursor: pointer;
    line-height: 1;
    padding: 0 5px;
  }
  #pghCloseBtn:hover { color: #ffffff; }
`;

function parsePrice(priceStr: string | number | null | undefined): number | null {
  if (typeof priceStr !== 'string' && typeof priceStr !== 'number') return null;
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

function formatCurrencySafe(val: number, iso: string): string {
  try {
    return val.toLocaleString('ru-RU', {
      style: 'currency',
      currency: iso.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${val.toFixed(2)} ${iso.toUpperCase()}`;
  }
}

export function initStoreGiftHelperModule(cfg: StoreWebkitConfig): void {
  if (!cfg.giftHelper) return;
  if (!window.location.pathname.includes('/app/')) return;

  injectStyleOnce('bsh-pgh-styles', PGH_CSS);

  let modal: HTMLDivElement | null = null;
  let resultDiv: HTMLDivElement | null = null;
  let fetchBtn: HTMLButtonElement | null = null;
  let regionSelect: HTMLSelectElement | null = null;
  let currentAppId: string | null = null;
  let currentUserPrice: number | null = null;
  let currentUserCurrencyISO = 'rub';
  const memoryRates: Record<string, Record<string, number>> = {};

  const getCurrentGameInfo = (): boolean => {
    const appIdMatch = window.location.pathname.match(/\/app\/(\d+)/);
    currentAppId = appIdMatch ? appIdMatch[1] : null;

    const priceMeta = document.querySelector('meta[itemprop="price"]') as HTMLMetaElement | null;
    const currencyMeta = document.querySelector('meta[itemprop="priceCurrency"]') as HTMLMetaElement | null;

    currentUserPrice = priceMeta ? parsePrice(priceMeta.content) : null;
    currentUserCurrencyISO = currencyMeta?.content ? currencyMeta.content.toLowerCase() : '';

    if (currentUserPrice === null || currentUserPrice === 0) {
      const purchaseBlock = document.querySelector(
        '.game_purchase_action .price[data-price-final], .discount_block .discount_final_price[data-price-final]'
      ) as HTMLElement | null;
      if (purchaseBlock?.dataset.priceFinal) {
        const cents = parsePrice(purchaseBlock.dataset.priceFinal);
        currentUserPrice = cents !== null ? cents / 100 : null;
      } else {
        const simplePrice = document.querySelector('.game_purchase_action .price:not([data-price-final])');
        if (simplePrice) {
          currentUserPrice = parsePrice(simplePrice.textContent?.trim());
        }
      }
    }

    if (!currentUserCurrencyISO) currentUserCurrencyISO = 'rub';
    return Boolean(currentAppId && currentUserPrice !== null && currentUserCurrencyISO);
  };

  const fetchFriendPrice = async (appId: string, friendCountryCode: string) => {
    const info = PGH_COUNTRY_CURRENCY_MAP[friendCountryCode];
    const inputJson = {
      ids: [{ appid: parseInt(appId, 10) }],
      context: { language: 'russian', country_code: friendCountryCode, steam_realm: 1 },
      data_request: { include_basic_info: true, include_all_purchase_options: true },
    };
    const res = await fetchViaBackend(`${PGH_API_URL}?input_json=${encodeURIComponent(JSON.stringify(inputJson))}`);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const parsed = JSON.parse(res.body);
    const itemData = parsed?.response?.store_items?.[0];
    if (itemData?.success === 1 && itemData?.best_purchase_option) {
      const priceData = itemData.best_purchase_option;
      const cents = priceData.final_price_in_cents ? parseInt(String(priceData.final_price_in_cents), 10) : null;
      return {
        price: cents !== null ? cents / 100 : null,
        currencyISO: info.iso,
        formatted: String(priceData.formatted_final_price || 'N/A'),
        packageId: priceData.packageid ? Number(priceData.packageid) : null,
      };
    }
    return { price: null, currencyISO: info.iso, formatted: 'Скрыта', packageId: null };
  };

  const fetchExchangeRates = async (baseIso: string): Promise<Record<string, number>> => {
    const key = baseIso.toLowerCase();
    if (memoryRates[key]) return memoryRates[key];

    const cacheKey = `bsh_pgh_rates_${key}`;
    const cached = await idbGet<{ ts: number; rates: Record<string, number> }>(cacheKey);
    if (cached?.rates && Date.now() - cached.ts < RATES_TTL) {
      memoryRates[key] = cached.rates;
      return cached.rates;
    }

    const res = await fetchViaBackend(`${PGH_CURRENCY_API_URL}${key}.json`);
    if (!res.ok || !res.body) throw new Error('Rates fetch failed');
    const json = JSON.parse(res.body);
    const rates = json?.[key];
    if (!rates || typeof rates !== 'object') throw new Error('Invalid rates');

    memoryRates[key] = rates;
    await idbSet(cacheKey, { ts: Date.now(), rates });
    return rates;
  };

  const checkPicsNative = async (packageId: number | null, friendCountryCode: string) => {
    if (!packageId) {
      return { status: 'unknown', message: 'Проверка PICS: Не найден ID пакета.' };
    }
    try {
      let picsData: any = null;
      const cached = await idbGet<{ ts: number; data: any }>(`${PICS_CACHE_PREFIX}${packageId}`);
      if (cached?.data && !cached.data.error && Date.now() - cached.ts < PICS_CACHE_TTL) {
        picsData = cached.data;
      } else {
        const fetched = await fetchPicsPackagesDirect([packageId]);
        picsData = fetched[packageId] || null;
        if (picsData && !picsData.error) {
          await idbSet(`${PICS_CACHE_PREFIX}${packageId}`, { ts: Date.now(), data: picsData });
        }
      }

      if (!picsData || picsData.error) {
        return { status: 'unknown', message: 'Проверка PICS: Не удалось получить данные пакета от Steam CM.' };
      }

      const extKey = Object.keys(picsData).find((k) => k.toLowerCase() === 'extended');
      const extended = extKey ? picsData[extKey] : null;
      if (extended && typeof extended === 'object') {
        const restrictedKey = Object.keys(extended).find(
          (k) => k.toLowerCase() === 'purchaserestrictedcountries'
        );
        if (restrictedKey) {
          const restrictedList = String(extended[restrictedKey] || '')
            .split(/\s+/)
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean);
          if (restrictedList.includes(friendCountryCode.toUpperCase())) {
            return {
              status: 'blocked',
              message: '🚫 ПОДАРОК НЕВОЗМОЖЕН: Жёсткая блокировка пакета издателем (PICS) для этого региона.',
            };
          }
        }
      }
      return { status: 'ok', message: '✅ PICS: Жёстких ограничений на этот регион нет.' };
    } catch {
      return { status: 'unknown', message: 'Проверка PICS: Ошибка подключения к Steam CM.' };
    }
  };

  const hideModal = () => {
    if (modal) modal.style.display = 'none';
  };

  const fetchAndComparePrices = async () => {
    if (!regionSelect || !resultDiv || !fetchBtn || !currentAppId || currentUserPrice === null) return;
    const selectedRegion = regionSelect.value;
    if (!selectedRegion) return;

    resultDiv.innerHTML = '<div class="pgh_status_loading">Анализ цен и проверка PICS через Steam CM...</div>';
    fetchBtn.disabled = true;
    regionSelect.disabled = true;

    try {
      const friendPriceData = await fetchFriendPrice(currentAppId, selectedRegion);
      const friendPrice = friendPriceData.price;
      const friendCurrencyISO = friendPriceData.currencyISO;

      let friendPriceInUserCurrency = friendPrice;
      let exchangeRateUsed: number | null = null;

      if (friendPrice !== null && currentUserCurrencyISO !== friendCurrencyISO) {
        try {
          const rates = await fetchExchangeRates(friendCurrencyISO);
          const rate = rates[currentUserCurrencyISO];
          if (rate !== undefined && rate !== null) {
            friendPriceInUserCurrency = parseFloat((friendPrice * rate).toFixed(2));
            exchangeRateUsed = rate;
          }
        } catch {
          friendPriceInUserCurrency = null;
        }
      }

      let localPackageId = friendPriceData.packageId;
      if (!localPackageId) {
        const subInput = document.querySelector('input[name="subid"]') as HTMLInputElement | null;
        if (subInput?.value) localPackageId = parseInt(subInput.value, 10);
      }
      if (!localPackageId) {
        const cartLink = document.querySelector('a[href*="addToCart("]') as HTMLAnchorElement | null;
        const m = cartLink?.getAttribute('href')?.match(/addToCart\(\s*(\d+)\s*\)/);
        if (m) localPackageId = parseInt(m[1], 10);
      }

      const picsResult = await checkPicsNative(localPackageId, selectedRegion);
      const userPrice = currentUserPrice;

      let html = `Ваша цена: <b>${formatCurrencySafe(userPrice, currentUserCurrencyISO)}</b><br>`;
      if (friendPrice !== null) {
        html += `Цена друга: <b>${formatCurrencySafe(friendPrice, friendCurrencyISO)}</b>`;
        if (currentUserCurrencyISO !== friendCurrencyISO && exchangeRateUsed !== null && friendPriceInUserCurrency !== null) {
          html += ` ≈ ${formatCurrencySafe(friendPriceInUserCurrency, currentUserCurrencyISO)}`;
        }
      } else {
        html += `Цена друга: <b>Скрыта / Недоступна</b>`;
      }
      html += '<br>';

      if (picsResult.status === 'blocked') {
        html += `<div class="pgh_result_block pgh_result_bad">${picsResult.message}<br><small style="font-weight:normal;">Игру нельзя отправить совсем.</small></div>`;
      } else {
        if (friendPriceInUserCurrency === null || friendPrice === null) {
          html += `<div class="pgh_result_block pgh_result_warn">Цена друга неизвестна.<br><small style="font-weight:normal;">Steam рассчитает итоговую стоимость на странице оформления покупки.</small></div>`;
        } else if (friendPriceInUserCurrency > userPrice) {
          html += `<div class="pgh_result_block pgh_result_bad">У друга дороже!<br><small style="font-weight:normal;">Вы заплатите цену региона друга: ${formatCurrencySafe(friendPriceInUserCurrency, currentUserCurrencyISO)}.</small></div>`;
        } else if (friendPriceInUserCurrency < userPrice) {
          html += `<div class="pgh_result_block pgh_result_warn">У друга дешевле.<br><small style="font-weight:normal;">Вы заплатите свою обычную цену. Другу выгоднее купить игру самому.</small></div>`;
        } else {
          html += `<div class="pgh_result_block pgh_result_good">Цены равны.<br><small style="font-weight:normal;">Вы заплатите свою цену.</small></div>`;
        }

        if (picsResult.status === 'ok') {
          html += `<div class="pgh_pics_status" style="color: #77dd77; border: 1px solid rgba(119, 221, 119, 0.3); background: rgba(119, 221, 119, 0.05);">${picsResult.message}</div>`;
        } else {
          html += `<div class="pgh_pics_status" style="color: #8f98a0; border: 1px solid rgba(143, 152, 160, 0.3); background: rgba(143, 152, 160, 0.05);">${picsResult.message}</div>`;
        }
      }

      resultDiv.innerHTML = html;
    } catch {
      resultDiv.innerHTML = '<div class="pgh_status_error">Ошибка обработки запроса.</div>';
    } finally {
      fetchBtn.disabled = !regionSelect.value;
      regionSelect.disabled = false;
    }
  };

  const showModal = () => {
    if (!getCurrentGameInfo()) return;

    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pghModal';
      modal.innerHTML = `
        <button type="button" id="pghCloseBtn">&times;</button>
        <div id="pghModalHeader">
          <h3>Доступность подарка</h3>
          <button type="button" id="pghHelpBtn">?</button>
        </div>
        <div id="pghHelpContent">
          При отправке подарка в другой регион действует правило: если игра у друга стоит дороже, Steam спишет с вас цену друга. Если дешевле — вы заплатите свою обычную цену.<br><br>
          Инструмент заранее рассчитывает стоимость и напрямую проверяет скрытые ограничения издателей (PICS) через Steam CM.
        </div>
        <label for="pghRegionSelect">Регион друга:</label>
        <select id="pghRegionSelect">
          <option value="">-- Выберите регион друга --</option>
          ${Object.entries(PGH_COUNTRY_CURRENCY_MAP)
            .sort(([, a], [, b]) => a.name.localeCompare(b.name))
            .map(([code, data]) => `<option value="${code}">${data.name} (${code})</option>`)
            .join('')}
        </select>
        <button type="button" id="pghFetchBtn" disabled>Узнать</button>
        <div id="pghResult"></div>
      `;
      document.body.appendChild(modal);

      resultDiv = document.getElementById('pghResult') as HTMLDivElement;
      fetchBtn = document.getElementById('pghFetchBtn') as HTMLButtonElement;
      regionSelect = document.getElementById('pghRegionSelect') as HTMLSelectElement;

      document.getElementById('pghCloseBtn')?.addEventListener('click', hideModal);
      document.getElementById('pghHelpBtn')?.addEventListener('click', () => {
        const helpContent = document.getElementById('pghHelpContent');
        if (helpContent) {
          helpContent.style.display = helpContent.style.display === 'block' ? 'none' : 'block';
        }
      });

      fetchBtn.addEventListener('click', fetchAndComparePrices);
      regionSelect.addEventListener('change', () => {
        if (fetchBtn && regionSelect) fetchBtn.disabled = !regionSelect.value;
      });

      document.addEventListener(
        'click',
        (ev) => {
          if (modal && modal.style.display === 'block' && !modal.contains(ev.target as Node)) {
            hideModal();
          }
        },
        true
      );
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && modal && modal.style.display === 'block') hideModal();
      });
    }

    if (regionSelect) regionSelect.value = '';
    if (fetchBtn) fetchBtn.disabled = true;
    if (resultDiv) resultDiv.innerHTML = '';
    const help = document.getElementById('pghHelpContent');
    if (help) help.style.display = 'none';
    modal.style.display = 'block';
  };

  const addGiftButton = () => {
    if (document.querySelector('.pgh_button')) return;

    const targetArea = document.querySelector(
      '.game_area_purchase_section .game_area_purchase_game_wrapper .game_purchase_action, #add_to_cart > .btn_addtocart > span'
    );
    const primaryContainer = targetArea?.closest('.game_purchase_action') || document.getElementById('add_to_cart');
    const queueCtn = document.getElementById('queueActionsCtn');

    if (!primaryContainer && !queueCtn) return;

    const giftButtonContainer = document.createElement('div');
    giftButtonContainer.className = 'pgh_button queue_control_button';
    giftButtonContainer.style.marginLeft = '3px';

    const giftButton = document.createElement('div');
    giftButton.className = 'btnv6_blue_hoverfade btn_medium';
    giftButton.style.cssText =
      'height: 32px; padding: 0 10px; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: pointer;';
    giftButton.title = 'Проверить возможность подарка другу';
    giftButton.innerHTML = '<span>GIFT</span>';
    giftButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showModal();
    });

    giftButtonContainer.appendChild(giftButton);

    if (primaryContainer?.parentNode) {
      primaryContainer.parentNode.insertBefore(giftButtonContainer, primaryContainer);
    } else if (queueCtn) {
      const expandFill = queueCtn.querySelector('.expand_to_fill');
      if (expandFill) queueCtn.insertBefore(giftButtonContainer, expandFill);
      else queueCtn.appendChild(giftButtonContainer);
    }
  };

  setTimeout(addGiftButton, 600);
  const obs = new MutationObserver(() => {
    if (!document.querySelector('.pgh_button')) addGiftButton();
  });
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
}
