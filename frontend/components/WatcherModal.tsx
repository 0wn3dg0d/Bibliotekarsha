import React, { useEffect, useRef, useState } from 'react';
import {
  StoredWatcherProfileSummary,
  WatcherNotification,
  clearAllNotifications,
  clearLibraryStorage,
  clearWishlistStorage,
  deleteNotification,
  getStoredWatcherProfiles,
  getWatcherState,
  markAllNotificationsRead,
  runWatcherUpdate,
  saveWatcherSettings,
  subscribeWatcher,
  toggleNotificationRead,
} from '../stores/watcher';
import { openSteamNativePopup } from '../utils/popup';
import { WatcherCalendarModal } from './WatcherCalendarModal';

interface WatcherModalProps {
  onClose: () => void;
  isNativePopup?: boolean;
}

const WATCHER_STYLES = `
  .bib-w-btn {
    background: rgba(103, 193, 245, 0.12);
    border: 1px solid rgba(103, 193, 245, 0.25);
    color: #c6d4df;
    padding: 6px 12px;
    white-space: nowrap;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.1s ease;
  }
  .bib-w-btn:hover:not(:disabled) {
    background: rgba(103, 193, 245, 0.26);
    border-color: #66c0f4;
    color: #ffffff;
  }
  .bib-w-btn:active:not(:disabled) {
    transform: translateY(1px);
  }
  .bib-w-btn:disabled {
    opacity: 0.55;
    cursor: wait;
  }
  .bib-w-btn-primary {
    background: linear-gradient(to bottom, #47bfff 0%, #1a9fff 100%);
    border: 1px solid #66c0f4;
    color: #ffffff;
    font-weight: 600;
  }
  .bib-w-btn-primary:hover:not(:disabled) {
    background: linear-gradient(to bottom, #66c0f4 0%, #2b80e9 100%);
    border-color: #99d5ff;
  }
  .bib-w-btn-danger {
    background: rgba(167, 67, 67, 0.25);
    border: 1px solid rgba(205, 92, 92, 0.45);
    color: #ffb3b3;
  }
  .bib-w-btn-danger:hover:not(:disabled) {
    background: rgba(196, 82, 82, 0.45);
    border-color: #ff7b72;
    color: #ffffff;
  }
  .bib-w-btn-active {
    background: rgba(102, 192, 244, 0.28);
    border-color: #66c0f4;
    color: #ffffff;
  }
  .bib-w-input, .bib-w-select {
    background: #1b2430;
    color: #e5eef5;
    border: 1px solid #303d4e;
    padding: 6px 10px;
    border-radius: 3px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }
  .bib-w-input:hover, .bib-w-select:hover, .bib-w-input:focus, .bib-w-select:focus {
    border-color: #66c0f4;
    background: #202c3b;
  }
  .bib-w-item {
    padding: 12px 18px;
    border-bottom: 1px solid #242e3b;
    display: flex;
    gap: 14px;
    align-items: flex-start;
    transition: background-color 0.16s ease;
  }
  .bib-w-item:hover {
    background-color: rgba(102, 192, 244, 0.14) !important;
  }
  .bib-w-link {
    color: #66c0f4;
    font-weight: 700;
    font-size: 15px;
    text-decoration: none;
    display: block;
    margin: 3px 0;
    transition: color 0.15s ease;
  }
  .bib-w-link:hover {
    color: #ffffff;
    text-decoration: underline;
  }
  .bib-w-icon-btn {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid #303d4e;
    color: #8f98a0;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s ease;
  }
  .bib-w-icon-btn:hover {
    background: rgba(102, 192, 244, 0.22);
    border-color: #66c0f4;
    color: #ffffff;
  }
  .bib-w-icon-btn-del:hover {
    background: rgba(248, 81, 73, 0.25);
    border-color: #f85149;
    color: #ff9b9b;
  }
  .bib-w-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 3px;
    transition: background-color 0.15s ease, color 0.15s ease;
  }
  .bib-w-label:hover {
    background-color: rgba(102, 192, 244, 0.08);
    color: #ffffff;
  }
`;

