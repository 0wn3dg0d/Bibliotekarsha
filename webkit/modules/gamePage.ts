import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { StoreWebkitConfig, fetchViaBackend, injectStyleOnce } from '../shared/ipc';

Chart.register(...registerables, ChartDataLabels);

interface ReviewSummary {
  total_reviews: number;
  total_positive: number;
  review_score?: number;
}

interface LangReviewEntry {
  langCode: string;
  langName: string;
  summary: ReviewSummary | null;
  visible: boolean;
  fetched: boolean;
}

const STEAM_LANGUAGES: Record<string, string> = {
  english: 'Английский',
  german: 'Немецкий',
  french: 'Французский',
  italian: 'Итальянский',
  koreana: 'Корейский',
  spanish: 'Испанский',
  schinese: 'Упр. китайский',
  tchinese: 'Трад. китайский',
  russian: 'Русский',
  thai: 'Тайский',
  japanese: 'Японский',
  portuguese: 'Португальский',
  polish: 'Польский',
  danish: 'Датский',
  dutch: 'Нидерландский',
  finnish: 'Финский',
  norwegian: 'Норвежский',
  swedish: 'Шведский',
  hungarian: 'Венгерский',
  czech: 'Чешский',
  romanian: 'Румынский',
  turkish: 'Турецкий',
  bulgarian: 'Болгарский',
  greek: 'Греческий',
  ukrainian: 'Украинский',
  latam: 'Испанский Лат. Ам.',
  vietnamese: 'Вьетнамский',
  indonesian: 'Индонезийский',
  brazilian: 'Португ. (Браз.)',
};

