import {
  StoreWebkitConfig,
  fetchViaBackend,
  idbGet,
  idbSet,
  injectStyleOnce,
} from '../../shared/ipc';
import { fetchPicsPackagesDirect } from './cmClient';

const PICS_CACHE_PREFIX = 'bsh_pics_v2_sub_';
const PICS_CACHE_TTL = 24 * 60 * 60 * 1000;

const PICS_CSS = `
  .use-pics-warning {
    position: relative;
    color: #ff6961;
    font-weight: 700;
    font-size: 13px;
    float: right;
    margin-left: 13px;
    margin-right: 15px;
    display: inline-block;
    line-height: 32px;
    font-family: "Motiva Sans", Arial, sans-serif;
  }
  .use-pics-warning-tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 0;
    background: #171d25;
    border: 1px solid #ff6961;
    color: #e5eef5;
    padding: 6px 10px;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.4;
    white-space: normal;
    width: max-content;
    max-width: 280px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.72);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.16s ease;
    z-index: 9999;
  }
  .use-pics-warning:hover .use-pics-warning-tooltip {
    opacity: 1;
  }
`;

function getExtendedRestrictedCountries(picsData: any): string[] {
  if (!picsData || typeof picsData !== 'object') return [];
  const extKey = Object.keys(picsData).find((k) => k.toLowerCase() === 'extended');
  const extended = extKey ? picsData[extKey] : null;
  if (!extended || typeof extended !== 'object') return [];

  const restrictedKey = Object.keys(extended).find(
    (k) => k.toLowerCase() === 'purchaserestrictedcountries'
  );
  const rawStr = restrictedKey ? String(extended[restrictedKey] || '') : '';
  return rawStr
    .split(/\s+/)
    .map((c) => c.trim())
    .filter(Boolean);
}

function collectPurchaseSubIds(): { allSubIds: number[]; blockMapping: Map<number, Element[]> } {
  const purchaseBlocks = document.querySelectorAll(
    '.game_area_purchase_game, .game_area_purchase_game_wrapper'
  );
  const blockMapping = new Map<number, Element[]>();
  const subIdSet = new Set<number>();

  purchaseBlocks.forEach((block) => {
    const subIds: number[] = [];
    const subIdInput = block.querySelector('input[name="subid"]') as HTMLInputElement | null;

    if (subIdInput?.value) {
      const parsed = parseInt(subIdInput.value, 10);
      if (parsed > 0) subIds.push(parsed);
    } else {
      const cartLink = block.querySelector('a[href*="addToCart("]') as HTMLAnchorElement | null;
      const cartMatch = cartLink?.getAttribute('href')?.match(/addToCart\(\s*(\d+)\s*\)/);
      if (cartMatch) {
        const parsed = parseInt(cartMatch[1], 10);
        if (parsed > 0) subIds.push(parsed);
      } else {
        const bundleWrapper = block.closest('.dynamic_bundle_description') as HTMLElement | null;
        if (bundleWrapper?.dataset?.dsBundleData) {
          try {
            const data = JSON.parse(bundleWrapper.dataset.dsBundleData);
            if (Array.isArray(data.m_rgItems)) {
              data.m_rgItems.forEach((item: any) => {
                const pid = parseInt(String(item.m_nPackageID), 10);
                if (pid > 0) subIds.push(pid);
              });
            }
          } catch {}
        }
      }
    }

    subIds.forEach((id) => {
      subIdSet.add(id);
      if (!blockMapping.has(id)) blockMapping.set(id, []);
      const list = blockMapping.get(id)!;
      if (!list.includes(block)) list.push(block);
    });
  });

  return { allSubIds: Array.from(subIdSet), blockMapping };
}

function renderPicsWarning(blocks: Element[], restrictedList: string[]): void {
  blocks.forEach((block) => {
    const priceBlock = block.querySelector('.game_purchase_price, .discount_block');
    if (!priceBlock) return;

    const actionBg = priceBlock.closest('.game_purchase_action_bg') as HTMLElement | null;
    if (!actionBg || actionBg.querySelector('.use-pics-warning')) return;

    const warning = document.createElement('div');
    warning.className = 'use-pics-warning';
    warning.style.cursor = restrictedList.length > 2 ? 'help' : 'default';

    const warningSpan = document.createElement('span');
    if (restrictedList.length <= 2) {
      warningSpan.textContent = `🚫 Строгие ограничения: ${restrictedList.join(', ')}`;
    } else {
      warningSpan.textContent = `🚫 Строгие ограничения: ${restrictedList.length} стран(ы)`;
      const tooltip = document.createElement('div');
      tooltip.className = 'use-pics-warning-tooltip';
      tooltip.textContent = restrictedList.join(', ');
      warning.appendChild(tooltip);
    }

    warning.appendChild(warningSpan);
    actionBg.insertBefore(warning, actionBg.firstChild);
  });
}

