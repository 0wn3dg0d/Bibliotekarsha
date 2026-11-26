import React, { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { ffi } from 'millennium';
import { registerNfoSection } from '../../core/nfo-registry';
import { BibliotekarshaModule } from '../../core/types';

Chart.register(...registerables, ChartDataLabels);

const fetchUrl = ffi('fetch_url');

interface ReviewSummary {
  total_reviews: number;
  total_positive: number;
  review_score?: number;
}

interface ReviewsBundle {
  all: ReviewSummary | null;
  schinese: ReviewSummary | null;
  russian: ReviewSummary | null;
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

const NFO_REVIEWS_MODAL_CSS = `
  .bib-ofx-modal {
    position: fixed;
    inset: 0;
    z-index: 100025;
    overflow: auto;
    padding: 52px 20px 20px;
    box-sizing: border-box;
    background-color: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(3px);
    font-family: "Motiva Sans", Arial, sans-serif;
    -webkit-app-region: no-drag;
  }
  .bib-ofx-content {
    background-color: #1b2838;
    margin: 0 auto;
    padding: 25px;
    border: 1px solid #567d9c;
    width: 84%;
    max-width: 900px;
    color: #c6d4df;
    position: relative;
    max-height: calc(100vh - 76px);
    overflow-y: auto;
    border-radius: 4px;
    scrollbar-color: #4b6f9c #1b2838;
    scrollbar-width: thin;
    -webkit-app-region: no-drag;
  }
  .bib-ofx-content::-webkit-scrollbar { width: 7px; }
  .bib-ofx-content::-webkit-scrollbar-track { background: #1b2838; }
  .bib-ofx-content::-webkit-scrollbar-thumb { background: #4b6f9c; border-radius: 4px; }
  .bib-ofx-close {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #aaa;
    font-size: 28px;
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    cursor: pointer;
    transition: color 0.2s ease, background-color 0.2s ease;
    position: absolute;
    top: 12px;
    right: 14px;
    z-index: 10;
    -webkit-app-region: no-drag;
  }
  .bib-ofx-close:hover { color: #fff; }
  .bib-ofx-refresh-btn {
    background: #66c0f4;
    color: #1b2838;
    padding: 8px 18px;
    border: none;
    cursor: pointer;
    border-radius: 2px;
    transition: background 0.2s ease, color 0.2s ease;
    font-weight: 600;
  }
  .bib-ofx-refresh-btn:hover:not(:disabled) { background: #45b0e6; color: #fff; }
  .bib-ofx-refresh-btn:disabled { opacity: 0.6; cursor: default; }
  .bib-ofx-review-box {
    background-color: #16202d;
    border: 1px solid #2a3f5a;
    margin-bottom: 12px;
    border-radius: 3px;
    padding: 12px;
  }
  .bib-ofx-review-hours { color: #8f98a0; font-size: 12px; margin-bottom: 8px; }
  .bib-ofx-review-text { color: #acb2b8; font-size: 13px; line-height: 17px; word-wrap: break-word; white-space: pre-wrap; margin-bottom: 8px; }
  .bib-ofx-review-meta { color: #556772; font-size: 11px; }

  .bib-grm-overlay {
    position: fixed;
    inset: 0;
    z-index: 100026;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 52px 20px 20px;
    box-sizing: border-box;
    background-color: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(5px);
    color: #c6d4df;
    font-family: "Motiva Sans", Arial, sans-serif;
    -webkit-app-region: no-drag;
  }
  .bib-grm-inner {
    background-color: #101822;
    margin: 0;
    padding: 0;
    border: 1px solid #67c1f5;
    width: 100%;
    max-width: 1400px;
    height: 100%;
    max-height: calc(100vh - 72px);
    display: flex;
    flex-direction: column;
    border-radius: 5px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    -webkit-app-region: no-drag;
  }
  .bib-grm-header {
    padding: 14px 24px;
    background-color: #16202d;
    border-bottom: 1px solid #2a3f5a;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    position: relative;
    z-index: 2;
    -webkit-app-region: no-drag;
  }
  .bib-grm-title { font-size: 19px; color: #67c1f5; font-weight: 500; margin: 0; }
  .bib-grm-close {
    font-size: 28px;
    color: #aaa;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    line-height: 1;
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
    transition: color 0.15s, background-color 0.15s, border-color 0.15s;
  }
  .bib-grm-close:hover {
    color: #fff;
    background: rgba(102, 192, 244, 0.16);
    border-color: rgba(102, 192, 244, 0.4);
  }
  .bib-grm-body { display: flex; flex-grow: 1; overflow: hidden; padding: 18px 22px; gap: 22px; }
  .bib-grm-left { width: 55%; display: flex; flex-direction: column; overflow: hidden; }
  .bib-grm-right {
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
  .bib-grm-controls { margin-bottom: 14px; display: flex; gap: 15px; align-items: center; flex-shrink: 0; }
  .bib-grm-collect {
    background: #66c0f4;
    color: #1b2838;
    padding: 9px 20px;
    border: none;
    cursor: pointer;
    border-radius: 3px;
    font-size: 14px;
    font-weight: bold;
  }
  .bib-grm-collect:hover:not(:disabled) { background: #8ad3f7; }
  .bib-grm-collect:disabled { background: #556772; color: #8f98a0; cursor: not-allowed; }
  .bib-grm-progress-area { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
  .bib-grm-progress-bar {
    width: 100%;
    background-color: #0a1016;
    border-radius: 5px;
    height: 18px;
    overflow: hidden;
    border: 1px solid #2a3f5a;
  }
  .bib-grm-progress-fill {
    height: 100%;
    background-color: #4b6f9c;
    transition: width 0.3s ease;
    text-align: right;
    color: #fff;
    font-weight: bold;
    line-height: 18px;
    font-size: 11px;
    padding-right: 6px;
    box-sizing: border-box;
  }
  .bib-grm-progress-text { font-size: 11px; color: #8f98a0; margin-top: 3px; min-height: 1.2em; }
  .bib-grm-table-wrap {
    flex-grow: 1;
    overflow: auto;
    border: 1px solid #2a3f5a;
    border-radius: 3px;
    background: #16202d;
  }
  .bib-grm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .bib-grm-table th, .bib-grm-table td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid #2a3f5a;
    white-space: nowrap;
  }
  .bib-grm-table th {
    background-color: #1f2c3a;
    color: #8f98a0;
    font-weight: normal;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .bib-grm-table td { color: #acb2b8; vertical-align: middle; }
  .bib-grm-table .col-rank { width: 36px; text-align: center; color: #8f98a0; }
  .bib-grm-table .col-check { width: 36px; text-align: center; }
  .bib-grm-table .col-count { width: 85px; text-align: right; }
  .bib-grm-table .col-pct-total { width: 75px; text-align: right; color: #8f98a0; }
  .bib-grm-table .col-pct-pos { width: 65px; text-align: right; }
  .bib-grm-table input[type="checkbox"] { accent-color: #67c1f5; width: 15px; height: 15px; cursor: pointer; }
  .bib-grm-no-reviews { margin-top: 10px; font-size: 12px; color: #8f98a0; }
  .bib-grm-footer {
    padding: 12px 22px;
    border-top: 1px solid #2a3f5a;
    background-color: #16202d;
    text-align: center;
    font-size: 12px;
    color: #8f98a0;
    flex-shrink: 0;
  }
`;

const reviewsSessionCache = new Map<number, ReviewsBundle>();
const globalMonitorCache = new Map<number, LangReviewEntry[]>();

function formatNumber(n: number): string {
  return n.toLocaleString('ru-RU');
}

function reviewColor(pct: number | null | undefined, total: number): string {
  if (total === 0 || pct === null || pct === undefined) return '#929396';
  if (pct >= 70) return '#66c0f4';
  if (pct >= 40) return '#B9A074';
  return '#a34c25';
}

async function fetchReviewSummary(appId: number, language: string): Promise<ReviewSummary | null> {
  const inputJson = encodeURIComponent(
    JSON.stringify({ appid: appId, languages: [language], purchase_type: 1 })
  );
  const url = `https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?input_json=${inputJson}`;
  try {
    const raw = await fetchUrl(JSON.stringify({ url, method: 'GET' }));
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed?.ok || !parsed?.body) return null;
    const json = JSON.parse(parsed.body);
    return json?.response?.query_summary ?? null;
  } catch {
    return null;
  }
}

async function fetchRussianReviewsPage(appId: number, filterStr: 'all' | 'recent', cursor: string) {
  const inputJson = encodeURIComponent(
    JSON.stringify({
      appid: appId,
      languages: ['russian'],
      purchase_type: 1,
      filter: filterStr === 'recent' ? 1 : 0,
      cursor,
      day_range: 365,
      num_per_page: 20,
    })
  );
  const url = `https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?input_json=${inputJson}`;
  try {
    const raw = await fetchUrl(JSON.stringify({ url, method: 'GET' }));
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed?.ok || !parsed?.body) {
      return { reviews: null, nextCursor: null, error: `Ошибка API (статус ${parsed?.status || 0})` };
    }
    const json = JSON.parse(parsed.body);
    if (Array.isArray(json?.response?.reviews)) {
      return {
        reviews: json.response.reviews as any[],
        nextCursor: (json.response.cursor as string) || null,
        error: null,
      };
    }
    return { reviews: null, nextCursor: null, error: 'Ошибка структуры данных' };
  } catch {
    return { reviews: null, nextCursor: null, error: 'Ошибка обработки ответа' };
  }
}

