import { fetchViaBackend, requestViaBackend } from '../../shared/ipc';
import { SmOfferItem, SmStoreModule } from './types';
import {
  smCalculateMissingValues,
  smFetchExchangeRates,
  smLogError,
  smParsePercent,
  smParsePrice,
  smProcessItemCurrency,
  smScrapeSteamPageOffers,
} from './utils';

export interface StoreBuildContext {
  setSteamOffersCache: (items: SmOfferItem[]) => void;
}

export function createStoreModules(ctx: StoreBuildContext): SmStoreModule[] {
  return [
    // Steam (текущая страница)
    {
      id: 'steam_current_page',
      name: 'Steam',
      baseUrl: 'https://store.steampowered.com',
      isEnabled: true,
      async fetch(_query, initialSearch = false) {
        if (!initialSearch) return [];
        const offers = await smScrapeSteamPageOffers();
        const headerImg =
          (document.querySelector('#gameHeaderImageCtn img.game_header_image_full') as HTMLImageElement | null)?.src ||
          null;
        const mapped = [...offers.editions, ...offers.dlc].map((offer) =>
          smCalculateMissingValues({
            storeId: 'steam_current_page',
            storeName: 'Steam',
            storeUrl: 'https://store.steampowered.com',
            productName: offer.title,
            productUrl: window.location.href,
            imageUrl: headerImg,
            currentPrice: offer.price,
            originalPrice: offer.originalPrice,
            discountPercent: offer.discountPercent,
            discountAmount: null,
            currency: 'RUB',
            isAvailable: offer.price !== null,
            type: offer.type,
          })
        );
        ctx.setSteamOffersCache(mapped);
        return mapped.filter((it) => it.type === 'sub' || it.type === 'bundle');
      },
    },

    // SteamBuy
    {
      id: 'steambuy',
      name: 'SteamBuy',
      baseUrl: 'https://steambuy.com',
      isEnabled: true,
      async fetch(query) {
        const url = `https://steambuy.com/sb/api/catalog/live?a=search&q=${encodeURIComponent(query)}`;
        const res = await fetchViaBackend(url, {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const data = JSON.parse(res.body);
        if (data.status !== 'success' || typeof data.html !== 'string') return [];

        const doc = new DOMParser().parseFromString(data.html, 'text/html');
        const results: SmOfferItem[] = [];
        doc.querySelectorAll('.search-result__item').forEach((item) => {
          const title = item.querySelector('.search-result__title')?.textContent?.trim();
          const href = item.querySelector('.search-result__link')?.getAttribute('href');
          const priceEl = item.querySelector('.search-result__cost');
          const priceText = priceEl?.innerHTML.replace(/<span[^>]*>.*<\/span>/i, '').replace('р', '').trim();
          const currentPrice = smParsePrice(priceText);
          const discountText = item.querySelector('.search-result__discount')?.textContent?.trim();
          const discountPercent = discountText && discountText !== '\u00a0' ? smParsePercent(discountText) || 0 : 0;
          const imageUrl = item.querySelector('.search-result__img img')?.getAttribute('src') || null;

          if (title && href && currentPrice !== null) {
            const fullUrl = href.startsWith('/') ? `https://steambuy.com${href}` : href;
            results.push(
              smCalculateMissingValues({
                storeId: 'steambuy',
                storeName: 'SteamBuy',
                storeUrl: 'https://steambuy.com',
                productName: title,
                productUrl: `${fullUrl}?partner=234029`,
                imageUrl,
                currentPrice,
                originalPrice: null,
                discountPercent,
                discountAmount: null,
                currency: 'RUB',
                isAvailable: true,
              })
            );
          }
        });
        return results;
      },
    },

    // Playo
    {
      id: 'playo',
      name: 'Playo',
      baseUrl: 'https://playo.ru',
      isEnabled: true,
      async fetch(query) {
        const pathQ = encodeURIComponent(query);
        const paramQ = encodeURIComponent(query).replace(/%20/g, '+');
        const res = await fetchViaBackend(`https://playo.ru/search/${pathQ}/?search=${paramQ}`);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const results: SmOfferItem[] = [];
        doc.querySelectorAll('.preview_list .preview_it').forEach((item) => {
          const href = item.querySelector('a.link_preview')?.getAttribute('href');
          const imgRaw = item.querySelector('.img_prev img')?.getAttribute('src') || '';
          const titleEl = item.querySelector('.inf');
          let productName = '';
          if (titleEl) {
            const clone = titleEl.cloneNode(true) as HTMLElement;
            clone.querySelector('.gmlst_dsnt_val_text')?.remove();
            productName = (clone.textContent || '').replace(/\s+/g, ' ').trim();
          }
          const currentPrice = smParsePrice(item.querySelector('.price')?.textContent);
          const originalPrice = smParsePrice(item.querySelector('.old_price')?.textContent);
          const discountPercent = smParsePercent(item.querySelector('.gmlst_dscnt_lbl')?.textContent);
          const discountAmount = smParsePrice(item.querySelector('.gmlst_dsnt_val_text')?.textContent);

          if (productName && href && currentPrice !== null) {
            const fullUrl = href.startsWith('/') ? `https://playo.ru${href}` : href;
            const imageUrl = imgRaw.startsWith('/') ? `https://playo.ru${imgRaw}` : imgRaw || null;
            results.push(
              smCalculateMissingValues({
                storeId: 'playo',
                storeName: 'Playo',
                storeUrl: 'https://playo.ru',
                productName,
                productUrl: `${fullUrl}?s=n3j6y08f`,
                imageUrl,
                currentPrice,
                originalPrice,
                discountPercent,
                discountAmount,
                currency: 'RUB',
                isAvailable: true,
              })
            );
          }
        });
        return results;
      },
    },

    // SteamPay
    {
      id: 'steampay',
      name: 'SteamPay',
      baseUrl: 'https://steampay.com',
      isEnabled: true,
      async fetch(query) {
        const res = await fetchViaBackend(`https://steampay.com/search?q=${encodeURIComponent(query)}`);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        await smFetchExchangeRates('usd').catch(() => {});

        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const results: SmOfferItem[] = [];
        for (const item of Array.from(doc.querySelectorAll('.catalog-item'))) {
          const priceText = item.querySelector('.catalog-item__price-span')?.textContent?.trim();
          const currentPrice = smParsePrice(priceText);
          if (currentPrice === null) continue;

          const nameEl = item.querySelector('.catalog-item__name');
          let productName = '';
          if (nameEl) {
            const clone = nameEl.cloneNode(true) as HTMLElement;
            clone.querySelector('.catalog-item__info')?.remove();
            productName = clone.textContent?.trim() || '';
          }
          const href = item.getAttribute('href');
          const imgRaw = item.querySelector('.catalog-item__img img')?.getAttribute('src') || '';
          const discountPercent = smParsePercent(item.querySelector('.catalog-item__discount')?.textContent);

          if (productName && href) {
            const processed = await smProcessItemCurrency(
              {
                storeId: 'steampay',
                storeName: 'SteamPay',
                storeUrl: 'https://steampay.com',
                productName,
                productUrl: href.startsWith('/') ? `https://steampay.com${href}` : href,
                imageUrl: imgRaw.startsWith('/') ? `https://steampay.com${imgRaw}` : imgRaw || null,
                currentPrice,
                originalPrice: null,
                discountPercent,
                discountAmount: null,
                currency: 'RUB',
                isAvailable: true,
              },
              priceText
            );
            if (processed) results.push(smCalculateMissingValues(processed));
          }
        }
        return results;
      },
    },

    // Gabestore
    {
      id: 'gabestore',
      name: 'Gabestore',
      baseUrl: 'https://gabestore.ru',
      isEnabled: true,
      async fetch(query) {
        const res = await fetchViaBackend(
          `https://gabestore.ru/result?ProductFilter%5Bsearch%5D=${encodeURIComponent(query)}`
        );
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const ctn = doc.querySelector('.js-load-container');
        if (!ctn) return [];

        const results: SmOfferItem[] = [];
        ctn.querySelectorAll('.shop-item').forEach((item) => {
          if (item.querySelector('.btn--empty-item')) return;
          const nameLink = item.querySelector('a.shop-item__name');
          const imgLink = item.querySelector('a.shop-item__image');
          const productName = nameLink?.textContent?.trim();
          const href = nameLink?.getAttribute('href') || imgLink?.getAttribute('href');
          const imageUrl = imgLink?.querySelector('img')?.getAttribute('src') || null;
          const currentPrice = smParsePrice(item.querySelector('.shop-item__price-current')?.textContent);
          const discountPercent = smParsePercent(item.querySelector('.shop-item__price-discount')?.textContent) || 0;

          if (productName && href && currentPrice !== null) {
            const fullUrl = href.startsWith('/') ? `https://gabestore.ru${href}` : href;
            const refUrl = `https://codeaven.com/g/om6s6jfc50c1442ace4b215ab801b9/?erid=2bL9aMPo2e49hMef4peVT3sy3u&ulp=${encodeURIComponent(fullUrl)}`;
            results.push(
              smCalculateMissingValues({
                storeId: 'gabestore',
                storeName: 'Gabestore',
                storeUrl: 'https://gabestore.ru',
                productName,
                productUrl: refUrl,
                imageUrl,
                currentPrice,
                originalPrice: null,
                discountPercent,
                discountAmount: null,
                currency: 'RUB',
                isAvailable: true,
              })
            );
          }
        });
        return results;
      },
    },

    // GamersBase
    {
      id: 'gamerbase',
      name: 'GamersBase',
      baseUrl: 'https://gamersbase.store',
      isEnabled: true,
      async fetch(query) {
        const res = await fetchViaBackend(
          `https://gamersbase.store/ru/search/?isFullTextSearch=true&searchQuery=${encodeURIComponent(query)}`,
          {
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            Referer: 'https://gamersbase.store/',
          }
        );
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        await smFetchExchangeRates('usd').catch(() => {});
        await smFetchExchangeRates('kzt').catch(() => {});

        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const results: SmOfferItem[] = [];
        for (const item of Array.from(doc.querySelectorAll('.js-products-container .ui.cover'))) {
          try {
            const linkEl = item.querySelector('a.cover-holder') as HTMLElement | null;
            const buyBtn = item.querySelector('.js-add-product') as HTMLElement | null;
            const rawJson = linkEl?.dataset.product || buyBtn?.dataset.product;
            if (!rawJson || !item.querySelector('.js-add-product.available-true')) continue;

            const pd = JSON.parse(rawJson);
            const currentPrice = smParsePrice(pd?.priceData?.actualPriceFormatted);
            const originalPrice = smParsePrice(pd?.priceData?.standardPriceFormatted);
            const href = linkEl?.getAttribute('href');
            if (!pd?.name || !href || currentPrice === null) continue;

            const processed = await smProcessItemCurrency(
              {
                storeId: 'gamerbase',
                storeName: 'GamersBase',
                storeUrl: 'https://gamersbase.store',
                productName: pd.name,
                productUrl: href.startsWith('/') ? `https://gamersbase.store${href}` : href,
                imageUrl: item.querySelector('.image img')?.getAttribute('src') || null,
                currentPrice,
                originalPrice,
                discountPercent: Number(pd.priceData?.discountPercent || 0),
                discountAmount: null,
                currency: pd.priceData?.currency || 'RUB',
                isAvailable: true,
              },
              pd.priceData?.actualPriceFormatted
            );
            if (processed) results.push(smCalculateMissingValues(processed));
          } catch {}
        }
        return results;
      },
    },

    // GamesForFarm
    {
      id: 'gamesforfarm',
      name: 'GamesForFarm',
      baseUrl: 'https://gamesforfarm.com',
      isEnabled: true,
      async fetch(query) {
        const res = await fetchViaBackend(`https://gamesforfarm.com/?search=${encodeURIComponent(query)}`);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const ctn = doc.querySelector('#gamesCatalog');
        if (!ctn) return [];

        const results: SmOfferItem[] = [];
        ctn.querySelectorAll('.product__item').forEach((item) => {
          const linkEl = item.querySelector('.product__box-title a');
          const imgEl = item.querySelector('.product__box-image img') as HTMLElement | null;
          const priceEl = item.querySelector('.product__box-price');
          let currentPrice: number | null = null;
          if (priceEl) {
            const clone = priceEl.cloneNode(true) as HTMLElement;
            clone.querySelector('span.sc-ru3bl')?.remove();
            currentPrice = smParsePrice(clone.textContent);
          }
          const productName = linkEl?.textContent?.trim();
          const href = linkEl?.getAttribute('href');
          const imageUrl = imgEl?.dataset.src || imgEl?.getAttribute('src') || null;
          const discountPercent = smParsePercent(item.querySelector('.product__box-prop.prop--discount')?.textContent) || 0;

          if (productName && href && currentPrice !== null) {
            results.push(
              smCalculateMissingValues({
                storeId: 'gamesforfarm',
                storeName: 'GamesForFarm',
                storeUrl: 'https://gamesforfarm.com',
                productName,
                productUrl: href.startsWith('/') ? `https://gamesforfarm.com${href}` : href,
                imageUrl,
                currentPrice,
                originalPrice: null,
                discountPercent,
                discountAmount: null,
                currency: 'RUB',
                isAvailable: true,
              })
            );
          }
        });
        return results;
      },
    },

    // Gamazavr
    {
      id: 'gamazavr',
      name: 'Gamazavr',
      baseUrl: 'https://gamazavr.ru',
      isEnabled: true,
      async fetch(query) {
        const res = await fetchViaBackend(`https://gamazavr.ru/search/?query=${encodeURIComponent(query)}`);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const ctn = doc.querySelector('.productsList');
        if (!ctn) return [];

        const results: SmOfferItem[] = [];
        ctn.querySelectorAll('.item').forEach((item) => {
          const descLink = item.querySelector('.description a');
          const imgRaw = item.querySelector('a.img img')?.getAttribute('src') || '';
          const productName = descLink?.querySelector('b')?.textContent?.trim();
          const href = descLink?.getAttribute('href');
          const currentPrice = smParsePrice(item.querySelector('.price b')?.textContent);
          const originalPrice = smParsePrice(item.querySelector('.price s')?.textContent);

          if (productName && href && currentPrice !== null) {
            const fullUrl = href.startsWith('/') ? `https://gamazavr.ru${href}` : href;
            results.push(
              smCalculateMissingValues({
                storeId: 'gamazavr',
                storeName: 'Gamazavr',
                storeUrl: 'https://gamazavr.ru',
                productName,
                productUrl: `${fullUrl}?partner=8293ebf587779da6`,
                imageUrl: imgRaw.startsWith('/') ? `https://gamazavr.ru${imgRaw}` : imgRaw || null,
                currentPrice,
                originalPrice,
                discountPercent: null,
                discountAmount: null,
                currency: 'RUB',
                isAvailable: true,
              })
            );
          }
        });
        return results;
      },
    },

    // GameRay
    {
      id: 'gameray',
      name: 'GameRay',
      baseUrl: 'https://gameray.ru',
      isEnabled: true,
      async fetch(query) {
        const res = await fetchViaBackend(`https://gameray.ru/search/index.php?q=${encodeURIComponent(query)}`);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const initial: Array<{ productName: string; fullProductUrl: string; imageUrl: string }> = [];
        (doc.querySelector('.search-page') || doc.body).querySelectorAll('a.ec-clicker').forEach((el) => {
          const productName = (el as HTMLElement).dataset.name?.trim();
          const href = el.getAttribute('href');
          const img = el.querySelector('img')?.getAttribute('src');
          if (productName && href && img) {
            initial.push({
              productName,
              fullProductUrl: href.startsWith('/') ? `https://gameray.ru${href}` : href,
              imageUrl: img.startsWith('/') ? `https://gameray.ru${img}` : img,
            });
          }
        });

        const settled = await Promise.allSettled(
          initial.slice(0, 5).map(async (it) => {
            const pr = await fetchViaBackend(it.fullProductUrl);
            if (!pr.ok || !pr.body) return null;
            const pdoc = new DOMParser().parseFromString(pr.body, 'text/html');
            const pricing = pdoc.querySelector('div.pricing');
            if (!pricing || !pricing.querySelector('a.buy-button')) return null;
            const currentPrice = smParsePrice(pricing.querySelector('strong.price span[itemprop="price"]')?.textContent);
            const originalPrice = smParsePrice(pricing.querySelector('strike.price_old')?.textContent);
            if (currentPrice === null) return null;

            return smCalculateMissingValues({
              storeId: 'gameray',
              storeName: 'GameRay',
              storeUrl: 'https://gameray.ru',
              productName: it.productName,
              productUrl: `${it.fullProductUrl}?partner=93`,
              imageUrl: it.imageUrl,
              currentPrice,
              originalPrice,
              discountPercent: null,
              discountAmount: null,
              currency: 'RUB',
              isAvailable: true,
            });
          })
        );

        return settled
          .filter((r): r is PromiseFulfilledResult<SmOfferItem | null> => r.status === 'fulfilled')
          .map((r) => r.value)
          .filter((v): v is SmOfferItem => v !== null);
      },
    },

    // KupiKod
    {
      id: 'kupikod',
      name: 'KupiKod',
      baseUrl: 'https://kupikod.com',
      isEnabled: true,
      async fetch(query) {
        const res = await fetchViaBackend(`https://search-v2.kupikod.com/search?q=${encodeURIComponent(query)}`);
        if (!res.ok || !res.body) return [];
        const data = JSON.parse(res.body);
        if (!Array.isArray(data?.items)) return [];

        const exclSuffixes = ['-eu', '-us', '-arg', '-tr', '-no-ru-no-rb', '-no-ru-no-cis', '-no-ru', '-euus', '-cis', '-uk', '-in', '-eg'];
        const exclPlatforms = ['-xbox-', '-origin-', '-uplay-', '-gog-', '-rockstar-', '-battlestate-', '-nintendo-'];
        const results: SmOfferItem[] = [];

        data.items.forEach((item: any) => {
          if (!item.active) return;
          const productName = item.name?.trim();
          const productUrl = item.link;
          const currentPrice = smParsePrice(item.min_price);
          const origRaw = smParsePrice(item.min_old_price);
          const originalPrice = origRaw !== null && currentPrice !== null && origRaw > currentPrice ? origRaw : null;
          const imageUrl = item.header_image;
          if (!productName || !productUrl || currentPrice === null || !imageUrl) return;

          const lowUrl = String(productUrl).toLowerCase();
          if (exclSuffixes.some((s) => lowUrl.endsWith(s)) || exclPlatforms.some((k) => lowUrl.includes(k))) return;

          results.push(
            smCalculateMissingValues({
              storeId: 'kupikod',
              storeName: `KupiKod${item.product === 'Gifts' ? ' (Гифты)' : ' (Ключи)'}`,
              storeUrl: 'https://kupikod.com',
              productName,
              productUrl,
              imageUrl,
              currentPrice,
              originalPrice,
              discountPercent: null,
              discountAmount: null,
              currency: 'RUB',
              isAvailable: true,
            })
          );
        });
        return results;
      },
    },

    // Zaka-zaka
    {
      id: 'zakazaka',
      name: 'Zaka-zaka',
      baseUrl: 'https://zaka-zaka.com',
      isEnabled: true,
      async fetch(query) {
        const res = await fetchViaBackend(`https://zaka-zaka.com/search/ask/${encodeURIComponent(query)}`);
        if (!res.ok || !res.body) return [];

        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const results: SmOfferItem[] = [];
        doc.querySelectorAll('.search-results .game-block.tile').forEach((item) => {
          const productName = item.querySelector('.tile__title')?.textContent?.trim();
          const href = item.getAttribute('href');
          const currentPrice = smParsePrice(item.querySelector('.tile__price-now')?.textContent);
          if (!productName || !href || currentPrice === null) return;
          const originalPrice = smParsePrice(item.querySelector('.tile__price-old')?.textContent);
          const discountPercent = smParsePercent(item.querySelector('.tile__discount')?.textContent) || 0;
          const imgRaw = item.querySelector('.tile__cover img')?.getAttribute('src') || '';

          results.push(
            smCalculateMissingValues({
              storeId: 'zakazaka',
              storeName: 'Zaka-zaka',
              storeUrl: 'https://zaka-zaka.com',
              productName,
              productUrl: href.startsWith('/') ? `https://zaka-zaka.com${href}` : href,
              imageUrl: imgRaw.startsWith('/') ? `https://zaka-zaka.com${imgRaw}` : imgRaw || null,
              currentPrice,
              originalPrice,
              discountPercent,
              discountAmount: null,
              currency: 'RUB',
              isAvailable: true,
            })
          );
        });
        return results;
      },
    },

    // Buka
    {
      id: 'buka',
      name: 'Buka',
      baseUrl: 'https://shop.buka.ru',
      isEnabled: true,
      async fetch(query) {
        const results: SmOfferItem[] = [];
        for (let pageIndex = 0; pageIndex < 2; pageIndex++) {
          const res = await requestViaBackend({
            url: 'https://shop.buka.ru/s/f/v3/search/get-page',
            method: 'POST',
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Content-Type': 'application/json',
              Origin: 'https://shop.buka.ru',
              Referer: 'https://shop.buka.ru/',
            },
            body: JSON.stringify({
              pageIndex,
              filter: { term: query, area_id: 100001, channel: 'WEB' },
            }),
            timeout: 8,
          });
          if (!res.ok || !res.body) {
            if (pageIndex === 0) throw new Error(`HTTP ${res.status} ${res.error || ''}`);
            break;
          }
          const data = JSON.parse(res.body);
          const rows: any[] = data?.page?.rows || [];

          rows.forEach((item) => {
            const pf = item.filters?.find((f: any) => f.field === 'platform');
            const isPC = pf?.values?.some((v: any) => v.title === 'PC');
            if (!isPC) return;
            if (item.saleState !== 'available' && item.saleState !== 'pre-order') return;

            const productName = item.title?.trim();
            const href = item.alias ? `/item/${item.alias}` : null;
            const imageUrl =
              item.images?.main?.resized?.['296x'] ||
              item.images?.main?.resized?.['160x'] ||
              item.images?.main?.resized?.x ||
              item.images?.main?.maxSize ||
              null;
            const priceObj = item.price;
            if (!productName || !href || !imageUrl || !priceObj) return;

            const currentPrice = typeof priceObj.actual === 'number' ? priceObj.actual : smParsePrice(priceObj.actual);
            if (currentPrice === null) return;
            let originalPrice = typeof priceObj.old === 'number' ? priceObj.old : smParsePrice(priceObj.old);
            if (originalPrice === 0) originalPrice = null;
            let discountPercent = priceObj.discount || null;
            if (!discountPercent && originalPrice && currentPrice < originalPrice) {
              discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
            }

            results.push(
              smCalculateMissingValues({
                storeId: 'buka',
                storeName: 'Buka',
                storeUrl: 'https://shop.buka.ru',
                productName,
                productUrl: `https://shop.buka.ru${href}`,
                imageUrl,
                currentPrice,
                originalPrice,
                discountPercent: discountPercent && discountPercent > 0 ? discountPercent : null,
                discountAmount: null,
                currency: 'RUB',
                isAvailable: true,
              })
            );
          });

          if (!data?.page?.hasNext) break;
        }
        return results;
      },
    },

    // GGSEL
    {
      id: 'ggsel',
      name: 'GGSEL',
      baseUrl: 'https://ggsel.net',
      isEnabled: true,
      async fetch(query) {
        const res = await fetchViaBackend(`https://ggsel.net/search/${encodeURIComponent(query)}`, {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const html = res.body;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const results: SmOfferItem[] = [];

        const match = html.match(/"data":(\[\{"id_goods".*?\}\]),"total":\d+/);
        if (match?.[1]) {
          try {
            const jsonItems = JSON.parse(match[1]);
            jsonItems.forEach((item: any) => {
              if (item.forbidden_type !== 0 || item.hidden_from_search || item.hidden_from_parents) return;
              if (![1, 2, 31, 48].includes(item.content_type_id)) return;
              const productName = item.name?.trim();
              const productUrl = item.url ? `https://ggsel.net/catalog/product/${item.url}?ai=234029` : null;
              const currentPrice = item.price_wmr ? smParsePrice(item.price_wmr) : null;
              if (!productName || currentPrice === null || !productUrl) return;

              const catDisc = item.category_discount ? smParsePrice(item.category_discount) : null;
              const originalPrice = catDisc && catDisc > currentPrice ? catDisc : null;

              let imageUrl: string | null = null;
              if (item.id_goods) {
                const domCard = doc.querySelector(`a[href$="${item.id_goods}"]`)?.closest('[data-testid="card"]');
                imageUrl = domCard?.querySelector('[data-testid="card-image"]')?.getAttribute('src') || null;
              }
              if (!imageUrl) {
                imageUrl =
                  item.image_url ||
                  (item.images ? `https://img.ggsel.net/${item.id_goods}/original/250x250/${item.images}` : null) ||
                  item.icon ||
                  null;
              }

              results.push(
                smCalculateMissingValues({
                  storeId: 'ggsel',
                  storeName: 'GGSEL',
                  storeUrl: 'https://ggsel.net',
                  productName,
                  productUrl,
                  imageUrl,
                  currentPrice,
                  originalPrice,
                  discountPercent: null,
                  discountAmount: null,
                  currency: 'RUB',
                  isAvailable: item.is_active === true,
                  sellerId: item.id_seller,
                  sellerName: item.seller_name,
                })
              );
            });
          } catch {}
        }

        if (results.length === 0) {
          doc.querySelectorAll('[data-testid="card"]').forEach((card) => {
            const linkEl = card.querySelector('[data-testid="card-link"]');
            const imgEl = card.querySelector('[data-testid="card-image"]');
            const priceEl = card.querySelector('[data-test="price"]');
            const oldEl = card.querySelector('[class*="oldPrice"]');
            const nameEl = card.querySelector('[class*="description"] span');

            const productName = nameEl?.textContent?.trim() || imgEl?.getAttribute('alt') || '';
            const href = linkEl?.getAttribute('href');
            const currentPrice = smParsePrice(priceEl?.textContent);
            const originalPrice = smParsePrice(oldEl?.textContent);
            if (!productName || !href || currentPrice === null) return;

            results.push(
              smCalculateMissingValues({
                storeId: 'ggsel',
                storeName: 'GGSEL',
                storeUrl: 'https://ggsel.net',
                productName,
                productUrl: `https://ggsel.net${href}?ai=234029`,
                imageUrl: imgEl?.getAttribute('src') || null,
                currentPrice,
                originalPrice: originalPrice && originalPrice > currentPrice ? originalPrice : null,
                discountPercent: null,
                discountAmount: null,
                currency: 'RUB',
                isAvailable: true,
              })
            );
          });
        }

        return results;
      },
    },

    // Plati.Market
    {
      id: 'platimarket',
      name: 'Plati.Market',
      baseUrl: 'https://plati.market',
      isEnabled: true,
      async fetch(query) {
        const apiBase = 'https://api.digiseller.com/api/products/search2';
        const finalRes = await fetchViaBackend(
          `${apiBase}?query=${encodeURIComponent(query)}&searchmode=10&sortmode=2&pagesize=200`
        );
        if (!finalRes.ok || !finalRes.body) throw new Error(`HTTP ${finalRes.status}`);
        const finalJson = JSON.parse(finalRes.body);
        const items = finalJson?.items?.item;
        if (!Array.isArray(items)) return [];

        const results: SmOfferItem[] = [];
        items.forEach((item: any) => {
          const currentPrice = smParsePrice(item.price_rur);
          if (!item.name || !item.url || currentPrice === null) return;
          results.push(
            smCalculateMissingValues({
              storeId: 'platimarket',
              storeName: 'Plati.Market',
              storeUrl: 'https://plati.market',
              productName: String(item.name),
              productUrl: `${item.url}?ai=234029`,
              imageUrl: `https://graph.digiseller.ru/img.ashx?id_d=${item.id}&w=150&h=80`,
              currentPrice,
              originalPrice: currentPrice,
              discountPercent: 0,
              discountAmount: 0,
              currency: 'RUB',
              isAvailable: true,
              sellerId: item.seller_id,
              sellerName: item.seller_name,
            })
          );
        });
        return results;
      },
    },

    // МТС Fog Play
    {
      id: 'fogplay',
      name: 'МТС Fog Play',
      baseUrl: 'https://fogplay.mts.ru',
      isEnabled: true,
      async fetch(query) {
        const res = await fetchViaBackend(`https://fogplay.mts.ru/keys/?search=${encodeURIComponent(query)}`);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const results: SmOfferItem[] = [];
        doc.querySelectorAll('#offers_grid article.card').forEach((card) => {
          const title = card.querySelector('.card__title')?.textContent?.trim();
          const href = card.querySelector('a.stretched-link')?.getAttribute('href');
          const currentPrice = smParsePrice(card.querySelector('.card__price')?.textContent);
          if (!title || !href || currentPrice === null) return;

          let img = card.querySelector('img.card__icon')?.getAttribute('src') || null;
          if (img?.startsWith('//')) img = `https:${img}`;
          else if (img?.startsWith('/')) img = `https://fogplay.mts.ru${img}`;

          results.push(
            smCalculateMissingValues({
              storeId: 'fogplay',
              storeName: 'МТС Fog Play',
              storeUrl: 'https://fogplay.mts.ru',
              productName: title,
              productUrl: href.startsWith('/') ? `https://fogplay.mts.ru${href}` : href,
              imageUrl: img,
              currentPrice,
              originalPrice: null,
              discountPercent: null,
              discountAmount: null,
              currency: 'RUB',
              isAvailable: true,
            })
          );
        });
        return results;
      },
    },

    // Sous-Buy
    {
      id: 'sousbuy',
      name: 'Sous-Buy',
      baseUrl: 'https://sous-buy.shop',
      isEnabled: true,
      async fetch(query) {
        const url = `https://sous-buy.shop/catalog?GameSearch[game]=${encodeURIComponent(
          query
        )}&GameSearch[instock]=1&GameSearch[key]=1&GameSearch[platform]=1`;
        const res = await fetchViaBackend(url);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const doc = new DOMParser().parseFromString(res.body, 'text/html');
        const results: SmOfferItem[] = [];
        doc.querySelectorAll('.product__items .product-item').forEach((item) => {
          const plat = item.querySelector('.product-item-platform');
          if (plat && !plat.textContent?.includes('Steam')) return;
          const title = item.querySelector('.cart-game-name')?.textContent?.trim();
          const href = item.querySelector('a')?.getAttribute('href');
          const currentPrice = smParsePrice(item.querySelector('.new-price-game')?.textContent);
          const originalPrice = smParsePrice(item.querySelector('.product-item__price-old')?.textContent);
          if (!title || !href || currentPrice === null) return;

          let img: string | null = null;
          const styleAttr = item.getAttribute('style') || '';
          const m = styleAttr.match(/url\("?(.+?)"?\)/);
          if (m?.[1]) img = m[1].startsWith('/') ? `https://sous-buy.shop${m[1]}` : m[1];

          results.push(
            smCalculateMissingValues({
              storeId: 'sousbuy',
              storeName: 'Sous-Buy',
              storeUrl: 'https://sous-buy.shop',
              productName: title,
              productUrl: href.startsWith('/') ? `https://sous-buy.shop${href}` : href,
              imageUrl: img,
              currentPrice,
              originalPrice,
              discountPercent: null,
              discountAmount: null,
              currency: 'RUB',
              isAvailable: true,
            })
          );
        });
        return results;
      },
    },

    // Ростелеком (Игровой)
    {
      id: 'rostelecom',
      name: 'Ростелеком',
      baseUrl: 'https://igrovoy.rt.ru',
      isEnabled: true,
      async fetch(query) {
        const url = `https://api-public-gaming.eco.rt.ru/v1/catalog?catalog=game-pc&platforms=1&sort=release_desc&search=${encodeURIComponent(
          query
        )}&limit=20&offset=0`;
        const res = await fetchViaBackend(url, { Accept: '*/*' });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const json = JSON.parse(res.body);
        const products: any[] = json?.products || [];
        const results: SmOfferItem[] = [];

        for (const item of products) {
          const priceData = item.prices?.[0];
          if (!priceData) continue;
          const currentPrice = priceData.price / 100;
          const originalPrice = priceData.full_price / 100 === currentPrice ? null : priceData.full_price / 100;

          let imageUrl: string | null = null;
          if (Array.isArray(item.images)) {
            for (const bp of ['768', '1024', '1280', '1440', '360']) {
              const g = item.images.find((x: any) => x.breakpoint === bp);
              const img = g?.images?.find((i: any) => i.type === 'product_card');
              if (img?.url) {
                imageUrl = img.url;
                break;
              }
            }
          }

          let discountPercent = priceData.discount?.value || null;
          if (!discountPercent && originalPrice && currentPrice < originalPrice) {
            discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
          }

          results.push(
            smCalculateMissingValues({
              storeId: 'rostelecom',
              storeName: 'Ростелеком',
              storeUrl: 'https://igrovoy.rt.ru',
              productName: item.title,
              productUrl: `https://igrovoy.rt.ru/catalog/game-pc/${item.card_id}/${item.slug}`,
              imageUrl,
              currentPrice,
              originalPrice,
              discountPercent,
              discountAmount: null,
              currency: 'RUB',
              isAvailable: item.status === 'active',
            })
          );
        }
        return results;
      },
    },

    // Gamers Hub
    {
      id: 'gamershub',
      name: 'Gamers Hub',
      baseUrl: 'https://gamershub.ru',
      isEnabled: true,
      async fetch(query) {
        const url = `https://backend.gamershub.ru/api/Catalog/Groups/Goods?userId=&sort=1&page=1&pageSize=25&filter=${encodeURIComponent(
          query
        )}&groupIds=&parameters=%D0%A1%D0%B5%D1%80%D0%B2%D0%B8%D1%81%20%D0%B0%D0%BA%D1%82%D0%B8%D0%B2%D0%B0%D1%86%D0%B8%D0%B8:Steam`;
        const res = await fetchViaBackend(url, { Accept: 'application/json' });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const json = JSON.parse(res.body);
        const products: any[] = json?.data || [];
        const results: SmOfferItem[] = [];

        for (const item of products) {
          const productName = item.name?.trim();
          const currentPrice = (smParsePrice(item.newPrice) ?? NaN);
          const origParsed = (smParsePrice(item.oldPrice) ?? NaN);
          if (!productName || isNaN(currentPrice)) continue;

          const processed = await smProcessItemCurrency(
            {
              storeId: 'gamershub',
              storeName: 'Gamers Hub',
              storeUrl: 'https://gamershub.ru',
              productName,
              productUrl: `https://gamershub.ru/product/${item.id}`,
              imageUrl: item.image || item.carouselImages?.[0] || null,
              currentPrice,
              originalPrice: !isNaN(origParsed) && origParsed > currentPrice ? origParsed : null,
              discountPercent: item.discount ? parseInt(String(item.discount), 10) : null,
              discountAmount: null,
              currency: item.currency || 'RUB',
              isAvailable: true,
            },
            String(currentPrice)
          );
          if (processed) results.push(smCalculateMissingValues(processed));
        }
        return results;
      },
    },
  ];
}
