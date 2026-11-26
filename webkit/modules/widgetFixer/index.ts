import { StoreWebkitConfig, fetchViaBackend } from '../../shared/ipc';

const FALLBACK_REGIONS = ['us', 'ch', 'kz', 'jp'];
const WIDGET_LANGUAGE = 'russian';
const ERROR_TEXT_MARKER = 'Невозможно загрузить информацию об этом предмете';
const FINAL_ERROR_MESSAGE = 'Не удаётся разблокировать виджет, все регионы проверены.';
const TARGET_URL_PART = 'store.steampowered.com/widget/';

async function isWidgetBlocked(urlString: string): Promise<boolean> {
  const res = await fetchViaBackend(urlString);
  if (!res.ok || !res.body) return true;
  return res.body.includes(ERROR_TEXT_MARKER);
}

function createFallbackElement(): HTMLDivElement {
  const fallback = document.createElement('div');
  fallback.textContent = FINAL_ERROR_MESSAGE;
  fallback.style.cssText = `
    display: flex; align-items: center; justify-content: center;
    width: 100%; min-height: 100px; background-color: #1b2838;
    color: #ff6b6b; font-family: "Motiva Sans", sans-serif; font-size: 14px;
    text-align: center; border: 1px dashed #ff6b6b; padding: 10px;
    box-sizing: border-box;
  `;
  return fallback;
}

export function initWidgetFixerModule(cfg: StoreWebkitConfig): void {
  if (!cfg.widgetFixer) return;

  const userRegion = (cfg.defaultRegion || 'US').toLowerCase();
  const regionsToTry = Array.from(new Set([userRegion, ...FALLBACK_REGIONS]));

  const processIframe = async (iframe: HTMLIFrameElement) => {
    if (iframe.dataset.steamWidgetProcessed === 'true') return;
    iframe.dataset.steamWidgetProcessed = 'true';

    const originalUrl = iframe.src || iframe.dataset.src || '';
    if (!originalUrl.includes(TARGET_URL_PART)) return;

    const blocked = await isWidgetBlocked(originalUrl);
    if (!blocked) return;

    for (const region of regionsToTry) {
      try {
        const url = new URL(originalUrl);
        url.searchParams.set('cc', region);
        url.searchParams.set('l', WIDGET_LANGUAGE);
        const newUrlString = url.toString();

        if (!(await isWidgetBlocked(newUrlString))) {
          if (iframe.src) iframe.src = newUrlString;
          if (iframe.dataset.src) iframe.dataset.src = newUrlString;
          return;
        }
      } catch {}
    }

    const fallback = createFallbackElement();
    iframe.parentNode?.replaceChild(fallback, iframe);
  };

  setTimeout(() => {
    const selector = `iframe[src*="${TARGET_URL_PART}"], iframe[data-src*="${TARGET_URL_PART}"]`;
    document.querySelectorAll(selector).forEach((el) => processIframe(el as HTMLIFrameElement));

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches(selector)) {
            processIframe(node as HTMLIFrameElement);
          } else {
            node.querySelectorAll(selector).forEach((el) => processIframe(el as HTMLIFrameElement));
          }
        });
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }, 1500);
}
