import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sharedStorageGet, sharedStorageSet } from '../services/sharedStorage';

export const GAME_NOTES_DB_KEY = 'use_game_notes_db_v2';

interface CriteriaScores {
  gfx: number;
  story: number;
  gameplay: number;
  audio: number;
  atmos: number;
}

export interface GameNoteRecord {
  name: string;
  headerUrl: string;
  text: string;
  criteria: CriteriaScores;
  avgScore: number;
  manualScore: number | '';
  updated: number;
}

const CRITERIA_LIST: Array<{ id: keyof CriteriaScores; label: string }> = [
  { id: 'gfx', label: 'Графика' },
  { id: 'story', label: 'Сюжет' },
  { id: 'gameplay', label: 'Геймплей' },
  { id: 'audio', label: 'Звук и музыка' },
  { id: 'atmos', label: 'Атмосфера' },
];

const emptyCriteria = (): CriteriaScores => ({ gfx: 0, story: 0, gameplay: 0, audio: 0, atmos: 0 });

function calcAvg(c: CriteriaScores): number {
  let sum = 0;
  let cnt = 0;
  (Object.keys(c) as Array<keyof CriteriaScores>).forEach((k) => {
    if (c[k] > 0) {
      sum += c[k] * 10;
      cnt++;
    }
  });
  return cnt > 0 ? Math.round(sum / cnt) : 0;
}

export async function hasSharedGameNote(appId: number): Promise<boolean> {
  const db = await sharedStorageGet<Record<string, GameNoteRecord>>(GAME_NOTES_DB_KEY);
  return Boolean(db && typeof db === 'object' && !Array.isArray(db) && db[String(appId)]);
}

interface LibraryGameNotesModalProps {
  appId: number;
  gameTitle: string;
  onClose: () => void;
}