const GAMEPAGE_CSS = `
  .additional-reviews {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #3e4c583d;
  }
  .additional-reviews .user_reviews_summary_row {
    display: flex;
    line-height: 16px;
    margin-bottom: 5px;
  }
  .additional-reviews .user_reviews_summary_row.clickable {
    cursor: pointer;
    transition: background-color 0.2s;
    border-radius: 2px;
    padding: 2px 4px;
    margin: 0 5px 5px -4px;
  }
  .additional-reviews .user_reviews_summary_row.clickable:hover {
    background-color: rgba(103, 193, 245, 0.1);
  }
  .additional-reviews .subtitle {
    flex: 1;
    color: #556772;
    font-size: 12px;
    user-select: none;
  }
  .additional-reviews .summary {
    flex: 3;
    color: #c6d4df;
    font-size: 12px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .additional-reviews .game_review_summary { font-weight: normal; }
  .additional-reviews .positive { color: #66c0f4; }
  .additional-reviews .mixed { color: #B9A074; }
  .additional-reviews .negative { color: #a34c25; }
  .additional-reviews .no_reviews { color: #929396; }
  .additional-reviews .summary-error { color: #ff6961; font-style: italic; }

  .ofxmodal {
    display: none;
    position: fixed;
    z-index: 10000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(3px);
  }
  .ofxmodal-content {
    background-color: #1b2838;
    margin: 6% auto;
    padding: 25px;
    border: 1px solid #567d9c;
    width: 84%;
    max-width: 900px;
    color: #c6d4df;
    position: relative;
    max-height: 84vh;
    overflow-y: auto;
    border-radius: 4px;
    font-family: "Motiva Sans", Arial, sans-serif;
    scrollbar-color: #4b6f9c #1b2838;
    scrollbar-width: thin;
  }
  .ofxclose {
    background: none;
    border: none;
    color: #aaa;
    font-size: 30px;
    font-weight: normal;
    padding: 0 5px;
    line-height: 1;
    cursor: pointer;
    transition: color 0.2s ease;
    position: absolute;
    top: 15px;
    right: 15px;
    z-index: 1001;
  }
  .ofxclose:hover { color: #fff; }
  .refresh-button {
    background: #66c0f4;
    color: #1b2838;
    padding: 8px 18px;
    border: none;
    cursor: pointer;
    border-radius: 2px;
    transition: background 0.2s ease, color 0.2s ease;
    font-weight: 600;
  }
  .refresh-button:hover { background: #45b0e6; color: #fff; }
  #reviews-container .review_box {
    background-color: #16202d;
    border: 1px solid #2a3f5a;
    margin-bottom: 12px;
    border-radius: 3px;
    padding: 12px;
  }
  #reviews-container .hours { color: #8f98a0; font-size: 12px; }
  #reviews-container .content { color: #acb2b8; font-size: 13px; line-height: 17px; word-wrap: break-word; white-space: pre-wrap; }
  #reviews-container .posted,
  #reviews-container .found_helpful { color: #556772; font-size: 11px; }

  #globalReviewsModal {
    display: none;
    position: fixed;
    z-index: 10001;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(5px);
    color: #c6d4df;
    font-family: "Motiva Sans", Arial, sans-serif;
  }
  #globalReviewsModal .modal-content-inner {
    background-color: #101822;
    margin: 3vh auto;
    padding: 0;
    border: 1px solid #67c1f5;
    width: 94%;
    max-width: 1400px;
    height: 94vh;
    display: flex;
    flex-direction: column;
    border-radius: 5px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  }
  #globalReviewsModal .modal-header {
    padding: 14px 24px;
    background-color: #16202d;
    border-bottom: 1px solid #2a3f5a;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  #globalReviewsModal .modal-title {
    font-size: 19px;
    color: #67c1f5;
    font-weight: 500;
    margin: 0;
  }
  #globalReviewsModal .modal-close-btn {
    font-size: 28px;
    color: #aaa;
    background: none;
    border: none;
    cursor: pointer;
    line-height: 1;
    padding: 0 5px;
  }
  #globalReviewsModal .modal-close-btn:hover { color: #fff; }
  #globalReviewsModal .modal-body {
    display: flex;
    flex-grow: 1;
    overflow: hidden;
    padding: 18px 22px;
    gap: 22px;
  }
  #globalReviewsModal .modal-left-panel {
    width: 55%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  #globalReviewsModal .modal-right-panel {
    width: 45%;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    background-color: #16202d;
    border-radius: 4px;
    border: 1px solid #2a3f5a;
    padding: 15px;
  }
  #globalReviewsModal .controls-area {
    margin-bottom: 14px;
    display: flex;
    gap: 15px;
    align-items: center;
    flex-shrink: 0;
  }
  #globalReviewsModal .collect-btn {
    background: #66c0f4;
    color: #1b2838;
    padding: 9px 20px;
    border: none;
    cursor: pointer;
    border-radius: 3px;
    font-size: 14px;
    font-weight: bold;
  }
  #globalReviewsModal .collect-btn:hover:not(:disabled) { background: #8ad3f7; }
  #globalReviewsModal .collect-btn:disabled { background: #556772; color: #8f98a0; cursor: not-allowed; }
  #globalReviewsModal .progress-area { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
  #globalReviewsModal .progress-bar-container {
    width: 100%;
    background-color: #0a1016;
    border-radius: 5px;
    height: 18px;
    overflow: hidden;
    border: 1px solid #2a3f5a;
  }
  #globalReviewsModal .progress-bar-inner {
    width: 0%;
    height: 100%;
    background-color: #4b6f9c;
    transition: width 0.3s ease;
    text-align: right;
    color: #fff;
    font-weight: bold;
    line-height: 18px;
    font-size: 11px;
    padding-right: 6px;
  }
  #globalReviewsModal .progress-text { font-size: 11px; color: #8f98a0; margin-top: 3px; height: 1.2em; }
  #globalReviewsModal .table-container {
    flex-grow: 1;
    overflow: auto;
    border: 1px solid #2a3f5a;
    border-radius: 3px;
    background: #16202d;
  }
  #globalReviewsModal .reviews-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  #globalReviewsModal .reviews-table th,
  #globalReviewsModal .reviews-table td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid #2a3f5a;
    white-space: nowrap;
  }
  #globalReviewsModal .reviews-table th {
    background-color: #1f2c3a;
    color: #8f98a0;
    font-weight: normal;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  #globalReviewsModal .reviews-table td { color: #acb2b8; vertical-align: middle; }
  #globalReviewsModal .reviews-table .col-rank { width: 36px; text-align: center; color: #8f98a0; }
  #globalReviewsModal .reviews-table .col-check { width: 36px; text-align: center; }
  #globalReviewsModal .reviews-table .col-count { width: 85px; text-align: right; }
  #globalReviewsModal .reviews-table .col-percent-total { width: 75px; text-align: right; color: #8f98a0; }
  #globalReviewsModal .reviews-table .col-percent-pos { width: 65px; text-align: right; }
  #globalReviewsModal .reviews-table input[type=checkbox] { accent-color: #67c1f5; width: 15px; height: 15px; cursor: pointer; }
  #globalReviewsModal .no-reviews-info { margin-top: 10px; font-size: 12px; color: #8f98a0; }
  #globalReviewsModal .chart-container { width: 100%; height: 100%; position: relative; }
  #globalReviewsModal #reviewsPieChart { max-width: 100%; max-height: 100%; }
  #globalReviewsModal .modal-footer {
    padding: 12px 22px;
    border-top: 1px solid #2a3f5a;
    background-color: #16202d;
    text-align: center;
    font-size: 12px;
    color: #8f98a0;
    flex-shrink: 0;
  }
`;

function getGenitiveCase(label: string): string {
  switch (label) {
    case 'интерфейс':
      return 'интерфейса';
    case 'озвучка':
      return 'озвучки';
    case 'субтитры':
      return 'субтитров';
    default:
      return label;
  }
}

