import { StoreWebkitConfig, fetchViaBackend } from '../../shared/ipc';

const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#FFFFFF" viewBox="0 0 16 16" opacity="0.9"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1A1.5 1.5 0 0 1 9.5 2.5h-3A1.5 1.5 0 0 1 5 1.5v-1H4a.5.5 0 0 0-.5.5V14a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V3.5a.5.5 0 0 0-.5-.5H6.5v1A.5.5 0 0 1 6 2h4a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5V1.5H4z"/><path d="M5 1.5v-1H6a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1A1.5 1.5 0 0 1 9.5 2.5h-3A1.5 1.5 0 0 1 5 1.5z"/></svg>`;
const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#77dd77" viewBox="0 0 16 16" opacity="0.9"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1A1.5 1.5 0 0 1 9.5 2.5h-3A1.5 1.5 0 0 1 5 1.5v-1H4a.5.5 0 0 0-.5.5V14a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5V3.5a.5.5 0 0 0-.5-.5H6.5v1A.5.5 0 0 1 6 2h4a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5V1.5H4z"/><path d="M5 1.5v-1H6a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1A1.5 1.5 0 0 1 9.5 2.5h-3A1.5 1.5 0 0 1 5 1.5z"/></svg>`;
const PCGW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><polygon opacity="0.75" fill="#FFFFFF" points="7.5,15.134 1.5,13.23 1.5,2.682 7.5,0.634 "/><path opacity="0.5" fill="#FFFFFF" d="M12.881,1.305L8.344,0.634v14.5l4.584-0.596L12.881,1.305z M10.344,13.787l-1,0.115V8.5h1V13.787z M12.344,6.947l-1.021-0.075c-0.151,0.222-0.429,0.377-0.72,0.377 c-0.342,0-0.438-0.203-0.574-0.492L9.344,6.688V5.85l0.747,0.075c0.151-0.222,0.292-0.377,0.583-0.377 c0.342,0,0.644,0.203,0.779,0.492l0.891,0.069V6.947z M12.344,4.281l-3-0.26V3.184l3,0.26V4.281z"/></svg>`;
const STEAMDB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="#FFFFFF"><path d="M 63.9 0 C 30.5 0 3.1 11.9 0.1 27.1 l 35.6 6.7 c 2.9 -0.9 6.2 -1.3 9.6 -1.3 l 16.7 -10 c -0.2 -2.5 1.3 -5.1 4.7 -7.2 4.8 -3.1 12.3 -4.8 19.9 -4.8 5.2 -0.1 10.5 0.7 15 2.2 11.2 3.8 13.7 11.1 5.7 16.3 -5.1 3.3 -13.3 5 -21.4 4.8 l -22 7.9 c -0.2 1.6 -1.3 3.1 -3.4 4.5 -5.9 3.8 -17.4 4.7 -25.6 1.9 -3.6 -1.2 -6 -3 -7 -4.8 L 2.5 38.4 C 4.8 42 8.5 45.3 13.3 48.2 5 53 0 59 0 65.5 0 71.9 4.8 77.8 12.9 82.6 4.8 87.3 0 93.2 0 99.6 0 115.3 28.6 128 64 128 99.3 128 128 115.3 128 99.6 128 93.2 123.2 87.3 115.1 82.6 123.2 77.8 128 71.9 128 65.5 128 59 123 52.9 114.6 48.1 122.9 43 127.9 36.7 127.9 29.9 127.9 13.4 99.2 0 63.9 0 Z m 22.8 14.2 c -5.2 0.1 -10.2 1.2 -13.4 3.3 -5.5 3.6 -3.8 8.5 3.8 11.1 7.6 2.6 18.1 1.8 23.6 -1.8 5.5 -3.6 3.8 -8.5 -3.8 -11 -3.1 -1 -6.7 -1.5 -10.2 -1.5 z m 0.3 1.7 c 7.4 0 13.3 2.8 13.3 6.2 0 3.4 -5.9 6.2 -13.3 6.2 -7.4 0 -13.3 -2.8 -13.3 -6.2 -0 -3.4 5.9 -6.2 13.3 -6.2 z m -41.7 18.5 0 0 c -1.6 0.1 -3.1 0.2 -4.6 0.4 l 9.1 1.7 a 10.8 5 0 1 1 -8.1 9.3 l -8.9 -1.7 c 1 0.9 2.4 1.7 4.3 2.4 6.4 2.2 15.4 1.5 20 -1.5 4.6 -3 3.2 -7.2 -3.2 -9.3 -2.6 -0.9 -5.7 -1.3 -8.6 -1.3 z m 63.7 16.6 0 9.3 c 0 11 -20.2 19.9 -45 19.9 -24.9 0 -45 -8.9 -45 -19.9 l 0 -9.2 c 11.5 5.3 27.4 8.6 44.9 8.6 17.6 0 33.6 -3.3 45.2 -8.7 z m 0 34.6 0 8.8 c 0 11 -20.2 19.9 -45 19.9 -24.9 0 -45 -8.9 -45 -19.9 l 0 -8.8 c 11.6 5.1 27.4 8.2 45 8.2 17.6 0 33.5 -3.1 45 -8.2 z"/></svg>`;