export function LibraryGameNotesModal({ appId, gameTitle, onClose }: LibraryGameNotesModalProps) {
  const [db, setDb] = useState<Record<string, GameNoteRecord>>({});
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<'editor' | 'gallery'>('editor');

  const [editId, setEditId] = useState(String(appId));
  const [editName, setEditName] = useState(gameTitle);
  const [editHeader, setEditHeader] = useState(
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`
  );
  const [text, setText] = useState('');
  const [criteria, setCriteria] = useState<CriteriaScores>(emptyCriteria);
  const [hoverCrit, setHoverCrit] = useState<Partial<CriteriaScores>>({});
  const [manualScore, setManualScore] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<() => void>(() => {});

  const hydrateEditor = (targetId: string, name: string, header: string, sourceDb: Record<string, GameNoteRecord>) => {
    setEditId(targetId);
    setEditName(name);
    setEditHeader(header || `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${targetId}/header.jpg`);
    const rec = sourceDb[targetId];
    setText(rec?.text || '');
    setCriteria({ ...emptyCriteria(), ...(rec?.criteria || {}) });
    setManualScore(rec?.manualScore !== undefined && rec?.manualScore !== '' ? String(rec.manualScore) : '');
    setView('editor');
  };

  useEffect(() => {
    sharedStorageGet<Record<string, GameNoteRecord>>(GAME_NOTES_DB_KEY).then((saved) => {
      const nextDb = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
      setDb(nextDb);
      hydrateEditor(
        String(appId),
        nextDb[String(appId)]?.name || gameTitle,
        nextDb[String(appId)]?.headerUrl ||
          `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
        nextDb
      );
      setLoaded(true);
    });
  }, [appId, gameTitle]);

  const avgScore = calcAvg(criteria);

  const persistCurrent = async (
    nextText = text,
    nextCriteria = criteria,
    nextManual = manualScore,
    currentDb = db
  ) => {
    const nextAvg = calcAvg(nextCriteria);
    const trimmed = nextText.trim();
    const copy = { ...currentDb };

    if (trimmed === '' && nextAvg === 0 && nextManual.trim() === '') {
      delete copy[editId];
    } else {
      copy[editId] = {
        name: editName,
        headerUrl: editHeader,
        text: trimmed,
        criteria: { ...nextCriteria },
        avgScore: nextAvg,
        manualScore: nextManual.trim() !== '' ? Math.max(0, Math.min(100, parseInt(nextManual, 10) || 0)) : '',
        updated: Date.now(),
      };
    }
    setDb(copy);
    await sharedStorageSet(GAME_NOTES_DB_KEY, copy);
    return copy;
  };

  const scheduleSave = (t: string, c: CriteriaScores, m: string) => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      persistCurrent(t, c, m);
    }, 600);
  };

  const handleClose = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    if (loaded && view === 'editor') {
      await persistCurrent();
    }
    onClose();
  };
  closeRef.current = () => {
    handleClose();
  };

  useEffect(() => {
    const targetWin =
      overlayRef.current?.ownerDocument?.defaultView ||
      window.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0')?.m_popup ||
      window;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeRef.current();
      }
    };
    targetWin.addEventListener('keydown', onKey, true);
    return () => targetWin.removeEventListener('keydown', onKey, true);
  }, []);

  const sortedGallery = useMemo(() => {
    const list = Object.entries(db).map(([id, rec]) => ({ id, ...rec }));
    const numManual = (r: GameNoteRecord) => (typeof r.manualScore === 'number' ? r.manualScore : -1);
    list.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': return (a.updated || 0) - (b.updated || 0);
        case 'name_asc': return a.name.localeCompare(b.name, 'ru');
        case 'name_desc': return b.name.localeCompare(a.name, 'ru');
        case 'avg_desc': return (b.avgScore || 0) - (a.avgScore || 0);
        case 'avg_asc': return (a.avgScore || 0) - (b.avgScore || 0);
        case 'manual_desc': return numManual(b) - numManual(a);
        case 'manual_asc': return numManual(a) - numManual(b);
        default: return (b.updated || 0) - (a.updated || 0);
      }
    });
    return list;
  }, [db, sortBy]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) handleClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(8, 12, 18, 0.86)',
        backdropFilter: 'blur(3px)',
        zIndex: 100025,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: view === 'gallery' ? '960px' : '560px',
          maxWidth: '94vw',
          maxHeight: '86vh',
          backgroundColor: '#1b2838',
          border: '1px solid #4b6f9c',
          borderRadius: '6px',
          boxShadow: '0 14px 48px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          color: '#c6d4df',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#101822',
            borderBottom: '1px solid #2a3a4c',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#66c0f4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {view === 'gallery' ? `Все заметки (${sortedGallery.length})` : `✎ Заметка: ${editName}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              className="bib-nfo-pill-btn"
              onClick={async () => {
                if (view === 'editor') {
                  if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
                  await persistCurrent();
                  setView('gallery');
                } else {
                  setView('editor');
                }
              }}
            >
              {view === 'editor' ? `Все заметки (${Object.keys(db).length})` : '← К редактору'}
            </button>
            <button type="button" onClick={handleClose} className="bib-nfo-close-icon">
              ×
            </button>
          </div>
        </div>

        {!loaded ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#8f98a0' }}>Загрузка заметок...</div>
        ) : view === 'editor' ? (
          <div className="bib-nfo-scroll" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                scheduleSave(e.target.value, criteria, manualScore);
              }}
              placeholder="Напишите здесь свои впечатления об игре..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '115px',
                backgroundColor: '#0d131a',
                border: '1px solid #30363d',
                borderRadius: '4px',
                color: '#e5eef5',
                padding: '10px',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />

            <div
              style={{
                backgroundColor: '#101822',
                border: '1px solid #2a3a4c',
                borderRadius: '4px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {CRITERIA_LIST.map((c) => {
                const shown = hoverCrit[c.id] ?? criteria[c.id] ?? 0;
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span>{c.label}</span>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
                      onMouseLeave={() => setHoverCrit((p) => ({ ...p, [c.id]: undefined }))}
                    >
                      {Array.from({ length: 10 }, (_, idx) => {
                        const val = idx + 1;
                        return (
                          <span
                            key={val}
                            onMouseEnter={() => setHoverCrit((p) => ({ ...p, [c.id]: val }))}
                            onClick={() => {
                              const nextC = { ...criteria, [c.id]: criteria[c.id] === val ? 0 : val };
                              setCriteria(nextC);
                              scheduleSave(text, nextC, manualScore);
                            }}
                            style={{
                              fontSize: '19px',
                              cursor: 'pointer',
                              userSelect: 'none',
                              lineHeight: 1,
                              color: val <= shown ? '#ffd700' : '#30363d',
                            }}
                          >
                            ★
                          </span>
                        );
                      })}
                      <span style={{ width: '32px', textAlign: 'right', color: '#66c0f4', fontWeight: 700, marginLeft: '8px' }}>
                        {shown * 10}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px dashed #30363d',
                  paddingTop: '10px',
                  marginTop: '4px',
                }}
              >
                <span style={{ color: '#8cc540', fontWeight: 700, fontSize: '14px' }}>
                  Средний балл: <span style={{ fontSize: '17px' }}>{avgScore}</span>
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 700 }}>
                  <span>Личная оценка:</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="-"
                    value={manualScore}
                    onChange={(e) => {
                      let v = e.target.value;
                      if (v !== '') {
                        const n = parseInt(v, 10);
                        if (n < 0) v = '0';
                        if (n > 100) v = '100';
                      }
                      setManualScore(v);
                      scheduleSave(text, criteria, v);
                    }}
                    style={{
                      width: '56px',
                      textAlign: 'center',
                      background: '#223143',
                      border: '1px solid #30363d',
                      color: '#fff',
                      padding: '4px 6px',
                      borderRadius: '3px',
                      fontSize: '14px',
                      fontWeight: 700,
                      outline: 'none',
                    }}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: '#788796' }}>
                Автосохранение включено · синхронизировано с магазином
              </span>
              <button type="button" onClick={handleClose} className="bib-nfo-primary-btn">
                Сохранить и закрыть
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: '#121a24',
                borderBottom: '1px solid #2a3a4c',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#8f98a0' }}>Щёлкните по карточке, чтобы отредактировать заметку</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  background: '#223143',
                  border: '1px solid #30363d',
                  color: '#fff',
                  padding: '5px 8px',
                  borderRadius: '3px',
                  fontSize: '12px',
                }}
              >
                <option value="date_desc">Сначала новые</option>
                <option value="date_asc">Сначала старые</option>
                <option value="name_asc">Название (А-Я)</option>
                <option value="name_desc">Название (Я-А)</option>
                <option value="avg_desc">Средний балл (лучшие)</option>
                <option value="avg_asc">Средний балл (худшие)</option>
                <option value="manual_desc">Личная оценка (лучшие)</option>
                <option value="manual_asc">Личная оценка (худшие)</option>
              </select>
            </div>

            <div
              className="bib-nfo-scroll"
              style={{
                padding: '16px',
                overflowY: 'auto',
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '12px',
                alignContent: 'start',
              }}
            >
              {sortedGallery.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#8f98a0', padding: '32px' }}>
                  Заметок пока нет.
                </div>
              ) : (
                sortedGallery.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => hydrateEditor(item.id, item.name, item.headerUrl, db)}
                    style={{
                      background: '#101822',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirmDeleteId !== item.id) {
                          setConfirmDeleteId(item.id);
                          setTimeout(() => setConfirmDeleteId((cur) => (cur === item.id ? null : cur)), 3500);
                          return;
                        }
                        const copy = { ...db };
                        delete copy[item.id];
                        setDb(copy);
                        setConfirmDeleteId(null);
                        await sharedStorageSet(GAME_NOTES_DB_KEY, copy);
                      }}
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: confirmDeleteId === item.id ? '#d9534f' : 'rgba(0,0,0,0.75)',
                        border: '1px solid #ff6961',
                        color: '#fff',
                        borderRadius: '3px',
                        padding: '2px 7px',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      {confirmDeleteId === item.id ? 'Точно?' : '×'}
                    </button>
                    <img
                      src={
                        item.headerUrl ||
                        `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`
                      }
                      alt=""
                      style={{ width: '100%', height: '108px', objectFit: 'cover' }}
                    />
                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', background: '#090d12', padding: '4px 7px', borderRadius: '3px' }}>
                        <span style={{ color: '#8cc540' }}>Ср.: {item.avgScore || '—'}</span>
                        <span style={{ color: '#66c0f4' }}>
                          Оценка: {item.manualScore !== '' ? `${item.manualScore}/100` : '—'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#8f98a0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.text || 'Нет текста'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
