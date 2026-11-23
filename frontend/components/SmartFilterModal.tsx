import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameMeta, TIERS, TIER_INFO } from '../config/tiers';
import {
  FilterPreset,
  addHiddenTag,
  applyPresetToScope,
  applyScopeToAllCollections,
  clearAllCollectionsFilters,
  clearYearFilter,
  deleteSavedPreset,
  getFilterState,
  getSavedPresets,
  isAnyCollectionFilterActive,
  matchesGameMeta,
  removeActiveTag,
  removeHiddenTag,
  resetScopeFilters,
  savePresetFromScope,
  setActiveTag,
  setRangeFilters,
  subscribeFilters,
  toggleLanguageFilter,
  toggleYearFilter,
} from '../stores/filters';
import { FetchProgress, getFetchProgress, onFetchProgress } from '../stores/localization';
import { ensureTagsLoaded, getAllTags, getTagName } from '../stores/tags';

interface SmartFilterModalProps {
  scope: string;
  scopeTitle: string;
  games: GameMeta[];
  onClose: () => void;
}

export function SmartFilterModal({ scope, scopeTitle, games, onClose }: SmartFilterModalProps) {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [tagQuery, setTagQuery] = useState('');
  const [yearQuery, setYearQuery] = useState('');
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<FilterPreset[]>(getSavedPresets);
  const [tagsReady, setTagsReady] = useState(() => getAllTags().size > 0);
  const [fetchStatus, setFetchStatus] = useState<FetchProgress>(getFetchProgress);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  const state = getFilterState(scope);

  const [revMinStr, setRevMinStr] = useState(() => (state.reviewCountMin !== null ? String(state.reviewCountMin) : ''));
  const [revMaxStr, setRevMaxStr] = useState(() => (state.reviewCountMax !== null ? String(state.reviewCountMax) : ''));
  const [ratMinStr, setRatMinStr] = useState(() => (state.ratingMin !== null ? String(state.ratingMin) : ''));
  const [ratMaxStr, setRatMaxStr] = useState(() => (state.ratingMax !== null ? String(state.ratingMax) : ''));
  const rangeTimerRef = useRef<any>(null);

  const syncInputsFromState = () => {
    const cur = getFilterState(scope);
    setRevMinStr(cur.reviewCountMin !== null ? String(cur.reviewCountMin) : '');
    setRevMaxStr(cur.reviewCountMax !== null ? String(cur.reviewCountMax) : '');
    setRatMinStr(cur.ratingMin !== null ? String(cur.ratingMin) : '');
    setRatMaxStr(cur.ratingMax !== null ? String(cur.ratingMax) : '');
  };

  useEffect(() => {
    ensureTagsLoaded().then(() => setTagsReady(true));
    const unsubF = subscribeFilters((changedScope) => {
      if (changedScope === scope || changedScope === 'collection:*') rerender();
    });
    const unsubP = onFetchProgress(setFetchStatus);
    return () => {
      if (rangeTimerRef.current) clearTimeout(rangeTimerRef.current);
      unsubF();
      unsubP();
    };
  }, [scope]);

  const scheduleRangeCommit = (rMin: string, rMax: string, pMin: string, pMax: string) => {
    if (rangeTimerRef.current) clearTimeout(rangeTimerRef.current);
    rangeTimerRef.current = setTimeout(() => {
      setRangeFilters(scope, {
        reviewCountMin: rMin.trim() === '' ? null : Number(rMin),
        reviewCountMax: rMax.trim() === '' ? null : Number(rMax),
        ratingMin: pMin.trim() === '' ? null : Number(pMin),
        ratingMax: pMax.trim() === '' ? null : Number(pMax),
      });
    }, 450);
  };

  const commitRangesNow = () => {
    if (rangeTimerRef.current) {
      clearTimeout(rangeTimerRef.current);
      rangeTimerRef.current = null;
    }
    setRangeFilters(scope, {
      reviewCountMin: revMinStr.trim() === '' ? null : Number(revMinStr),
      reviewCountMax: revMaxStr.trim() === '' ? null : Number(revMaxStr),
      ratingMin: ratMinStr.trim() === '' ? null : Number(ratMinStr),
      ratingMax: ratMaxStr.trim() === '' ? null : Number(ratMaxStr),
    });
  };

  const showNotice = (msg: string) => {
    setBulkNotice(msg);
    setTimeout(() => setBulkNotice(null), 2500);
  };

  const stats = useMemo(() => {
    const langCounts: Record<string, number> = { voice: 0, subtitles: 0, none: 0 };
    const yearCounts = new Map();
    let minRev = Infinity;
    let maxRev = 0;
    let minRat = 100;
    let maxRat = 0;
    let totalMatched = 0;

    for (const g of games) {
      if (matchesGameMeta(scope, g, 'language')) {
        langCounts[g.tier]++;
      }
      if (matchesGameMeta(scope, g, 'years')) {
        yearCounts.set(g.releaseYear, (yearCounts.get(g.releaseYear) ?? 0) + 1);
      }
      if (matchesGameMeta(scope, g)) {
        totalMatched++;
        if (g.reviewCount < minRev) minRev = g.reviewCount;
        if (g.reviewCount > maxRev) maxRev = g.reviewCount;
        if (g.reviewCount > 0) {
          if (g.reviewPercent < minRat) minRat = g.reviewPercent;
          if (g.reviewPercent > maxRat) maxRat = g.reviewPercent;
        }
      }
    }

    const sortedYears = Array.from(yearCounts.entries()).sort((a: any, b: any) => {
      if (a[0] === 'Без даты') return 1;
      if (b[0] === 'Без даты') return -1;
      return Number(b[0]) - Number(a[0]);
    });

    return {
      langCounts,
      sortedYears,
      totalMatched,
      minRev: minRev === Infinity ? 0 : minRev,
      maxRev,
      minRat: minRat > maxRat ? 0 : minRat,
      maxRat,
    };
  }, [
    scope,
    games,
    state.languages.size,
    state.years.size,
    state.reviewCountMin,
    state.reviewCountMax,
    state.ratingMin,
    state.ratingMax,
    Object.keys(state.activeTags).length,
    state.hiddenTags.size,
  ]);

  const tagSearchResults = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (q.length < 2 || !tagsReady) return [];
    const results: any[] = [];
    for (const [id, name] of getAllTags().entries()) {
      if (state.activeTags[id] !== undefined || state.hiddenTags.has(id)) continue;
      if (name.toLowerCase().includes(q)) {
        results.push([id, name]);
        if (results.length >= 40) break;
      }
    }
    return results;
  }, [tagQuery, tagsReady, state.activeTags, state.hiddenTags]);

  const filteredYears = useMemo(() => {
    const q = yearQuery.trim().toLowerCase();
    if (!q) return stats.sortedYears;
    return stats.sortedYears.filter(([y]: any) => y.toLowerCase().includes(q));
  }, [stats.sortedYears, yearQuery]);

  const pct = fetchStatus.total > 0 ? Math.min(100, Math.round((fetchStatus.done / fetchStatus.total) * 100)) : 100;
  const anyColActive = isAnyCollectionFilterActive();

  return (
    <div
      onClick={() => {
        commitRangesNow();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 14, 20, 0.82)',
        backdropFilter: 'blur(4px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: '"Motiva Sans", Arial, sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '880px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          backgroundColor: '#171d25',
          border: '1px solid #2d3846',
          borderRadius: '6px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.75)',
          display: 'flex',
          flexDirection: 'column',
          color: '#dcdedf',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            backgroundColor: '#10151c',
            borderBottom: '1px solid #26303d',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#66c0f4' }}>Bibliotekarsha</span>
            <span
              style={{
                fontSize: '12px',
                backgroundColor: 'rgba(102, 192, 244, 0.14)',
                color: '#a3d5f7',
                padding: '2px 8px',
                borderRadius: '3px',
              }}
            >
              {scopeTitle}
            </span>
            <span style={{ fontSize: '12px', color: '#8f98a0' }}>
              Подходит: <b style={{ color: '#fff' }}>{stats.totalMatched}</b> из {games.length}
            </span>
            {fetchStatus.active ? (
              <span style={{ fontSize: '11px', color: '#66c0f4' }}>
                • Сбор базы: {pct}% ({fetchStatus.done}/{fetchStatus.total})
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#56d364' }}>• База готова ({fetchStatus.cachedCount})</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                if (rangeTimerRef.current) clearTimeout(rangeTimerRef.current);
                resetScopeFilters(scope);
                syncInputsFromState();
              }}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid #384454',
                color: '#c6d4df',
                padding: '5px 12px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Сбросить текущий
            </button>
            <button
              type="button"
              onClick={() => {
                commitRangesNow();
                onClose();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8f98a0',
                fontSize: '22px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '10px 20px',
            backgroundColor: '#131922',
            borderBottom: '1px solid #242e3b',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#8f98a0', fontWeight: 600 }}>Шаблоны:</span>
            <input
              type="text"
              placeholder="Название шаблона..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && presetName.trim()) {
                  commitRangesNow();
                  setPresets(savePresetFromScope(scope, presetName));
                  setPresetName('');
                }
              }}
              style={{
                background: '#1b2430',
                border: '1px solid #303d4e',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '3px',
                fontSize: '12px',
                width: '170px',
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (!presetName.trim()) return;
                commitRangesNow();
                setPresets(savePresetFromScope(scope, presetName));
                setPresetName('');
              }}
              style={{
                background: '#238636',
                border: 'none',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Сохранить
            </button>

            {presets.map((p) => (
              <div
                key={p.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#1f2937',
                  border: '1px solid #354457',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  fontSize: '12px',
                }}
              >
                <span
                  onClick={() => {
                    if (rangeTimerRef.current) clearTimeout(rangeTimerRef.current);
                    applyPresetToScope(scope, p);
                    syncInputsFromState();
                  }}
                  title="Применить шаблон"
                  style={{
                    padding: '3px 9px',
                    cursor: 'pointer',
                    color: '#d4e4f7',
                  }}
                >
                  {p.name}
                </span>
                <span
                  onClick={() => setPresets(deleteSavedPreset(p.name))}
                  title="Удалить шаблон"
                  style={{
                    padding: '3px 7px',
                    cursor: 'pointer',
                    backgroundColor: 'rgba(167, 67, 67, 0.35)',
                    color: '#f88',
                    borderLeft: '1px solid #354457',
                  }}
                >
                  ×
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#8f98a0', fontWeight: 600 }}>Коллекции:</span>
            <button
              type="button"
              onClick={() => {
                commitRangesNow();
                applyScopeToAllCollections(scope);
                showNotice('Фильтр применён ко всем коллекциям (общий список не затронут)');
              }}
              style={{
                background: 'rgba(102, 192, 244, 0.16)',
                border: '1px solid rgba(102, 192, 244, 0.45)',
                color: '#a3d5f7',
                padding: '4px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Применить ко всем коллекциям
            </button>
            <button
              type="button"
              onClick={() => {
                clearAllCollectionsFilters();
                if (scope.startsWith('collection:')) syncInputsFromState();
                showNotice('Фильтры со всех коллекций сняты');
              }}
              style={{
                background: anyColActive ? 'rgba(167, 67, 67, 0.3)' : 'rgba(255,255,255,0.05)',
                border: anyColActive ? '1px solid rgba(248, 81, 73, 0.45)' : '1px solid #303d4e',
                color: anyColActive ? '#ff9b9b' : '#8f98a0',
                padding: '4px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Снять со всех коллекций
            </button>
            {bulkNotice && <span style={{ fontSize: '11px', color: '#56d364' }}>✓ {bulkNotice}</span>}
          </div>
        </div>

        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1.35fr',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: '#11161d', padding: '12px', borderRadius: '4px', border: '1px solid #242e3b' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#66c0f4', marginBottom: '8px', textTransform: 'uppercase' }}>
                Русский язык
              </div>
              {TIERS.map((tier) => {
                const info = TIER_INFO[tier];
                const checked = state.languages.has(tier);
                return (
                  <label
                    key={tier}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLanguageFilter(scope, tier)}
                        style={{ accentColor: info.color, width: '15px', height: '15px' }}
                      />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: info.color }} />
                      <span>{info.label}</span>
                    </span>
                    <span style={{ color: '#8f98a0', fontSize: '12px' }}>{stats.langCounts[tier]}</span>
                  </label>
                );
              })}
            </div>

            <div style={{ background: '#11161d', padding: '12px', borderRadius: '4px', border: '1px solid #242e3b' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#66c0f4', marginBottom: '8px', textTransform: 'uppercase' }}>
                Отзывы и рейтинг
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#8f98a0', marginBottom: '4px' }}>Отзывов от</div>
                  <input
                    type="number"
                    placeholder={`От ${stats.minRev}`}
                    value={revMinStr}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRevMinStr(v);
                      scheduleRangeCommit(v, revMaxStr, ratMinStr, ratMaxStr);
                    }}
                    onBlur={commitRangesNow}
                    onKeyDown={(e) => e.key === 'Enter' && commitRangesNow()}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#1b2430',
                      border: '1px solid #303d4e',
                      color: '#fff',
                      padding: '6px 8px',
                      borderRadius: '3px',
                      fontSize: '12px',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8f98a0', marginBottom: '4px' }}>Отзывов до</div>
                  <input
                    type="number"
                    placeholder={`До ${stats.maxRev}`}
                    value={revMaxStr}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRevMaxStr(v);
                      scheduleRangeCommit(revMinStr, v, ratMinStr, ratMaxStr);
                    }}
                    onBlur={commitRangesNow}
                    onKeyDown={(e) => e.key === 'Enter' && commitRangesNow()}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#1b2430',
                      border: '1px solid #303d4e',
                      color: '#fff',
                      padding: '6px 8px',
                      borderRadius: '3px',
                      fontSize: '12px',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8f98a0', marginBottom: '4px' }}>Рейтинг от (%)</div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={`От ${stats.minRat}%`}
                    value={ratMinStr}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRatMinStr(v);
                      scheduleRangeCommit(revMinStr, revMaxStr, v, ratMaxStr);
                    }}
                    onBlur={commitRangesNow}
                    onKeyDown={(e) => e.key === 'Enter' && commitRangesNow()}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#1b2430',
                      border: '1px solid #303d4e',
                      color: '#fff',
                      padding: '6px 8px',
                      borderRadius: '3px',
                      fontSize: '12px',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8f98a0', marginBottom: '4px' }}>Рейтинг до (%)</div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={`До ${stats.maxRat}%`}
                    value={ratMaxStr}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRatMaxStr(v);
                      scheduleRangeCommit(revMinStr, revMaxStr, ratMinStr, v);
                    }}
                    onBlur={commitRangesNow}
                    onKeyDown={(e) => e.key === 'Enter' && commitRangesNow()}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#1b2430',
                      border: '1px solid #303d4e',
                      color: '#fff',
                      padding: '6px 8px',
                      borderRadius: '3px',
                      fontSize: '12px',
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ background: '#11161d', padding: '12px', borderRadius: '4px', border: '1px solid #242e3b', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#66c0f4', textTransform: 'uppercase' }}>Год выхода</span>
                {state.years.size > 0 && (
                  <span onClick={() => clearYearFilter(scope)} style={{ fontSize: '11px', color: '#66c0f4', cursor: 'pointer' }}>
                    Очистить ({state.years.size})
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Поиск года..."
                value={yearQuery}
                onChange={(e) => setYearQuery(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#1b2430',
                  border: '1px solid #303d4e',
                  color: '#fff',
                  padding: '5px 8px',
                  borderRadius: '3px',
                  fontSize: '12px',
                  marginBottom: '8px',
                }}
              />
              <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {filteredYears.map(([year, count]: any) => (
                  <label
                    key={year}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      padding: '3px 4px',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        checked={state.years.has(year)}
                        onChange={() => toggleYearFilter(scope, year)}
                        style={{ accentColor: '#66c0f4' }}
                      />
                      <span>{year}</span>
                    </span>
                    <span style={{ color: '#8f98a0' }}>{count}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              background: '#11161d',
              padding: '14px',
              borderRadius: '4px',
              border: '1px solid #242e3b',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#66c0f4', marginBottom: '4px', textTransform: 'uppercase' }}>
                Умные метки (вес и исключение)
              </div>
              <div style={{ fontSize: '11px', color: '#8f98a0', marginBottom: '8px' }}>
                Число справа от активной метки — макс. позиция в тегах игры (например, 3 = только в топ-3 тегов).
              </div>
              <input
                type="text"
                placeholder={tagsReady ? 'Введите название метки (от 2 букв)...' : 'Загрузка словаря меток...'}
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#1b2430',
                  border: '1px solid #303d4e',
                  color: '#fff',
                  padding: '7px 10px',
                  borderRadius: '3px',
                  fontSize: '13px',
                }}
              />
              {tagSearchResults.length > 0 && (
                <div
                  style={{
                    maxHeight: '150px',
                    overflowY: 'auto',
                    background: '#1b2430',
                    border: '1px solid #303d4e',
                    borderTop: 'none',
                    borderRadius: '0 0 3px 3px',
                  }}
                >
                  {tagSearchResults.map(([id, name]: any) => (
                    <div
                      key={id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderBottom: '1px solid #253140',
                        fontSize: '12px',
                      }}
                    >
                      <span>{name}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTag(scope, id, 5);
                            setTagQuery('');
                          }}
                          style={{
                            background: '#238636',
                            border: 'none',
                            color: '#fff',
                            padding: '3px 8px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          + Включить
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addHiddenTag(scope, id);
                            setTagQuery('');
                          }}
                          style={{
                            background: '#a74343',
                            border: 'none',
                            color: '#fff',
                            padding: '3px 8px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          − Исключить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1 }}>
              <div
                style={{
                  background: '#161d26',
                  border: '1px solid #263241',
                  borderRadius: '4px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ fontSize: '12px', color: '#56d364', fontWeight: 600, borderBottom: '1px solid #263241', paddingBottom: '4px' }}>
                  Требуемые метки (до №)
                </div>
                {Object.entries(state.activeTags).length === 0 && (
                  <div style={{ fontSize: '11px', color: '#6e7a88' }}>Нет выбранных меток</div>
                )}
                {Object.entries(state.activeTags).map(([idStr, pos]) => {
                  const id = Number(idStr);
                  return (
                    <div
                      key={id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        background: '#212b38',
                        padding: '5px 8px',
                        borderRadius: '3px',
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getTagName(id)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', color: '#8f98a0' }}>до</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={pos}
                          onChange={(e) => setActiveTag(scope, id, Number(e.target.value) || 1)}
                          style={{
                            width: '42px',
                            textAlign: 'center',
                            background: '#131922',
                            border: '1px solid #354457',
                            color: '#fff',
                            borderRadius: '2px',
                            padding: '2px',
                            fontSize: '12px',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => addHiddenTag(scope, id)}
                          title="Перенести в исключения"
                          style={{
                            background: '#303d4e',
                            border: 'none',
                            color: '#c6d4df',
                            padding: '2px 5px',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() => removeActiveTag(scope, id)}
                          style={{
                            background: '#a74343',
                            border: 'none',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontSize: '11px',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  background: '#161d26',
                  border: '1px solid #263241',
                  borderRadius: '4px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ fontSize: '12px', color: '#f85149', fontWeight: 600, borderBottom: '1px solid #263241', paddingBottom: '4px' }}>
                  Исключённые метки
                </div>
                {state.hiddenTags.size === 0 && <div style={{ fontSize: '11px', color: '#6e7a88' }}>Нет скрытых меток</div>}
                {Array.from(state.hiddenTags).map((id) => (
                  <div
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      background: '#212b38',
                      padding: '5px 8px',
                      borderRadius: '3px',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getTagName(id)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setActiveTag(scope, id, 5)}
                        title="Перенести в требуемые"
                        style={{
                          background: '#303d4e',
                          border: 'none',
                          color: '#c6d4df',
                          padding: '2px 5px',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHiddenTag(scope, id)}
                        style={{
                          background: '#a74343',
                          border: 'none',
                          color: '#fff',
                          padding: '2px 6px',
                          borderRadius: '2px',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#10151c',
            borderTop: '1px solid #26303d',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={() => {
              commitRangesNow();
              onClose();
            }}
            style={{
              background: 'linear-gradient(to right, #47bfff 0%, #1a44c2 100%)',
              border: 'none',
              color: '#fff',
              fontWeight: 600,
              padding: '7px 22px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