async function copyTextSafe(text: string): Promise<boolean> {
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

function createIconButton(href: string, tooltipText: string, svgHtml: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'btnv6_blue_hoverfade btn_medium';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.title = tooltipText;

  const span = document.createElement('span');
  span.dataset.tooltipText = tooltipText;

  const img = document.createElement('img');
  img.className = 'ico16';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgHtml)}`;
  img.style.width = '16px';
  img.style.height = '16px';

  span.appendChild(img);
  link.appendChild(span);
  return link;
}

export function initStoreExternalLinksModule(cfg: StoreWebkitConfig): void {
  if (!cfg.externalLinks) return;

  const addLinks = (): boolean => {
    const match = window.location.pathname.match(/\/app\/(\d+)/);
    const appId = match ? match[1] : null;
    if (!appId) return false;

    const container = document.querySelector('.apphub_OtherSiteInfo');
    if (!container) return false;

    if (container.querySelector('#use_copy_eng_name_btn') || container.querySelector('.use_pcgw_btn')) {
      return true;
    }

    let copyButton: HTMLAnchorElement | null = null;
    let pcgwButton: HTMLAnchorElement | null = null;
    let steamdbButton: HTMLAnchorElement | null = null;

    if (window.location.hostname.includes('store.steampowered.com')) {
      copyButton = createIconButton('#', 'Копировать английское название', COPY_SVG);
      copyButton.id = 'use_copy_eng_name_btn';
      copyButton.removeAttribute('target');
      copyButton.addEventListener('click', async (e) => {
        e.preventDefault();
        const img = copyButton!.querySelector('img') as HTMLImageElement;
        const originalSrc = img.src;
        if (img.src.includes('77dd77')) return;

        const apiUrl = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(
          JSON.stringify({
            ids: [{ appid: parseInt(appId, 10) }],
            context: { language: 'english', country_code: 'US', steam_realm: 1 },
            data_request: { include_basic_info: true },
          })
        )}`;

        const res = await fetchViaBackend(apiUrl);
        if (res.ok && res.body) {
          try {
            const data = JSON.parse(res.body);
            const gameName = data?.response?.store_items?.[0]?.name;
            if (gameName && (await copyTextSafe(String(gameName)))) {
              img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(CHECK_SVG)}`;
              setTimeout(() => {
                img.src = originalSrc;
              }, 2000);
            }
          } catch {}
        }
      });
    } else if (window.location.hostname.includes('steamcommunity.com')) {
      if (!container.querySelector('a[href*="store.steampowered.com/app/"]')) {
        const storeButton = document.createElement('a');
        storeButton.className = 'btnv6_blue_hoverfade btn_medium';
        storeButton.href = `https://store.steampowered.com/app/${appId}`;
        storeButton.innerHTML = '<span>Страница в магазине</span>';
        storeButton.target = '_blank';
        container.appendChild(storeButton);
      }
    }

    if (!container.querySelector('a[href*="pcgamingwiki.com"]')) {
      pcgwButton = createIconButton(
        `https://pcgamingwiki.com/api/appid.php?appid=${appId}`,
        'Посмотреть на PCGamingWiki',
        PCGW_SVG
      );
      pcgwButton.classList.add('use_pcgw_btn');
    }

    if (!container.querySelector('a[href*="steamdb.info"]')) {
      steamdbButton = createIconButton(
        `https://steamdb.info/app/${appId}/`,
        'Посмотреть на SteamDB',
        STEAMDB_SVG
      );
      steamdbButton.classList.add('use_steamdb_btn');
    }

    let addedAny = false;
    if (steamdbButton) {
      container.prepend(steamdbButton);
      addedAny = true;
    }
    if (pcgwButton) {
      container.prepend(pcgwButton);
      if (steamdbButton) {
        container.insertBefore(document.createTextNode(' '), pcgwButton.nextSibling);
      }
      addedAny = true;
    }
    if (copyButton) {
      container.prepend(copyButton);
      if (addedAny && copyButton.nextSibling && copyButton.nextSibling.nodeType !== Node.TEXT_NODE) {
        container.insertBefore(document.createTextNode(' '), copyButton.nextSibling);
      }
    }

    return true;
  };

  if (!addLinks()) {
    const obs = new MutationObserver((_m, o) => {
      if (addLinks()) o.disconnect();
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      addLinks();
    }, 6000);
  }
}
