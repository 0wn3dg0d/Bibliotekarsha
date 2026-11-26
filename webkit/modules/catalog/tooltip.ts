import { StoreWebkitConfig } from '../../shared/ipc';
import { CatalogGameData, catalogGameCache, getAllCatalogTags } from './store';

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getReviewClass(percent: number, totalReviews: number): string {
  if (!totalReviews) return 'catalog-no-reviews';
  if (percent >= 70) return 'catalog-positive';
  if (percent >= 40) return 'catalog-mixed';
  return 'catalog-negative';
}

function formatLangSupport(lang?: { supported?: boolean; full_audio?: boolean; subtitles?: boolean }) {
  if (!lang) return { text: 'Отсутствует', cls: 'catalog-language-no' };
  let text = '';
  if (lang.supported) text += '<br>Интерфейс: ✔ ';
  if (lang.full_audio) text += '<br>Озвучка: ✔ ';
  if (lang.subtitles) text += '<br>Субтитры: ✔';
  if (!text) return { text: 'Отсутствует', cls: 'catalog-language-no' };
  return { text, cls: 'catalog-language-yes' };
}

export function initCatalogTooltip(cfg: StoreWebkitConfig): void {
  let tooltipEl: HTMLDivElement | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const hideTooltip = () => {
    if (!tooltipEl) return;
    tooltipEl.style.opacity = '0';
    setTimeout(() => {
      if (tooltipEl && tooltipEl.style.opacity === '0') {
        tooltipEl.style.display = 'none';
      }
    }, 260);
  };

  const displayGameInfo = (element: HTMLElement, data: CatalogGameData) => {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'bsh-catalog-tooltip';
      tooltipEl.innerHTML = '<div class="tooltip-arrow"></div><div class="tooltip-content"></div>';
      document.body.appendChild(tooltipEl);
    }

    const content = tooltipEl.querySelector('.tooltip-content')!;
    const ruLang = formatLangSupport(data.language_support_russian);
    const enLang = cfg.catalogTooltipEnglish ? formatLangSupport(data.language_support_english) : null;
    const reviewCls = getReviewClass(data.percent_positive, data.review_count);
    const eaCls = data.is_early_access ? 'catalog-early-access-yes' : 'catalog-early-access-no';

    const allTags = getAllCatalogTags();
    const tagsHtml = (data.tagids || [])
      .slice(0, 5)
      .map((tagId) => `<div class="custom-tag">${escapeHtml(allTags[String(tagId)] || `Тег #${tagId}`)}</div>`)
      .join('');

    content.innerHTML = `
      <div><strong>Издатели:</strong> <span class="${!data.publishers ? 'catalog-no-reviews' : ''}">${escapeHtml(data.publishers || 'Нет данных')}</span></div>
      <div><strong>Разработчики:</strong> <span class="${!data.developers ? 'catalog-no-reviews' : ''}">${escapeHtml(data.developers || 'Нет данных')}</span></div>
      <div style="margin-bottom: 8px;"><strong>Серия игр:</strong> <span class="${!data.franchises ? 'catalog-no-reviews' : ''}">${escapeHtml(data.franchises || 'Нет данных')}</span></div>
      <div style="margin-bottom: 8px;"><strong>Отзывы: </strong><span>${data.review_count || 0} </span><span class="${reviewCls}">(${data.percent_positive || 0}% положит.)</span></div>
      <div style="margin-bottom: 8px;"><strong>Ранний доступ:</strong> <span class="${eaCls}">${data.is_early_access ? 'Да' : 'Нет'}</span></div>
      <div style="margin-bottom: 8px;"><strong>Русский язык:</strong> <span class="${ruLang.cls}">${ruLang.text}</span></div>
      ${enLang ? `<div style="margin-bottom: 8px;"><strong>Английский язык:</strong> <span class="${enLang.cls}">${enLang.text}</span></div>` : ''}
      ${tagsHtml ? `<div style="margin-bottom: 8px;"><strong>Метки:</strong><div class="custom-tags-container">${tagsHtml}</div></div>` : ''}
      <div><strong>Описание:</strong> <span class="${!data.short_description ? 'catalog-no-reviews' : ''}">${escapeHtml(data.short_description || 'Нет данных')}</span></div>
    `;

    tooltipEl.style.display = 'block';
    const rect = element.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();

    const leftPos = Math.max(8, rect.left + window.scrollX - tipRect.width - 8);
    const topPos = Math.max(8, rect.top + window.scrollY - 20);
    tooltipEl.style.left = `${leftPos}px`;
    tooltipEl.style.top = `${topPos}px`;
    tooltipEl.style.opacity = '0';

    requestAnimationFrame(() => {
      if (tooltipEl) tooltipEl.style.opacity = '1';
    });

    element.addEventListener(
      'mouseleave',
      () => {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(hideTooltip, 180);
      },
      { once: true }
    );
  };

  document.addEventListener('mouseover', (event) => {
    const target = event.target as HTMLElement | null;
    const row = target?.closest('a.search_result_row') as HTMLElement | null;

    if (row?.dataset.dsAppid) {
      const gameData = catalogGameCache.get(row.dataset.dsAppid);
      if (gameData) {
        if (hoverTimer) clearTimeout(hoverTimer);
        if (hideTimer) clearTimeout(hideTimer);
        hoverTimer = setTimeout(() => displayGameInfo(row, gameData), 280);
        return;
      }
    }

    if (hoverTimer) clearTimeout(hoverTimer);
    if (hideTimer) clearTimeout(hideTimer);
    hideTooltip();
  });
}