function getTargetDocument(): Document {
  return window.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0')?.m_popup?.document || document;
}

function formatDateValue(info?: { value: number | string; displayType: string | null }): string {
  if (!info || info.value === 'Не указана') return 'Не указано';
  if (typeof info.value === 'string') return info.value;
  const d = new Date(info.value * 1000);
  const months = [
    'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
  ];
  const q = Math.floor(d.getMonth() / 3) + 1;
  if (info.displayType === 'date_month') return `${months[d.getMonth()]} ${d.getFullYear()}`;
  if (info.displayType === 'date_quarter') return `Q${q} ${d.getFullYear()}`;
  if (info.displayType === 'date_year') return String(d.getFullYear());
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getNotifBadgeTitle(n: WatcherNotification): string {
  const src = n.source === 'wishlist' ? 'Желаемое' : 'Библиотека';
  switch (n.changeType) {
    case 'date':
      return `${src} (Дата выхода)`;
    case 'ea_status':
      return `${src} (Ранний доступ)`;
    case 'ru_lang':
      return `${src} (Русский язык)`;
    case 'demo_added':
      return `${src} (Появилось демо)`;
    case 'demo_removed':
      return `${src} (Демо скрыто)`;
    case 'playtest_added':
      return `${src} (Появился плейтест)`;
    case 'playtest_removed':
      return `${src} (Плейтест скрыт)`;
    case 'delisted':
      return `${src} (Снята / Скрыта)`;
    case 'relisted':
      return `${src} (Снова доступна)`;
  }
}

function renderNotifBody(n: WatcherNotification) {
  if (n.changeType === 'demo_added') return <span>У игры стала доступна демоверсия!</span>;
  if (n.changeType === 'demo_removed') return <span>Демоверсия игры была удалена или скрыта.</span>;
  if (n.changeType === 'playtest_added') return <span>Открылась запись на плейтест!</span>;
  if (n.changeType === 'playtest_removed') return <span>Плейтест игры завершился или был скрыт.</span>;
  if (n.changeType === 'delisted') return <span style={{ color: '#ff7b72' }}>Игра снята с продажи или скрыта в магазине.</span>;
  if (n.changeType === 'relisted') return <span style={{ color: '#56d364' }}>Игра снова доступна в магазине Steam!</span>;
  if (n.changeType === 'ea_status') return <span style={{ color: '#56d364' }}>Игра вышла из раннего доступа!</span>;
  if (n.changeType === 'date') {
    return (
      <span>
        Дата выхода изменилась: <span style={{ color: '#8f98a0' }}>{formatDateValue(n.oldDate)}</span> →{' '}
        <b style={{ color: '#66c0f4' }}>{formatDateValue(n.newDate)}</b>
      </span>
    );
  }
  if (n.changeType === 'ru_lang' && n.ruChangeDetails) {
    const { added, removed, oldState, newState } = n.ruChangeDetails;
    const addedNames: string[] = [];
    const removedNames: string[] = [];
    if (added.supported) addedNames.push('Интерфейс');
    if (added.full_audio) addedNames.push('Озвучка');
    if (added.subtitles) addedNames.push('Субтитры');
    if (removed.supported) removedNames.push('Интерфейс');
    if (removed.full_audio) removedNames.push('Озвучка');
    if (removed.subtitles) removedNames.push('Субтитры');

    const hadAny = oldState.supported || oldState.full_audio || oldState.subtitles;
    const hasAny = newState.supported || newState.full_audio || newState.subtitles;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {addedNames.length > 0 && (
          <span style={{ color: '#56d364' }}>
            {hadAny ? 'Добавлено к русскому языку:' : 'Появился русский язык:'} <b>{addedNames.join(' + ')}</b>
          </span>
        )}
        {removedNames.length > 0 && (
          <span style={{ color: '#ff7b72' }}>
            {hasAny ? `Убрано: ${removedNames.join(', ')}` : 'Русский язык удалён из игры'}
          </span>
        )}
      </div>
    );
  }
  return null;
}