function useModalEscape(onClose: () => void, overlayRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const targetWin =
      overlayRef.current?.ownerDocument?.defaultView ||
      window.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0')?.m_popup ||
      window;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    targetWin.addEventListener('keydown', onKey, true);
    return () => targetWin.removeEventListener('keydown', onKey, true);
  }, [onClose, overlayRef]);
}

function RussianReviewsModal({ appId, onClose }: { appId: number; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter] = useState<'all' | 'recent'>('all');
  const [reviews, setReviews] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>('*');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalEscape(onClose, overlayRef);

  const load = async (mode: 'all' | 'recent', cur: string, isLoadMore: boolean) => {
    if (isLoadMore) setLoadingMore(true);
    else {
      setLoading(true);
      setReviews([]);
    }
    setError(null);

    const res = await fetchRussianReviewsPage(appId, mode, cur);
    setLoading(false);
    setLoadingMore(false);

    if (res.error) {
      if (!isLoadMore) setError(res.error);
      return;
    }

    const list = res.reviews || [];
    setReviews((prev) => (isLoadMore ? [...prev, ...list] : list));
    setCursor(list.length > 0 && res.nextCursor && res.nextCursor !== cur ? res.nextCursor : null);
  };

  useEffect(() => {
    load('all', '*', false);
  }, [appId]);

  return (
    <div ref={overlayRef} className="bib-ofx-modal" onClick={onClose}>
      <style>{NFO_REVIEWS_MODAL_CSS}</style>
      <div className="bib-ofx-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bib-ofx-close" title="Закрыть" onClick={onClose}>
          &times;
        </button>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <button
            type="button"
            className="bib-ofx-refresh-btn"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: filter === 'all' ? '#66c0f4' : '#2a3f5a',
              color: filter === 'all' ? '#1b2838' : '#67c1f5',
            }}
            onClick={() => {
              setFilter('all');
              load('all', '*', false);
            }}
          >
            Самые полезные
          </button>
          <button
            type="button"
            className="bib-ofx-refresh-btn"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: filter === 'recent' ? '#66c0f4' : '#2a3f5a',
              color: filter === 'recent' ? '#1b2838' : '#67c1f5',
            }}
            onClick={() => {
              setFilter('recent');
              load('recent', '*', false);
            }}
          >
            Недавние
          </button>
        </div>

        <h3 style={{ textAlign: 'center', color: '#67c1f5', margin: '0 0 18px 0', fontSize: '18px' }}>
          Русскоязычные обзоры
        </h3>

        <div>
          {loading && <div style={{ textAlign: 'center', color: '#8f98a0', padding: '16px' }}>Загрузка...</div>}
          {!loading && error && <p style={{ color: '#ff6961', textAlign: 'center' }}>{error}</p>}
          {!loading && !error && reviews.length === 0 && (
            <p style={{ color: '#8f98a0', textAlign: 'center', padding: '20px' }}>Нет обзоров.</p>
          )}
          {reviews.map((r, i) => {
            const isPositive = Boolean(r.voted_up);
            const hours = ((r.author?.playtime_at_review || 0) / 60).toFixed(1);
            const date = r.timestamp_created
              ? new Date(r.timestamp_created * 1000).toLocaleDateString('ru-RU')
              : '';
            return (
              <div key={String(r.recommendationid || i)} className="bib-ofx-review-box">
                <div style={{ color: isPositive ? '#66c0f4' : '#a34c25', fontSize: '16px', marginBottom: '6px' }}>
                  {isPositive ? '👍 Рекомендую' : '👎 Не рекомендую'}
                </div>
                <div className="bib-ofx-review-hours">В игре: {hours} ч.</div>
                <div className="bib-ofx-review-text">{r.review || ''}</div>
                <div className="bib-ofx-review-meta" style={{ marginBottom: '3px' }}>
                  Опубликовано: {date}
                </div>
                <div className="bib-ofx-review-meta">
                  Полезно: {r.votes_up ?? 0} | Смешно: {r.votes_funny ?? 0}
                </div>
              </div>
            );
          })}
        </div>

        {!loading && cursor && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              disabled={loadingMore}
              className="bib-ofx-refresh-btn"
              onClick={() => load(filter, cursor, true)}
            >
              {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GlobalReviewsMonitorModal({
  appId,
  initialRu,
  initialZh,
  onClose,
}: {
  appId: number;
  initialRu: ReviewSummary | null;
  initialZh: ReviewSummary | null;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const cancelledRef = useRef(false);

  const [entries, setEntries] = useState<LangReviewEntry[]>(() => globalMonitorCache.get(appId) || []);
  const [collecting, setCollecting] = useState(false);
  const [progressPct, setProgressPct] = useState(() => (globalMonitorCache.has(appId) ? 100 : 0));
  const [progressText, setProgressText] = useState(() =>
    globalMonitorCache.has(appId) ? 'Данные загружены из кэша сессии.' : ''
  );

  useModalEscape(onClose, overlayRef);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const visibleData = entries
      .filter((d) => d.visible && d.summary && d.summary.total_reviews > 0)
      .sort((a, b) => (b.summary?.total_reviews || 0) - (a.summary?.total_reviews || 0));

    if (visibleData.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

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

    chartRef.current = new Chart(ctx, {
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
        layout: { padding: 20 },
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
              return `${lbl}\n${pct.toFixed(0)}%`;
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
        } as any,
      },
    });
  }, [entries]);

  const startCollection = async () => {
    if (collecting) return;
    setCollecting(true);
    setEntries([]);
    setProgressPct(0);

    const collected: LangReviewEntry[] = [
      {
        langCode: 'russian',
        langName: STEAM_LANGUAGES.russian,
        summary: initialRu,
        visible: true,
        fetched: initialRu !== null,
      },
      {
        langCode: 'schinese',
        langName: STEAM_LANGUAGES.schinese,
        summary: initialZh,
        visible: true,
        fetched: initialZh !== null,
      },
    ];

    const langsToFetch = Object.keys(STEAM_LANGUAGES).filter((l) => l !== 'russian' && l !== 'schinese');
    let okCount = 0;
    let errCount = 0;

    setProgressText(`Обработано: 0 из ${langsToFetch.length} языков (Успешно: 0, Ошибок: 0)`);

    for (const langCode of langsToFetch) {
      if (cancelledRef.current) return;
      const summary = await fetchReviewSummary(appId, langCode);
      if (cancelledRef.current) return;

      collected.push({
        langCode,
        langName: STEAM_LANGUAGES[langCode],
        summary,
        visible: true,
        fetched: summary !== null,
      });

      if (summary !== null) okCount++;
      else errCount++;

      const done = okCount + errCount;
      const pct = langsToFetch.length > 0 ? Math.round((done / langsToFetch.length) * 100) : 100;
      setProgressPct(pct);
      setProgressText(`Обработано: ${done} из ${langsToFetch.length} языков (Успешно: ${okCount}, Ошибок: ${errCount})`);

      await new Promise((r) => setTimeout(r, 150));
    }

    if (cancelledRef.current) return;
    globalMonitorCache.set(appId, collected);
    setEntries([...collected]);
    setCollecting(false);
    setProgressText((prev) => `${prev} — Готово!`);
  };

  const toggleLangVisible = (langCode: string, checked: boolean) => {
    setEntries((prev) => {
      const next = prev.map((e) => (e.langCode === langCode ? { ...e, visible: checked } : e));
      globalMonitorCache.set(appId, next);
      return next;
    });
  };

  const errorLangs = entries.filter((d) => !d.fetched && d.summary === null);
  const validLangs = entries
    .filter((d) => d.fetched && d.summary !== null)
    .sort((a, b) => (b.summary?.total_reviews || 0) - (a.summary?.total_reviews || 0));

  const nonZeroLangs = validLangs.filter((d) => (d.summary?.total_reviews || 0) > 0);
  const zeroLangs = validLangs.filter((d) => (d.summary?.total_reviews || 0) === 0).map((d) => d.langName);
  const totalReviews = nonZeroLangs.reduce((sum, d) => sum + (d.summary?.total_reviews || 0), 0);

  const footerInfoParts: string[] = [];
  if (zeroLangs.length > 0) footerInfoParts.push(`Нет обзоров: ${zeroLangs.join(', ')}`);
  if (errorLangs.length > 0) footerInfoParts.push(`Ошибки загрузки: ${errorLangs.map((l) => l.langName).join(', ')}`);

  return (
    <div ref={overlayRef} className="bib-grm-overlay" onClick={onClose}>
      <style>{NFO_REVIEWS_MODAL_CSS}</style>
      <div className="bib-grm-inner" onClick={(e) => e.stopPropagation()}>
        <div className="bib-grm-header">
          <h3 className="bib-grm-title">Глобальный монитор обзоров</h3>
          <button type="button" className="bib-grm-close" title="Закрыть" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="bib-grm-body">
          <div className="bib-grm-left">
            <div className="bib-grm-controls">
              <button
                type="button"
                disabled={collecting}
                className="bib-grm-collect"
                onClick={startCollection}
              >
                Собрать
              </button>
              <div className="bib-grm-progress-area">
                <div className="bib-grm-progress-bar">
                  <div className="bib-grm-progress-fill" style={{ width: `${progressPct}%` }}>
                    {progressPct > 0 ? `${progressPct}%` : ''}
                  </div>
                </div>
                <div className="bib-grm-progress-text">{progressText}</div>
              </div>
            </div>

            <div className="bib-grm-table-wrap bib-nfo-scroll">
              <table className="bib-grm-table">
                <thead>
                  <tr>
                    <th className="col-rank">#</th>
                    <th className="col-check" title="Показать на диаграмме">
                      📊
                    </th>
                    <th>Язык</th>
                    <th className="col-count">Обзоры</th>
                    <th className="col-pct-total">% Общ</th>
                    <th className="col-pct-pos">% 👍</th>
                  </tr>
                </thead>
                <tbody>
                  {collecting ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#8f98a0' }}>
                        Загрузка данных...
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#8f98a0' }}>
                        Нажмите «Собрать», чтобы загрузить данные.
                      </td>
                    </tr>
                  ) : nonZeroLangs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#8f98a0' }}>
                        Нет обзоров или не удалось загрузить данные.
                      </td>
                    </tr>
                  ) : (
                    nonZeroLangs.map((data, idx) => {
                      const count = data.summary?.total_reviews || 0;
                      const pos = data.summary?.total_positive || 0;
                      const pctTotal = totalReviews > 0 ? ((count / totalReviews) * 100).toFixed(1) : '0.0';
                      const pctPos = Math.round((pos / count) * 100);
                      return (
                        <tr key={data.langCode}>
                          <td className="col-rank">{idx + 1}</td>
                          <td className="col-check">
                            <input
                              type="checkbox"
                              checked={data.visible}
                              onChange={(e) => toggleLangVisible(data.langCode, e.target.checked)}
                            />
                          </td>
                          <td>{data.langName}</td>
                          <td className="col-count">{formatNumber(count)}</td>
                          <td className="col-pct-total">{pctTotal}%</td>
                          <td className="col-pct-pos">
                            <span style={{ color: reviewColor(pctPos, count) }}>{pctPos}%</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {footerInfoParts.length > 0 && (
              <div className="bib-grm-no-reviews">{footerInfoParts.join('. ')}</div>
            )}
          </div>

          <div className="bib-grm-right">
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%' }} />
            </div>
          </div>
        </div>

        <div className="bib-grm-footer">
          <strong>Внимание:</strong> Загрузка данных по каждому языку отправляет отдельный запрос к Steam API.
        </div>
      </div>
    </div>
  );
}

function ReviewsSectionView({ appId }: { appId: number }) {
  const [data, setData] = useState<ReviewsBundle | null>(() => reviewsSessionCache.get(appId) || null);
  const [ruModalOpen, setRuModalOpen] = useState(false);
  const [globalModalOpen, setGlobalModalOpen] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const handleRefresh = () => {
    reviewsSessionCache.delete(appId);
    setRetryTick((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    if (reviewsSessionCache.has(appId)) {
      setData(reviewsSessionCache.get(appId)!);
      return;
    }

    setData(null);
    Promise.all([
      fetchReviewSummary(appId, 'all'),
      fetchReviewSummary(appId, 'schinese'),
      fetchReviewSummary(appId, 'russian'),
    ]).then(([all, schinese, russian]) => {
      if (cancelled) return;
      const bundle: ReviewsBundle = { all, schinese, russian };
      if (all !== null && schinese !== null && russian !== null) {
        reviewsSessionCache.set(appId, bundle);
      }
      setData(bundle);
    });

    return () => {
      cancelled = true;
    };
  }, [appId, retryTick]);

  if (!data) {
    return <div style={{ color: '#8f98a0' }}>Загрузка статистики обзоров Steam...</div>;
  }

  const nonChinese: ReviewSummary | null =
    data.all && data.schinese
      ? {
          total_reviews: Math.max(0, data.all.total_reviews - data.schinese.total_reviews),
          total_positive: Math.max(0, data.all.total_positive - data.schinese.total_positive),
        }
      : null;

  const renderRow = (label: string, summary: ReviewSummary | null, hint?: string, onClick?: () => void) => {
    const total = summary?.total_reviews ?? 0;
    const pos = summary?.total_positive ?? 0;
    const pct = total > 0 ? Math.round((pos / total) * 100) : 0;
    const text =
      summary === null
        ? 'Ошибка загрузки'
        : total > 0
        ? `${pct}% из ${formatNumber(total)} положительные`
        : 'Нет обзоров';
    const color = summary === null ? '#ff6961' : reviewColor(pct, total);

    return (
      <div
        onClick={onClick}
        title={hint}
        className={onClick ? 'bib-nfo-item-row' : 'bib-nfo-stat-row'}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#c6d4df', fontWeight: 500 }}>{label}</span>
          {hint && <span style={{ fontSize: '10.5px', color: '#788796' }}>{hint}</span>}
        </div>
        <strong style={{ color, textAlign: 'right', flexShrink: 0, fontSize: '12.5px' }}>{text}</strong>
      </div>
    );
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {renderRow('Тотальные', data.all, 'Щелчок — Глобальный монитор обзоров', () => setGlobalModalOpen(true))}
        {renderRow('Безкитайские', nonChinese, 'За вычетом упр. китайского')}
        {renderRow('Русские', data.russian, 'Щелчок — русскоязычные обзоры', () => setRuModalOpen(true))}
        {(data.all === null || data.schinese === null || data.russian === null) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleRefresh} className="bib-nfo-pill-btn">
              ⟳ Повторить загрузку
            </button>
          </div>
        )}
      </div>

      {ruModalOpen && <RussianReviewsModal appId={appId} onClose={() => setRuModalOpen(false)} />}
      {globalModalOpen && (
        <GlobalReviewsMonitorModal
          appId={appId}
          initialRu={data.russian}
          initialZh={data.schinese}
          onClose={() => setGlobalModalOpen(false)}
        />
      )}
    </>
  );
}

export const nfoReviewsModule: BibliotekarshaModule = {
  id: 'nfo-reviews',
  name: 'NFO: Расширенные обзоры (Тотальные / Безкитайские / Русские)',
  description:
    'Добавляет блок расширенных обзоров Steam в окно NFO библиотеки с чтением русских отзывов и Глобальным монитором по 29 языкам.',
  defaultEnabled: true,
  mountGlobal: () =>
    registerNfoSection({
      id: 'reviews',
      title: 'Обзоры Steam',
      subtitle: 'Включая ключи',
      order: 35,
      render: (appId: number) => <ReviewsSectionView appId={appId} />,
    }),
};
