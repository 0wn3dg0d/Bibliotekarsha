import React, { useEffect, useState } from 'react';
import { registerNfoSection } from '../../core/nfo-registry';
import { BibliotekarshaModule } from '../../core/types';
import { getCurrentAccount, subscribeAccountChange } from '../../services/accountContext';
import {
  LibFriendsAndAchResult,
  fetchLibraryFriendsAndAchievements,
} from '../../services/libraryNfoService';

const friendsSessionCache = new Map<string, LibFriendsAndAchResult>();
subscribeAccountChange((acc, prevId) => {
  if (acc.steamId64 !== prevId) friendsSessionCache.clear();
});
const cacheKeyFor = (appId: number) => `${getCurrentAccount().steamId64 || 'anon'}:${appId}`;

function openFriendProfile(
  e: React.MouseEvent | React.KeyboardEvent,
  rawUrl: string
): void {
  e.preventDefault();
  e.stopPropagation();

  const url = rawUrl.startsWith('/') ? `https://steamcommunity.com${rawUrl}` : rawUrl;
  try {
    const sys = (window as any).SteamClient?.System;
    if (typeof sys?.OpenInSystemBrowser === 'function') {
      sys.OpenInSystemBrowser(url);
      return;
    }
  } catch {}

  try {
    (window as any).SteamClient?.URL?.ExecuteSteamURL?.(`steam://openurl_external/${url}`);
  } catch {}
}

function FriendsAndAchSectionView({ appId }: { appId: number }) {
  const [data, setData] = useState<LibFriendsAndAchResult | null>(
    () => friendsSessionCache.get(cacheKeyFor(appId)) || null
  );
  const [retryTick, setRetryTick] = useState(0);

  const handleRefresh = () => {
    friendsSessionCache.delete(cacheKeyFor(appId));
    setRetryTick((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const key = cacheKeyFor(appId);
    if (friendsSessionCache.has(key)) {
      setData(friendsSessionCache.get(key)!);
      return;
    }

    setData(null);
    fetchLibraryFriendsAndAchievements(String(appId)).then((res) => {
      if (cancelled) return;
      const isTransientErr = Boolean(res.playtimes.length === 0 && !res.achievements.hasAchievements && res.achievements.error);
      if (!isTransientErr) {
        friendsSessionCache.set(key, res);
      }
      setData(res);
    });

    return () => {
      cancelled = true;
    };
  }, [appId, retryTick]);

  if (!data) {
    return <div style={{ color: '#8f98a0' }}>Загрузка статистики друзей и достижений...</div>;
  }

  const { playtimes, achievements } = data;
  const maxH = playtimes.length > 0 ? Math.max(...playtimes.map((f) => f.hours)) : 0;
  const minH = playtimes.length > 0 ? Math.min(...playtimes.map((f) => f.hours)) : 0;
  const avgH =
    playtimes.length > 0
      ? playtimes.reduce((sum, f) => sum + f.hours, 0) / playtimes.length
      : 0;
  const topPlayers = playtimes.filter((f) => f.hours === maxH);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#66c0f4',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
            }}
          >
            Время друзей
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            className="bib-nfo-pill-btn"
            style={{ padding: '1px 6px', fontSize: '11px' }}
            title="Обновить статистику друзей и достижений"
          >
            ⟳
          </button>
        </div>

        {playtimes.length === 0 ? (
          <div style={{ color: '#8f98a0' }}>Друзья не играли или данные недоступны.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="bib-nfo-stat-row">
              <span style={{ color: '#c6d4df' }}>Максимум:</span>
              <span style={{ textAlign: 'right' }}>
                <strong style={{ color: '#ffffff' }}>{maxH.toFixed(1)} ч.</strong>{' '}
                <span style={{ color: '#8f98a0', fontSize: '12px' }}>
                  (
                  {topPlayers.map((p, idx) => (
                    <span key={p.profile}>
                      {idx > 0 && ', '}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => openFriendProfile(e, p.profile)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            openFriendProfile(e, p.profile);
                          }
                        }}
                        className="bib-nfo-link"
                        style={{ cursor: 'pointer' }}
                        title="Открыть профиль друга в браузере"
                      >
                        {p.name}
                      </span>
                    </span>
                  ))}
                  )
                </span>
              </span>
            </div>

            <div className="bib-nfo-stat-row">
              <span style={{ color: '#c6d4df' }}>Среднее ({playtimes.length} чел.):</span>
              <strong style={{ color: '#ffffff' }}>{avgH.toFixed(1)} ч.</strong>
            </div>

            <div className="bib-nfo-stat-row">
              <span style={{ color: '#c6d4df' }}>Минимум:</span>
              <strong style={{ color: '#ffffff' }}>{minH.toFixed(1)} ч.</strong>
            </div>
          </div>
        )}
      </div>

      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#66c0f4',
            textTransform: 'uppercase',
            marginBottom: '6px',
            letterSpacing: '0.4px',
          }}
        >
          Глобальные достижения
        </div>

        {!achievements.hasAchievements ? (
          <div style={{ color: '#8f98a0' }}>{achievements.error || 'Достижения отсутствуют.'}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="bib-nfo-stat-row">
              <span style={{ color: '#c6d4df' }}>Платина (редчайшее):</span>
              <strong style={{ color: '#ffffff' }}>{achievements.platinumPercent}%</strong>
            </div>

            <div className="bib-nfo-stat-row">
              <span style={{ color: '#c6d4df' }}>Средний прогресс:</span>
              <strong style={{ color: '#ffffff' }}>{achievements.averageAdjustedPercent}%</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const nfoFriendsModule: BibliotekarshaModule = {
  id: 'nfo-friends',
  name: 'NFO: Время друзей и Достижения',
  description: 'Выводит статистику наигранного времени друзей и процент глобальных достижений в окне NFO.',
  defaultEnabled: true,
  mountGlobal: () =>
    registerNfoSection({
      id: 'friends-ach',
      title: 'Друзья и Достижения',
      subtitle: 'Статистика',
      order: 30,
      render: (appId: number) => <FriendsAndAchSectionView appId={appId} />,
    }),
};
