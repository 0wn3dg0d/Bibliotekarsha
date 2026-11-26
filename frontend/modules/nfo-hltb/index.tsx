import { useEffect, useState } from 'react';
import { registerNfoSection } from '../../core/nfo-registry';
import { BibliotekarshaModule } from '../../core/types';
import {
  LibHltbEntry,
  LibHltbResult,
  fetchLibraryHltb,
  formatLibHltbTime,
} from '../../services/libraryNfoService';
import { getGameNames } from '../../services/net';

const hltbSessionCache = new Map<number, LibHltbResult>();

function HltbSectionView({ appId }: { appId: number }) {
  const [status, setStatus] = useState<string>('Запрос данных из HowLongToBeat...');
  const [selected, setSelected] = useState<LibHltbEntry | null>(null);
  const [matches, setMatches] = useState<LibHltbEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const handleRefresh = () => {
    hltbSessionCache.delete(appId);
    setRetryTick((n) => n + 1);
  };

  const applyResult = (res: LibHltbResult) => {
    if (res.status === 'error') {
      setError(res.error || 'Ошибка загрузки HLTB.');
      return;
    }
    if (res.status === 'not_found') {
      setError('Игра не найдена в базе HowLongToBeat.');
      return;
    }
    if (res.matches) setMatches(res.matches);
    if (res.status === 'ok' && res.entry) {
      setSelected(res.entry);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (hltbSessionCache.has(appId)) {
        applyResult(hltbSessionCache.get(appId)!);
        return;
      }

      setError(null);
      setSelected(null);
      setMatches([]);
      setStatus('Определение названия игры...');

      const names = await getGameNames(appId);
      const searchName = names.englishName || names.localName || `App ${appId}`;
      if (!cancelled) setStatus(`Поиск «${searchName}» на HLTB...`);

      const res = await fetchLibraryHltb(String(appId), searchName);
      if (cancelled) return;
      if (res.status !== 'error') {
        hltbSessionCache.set(appId, res);
      }
      applyResult(res);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [appId, retryTick]);

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', color: '#8f98a0' }}>
        <span>{error}</span>
        <button type="button" onClick={handleRefresh} className="bib-nfo-pill-btn" title="Повторить запрос">
          ⟳
        </button>
      </div>
    );
  }

  if (selected) {
    const rows = [
      { label: 'Только сюжет', time: selected.comp_main, count: selected.comp_main_count },
      { label: 'Сюжет + доп.', time: selected.comp_plus, count: selected.comp_plus_count },
      { label: 'Комплеционист', time: selected.comp_100, count: selected.comp_100_count },
      { label: 'Все стили', time: selected.comp_all, count: selected.comp_all_count },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <a
            href={`https://howlongtobeat.com/game/${selected.game_id}`}
            target="_blank"
            rel="noreferrer"
            className="bib-nfo-link" style={{ fontWeight: 700, fontSize: '14px' }}
          >
            {selected.game_name} ↗
          </a>
          {matches.length > 1 && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="bib-nfo-pill-btn"
            >
              Другие совпадения
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.map((r) => (
            <div
              key={r.label}
              className="bib-nfo-stat-row"
            >
              <span style={{ color: '#c6d4df' }}>{r.label}</span>
              <span>
                <strong style={{ color: '#ffffff' }}>{formatLibHltbTime(r.time)}</strong>{' '}
                <span style={{ color: '#8f98a0', fontSize: '11px' }}>({r.count || 0})</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (matches.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ color: '#a3d5f7', fontSize: '12px', marginBottom: '4px' }}>
          Возможные совпадения ({matches.length}):
        </div>
        {matches.map((m) => (
          <div
            key={m.game_id}
            onClick={() => setSelected(m)}
            className="bib-nfo-item-row" style={{ cursor: 'pointer' }}
          >
            <span style={{ color: '#e2e8f0' }}>{m.game_name}</span>
            {typeof m.percentage === 'number' && (
              <span
                style={{
                  fontSize: '11px',
                  color: '#66c0f4',
                  backgroundColor: 'rgba(102, 192, 244, 0.14)',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  flexShrink: 0,
                }}
              >
                {m.percentage}%
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return <div style={{ color: '#8f98a0' }}>{status}</div>;
}

export const nfoHltbModule: BibliotekarshaModule = {
  id: 'nfo-hltb',
  name: 'NFO: Время прохождения (HowLongToBeat)',
  description: 'Поиск игры на HowLongToBeat.com и вывод статистики времени прохождения в окне NFO.',
  defaultEnabled: true,
  mountGlobal: () =>
    registerNfoSection({
      id: 'hltb',
      title: 'HowLongToBeat',
      subtitle: 'Время прохождения',
      order: 10,
      render: (appId: number) => <HltbSectionView appId={appId} />,
    }),
};