function createFruitIndicator(svgHtml: string, hasSupport: boolean, label: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.cursor = 'pointer';

  const box = document.createElement('div');
  box.style.width = '60px';
  box.style.height = '60px';
  box.style.borderRadius = '4px';
  box.style.display = 'flex';
  box.style.alignItems = 'center';
  box.style.justifyContent = 'center';
  box.style.background = hasSupport ? 'rgba(66, 135, 245, 0.2)' : 'rgba(0, 0, 0, 0.15)';
  box.style.border = `1px solid ${hasSupport ? '#2A5891' : '#3c3c3c'}`;
  box.style.opacity = '0.95';
  box.style.transition = 'transform 0.25s ease, box-shadow 0.25s ease';
  box.style.overflow = 'hidden';
  box.style.transform = 'translateZ(0)';

  const iconHolder = document.createElement('div');
  iconHolder.innerHTML = svgHtml;
  iconHolder.style.width = '30px';
  iconHolder.style.height = '30px';
  iconHolder.style.display = 'block';
  iconHolder.style.margin = '0 auto';

  const svgEl = iconHolder.querySelector('svg');
  if (svgEl) {
    svgEl.style.fill = hasSupport ? '#FFFFFF' : '#3A3B3B';
  }
  box.appendChild(iconHolder);

  const tooltip = document.createElement('div');
  tooltip.textContent = hasSupport ? `Есть ${label}` : `Нет ${getGenitiveCase(label)}`;
  tooltip.style.position = 'absolute';
  tooltip.style.top = '50%';
  tooltip.style.right = 'calc(100% + 8px)';
  tooltip.style.transform = 'translateY(-50%) translateX(10px)';
  tooltip.style.background = 'rgba(0, 0, 0, 0.85)';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '7px 12px';
  tooltip.style.borderRadius = '6px';
  tooltip.style.fontSize = '13px';
  tooltip.style.whiteSpace = 'nowrap';
  tooltip.style.opacity = '0';
  tooltip.style.transition = 'opacity 0.2s ease';
  tooltip.style.zIndex = '10000';
  tooltip.style.pointerEvents = 'none';
  wrapper.appendChild(tooltip);

  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.zIndex = '30';
    box.style.transform = 'scale(1.08) translateZ(0)';
    tooltip.style.opacity = '1';
  });
  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.zIndex = '1';
    box.style.transform = 'scale(1) translateZ(0)';
    tooltip.style.opacity = '0';
  });

  wrapper.appendChild(box);
  return wrapper;
}

function checkRussianSupport(): { interface: boolean; voice: boolean; subtitles: boolean } {
  const table = document.querySelector('#languageTable table.game_language_options');
  if (!table) return { interface: false, voice: false, subtitles: false };

  const rows = table.querySelectorAll('tr');
  for (const row of Array.from(rows)) {
    const langCell = row.querySelector('td.ellipsis');
    if (langCell && /русский|Russian/i.test((langCell.textContent || '').trim())) {
      const uiCell = row.querySelector('td.checkcol:nth-child(2) span');
      const voiceCell = row.querySelector('td.checkcol:nth-child(3) span');
      const subCell = row.querySelector('td.checkcol:nth-child(4) span');
      return {
        interface: uiCell !== null,
        voice: voiceCell !== null,
        subtitles: subCell !== null,
      };
    }
  }
  return { interface: false, voice: false, subtitles: false };
}

