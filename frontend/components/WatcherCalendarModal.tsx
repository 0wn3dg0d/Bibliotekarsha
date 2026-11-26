import React, { useMemo, useState } from 'react';
import { TrackedWishlistGame } from '../stores/watcher';

interface WatcherCalendarModalProps {
  wishlistData: Record<number, TrackedWishlistGame>;
  onClose: () => void;
  isNativePopup?: boolean;
}

const CALENDAR_STYLES = `
  .bib-cal-btn {
    background: rgba(103, 193, 245, 0.12);
    border: 1px solid rgba(103, 193, 245, 0.25);
    color: #d6e2ed;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.1s ease;
  }
  .bib-cal-btn:hover {
    background: rgba(103, 193, 245, 0.28);
    border-color: #66c0f4;
    color: #ffffff;
  }
  .bib-cal-btn:active {
    transform: translateY(1px);
  }
  .bib-cal-select {
    background: #1b2430;
    color: #e5eef5;
    border: 1px solid #303d4e;
    padding: 6px 10px;
    border-radius: 3px;
    font-size: 13px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }
  .bib-cal-select:hover, .bib-cal-select:focus {
    border-color: #66c0f4;
    background: #202c3b;
  }
  .bib-cal-day {
    background-color: #1b2634;
    min-height: 105px;
    padding: 24px 6px 6px;
    border-radius: 3px;
    border: 1px solid transparent;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 5px;
    transition: background-color 0.16s ease, border-color 0.16s ease;
  }
  .bib-cal-day:hover {
    background-color: #213042;
    border-color: rgba(102, 192, 244, 0.35);
  }
  .bib-cal-game {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    background-color: rgba(16, 24, 34, 0.85);
    border: 1px solid rgba(42, 71, 94, 0.45);
    border-radius: 3px;
    text-decoration: none;
    font-size: 13px;
    line-height: 1.25;
    transition: background-color 0.16s ease, border-color 0.16s ease, transform 0.12s ease, box-shadow 0.16s ease;
  }
  .bib-cal-game:hover {
    background-color: rgba(42, 71, 94, 0.9);
    border-color: #66c0f4;
    color: #ffffff !important;
    transform: translateY(-1px);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.45);
  }
`;

function getApproxText(rel: TrackedWishlistGame['releaseInfo']): string {
  if (typeof rel.date !== 'number') return String(rel.date);
  const d = new Date(rel.date * 1000);
  const q = Math.floor(d.getMonth() / 3) + 1;
  if (rel.displayType === 'date_month') return d.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
  if (rel.displayType === 'date_quarter') return `Q${q} ${d.getFullYear()}`;
  if (rel.displayType === 'date_year') return String(d.getFullYear());
  return d.toLocaleDateString('ru-RU');
}