export function initStorePicsCheckModule(cfg: StoreWebkitConfig): void {
  if (!cfg.picsCheck) return;
  if (!window.location.pathname.includes('/app/')) return;

  injectStyleOnce('bsh-pics-warning-css', PICS_CSS);

  const targetRegion = (cfg.picsTargetRegion || 'RU').toUpperCase();
  const memoryPicsCache = new Map<number, any>();
  let running = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const scanAndCheck = async () => {
    if (running) return;
    const { allSubIds, blockMapping } = collectPurchaseSubIds();
    if (allSubIds.length === 0) return;

    const uncheckedSubIds = allSubIds.filter((id) =>
      (blockMapping.get(id) || []).some((b) => {
        const bg = b
          .querySelector('.game_purchase_price, .discount_block')
          ?.closest('.game_purchase_action_bg') as HTMLElement | null;
        return bg && bg.dataset.bshPicsChecked !== '1';
      })
    );
    if (uncheckedSubIds.length === 0) return;

    running = true;
    try {
      const inputJson = {
        ids: uncheckedSubIds.map((id) => ({ packageid: id })),
        context: { language: 'english', country_code: targetRegion, steam_realm: 1 },
      };
      const apiUrl = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(
        JSON.stringify(inputJson)
      )}`;

      const apiRes = await fetchViaBackend(apiUrl);
      if (!apiRes.ok || !apiRes.body) return;

      const apiData = JSON.parse(apiRes.body);
      const storeItems: any[] = apiData?.response?.store_items || [];

      const restrictedPackageIds: number[] = storeItems
        .filter(
          (item) =>
            item.success === 15 ||
            item.visible === false ||
            item.unvailable_for_country_restriction === true ||
            item.unavailable_for_country_restriction === true
        )
        .map((item) => Number(item.id))
        .filter((id) => id > 0);

      uncheckedSubIds.forEach((id) => {
        (blockMapping.get(id) || []).forEach((b) => {
          const bg = b
            .querySelector('.game_purchase_price, .discount_block')
            ?.closest('.game_purchase_action_bg') as HTMLElement | null;
          if (bg) bg.dataset.bshPicsChecked = '1';
        });
      });

      if (restrictedPackageIds.length === 0) return;

      const idsToFetch: number[] = [];
      for (const id of restrictedPackageIds) {
        if (memoryPicsCache.has(id)) continue;
        const cached = await idbGet<{ ts: number; data: any }>(`${PICS_CACHE_PREFIX}${id}`);
        if (cached && cached.data && !cached.data.error && Date.now() - cached.ts < PICS_CACHE_TTL) {
          memoryPicsCache.set(id, cached.data);
        } else {
          idsToFetch.push(id);
        }
      }

      if (idsToFetch.length > 0) {
        const fetched = await fetchPicsPackagesDirect(idsToFetch);
        for (const id of idsToFetch) {
          if (fetched[id]) {
            memoryPicsCache.set(id, fetched[id]);
            if (!fetched[id].error) {
              await idbSet(`${PICS_CACHE_PREFIX}${id}`, { ts: Date.now(), data: fetched[id] });
            }
          }
        }
      }

      for (const subId of restrictedPackageIds) {
        const picsData = memoryPicsCache.get(subId);
        const restrictedList = getExtendedRestrictedCountries(picsData);
        if (restrictedList.length > 0) {
          renderPicsWarning(blockMapping.get(subId) || [], restrictedList);
        }
      }
    } catch (err) {
      console.warn('[Bibliotekarsha PICS] Ошибка проверки:', err);
    } finally {
      running = false;
    }
  };

  const scheduleScan = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      scanAndCheck();
    }, 450);
  };

  scheduleScan();

  const obs = new MutationObserver(() => {
    scheduleScan();
  });
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
  }
}