function addRussianIndicators(): void {
  const headerCtn = document.querySelector('#gameHeaderImageCtn') as HTMLElement | null;
  if (!headerCtn) return;

  const existing = headerCtn.querySelector('.use-rus-indicator-container');
  if (existing) existing.remove();

  const support = checkRussianSupport();

  const container = document.createElement('div');
  container.className = 'use-rus-indicator-container';
  container.style.position = 'absolute';
  container.style.top = '-10px';
  container.style.left = 'calc(100% + 10px)';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '15px';
  container.style.alignItems = 'flex-start';
  container.style.zIndex = '20';
  container.style.marginTop = '10px';

  const uiInd = createFruitIndicator(
    `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12,0C5.38,0,0,5.38,0,12s5.38,12,12,12s12-5.38,12-12S18.62,0,12,0z M12,22C6.49,22,2,17.51,2,12S6.49,2,12,2 s10,4.49,10,10S17.51,22,12,22z M10.5,10h3v8h-3V10z M10.5,5h3v3h-3V5z" /></svg>`,
    support.interface,
    'интерфейс'
  );
  const voiceInd = createFruitIndicator(
    `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15,21v-2c3.86,0,7-3.14,7-7s-3.14-7-7-7V3c4.96,0,9,4.04,9,9S19.96,21,15,21z M15,17v-2c1.65,0,3-1.35,3-3s-1.35-3-3-3V7 c2.76,0,5,2.24,5,5S17.76,17,15,17z M1,12v4h5l6,5V3L6,8H1V12" /></svg>`,
    support.voice,
    'озвучка'
  );
  const subInd = createFruitIndicator(
    `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g><path d="M11,24l-4.4-5H0V0h23v19h-7.6L11,24z M2,17h5.4l3.6,4l3.6-4H21V2H2V17z" /></g><g><rect x="5" y="8" width="3" height="3" /></g><g><rect x="10" y="8" width="3" height="3" /></g><g><rect x="15" y="8" width="3" height="3" /></g></svg>`,
    support.subtitles,
    'субтитры'
  );

  container.append(uiInd, voiceInd, subInd);
  headerCtn.style.position = 'relative';
  headerCtn.appendChild(container);

  const appName = document.querySelector('#appHubAppName.apphub_AppName') as HTMLElement | null;
  if (appName) {
    appName.style.maxWidth = '530px';
    appName.style.overflow = 'hidden';
    appName.style.textOverflow = 'ellipsis';
    appName.style.whiteSpace = 'nowrap';
    appName.title = appName.textContent || '';
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('ru-RU');
}

function getReviewClass(percent: number | null | undefined, totalReviews: number): string {
  if (totalReviews === 0 || percent === null || percent === undefined) return 'no_reviews';
  if (percent >= 70) return 'positive';
  if (percent >= 40) return 'mixed';
  return 'negative';
}

async function fetchReviewsSummary(appid: string, language: string): Promise<ReviewSummary | null> {
  const inputJson = encodeURIComponent(
    JSON.stringify({
      appid: parseInt(appid, 10),
      languages: [language],
      purchase_type: 1,
    })
  );
  const url = `https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?input_json=${inputJson}`;
  const res = await fetchViaBackend(url);
  if (!res.ok || !res.body) return null;
  try {
    const data = JSON.parse(res.body);
    return data?.response?.query_summary ?? null;
  } catch {
    return null;
  }
}

async function fetchRussianReviewsList(
  appid: string,
  filterStr: string,
  cursor: string
): Promise<{ reviews: any[] | null; nextCursor: string | null; error: string | null }> {
  const filterEnum = filterStr === 'recent' ? 1 : 0;
  const inputJson = encodeURIComponent(
    JSON.stringify({
      appid: parseInt(appid, 10),
      languages: ['russian'],
      purchase_type: 1,
      filter: filterEnum,
      cursor,
      day_range: 365,
      num_per_page: 20,
    })
  );
  const url = `https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?input_json=${inputJson}`;
  const res = await fetchViaBackend(url);
  if (!res.ok || !res.body) {
    return { reviews: null, nextCursor: null, error: `Ошибка API (статус ${res.status})` };
  }
  try {
    const data = JSON.parse(res.body);
    if (data?.response?.reviews) {
      return { reviews: data.response.reviews, nextCursor: data.response.cursor || null, error: null };
    }
    return { reviews: null, nextCursor: null, error: 'Ошибка структуры данных' };
  } catch {
    return { reviews: null, nextCursor: null, error: 'Ошибка обработки ответа' };
  }
}

export function initGamePageModule(cfg: StoreWebkitConfig): void {
  if (!cfg.gamePage) return;
  if (!window.location.pathname.includes('/app/')) return;

  const appidMatch = window.location.pathname.match(/\/app\/(\d+)/);
  const appid = appidMatch ? appidMatch[1] : null;
  if (!appid) return;

  let allReviewsData: ReviewSummary | null = null;
  let schineseData: ReviewSummary | null = null;
  let russianData: ReviewSummary | null = null;

  let currentReviewCursor = '*';
  let currentReviewFilter = 'all';

  let globalReviewsChart: Chart | null = null;
  let allLanguageData: LangReviewEntry[] = [];
  let globalCollectionRunId = 0;

  function renderReviewsFragment(reviews: any[]): DocumentFragment {
    const frag = document.createDocumentFragment();
    if (!reviews || reviews.length === 0) return frag;

    for (const r of reviews) {
      const isPositive = r.voted_up ? '👍 Рекомендую' : '👎 Не рекомендую';
      const color = r.voted_up ? '#66c0f4' : '#a34c25';
      const hours = ((r.author?.playtime_at_review || 0) / 60).toFixed(1);
      const date = new Date(r.timestamp_created * 1000).toLocaleDateString('ru-RU');

      const box = document.createElement('div');
      box.className = 'review_box';

      const titleEl = document.createElement('div');
      titleEl.className = 'title';
      titleEl.style.cssText = `color: ${color}; font-size: 16px; margin-bottom: 6px;`;
      titleEl.textContent = isPositive;

      const hoursEl = document.createElement('div');
      hoursEl.className = 'hours';
      hoursEl.style.marginBottom = '8px';
      hoursEl.textContent = `В игре: ${hours} ч.`;

      const contentEl = document.createElement('div');
      contentEl.className = 'content';
      contentEl.style.marginBottom = '8px';
      contentEl.textContent = r.review || '';

      const postedEl = document.createElement('div');
      postedEl.className = 'posted';
      postedEl.style.marginBottom = '3px';
      postedEl.textContent = `Опубликовано: ${date}`;

      const helpfulEl = document.createElement('div');
      helpfulEl.className = 'found_helpful';
      helpfulEl.textContent = `Полезно: ${r.votes_up ?? 0} | Смешно: ${r.votes_funny ?? 0}`;

      box.append(titleEl, hoursEl, contentEl, postedEl, helpfulEl);
      frag.appendChild(box);
    }
    return frag;
  }

  function closeRussianReviewsModal(): void {
    const modal = document.getElementById('russianReviewsModal') as any;
    if (modal) {
      modal.style.display = 'none';
      if (modal._escHandler) {
        document.removeEventListener('keydown', modal._escHandler);
        delete modal._escHandler;
      }
    }
    document.body.style.overflow = '';
  }

  async function loadRussianReviews(modal: HTMLElement, filter: string, isLoadMore = false): Promise<void> {
    const container = modal.querySelector('#reviews-container') as HTMLElement;
    const loadMoreBtn = modal.querySelector('#load-more-btn') as HTMLButtonElement;

    if (!isLoadMore) {
      currentReviewFilter = filter;
      currentReviewCursor = '*';
      loadMoreBtn.style.display = 'none';
    } else {
      loadMoreBtn.textContent = 'Загрузка...';
      loadMoreBtn.disabled = true;
    }

    const { reviews, nextCursor, error } = await fetchRussianReviewsList(appid!, filter, currentReviewCursor);

    if (error) {
      if (!isLoadMore) {
        container.innerHTML = `<p style="color:#ff6961;text-align:center;">${error}</p>`;
      }
      loadMoreBtn.textContent = 'Загрузить ещё';
      loadMoreBtn.disabled = false;
      return;
    }

    if (!reviews || (reviews.length === 0 && !isLoadMore)) {
      container.innerHTML = '<p style="color:#8f98a0;text-align:center;padding:20px;">Нет обзоров.</p>';
      loadMoreBtn.style.display = 'none';
      return;
    }

    const fragment = renderReviewsFragment(reviews);
    if (isLoadMore) {
      container.appendChild(fragment);
    } else {
      container.innerHTML = '';
      container.appendChild(fragment);
    }

    const prevCursor = currentReviewCursor;
    currentReviewCursor = nextCursor || '*';

    if (reviews.length === 0 || !nextCursor || nextCursor === prevCursor) {
      loadMoreBtn.style.display = 'none';
    } else {
      loadMoreBtn.style.display = 'inline-block';
      loadMoreBtn.textContent = 'Загрузить ещё';
      loadMoreBtn.disabled = false;
    }
  }

  function openRussianReviewsModal(): void {
    let modal = document.getElementById('russianReviewsModal') as any;
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'russianReviewsModal';
      modal.className = 'ofxmodal';
      modal.innerHTML = `
        <div class="ofxmodal-content">
          <span class="ofxclose" title="Закрыть">&times;</span>
          <div style="display:flex;gap:10px;margin-bottom:14px;">
            <button class="refresh-button" id="filter-all" style="padding:6px 12px;font-size:12px;">Самые полезные</button>
            <button class="refresh-button" id="filter-recent" style="padding:6px 12px;font-size:12px;background:#2a3f5a;color:#67c1f5;">Недавние</button>
          </div>
          <h3 style="text-align:center;color:#67c1f5;margin:0 0 18px 0;">Русскоязычные обзоры</h3>
          <div id="reviews-container">Загрузка...</div>
          <div style="text-align:center;margin-top:16px;">
            <button id="load-more-btn" class="refresh-button" style="display:none;">Загрузить ещё</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('.ofxclose').addEventListener('click', closeRussianReviewsModal);

      const btnAll = modal.querySelector('#filter-all') as HTMLButtonElement;
      const btnRecent = modal.querySelector('#filter-recent') as HTMLButtonElement;

      btnAll.addEventListener('click', () => {
        btnAll.style.background = '#66c0f4';
        btnAll.style.color = '#1b2838';
        btnRecent.style.background = '#2a3f5a';
        btnRecent.style.color = '#67c1f5';
        modal.querySelector('#reviews-container').textContent = 'Загрузка...';
        loadRussianReviews(modal, 'all');
      });

      btnRecent.addEventListener('click', () => {
        btnRecent.style.background = '#66c0f4';
        btnRecent.style.color = '#1b2838';
        btnAll.style.background = '#2a3f5a';
        btnAll.style.color = '#67c1f5';
        modal.querySelector('#reviews-container').textContent = 'Загрузка...';
        loadRussianReviews(modal, 'recent');
      });

      modal.querySelector('#load-more-btn').addEventListener('click', () => {
        loadRussianReviews(modal, currentReviewFilter, true);
      });

      modal.addEventListener('click', (event: MouseEvent) => {
        if (event.target === modal) closeRussianReviewsModal();
      });
    }

    if (!modal._escHandler) {
      modal._escHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeRussianReviewsModal();
      };
      document.addEventListener('keydown', modal._escHandler);
    }

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    const btnAll = modal.querySelector('#filter-all') as HTMLButtonElement;
    const btnRecent = modal.querySelector('#filter-recent') as HTMLButtonElement;
    btnAll.style.background = '#66c0f4';
    btnAll.style.color = '#1b2838';
    btnRecent.style.background = '#2a3f5a';
    btnRecent.style.color = '#67c1f5';

    loadRussianReviews(modal, 'all');
  }

  function closeGlobalReviewsModal(): void {
    globalCollectionRunId++;
    const collectBtn = document.getElementById('global-reviews-collect-btn') as HTMLButtonElement | null;
    if (collectBtn) collectBtn.disabled = false;
    const modal = document.getElementById('globalReviewsModal') as any;
    if (modal) {
      modal.style.display = 'none';
      if (modal._escHandler) {
        document.removeEventListener('keydown', modal._escHandler);
        delete modal._escHandler;
      }
    }
    document.body.style.overflow = '';
  }

  function updateGlobalReviewsChart(): void {
    const canvas = document.getElementById('reviewsPieChart') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const visibleData = allLanguageData
      .filter((d) => d.visible && d.summary && d.summary.total_reviews > 0)
      .sort((a, b) => (b.summary?.total_reviews || 0) - (a.summary?.total_reviews || 0));

    const chartLabels: string[] = [];
    const chartDataPoints: number[] = [];
    const chartColors: string[] = [];
    let otherCount = 0;
    const otherDetails: string[] = [];
    const topN = 6;

    const totalVisibleReviews = visibleData.reduce((sum, d) => sum + (d.summary?.total_reviews || 0), 0);
    const palette = [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b',
      '#e377c2', '#7f7f7f', '#bcbd22', '#17becf', '#aec7e8', '#ffbb78',
    ];

    visibleData.forEach((data, index) => {
      const count = data.summary?.total_reviews || 0;
      if (index < topN) {
        chartLabels.push(data.langName);
        chartDataPoints.push(count);
        chartColors.push(palette[index % palette.length]);
      } else {
        otherCount += count;
        otherDetails.push(`${data.langName}: ${formatNumber(count)}`);
      }
    });

    if (otherCount > 0) {
      chartLabels.push('Другие');
      chartDataPoints.push(otherCount);
      chartColors.push('#808080');
    }

    if (globalReviewsChart) {
      globalReviewsChart.destroy();
      globalReviewsChart = null;
    }

    if (chartDataPoints.length > 0) {
      globalReviewsChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: chartLabels,
          datasets: [
            {
              data: chartDataPoints,
              backgroundColor: chartColors,
              borderColor: '#101822',
              borderWidth: 2,
              hoverOffset: 8,
              hoverBorderColor: '#FFF',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#c6d4df',
                padding: 12,
                font: { size: 12 },
                boxWidth: 12,
                usePointStyle: true,
              },
            },
            tooltip: {
              callbacks: {
                label(context: any) {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const pct = totalVisibleReviews > 0 ? ((value / totalVisibleReviews) * 100).toFixed(1) : '0';
                  const lines = [`${label}: ${formatNumber(value)} (${pct}%)`];
                  if (label === 'Другие' && otherDetails.length > 0) {
                    lines.push('', 'Включает:', ...otherDetails.slice(0, 10));
                    if (otherDetails.length > 10) lines.push(`...и ещё ${otherDetails.length - 10}`);
                  }
                  return lines;
                },
              },
              backgroundColor: 'rgba(16, 24, 34, 0.92)',
              padding: 10,
            },
            datalabels: {
              formatter(value: number, context: any) {
                const pct = totalVisibleReviews > 0 ? (value / totalVisibleReviews) * 100 : 0;
                if (pct < 3) return null;
                let lbl = context.chart.data.labels[context.dataIndex] || '';
                if (lbl.length > 15 && lbl !== 'Другие') {
                  const parts = lbl.split(' ');
                  lbl = parts.length > 1 ? parts[0] : lbl.substring(0, 12) + '...';
                }
                return `${lbl}
${pct.toFixed(0)}%`;
              },
              color: '#FFFFFF',
              font: { weight: 'bold', size: 12, family: '"Motiva Sans", Arial, sans-serif' },
              backgroundColor: 'rgba(16, 24, 34, 0.75)',
              borderRadius: 3,
              padding: { top: 3, bottom: 3, left: 6, right: 6 },
              anchor: 'end',
              align: 'start',
              offset: 15,
              display(context: any) {
                const val = context.dataset.data[context.dataIndex] || 0;
                const pct = totalVisibleReviews > 0 ? (val / totalVisibleReviews) * 100 : 0;
                return pct >= 3;
              },
            },
          },
          layout: { padding: 20 },
        },
      });
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function renderGlobalReviewResults(): void {
    const tableBody = document.getElementById('global-reviews-table-body');
    const noReviewsInfo = document.getElementById('global-reviews-no-reviews-info');
    if (!tableBody || !noReviewsInfo) return;

    tableBody.innerHTML = '';
    noReviewsInfo.textContent = '';

    const languagesWithErrors = allLanguageData.filter((d) => !d.fetched && d.summary === null);
    const validLanguageData = allLanguageData.filter((d) => d.fetched && d.summary !== null);
    const zeroLangs: string[] = [];

    const totalReviews = validLanguageData.reduce((sum, d) => sum + (d.summary?.total_reviews || 0), 0);
    validLanguageData.sort((a, b) => (b.summary?.total_reviews || 0) - (a.summary?.total_reviews || 0));

    if (validLanguageData.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;padding:20px;color:#8f98a0;">Нет обзоров или не удалось загрузить данные.</td></tr>';
      return;
    }

    let rank = 1;
    for (const data of validLanguageData) {
      const reviewCount = data.summary?.total_reviews || 0;
      if (reviewCount === 0) {
        zeroLangs.push(data.langName);
        continue;
      }
      const posCount = data.summary?.total_positive || 0;
      const pctTotal = totalReviews > 0 ? ((reviewCount / totalReviews) * 100).toFixed(1) : '0.0';
      const pctPos = Math.round((posCount / reviewCount) * 100);
      const revClass = getReviewClass(pctPos, reviewCount);

      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="col-rank">${rank++}</td>
        <td class="col-check"><input type="checkbox" class="chart-toggle-checkbox" data-lang-code="${data.langCode}" ${data.visible ? 'checked' : ''}></td>
        <td class="col-lang">${data.langName}</td>
        <td class="col-count">${formatNumber(reviewCount)}</td>
        <td class="col-percent-total">${pctTotal}%</td>
        <td class="col-percent-pos"><span class="game_review_summary ${revClass}">${pctPos}%</span></td>
      `;
      tableBody.appendChild(row);
    }

    tableBody.querySelectorAll('.chart-toggle-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e: Event) => {
        const input = e.target as HTMLInputElement;
        const entry = allLanguageData.find((d) => d.langCode === input.dataset.langCode);
        if (entry) entry.visible = input.checked;
        updateGlobalReviewsChart();
      });
    });

    const parts: string[] = [];
    if (zeroLangs.length > 0) parts.push(`Нет обзоров: ${zeroLangs.join(', ')}`);
    if (languagesWithErrors.length > 0) parts.push(`Ошибки загрузки: ${languagesWithErrors.map((l) => l.langName).join(', ')}`);
    noReviewsInfo.textContent = parts.join('. ');

    updateGlobalReviewsChart();
  }

  async function startGlobalReviewCollection(): Promise<void> {
    const collectBtn = document.getElementById('global-reviews-collect-btn') as HTMLButtonElement | null;
    const progressBar = document.getElementById('global-reviews-progress-bar') as HTMLElement | null;
    const progressText = document.getElementById('global-reviews-progress-text') as HTMLElement | null;
    const tableBody = document.getElementById('global-reviews-table-body') as HTMLElement | null;
    const noReviewsInfo = document.getElementById('global-reviews-no-reviews-info') as HTMLElement | null;
    if (!collectBtn || !progressBar || !progressText || !tableBody || !noReviewsInfo) return;

    const runId = ++globalCollectionRunId;
    collectBtn.disabled = true;
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#8f98a0;">Загрузка данных...</td></tr>';
    noReviewsInfo.textContent = '';

    if (globalReviewsChart) {
      globalReviewsChart.destroy();
      globalReviewsChart = null;
    }

    allLanguageData = [
      {
        langCode: 'russian',
        langName: STEAM_LANGUAGES.russian,
        summary: russianData,
        visible: true,
        fetched: russianData !== null,
      },
      {
        langCode: 'schinese',
        langName: STEAM_LANGUAGES.schinese,
        summary: schineseData,
        visible: true,
        fetched: schineseData !== null,
      },
    ];

    const langsToFetch = Object.keys(STEAM_LANGUAGES).filter((l) => l !== 'russian' && l !== 'schinese');
    let okCount = 0;
    let errCount = 0;

    const updateProgress = () => {
      const done = okCount + errCount;
      const pct = langsToFetch.length > 0 ? Math.round((done / langsToFetch.length) * 100) : 100;
      progressBar.style.width = `${pct}%`;
      progressBar.textContent = `${pct}%`;
      progressText.textContent = `Обработано: ${done} из ${langsToFetch.length} языков (Успешно: ${okCount}, Ошибок: ${errCount})`;
    };

    updateProgress();

    for (const langCode of langsToFetch) {
      if (runId !== globalCollectionRunId) return;
      const summary = await fetchReviewsSummary(appid!, langCode);
      if (runId !== globalCollectionRunId) return;
      allLanguageData.push({
        langCode,
        langName: STEAM_LANGUAGES[langCode],
        summary,
        visible: true,
        fetched: summary !== null,
      });
      if (summary !== null) okCount++;
      else errCount++;
      updateProgress();
      await new Promise((r) => setTimeout(r, 150));
    }

    if (runId !== globalCollectionRunId) return;
    renderGlobalReviewResults();
    collectBtn.disabled = false;
    progressText.textContent += ' — Готово!';
  }

  function openGlobalReviewsModal(): void {
    let modal = document.getElementById('globalReviewsModal') as any;
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'globalReviewsModal';
      modal.innerHTML = `
        <div class="modal-content-inner">
          <div class="modal-header">
            <h3 class="modal-title">Глобальный монитор обзоров</h3>
            <button class="modal-close-btn" title="Закрыть">&times;</button>
          </div>
          <div class="modal-body">
            <div class="modal-left-panel">
              <div class="controls-area">
                <button id="global-reviews-collect-btn" class="collect-btn">Собрать</button>
                <div class="progress-area">
                  <div class="progress-bar-container">
                    <div id="global-reviews-progress-bar" class="progress-bar-inner"></div>
                  </div>
                  <div id="global-reviews-progress-text" class="progress-text"></div>
                </div>
              </div>
              <div class="table-container">
                <table class="reviews-table">
                  <thead>
                    <tr>
                      <th class="col-rank">#</th>
                      <th class="col-check" title="Показать на диаграмме">📊</th>
                      <th class="col-lang">Язык</th>
                      <th class="col-count">Обзоры</th>
                      <th class="col-percent-total">% Общ</th>
                      <th class="col-percent-pos">% 👍</th>
                    </tr>
                  </thead>
                  <tbody id="global-reviews-table-body">
                    <tr><td colspan="6" style="text-align:center;padding:20px;color:#8f98a0;">Нажмите «Собрать», чтобы загрузить данные.</td></tr>
                  </tbody>
                </table>
              </div>
              <div id="global-reviews-no-reviews-info" class="no-reviews-info"></div>
            </div>
            <div class="modal-right-panel">
              <div class="chart-container">
                <canvas id="reviewsPieChart"></canvas>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <strong>Внимание:</strong> Загрузка данных по каждому языку отправляет отдельный запрос к Steam API.
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('.modal-close-btn').addEventListener('click', closeGlobalReviewsModal);
      modal.querySelector('#global-reviews-collect-btn').addEventListener('click', startGlobalReviewCollection);
      modal.addEventListener('click', (event: MouseEvent) => {
        if (event.target === modal) closeGlobalReviewsModal();
      });
    }

    if (!modal._escHandler) {
      modal._escHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeGlobalReviewsModal();
      };
      document.addEventListener('keydown', modal._escHandler);
    }

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  function displayAdditionalReviews(): void {
    const container = document.querySelector('.additional-reviews');
    if (!container) return;
    container.innerHTML = '';

    const addRow = (id: string, title: string, data: ReviewSummary | null, onClick?: () => void) => {
      const row = document.createElement('div');
      row.className = 'user_reviews_summary_row';
      row.id = id;
      if (onClick) {
        row.classList.add('clickable');
        row.addEventListener('click', onClick);
      }

      let statusClass = 'no_reviews';
      let text = 'Нет данных';
      if (data === null) {
        statusClass = 'summary-error';
        text = 'Ошибка загрузки';
      } else if (data.total_reviews > 0) {
        const pct = Math.round((data.total_positive / data.total_reviews) * 100);
        statusClass = getReviewClass(pct, data.total_reviews);
        text = `${pct}% из ${formatNumber(data.total_reviews)} положительные`;
      } else {
        text = 'Нет обзоров';
      }

      row.innerHTML = `
        <div class="subtitle column all">${title}:</div>
        <div class="summary column">
          <span class="game_review_summary ${statusClass}">${text}</span>
        </div>
      `;
      container.appendChild(row);
    };

    addRow('total-reviews-row', 'Тотальные', allReviewsData, openGlobalReviewsModal);

    let nonChinese: ReviewSummary | null = null;
    if (allReviewsData && schineseData) {
      nonChinese = {
        total_reviews: Math.max(0, allReviewsData.total_reviews - schineseData.total_reviews),
        total_positive: Math.max(0, allReviewsData.total_positive - schineseData.total_positive),
      };
    }
    addRow('non-chinese-reviews-row', 'Безкитайские', nonChinese);
    addRow('russian-reviews-row', 'Русские', russianData, openRussianReviewsModal);
  }

  async function loadAdditionalReviews(): Promise<void> {
    const loadBtn = document.getElementById('load-reviews-button');
    if (loadBtn) {
      const summaryEl = loadBtn.querySelector('.game_review_summary');
      if (summaryEl) summaryEl.textContent = 'Загрузка...';
      loadBtn.style.pointerEvents = 'none';
      loadBtn.style.opacity = '0.6';
    }

    const [allRes, schineseRes, russianRes] = await Promise.all([
      fetchReviewsSummary(appid!, 'all'),
      fetchReviewsSummary(appid!, 'schinese'),
      fetchReviewsSummary(appid!, 'russian'),
    ]);

    allReviewsData = allRes;
    schineseData = schineseRes;
    russianData = russianRes;

    displayAdditionalReviews();
    if (loadBtn) loadBtn.remove();
  }

  function addLoadButton(): void {
    const reviewsContainer = document.querySelector('.user_reviews');
    if (!reviewsContainer) return;

    document.getElementById('load-reviews-button')?.remove();
    document.querySelector('.additional-reviews')?.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'additional-reviews';

    const btnRow = document.createElement('div');
    btnRow.className = 'user_reviews_summary_row clickable';
    btnRow.id = 'load-reviews-button';
    btnRow.innerHTML = `
      <div class="subtitle column all">Доп. обзоры:</div>
      <div class="summary column">
        <span class="game_review_summary no_reviews">Загрузить статистику</span>
      </div>
    `;
    btnRow.addEventListener('click', loadAdditionalReviews);

    wrapper.appendChild(btnRow);
    reviewsContainer.appendChild(wrapper);

    if (cfg.autoLoadReviews) {
      loadAdditionalReviews();
    }
  }

  let initialized = false;
  const tryInit = () => {
    if (initialized) return true;
    const headerImage = document.querySelector('#gameHeaderImageCtn');
    const reviewsContainer = document.querySelector('.user_reviews');
    const langTable = document.querySelector('#languageTable');

    if (headerImage && (reviewsContainer || langTable || document.readyState !== 'loading')) {
      initialized = true;
      injectStyleOnce('bsh-gamepage-styles', GAMEPAGE_CSS);
      addRussianIndicators();
      addLoadButton();
      return true;
    }
    return false;
  };

  if (!tryInit()) {
    const observer = new MutationObserver((_m, obs) => {
      if (tryInit()) obs.disconnect();
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    setTimeout(() => {
      observer.disconnect();
      if (!initialized && document.querySelector('#gameHeaderImageCtn')) {
        initialized = true;
        injectStyleOnce('bsh-gamepage-styles', GAMEPAGE_CSS);
        addRussianIndicators();
        addLoadButton();
      }
    }, 8000);
  }
}