export function WatcherCalendarModal({ wishlistData, onClose, isNativePopup }: WatcherCalendarModalProps) {
  const [startYear, setStartYear] = useState<string>('');
  const [startMonth, setStartMonth] = useState<string>('');
  const [showAll, setShowAll] = useState(false);
  const [visibleMonths, setVisibleMonths] = useState(3);

  const gamesWithDates = useMemo(() => {
    return Object.entries(wishlistData)
      .filter(([, g]) => typeof g.releaseInfo?.date === 'number')
      .map(([id, g]) => ({
        appid: Number(id),
        ...g,
        releaseDate: new Date((g.releaseInfo.date as number) * 1000),
      }));
  }, [wishlistData]);

  const availableYears = useMemo(() => {
    return Array.from(new Set(gamesWithDates.map((g) => g.releaseDate.getFullYear()))).sort((a, b) => a - b);
  }, [gamesWithDates]);

  const monthsData = useMemo(() => {
    let filtered = gamesWithDates;
    if (!showAll) {
      const now = new Date();
      const y = startYear ? Number(startYear) : now.getFullYear();
      const m = startYear ? (startMonth !== '' ? Number(startMonth) : 0) : now.getMonth();
      filtered = filtered.filter((g) => {
        const ry = g.releaseDate.getFullYear();
        const rm = g.releaseDate.getMonth();
        return ry > y || (ry === y && rm >= m);
      });
    }

    const map = new Map<string, { year: number; month: number; games: typeof gamesWithDates }>();
    for (const g of filtered) {
      const y = g.releaseDate.getFullYear();
      const m = g.releaseDate.getMonth();
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { year: y, month: m, games: [] });
      map.get(key)!.games.push(g);
    }
    return Array.from(map.values()).sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));
  }, [gamesWithDates, showAll, startYear, startMonth]);

  const exportIcs = () => {
    const list = monthsData.flatMap((m) => m.games);
    if (!list.length) return;
    const esc = (s: string) =>
      String(s || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
    const ymd = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const nowUtc = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bibliotekarsha//Watcher//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];
    for (const g of list) {
      const s = g.releaseDate;
      const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
      const approx = ['date_month', 'date_quarter', 'date_year'].includes(g.releaseInfo?.displayType || '');
      lines.push(
        'BEGIN:VEVENT',
        `UID:bib-watcher-${g.appid}@steampowered.com`,
        `DTSTAMP:${nowUtc}`,
        `DTSTART;VALUE=DATE:${ymd(s)}`,
        `DTEND;VALUE=DATE:${ymd(e)}`,
        `SUMMARY:${esc(approx ? `${g.name} (приблизительно)` : g.name)}`,
        `DESCRIPTION:${esc(`https://store.steampowered.com/app/${g.appid}`)}`,
        'END:VEVENT'
      );
    }
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Steam_Release_Calendar_${new Date().toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];

  const boxStyle: React.CSSProperties = isNativePopup
    ? {
        width: '100%',
        height: '100%',
        paddingTop: '46px',
        backgroundColor: '#171d25',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#dcdedf',
        fontFamily: '"Motiva Sans", Arial, sans-serif',
      }
    : {
        width: '1360px',
        maxWidth: '96vw',
        height: '88vh',
        backgroundColor: '#171d25',
        border: '1px solid #384658',
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#dcdedf',
      };

  const content = (
    <div onClick={(e) => e.stopPropagation()} style={boxStyle}>
      <style>{CALENDAR_STYLES}</style>
      <div
        style={{
          padding: '12px 20px',
          backgroundColor: '#10151c',
          borderTop: isNativePopup ? '1px solid #26303d' : 'none',
          borderBottom: '1px solid #26303d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          position: 'relative',
          zIndex: 2,
          ...(isNativePopup ? ({ WebkitAppRegion: 'no-drag' } as any) : {}),
        }}
      >
        <span style={{ fontSize: '17px', fontWeight: 700, color: '#66c0f4' }}>
          Календарь релизов ({gamesWithDates.length} игр с датой)
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={startYear}
            onChange={(e) => {
              setStartYear(e.target.value);
              setShowAll(false);
              setVisibleMonths(3);
            }}
            className="bib-cal-select"
          >
            <option value="">Текущий год</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={startMonth}
            onChange={(e) => {
              setStartMonth(e.target.value);
              setShowAll(false);
              setVisibleMonths(3);
            }}
            className="bib-cal-select"
          >
            <option value="">Месяц</option>
            {monthNames.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setStartYear('');
              setStartMonth('');
              setShowAll(true);
              setVisibleMonths(6);
            }}
            className="bib-cal-btn"
          >
            Показать все
          </button>
          <button
            type="button"
            onClick={() => {
              setStartYear('');
              setStartMonth('');
              setShowAll(false);
              setVisibleMonths(3);
            }}
            className="bib-cal-btn"
          >
            Сброс
          </button>
          <button type="button" onClick={exportIcs} className="bib-cal-btn">
            Экспорт .ics
          </button>
          {!isNativePopup && (
            <button
              type="button"
              onClick={onClose}
              className="bib-cal-btn"
              style={{ fontSize: '18px', lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
        {monthsData.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8f98a0', padding: '40px', fontSize: '15px' }}>
            Игры с датами релиза по выбранным фильтрам не найдены.
          </div>
        ) : (
          <>
            {monthsData.slice(0, visibleMonths).map(({ year, month, games }) => {
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const firstDay = new Date(year, month, 1).getDay();
              const offset = firstDay === 0 ? 6 : firstDay - 1;
              return (
                <div key={`${year}-${month}`} style={{ marginBottom: '32px' }}>
                  <div style={{ fontSize: '21px', fontWeight: 700, color: '#66c0f4', marginBottom: '12px' }}>
                    {monthNames[month]} {year}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px' }}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                      <div
                        key={d}
                        style={{
                          textAlign: 'center',
                          padding: '8px 0',
                          fontSize: '13px',
                          color: '#66c0f4',
                          borderBottom: '2px solid #2b4c6b',
                          fontWeight: 700,
                        }}
                      >
                        {d}
                      </div>
                    ))}
                    {Array.from({ length: offset }).map((_, idx) => (
                      <div key={`empty-${idx}`} style={{ backgroundColor: '#131922', minHeight: '105px', borderRadius: '3px' }} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const dayGames = games
                        .filter((g) => g.releaseDate.getDate() === day)
                        .sort((a, b) => a.name.localeCompare(b.name));
                      return (
                        <div key={day} className="bib-cal-day">
                          <span style={{ position: 'absolute', top: '5px', right: '7px', fontSize: '13px', fontWeight: 600, color: '#8f98a0' }}>
                            {day}
                          </span>
                          {dayGames.map((g) => {
                            const approx = ['date_month', 'date_quarter', 'date_year'].includes(
                              g.releaseInfo.displayType || ''
                            );
                            const img = g.header
                              ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${g.appid}/${g.header}`
                              : `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`;
                            return (
                              <a
                                key={g.appid}
                                href={`https://store.steampowered.com/app/${g.appid}`}
                                target="_blank"
                                rel="noreferrer"
                                title={approx ? `Приблизительная дата: ${getApproxText(g.releaseInfo)}` : g.name}
                                className="bib-cal-game"
                                style={{
                                  color: approx ? '#ffd580' : '#e2ecf5',
                                }}
                              >
                                <img
                                  src={img}
                                  alt=""
                                  style={{ width: '72px', height: '34px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                  {g.name}
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {visibleMonths < monthsData.length && (
              <div style={{ textAlign: 'center', padding: '12px' }}>
                <button type="button" onClick={() => setVisibleMonths((v) => v + 3)} className="bib-cal-btn" style={{ padding: '9px 22px', fontSize: '14px' }}>
                  Показать ещё 3 месяца
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (isNativePopup) {
    return content;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 14, 20, 0.85)',
        zIndex: 1000010,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: '"Motiva Sans", Arial, sans-serif',
      }}
    >
      {content}
    </div>
  );
}
