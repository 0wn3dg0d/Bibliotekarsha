import Hls from 'hls.js';
import { StoreWebkitConfig, fetchViaBackend } from '../shared/ipc';

const FALLBACK_REGIONS = ['us', 'ch', 'kz', 'jp'];

const LOCK_MARKERS = [
  'Данный товар недоступен в вашем регионе',
  'Данный контент недоступен в вашем регионе',
  'This item is currently unavailable in your region',
  'This content is currently unavailable in your region',
  'Этот центр сообщества недоступен в вашем регионе',
  'This Community Hub is not available in your region',
  'недоступен в вашем регионе',
  'unavailable in your region',
  'not available in your country',
];

function generateHexId(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isSteamHost(hostname: string): boolean {
  const lower = (hostname || '').toLowerCase();
  return (
    lower === 'store.steampowered.com' ||
    lower === 'steamcommunity.com' ||
    lower.endsWith('.steampowered.com') ||
    lower.endsWith('.steamcommunity.com')
  );
}

function validateUnlockedHtml(html: string, targetPath: string): { ok: boolean; reason?: string } {
  if (!html || html.length < 500) return { ok: false, reason: `empty_html (${html?.length || 0})` };
  if (LOCK_MARKERS.some((m) => html.includes(m))) return { ok: false, reason: 'region_blocked' };
  if (html.includes('agegate_birthday_selector') || html.includes('id="app_agegate"')) {
    return { ok: false, reason: 'age_gate' };
  }
  if (['/app/', '/bundle/', '/sub/'].some((p) => targetPath.includes(p)) && html.includes('home.js')) {
    return { ok: false, reason: 'redirected_home' };
  }
  return { ok: true };
}

function extractVideoUrls(t: any): { hls: string; direct: string } {
  if (!t || typeof t !== 'object') return { hls: '', direct: '' };
  const hls =
    t.hlsManifest ||
    t.hls_manifest ||
    t.hls ||
    (typeof t.manifest === 'string' && t.manifest.includes('.m3u8') ? t.manifest : '') ||
    '';

  const direct =
    t.mp4Manifest ||
    t.mp4_hd ||
    t.mp4_sd ||
    t.mp4 ||
    t.webm_hd ||
    t.webm_sd ||
    t.webm ||
    t.microtrailer ||
    (t.video?.mp4_hd || t.video?.mp4_sd || t.video?.webm_hd || '') ||
    '';

  return { hls: String(hls || ''), direct: String(direct || '') };
}

function initFallbackCarousel(): void {
  setTimeout(() => {
    const carouselEl = document.querySelector('.gamehighlight_desktopcarousel[data-props]') as HTMLElement | null;
    if (!carouselEl || carouselEl.children.length > 0) return;

    let props: any;
    try {
      props = JSON.parse(carouselEl.getAttribute('data-props') || '{}');
    } catch {
      return;
    }

    const trailers = (props.trailers || []).map((t: any) => {
      const urls = extractVideoUrls(t);
      return {
        type: 'video',
        thumb: t.thumbnail || t.poster || '',
        poster: t.poster || t.thumbnail || '',
        hls: urls.hls,
        direct: urls.direct,
      };
    });

    const screenshots = (props.screenshots || []).map((s: any) => ({
      type: 'image',
      thumb: s.thumbnail,
      standard: s.standard,
      full: s.full,
    }));

    const items = [...trailers, ...screenshots];
    if (items.length === 0) return;

    const skeleton = document.querySelector('.gamehighlight_desktopskeleton') as HTMLElement | null;
    if (skeleton) skeleton.style.display = 'none';

    const style = document.createElement('style');
    style.textContent = `
      .gamehighlight_desktopcarousel { width: 100% !important; display: block !important; }
      .bsh-fb-carousel { background: #000; position: relative; width: 100%; user-select: none; font-family: "Motiva Sans", sans-serif; }
      .bsh-fb-stage { width: 100%; aspect-ratio: 16 / 9; background: #000; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
      .bsh-fb-stage img { width: 100%; height: 100%; object-fit: contain; cursor: zoom-in; }
      .bsh-fb-stage video { width: 100%; height: 100%; background: #000; }
      .bsh-fb-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.65); color: #fff; border: 1px solid rgba(255,255,255,0.2); width: 34px; height: 54px; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; z-index: 5; transition: background 0.15s; }
      .bsh-fb-nav:hover { background: rgba(102, 192, 244, 0.85); color: #000; }
      .bsh-fb-prev { left: 0; border-radius: 0 4px 4px 0; }
      .bsh-fb-next { right: 0; border-radius: 4px 0 0 4px; }
      .bsh-fb-strip { display: flex; gap: 4px; overflow-x: auto; padding: 6px 4px; background: #0b1016; }
      .bsh-fb-thumb { position: relative; flex: 0 0 116px; height: 65px; cursor: pointer; border: 2px solid transparent; opacity: 0.65; transition: opacity 0.15s, border-color 0.15s; box-sizing: border-box; }
      .bsh-fb-thumb:hover { opacity: 0.95; }
      .bsh-fb-thumb.active { border-color: #66c0f4; opacity: 1; }
      .bsh-fb-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .bsh-fb-play-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 26px; height: 26px; background: rgba(0,0,0,0.75); border: 1px solid #fff; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; padding-left: 2px; }
      .bsh-fb-counter { position: absolute; top: 8px; right: 10px; background: rgba(0,0,0,0.7); color: #c6d4df; font-size: 12px; padding: 2px 8px; border-radius: 3px; z-index: 4; pointer-events: none; }
    `;
    document.head.appendChild(style);

    carouselEl.innerHTML = `
      <div class="bsh-fb-carousel">
        <div class="bsh-fb-stage">
          <span class="bsh-fb-counter"></span>
          <button type="button" class="bsh-fb-nav bsh-fb-prev">&#10094;</button>
          <div class="bsh-fb-media" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"></div>
          <button type="button" class="bsh-fb-nav bsh-fb-next">&#10095;</button>
        </div>
        <div class="bsh-fb-strip"></div>
      </div>
    `;

    const stageMedia = carouselEl.querySelector('.bsh-fb-media') as HTMLElement;
    const counterEl = carouselEl.querySelector('.bsh-fb-counter') as HTMLElement;
    const stripEl = carouselEl.querySelector('.bsh-fb-strip') as HTMLElement;
    let currentIndex = 0;
    let activeHls: Hls | null = null;

    const thumbEls = items.map((item, idx) => {
      const div = document.createElement('div');
      div.className = 'bsh-fb-thumb';
      const img = document.createElement('img');
      img.src = item.thumb;
      img.loading = 'lazy';
      div.appendChild(img);

      if (item.type === 'video') {
        const badge = document.createElement('div');
        badge.className = 'bsh-fb-play-badge';
        badge.textContent = '▶';
        div.appendChild(badge);
      }

      div.addEventListener('click', () => showSlide(idx));
      stripEl.appendChild(div);
      return div;
    });

    function showSlide(index: number) {
      if (activeHls) {
        try {
          activeHls.destroy();
        } catch {}
        activeHls = null;
      }

      currentIndex = (index + items.length) % items.length;
      const item = items[currentIndex];
      counterEl.textContent = `${currentIndex + 1} / ${items.length}`;
      thumbEls.forEach((el, i) => el.classList.toggle('active', i === currentIndex));
      stageMedia.innerHTML = '';

      if (item.type === 'video') {
        const video = document.createElement('video');
        video.controls = true;
        video.poster = item.poster || '';
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        stageMedia.appendChild(video);

        if (Hls.isSupported() && item.hls) {
          activeHls = new Hls({ enableWorker: false });
          activeHls.loadSource(item.hls);
          activeHls.attachMedia(video);
          activeHls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
        } else if (item.hls && video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = item.hls;
          video.play().catch(() => {});
        } else if (item.direct) {
          video.src = item.direct;
          video.play().catch(() => {});
        }
      } else {
        const img = document.createElement('img');
        img.src = item.standard || item.full;
        img.title = 'Открыть в полном размере';
        img.addEventListener('click', () => {
          if (item.full) window.open(item.full, '_blank', 'noopener,noreferrer');
        });
        stageMedia.appendChild(img);
      }
    }

    carouselEl.querySelector('.bsh-fb-prev')?.addEventListener('click', () => showSlide(currentIndex - 1));
    carouselEl.querySelector('.bsh-fb-next')?.addEventListener('click', () => showSlide(currentIndex + 1));
    showSlide(0);
  }, 400);
}

function injectUnlockedHtml(html: string, targetUrl: string, cfg: StoreWebkitConfig, onPageReady?: () => void): void {
  try {
    window.stop();
  } catch {}

  try {
    const u = new URL(targetUrl, window.location.href);
    if (u.origin === window.location.origin && u.href !== window.location.href) {
      history.pushState({ bshIncognito: true }, '', u.href);
    }
  } catch {}

  const clientCleanupAndCookies = `
    <style id="bsh-incognito-client-cleanup">
      #global_header,
      .banner_open_in_steam,
      .StoreMenuLoadingPlaceholder,
      .PlaceholderInner,
      [data-featuretarget="store-menu-v7"],
      [data-featuretarget="open-in-desktop-client"],
      #responsive_store_nav_ctn,
      #responsive_store_nav_overlay,
      #responsive_store_search_overlay,
      #store_header {
        display: none !important;
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      :root, html, body, body.v7menu {
        --store-menu-overlap-height: 0px !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      html:not(.rn_mobile_app) body.v7menu .game_page_background:not(.bundle),
      body.v7menu .game_page_background,
      body.v7menu .page_content_ctn {
        padding-top: 0 !important;
        margin-top: 0 !important;
      }
    </style>
    <script type="text/javascript">
      document.cookie = "birthtime=631152001; path=/; max-age=31536000";
      document.cookie = "lastagecheckage=1-January-1990; path=/; max-age=31536000";
      document.cookie = "wants_mature_content=1; path=/; max-age=31536000";
      document.cookie = "mature_content=1; path=/; max-age=31536000";
      window.__BSH_INCOGNITO_ACTIVE = true;
    </script>
  `;

  let cleaned = html.replace(
    /<script[^>]*src=["'][^"']*\/applications\/store\/main\.js[^"']*["'][^>]*><\/script>/gi,
    ''
  );
  cleaned = cleaned.includes('</head>')
    ? cleaned.replace('</head>', `${clientCleanupAndCookies}</head>`)
    : `${clientCleanupAndCookies}${cleaned}`;

  document.open();
  document.write(cleaned);
  document.close();

  setTimeout(() => {
    initFallbackCarousel();
    if (onPageReady) onPageReady();
  }, 250);
}

let bypassRunning = false;

export async function bypassAndRender(
  targetUrl: string,
  cfg: StoreWebkitConfig,
  onPageReady?: () => void
): Promise<void> {
  if (bypassRunning) return;
  bypassRunning = true;
  (window as any).__BSH_INCOGNITO_BYPASSING = true;

  if (!document.body) {
    await new Promise<void>((r) => window.addEventListener('DOMContentLoaded', () => r(), { once: true }));
  }

  document.body.innerHTML = `
    <div style="font-family:'Motiva Sans',sans-serif;color:#c7d5e0;background:#1b2838;text-align:center;padding:90px 20px;height:100vh;box-sizing:border-box;">
      <div style="font-size:22px;color:#66c0f4;font-weight:700;margin-bottom:10px;">Виртуальный режим «Инкогнито» (Bibliotekarsha)</div>
      <div id="bsh-incognito-status" style="font-size:15px;color:#8f98a0;">Подготовка анонимной сессии...</div>
    </div>
  `;
  const statusEl = document.getElementById('bsh-incognito-status');

  const sessionid = generateHexId(12);
  const browserid = generateHexId(20);
  const ageCookies = 'birthtime=631152001; lastagecheckage=1-January-1990; wants_mature_content=1; mature_content=1;';

  const preferred = (cfg.defaultRegion || 'US').trim().toLowerCase();
  const regions = Array.from(new Set([preferred, ...FALLBACK_REGIONS]));
  let lastError = '';

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    if (statusEl) {
      statusEl.textContent = `Попытка ${i + 1}/${regions.length}: загрузка через регион [${region.toUpperCase()}]...`;
    }

    const reqUrl = new URL(targetUrl);
    reqUrl.searchParams.set('cc', region);
    reqUrl.searchParams.set('l', 'russian');

    const cookieHeader = `sessionid=${sessionid}; browserid=${browserid}; steamCountry=${region.toUpperCase()}; ${ageCookies}`;
    const res = await fetchViaBackend(reqUrl.href, { Cookie: cookieHeader });

    if (!res.ok) {
      lastError = `HTTP ${res.status}${res.error ? ` (${res.error})` : ''}`;
      continue;
    }

    const check = validateUnlockedHtml(res.body, reqUrl.pathname);
    if (!check.ok) {
      lastError = check.reason || 'blocked';
      continue;
    }

    if (statusEl) {
      statusEl.textContent = `Успешно! Отрисовка страницы из региона [${region.toUpperCase()}]...`;
    }
    bypassRunning = false;
    (window as any).__BSH_INCOGNITO_BYPASSING = false;
    injectUnlockedHtml(res.body, targetUrl, cfg, onPageReady);
    return;
  }

  bypassRunning = false;
  (window as any).__BSH_INCOGNITO_BYPASSING = false;
  if (statusEl) {
    statusEl.style.color = '#ff7b72';
    statusEl.textContent = `Не удалось обойти региональную блокировку (${regions.join(', ').toUpperCase()}). Причина: ${lastError}`;
  }
}

export function detectBlockedPage(): boolean {
  const path = window.location.pathname;
  const host = window.location.hostname;
  const storePaths = ['/app/', '/bundle/', '/sub/', '/publisher/', '/developer/', '/franchise/', '/curator/'];
  const communityPaths = ['/app/', '/sharedfiles/filedetails/', '/workshop/', '/games/'];

  if (host === 'store.steampowered.com' && storePaths.some((p) => path.includes(p))) {
    const errEl = document.querySelector('#error_box, .error_ctn, .page_content .error') as HTMLElement | null;
    if (errEl && LOCK_MARKERS.some((m) => (errEl.innerText || '').includes(m))) {
      return true;
    }
  } else if (host.includes('steamcommunity.com') && communityPaths.some((p) => path.includes(p))) {
    const msgEl = document.querySelector('.error_ctn #message h3, #message h3, #error_box') as HTMLElement | null;
    if (msgEl && LOCK_MARKERS.some((m) => (msgEl.innerText || '').includes(m))) {
      return true;
    }
  }
  return false;
}