export function WatcherModal({ onClose, isNativePopup }: WatcherModalProps) {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [subView, setSubView] = useState<'list' | 'settings' | 'storage'>('list');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [profiles, setProfiles] = useState<StoredWatcherProfileSummary[]>([]);

  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const doc = getTargetDocument();
    const winW = doc.defaultView?.innerWidth || 1280;
    return {
      x: Math.max(20, Math.round((winW - 1200) / 2)),
      y: 56,
    };
  });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = subscribeWatcher(rerender);
    if (isNativePopup) {
      return () => unsub();
    }

    const targetDoc = getTargetDocument();
    const targetWin = targetDoc.defaultView || window;

    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const w = modalRef.current?.offsetWidth || 1200;
      setPos({
        x: Math.min(targetWin.innerWidth - 200, Math.max(-w + 200, dragRef.current.origX + dx)),
        y: Math.min(targetWin.innerHeight - 60, Math.max(0, dragRef.current.origY + dy)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    targetWin.addEventListener('mousemove', onMove);
    targetWin.addEventListener('mouseup', onUp);
    targetWin.addEventListener('keydown', onKey);
    return () => {
      unsub();
      targetWin.removeEventListener('mousemove', onMove);
      targetWin.removeEventListener('mouseup', onUp);
      targetWin.removeEventListener('keydown', onKey);
    };
  }, [onClose, isNativePopup]);

  const st = getWatcherState();
  const sorted = [...st.notifications].sort((a, b) => (a.read === b.read ? b.timestamp - a.timestamp : a.read ? 1 : -1));
  const filtered = sorted.filter((n) => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (!n.name.toLowerCase().includes(q) && !String(n.appid).includes(q)) return false;
    }
    switch (typeFilter) {
      case 'unread':
        return !n.read;
      case 'wishlist':
        return n.source === 'wishlist';
      case 'library':
        return n.source === 'library';
      case 'date':
        return n.changeType === 'date';
      case 'ru_lang':
        return n.changeType === 'ru_lang';
      case 'ea_status':
        return n.changeType === 'ea_status';
      case 'demo_playtest':
        return n.changeType.startsWith('demo_') || n.changeType.startsWith('playtest_');
      case 'delisted':
        return n.changeType === 'delisted' || n.changeType === 'relisted';
      default:
        return true;
    }
  });

  const openCalendar = () => {
    if (isNativePopup) {
      const calHandle = openSteamNativePopup({
        title: 'Bibliotekarsha — Календарь релизов',
        width: 1360,
        height: 880,
        render: (closeCal) => (
          <WatcherCalendarModal wishlistData={getWatcherState().wishlistData} onClose={closeCal} isNativePopup />
        ),
      });
      if (calHandle) return;
    }
    setCalendarOpen(true);
  };

  const containerStyle: React.CSSProperties = isNativePopup
    ? {
        width: '100%',
        height: '100%',
        paddingTop: '46px',
        backgroundColor: '#171d25',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        color: '#dcdedf',
        overflow: 'hidden',
        fontFamily: '"Motiva Sans", Arial, sans-serif',
      }
    : {
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: '1200px',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: 'calc(100vh - 76px)',
        backgroundColor: '#171d25',
        border: '1px solid #384658',
        borderRadius: '6px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.88)',
        display: 'flex',
        flexDirection: 'column',
        color: '#dcdedf',
        overflow: 'hidden',
        zIndex: 999999,
        fontFamily: '"Motiva Sans", Arial, sans-serif',
      };

  const modalNode = (
    <div ref={modalRef} onClick={(e) => e.stopPropagation()} style={containerStyle}>
      <style>{WATCHER_STYLES}</style>
      <div
        onMouseDown={(e) => {
          if (isNativePopup) return;
          if ((e.target as HTMLElement).closest('button')) return;
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
        }}
        style={{
          padding: '12px 18px',
          backgroundColor: '#10151c',
          borderTop: isNativePopup ? '1px solid #26303d' : 'none',
          borderBottom: '1px solid #26303d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          cursor: isNativePopup ? 'default' : 'move',
          userSelect: 'none',
          flexShrink: 0,
          position: 'relative',
          zIndex: 2,
          ...(isNativePopup ? ({ WebkitAppRegion: 'no-drag' } as any) : {}),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexShrink: 1 }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#66c0f4' }}>
            Уведомления ({filtered.length})
          </span>
          {st.accountLabel && (
            <span
              title={`Активная база аккаунта SteamID64: ${st.accountId || 'не определён'}`}
              style={{
                fontSize: '11px',
                backgroundColor: 'rgba(102, 192, 244, 0.14)',
                border: '1px solid rgba(102, 192, 244, 0.3)',
                color: '#a9d7f5',
                padding: '2px 8px',
                borderRadius: '3px',
                fontWeight: 600,
                maxWidth: '240px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              👤 {st.accountLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', flexShrink: 0 }}>
          <button
            type="button"
            disabled={st.updating}
            onClick={() => runWatcherUpdate()}
            className="bib-w-btn bib-w-btn-primary" style={{ minWidth: '142px', whiteSpace: 'nowrap', textAlign: 'center' }}
          >
            {st.updating ? `Обновление (${st.progress}%)...` : '⟳ Обновить'}
          </button>
          <button
            type="button"
            onClick={() => markAllNotificationsRead()}
            title="Отметить все как прочитанные"
            className="bib-w-btn"
          >
            ✓ Все
          </button>
          <button
            type="button"
            onClick={() => clearAllNotifications()}
            title="Очистить все уведомления"
            className="bib-w-btn"
          >
            Очистить
          </button>
          <button
            type="button"
            onClick={openCalendar}
            title="Календарь релизов"
            className="bib-w-btn"
          >
            📅 Календарь
          </button>
          <button
            type="button"
            onClick={() => setSubView(subView === 'settings' ? 'list' : 'settings')}
            title="Настройки отслеживания"
            className={`bib-w-btn ${subView === 'settings' ? 'bib-w-btn-active' : ''}`}
          >
            ⚙ Настройки
          </button>
          <button
            type="button"
            onClick={() => {
              const next = subView === 'storage' ? 'list' : 'storage';
              setSubView(next);
              if (next === 'storage') {
                getStoredWatcherProfiles().then(setProfiles);
              }
            }}
            title="Хранилище"
            className={`bib-w-btn ${subView === 'storage' ? 'bib-w-btn-active' : ''}`}
          >
            🗄 База
          </button>
          {!isNativePopup && (
            <button
              type="button"
              onClick={onClose}
              className="bib-w-icon-btn"
              style={{ fontSize: '18px', lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {st.progress > 0 && (
        <div style={{ height: '4px', backgroundColor: '#242e3b', width: '100%', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${st.progress}%`, backgroundColor: '#66c0f4', transition: 'width 0.25s' }} />
        </div>
      )}

      {(st.statusText || st.errorText) && (
        <div
          style={{
            padding: '8px 18px',
            backgroundColor: st.errorText ? 'rgba(248, 81, 73, 0.15)' : 'rgba(102, 192, 244, 0.1)',
            borderBottom: '1px solid #242e3b',
            fontSize: '13px',
            color: st.errorText ? '#ff9b9b' : '#8fd0f8',
            flexShrink: 0,
          }}
        >
          {st.errorText || st.statusText}
        </div>
      )}

      {subView === 'settings' && (
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#66c0f4' }}>Настройки Наблюдателя</div>
          <label className="bib-w-label">
            <input
              type="checkbox"
              checked={st.settings.wishlist}
              onChange={(e) => saveWatcherSettings({ wishlist: e.target.checked })}
              style={{ accentColor: '#66c0f4', width: '16px', height: '16px' }}
            />
            <span>Отслеживать Список желаемого ({Object.keys(st.wishlistData).length} игр в базе)</span>
          </label>
          <label className="bib-w-label">
            <input
              type="checkbox"
              checked={st.settings.library}
              onChange={(e) => saveWatcherSettings({ library: e.target.checked })}
              style={{ accentColor: '#66c0f4', width: '16px', height: '16px' }}
            />
            <span>Отслеживать Библиотеку ({Object.keys(st.ownedData).length} игр в базе)</span>
          </label>
          <div style={{ paddingLeft: '26px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label className="bib-w-label" style={{ fontSize: '13px' }}>
              <input
                type="checkbox"
                disabled={!st.settings.library}
                checked={st.settings.recheckRussian}
                onChange={(e) => saveWatcherSettings({ recheckRussian: e.target.checked })}
                style={{ accentColor: '#66c0f4', width: '15px', height: '15px' }}
              />
              <span>Перепроверять игры с русским языком</span>
            </label>
            <label className="bib-w-label" style={{ fontSize: '13px' }}>
              <input
                type="checkbox"
                disabled={!st.settings.library || st.settings.recheckRussian}
                checked={st.settings.recheckPartial}
                onChange={(e) => saveWatcherSettings({ recheckPartial: e.target.checked })}
                style={{ accentColor: '#66c0f4', width: '15px', height: '15px' }}
              />
              <span>...только игры без полной локализации</span>
            </label>
          </div>
          <div style={{ borderTop: '1px solid #242e3b', paddingTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label className="bib-w-label">
              <input
                type="checkbox"
                checked={st.settings.autoUpdate}
                onChange={(e) => saveWatcherSettings({ autoUpdate: e.target.checked })}
                style={{ accentColor: '#66c0f4', width: '16px', height: '16px' }}
              />
              <span>Автообновление в фоне каждые</span>
            </label>
            <select
              disabled={!st.settings.autoUpdate}
              value={st.settings.autoUpdateIntervalHours}
              onChange={(e) => saveWatcherSettings({ autoUpdateIntervalHours: Number(e.target.value) })}
              className="bib-w-select"
            >
              <option value={12}>12 ч.</option>
              <option value={24}>24 ч.</option>
            </select>
          </div>
          <div style={{ marginTop: '6px' }}>
            <button type="button" onClick={() => setSubView('list')} className="bib-w-btn">
              ← Вернуться к уведомлениям
            </button>
          </div>
        </div>
      )}

      {subView === 'storage' && (
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#66c0f4' }}>
            Управление хранилищем IndexedDB (Мультиаккаунт)
          </div>
          <div style={{ fontSize: '14px', color: '#a5b1bd' }}>
            Текущий профиль: <b style={{ color: '#e5eef5' }}>{st.accountLabel || st.accountId}</b> — отслеживается{' '}
            <b>{Object.keys(st.wishlistData).length}</b> игр из желаемого и{' '}
            <b>{Object.keys(st.ownedData).length}</b> игр из библиотеки.
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => clearWishlistStorage().then(() => getStoredWatcherProfiles().then(setProfiles))}
              className="bib-w-btn bib-w-btn-danger"
            >
              Очистить Желаемое (текущий аккаунт)
            </button>
            <button
              type="button"
              onClick={() => clearLibraryStorage().then(() => getStoredWatcherProfiles().then(setProfiles))}
              className="bib-w-btn bib-w-btn-danger"
            >
              Очистить Библиотеку (текущий аккаунт)
            </button>
          </div>

          {profiles.length > 0 && (
            <div style={{ marginTop: '8px', borderTop: '1px solid #242e3b', paddingTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#8fd0f8', marginBottom: '8px' }}>
                Сохранённые профили на этом ПК ({profiles.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {profiles.map((p) => (
                  <div
                    key={p.accountId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      backgroundColor: p.isCurrent ? 'rgba(102, 192, 244, 0.14)' : '#121820',
                      border: `1px solid ${p.isCurrent ? 'rgba(102, 192, 244, 0.45)' : '#242e3b'}`,
                      fontSize: '13px',
                    }}
                  >
                    <span>
                      <b style={{ color: p.isCurrent ? '#ffffff' : '#c6d4df' }}>{p.label}</b>{' '}
                      {p.isCurrent && <span style={{ color: '#56d364', fontSize: '11px' }}>• активен</span>}
                    </span>
                    <span style={{ color: '#8f98a0', fontSize: '12px' }}>
                      Желаемое: {p.wishlistCount} · Библиотека: {p.ownedCount} · Непрочит.: {p.unreadCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: '6px' }}>
            <button type="button" onClick={() => setSubView('list')} className="bib-w-btn">
              ← Вернуться к уведомлениям
            </button>
          </div>
        </div>
      )}

      {subView === 'list' && (
        <>
          <div
            style={{
              padding: '10px 18px',
              backgroundColor: '#131922',
              borderBottom: '1px solid #242e3b',
              display: 'flex',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bib-w-select">
              <option value="all">Все уведомления</option>
              <option value="unread">Непрочитанные</option>
              <option value="wishlist">Желаемое</option>
              <option value="library">Библиотека</option>
              <option value="date">Дата выхода</option>
              <option value="ru_lang">Русский язык</option>
              <option value="ea_status">Ранний доступ</option>
              <option value="demo_playtest">Демо / Плейтест</option>
              <option value="delisted">Снятие / Возврат</option>
            </select>
            <input
              type="text"
              placeholder="Поиск по названию или AppID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bib-w-input"
              style={{ flex: 1 }}
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#8f98a0', fontSize: '14px' }}>
                {st.notifications.length === 0
                  ? 'Уведомлений пока нет. Нажмите «⟳ Обновить», чтобы создать снимок и отслеживать изменения.'
                  : 'По выбранным фильтрам уведомлений не найдено.'}
              </div>
            ) : (
              filtered.map((n) => {
                const img = n.header
                  ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${n.appid}/${n.header}`
                  : `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${n.appid}/header.jpg`;
                return (
                  <div
                    key={n.id}
                    className="bib-w-item"
                    style={{
                      backgroundColor: n.read ? 'transparent' : 'rgba(102, 192, 244, 0.09)',
                    }}
                  >
                    <a href={`https://store.steampowered.com/app/${n.appid}`} target="_blank" rel="noreferrer">
                      <img
                        src={img}
                        alt=""
                        style={{ width: '116px', height: '54px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }}
                      />
                    </a>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#8f98a0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {getNotifBadgeTitle(n)}
                      </div>
                      <a
                        href={`https://store.steampowered.com/app/${n.appid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bib-w-link"
                      >
                        {n.name}
                      </a>
                      <div style={{ fontSize: '13px', color: '#dcdedf', lineHeight: 1.45 }}>{renderNotifBody(n)}</div>
                      <div style={{ fontSize: '12px', color: '#6e7a88', marginTop: '4px' }}>
                        {new Date(n.timestamp).toLocaleString('ru-RU')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => toggleNotificationRead(n.id)}
                        title={n.read ? 'Пометить как непрочитанное' : 'Пометить как прочитанное'}
                        className="bib-w-icon-btn"
                        style={{ color: n.read ? '#8f98a0' : '#66c0f4' }}
                      >
                        {n.read ? '✉' : '📩'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNotification(n.id)}
                        title="Удалить"
                        className="bib-w-icon-btn bib-w-icon-btn-del"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {calendarOpen && <WatcherCalendarModal wishlistData={st.wishlistData} onClose={() => setCalendarOpen(false)} />}
    </div>
  );

  if (isNativePopup) {
    return modalNode;
  }

  const reactDom = window.SP_REACTDOM;
  const targetBody = getTargetDocument().body;
  if (reactDom?.createPortal && targetBody) {
    return reactDom.createPortal(modalNode, targetBody);
  }
  return modalNode;
}
