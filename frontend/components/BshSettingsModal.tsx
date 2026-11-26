import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SETTINGS_CATALOG,
  SETTINGS_CATEGORIES,
  SettingItemDef,
  SettingsCategoryId,
} from '../config/settingsCatalog';
import { ALL_MODULES } from '../modules/registry';
import {
  DEFAULT_INCOGNITO_SETTINGS,
  INCOGNITO_REGIONS,
  getIncognitoSettings,
  subscribeIncognito,
  updateIncognitoSettings,
} from '../stores/incognito';
import { isModuleEnabled, setModuleEnabled, subscribeSettings } from '../stores/settings';
import { AuthorModal } from './settings/AuthorModal';
import { BackupModal } from './settings/BackupModal';
import { SettingInfoModal } from './settings/SettingInfoModal';

interface BshSettingsModalProps {
  onClose: () => void;
  isNativePopup?: boolean;
}

const PICS_REGIONS: Array<[string, string]> = [
  ['RU', 'Россия (RU)'],
  ['BY', 'Беларусь (BY)'],
  ['KZ', 'Казахстан (KZ)'],
  ['UA', 'Украина (UA)'],
  ['TR', 'Турция (TR)'],
  ['US', 'США (US)'],
];

const BSH_STYLES = `
  .bib-bsh-scroll::-webkit-scrollbar { width: 6px; }
  .bib-bsh-scroll::-webkit-scrollbar-track { background: #10151c; }
  .bib-bsh-scroll::-webkit-scrollbar-thumb { background: #2c3847; border-radius: 3px; }
  .bib-bsh-scroll::-webkit-scrollbar-thumb:hover { background: #4a617d; }

  .bib-bsh-btn {
    background: rgba(103, 193, 245, 0.12);
    border: 1px solid rgba(103, 193, 245, 0.25);
    color: #d6e2ed;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12.5px;
    white-space: nowrap;
    transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
  }
  .bib-bsh-btn:hover {
    background: rgba(103, 193, 245, 0.26);
    border-color: #66c0f4;
    color: #ffffff;
  }
  .bib-bsh-btn-danger {
    background: rgba(167, 67, 67, 0.25);
    border-color: rgba(205, 92, 92, 0.45);
    color: #ffb3b3;
  }
  .bib-bsh-btn-danger:hover {
    background: rgba(196, 82, 82, 0.45);
    border-color: #ff7b72;
    color: #ffffff;
  }

  .bib-bsh-nav-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: #b8c7d4;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
  }
  .bib-bsh-nav-item:hover {
    background: rgba(102, 192, 244, 0.1);
    color: #ffffff;
  }
  .bib-bsh-nav-item.active {
    background: rgba(102, 192, 244, 0.18);
    border-color: rgba(102, 192, 244, 0.45);
    color: #ffffff;
    font-weight: 600;
  }

  .bib-bsh-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.055);
    transition: background-color 0.14s ease, border-color 0.14s ease;
  }
  .bib-bsh-row:hover {
    background-color: rgba(102, 192, 244, 0.09);
    border-color: rgba(102, 192, 244, 0.3);
  }
  .bib-bsh-info-btn {
    width: 26px;
    height: 26px;
    border-radius: 4px;
    border: 1px solid rgba(103, 193, 245, 0.22);
    background: rgba(103, 193, 245, 0.08);
    color: #67c1f5;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .bib-bsh-info-btn:hover {
    background: rgba(103, 193, 245, 0.28);
    border-color: #67c1f5;
    color: #ffffff;
  }
  .bib-bsh-select {
    background: #1b2430;
    color: #e5eef5;
    border: 1px solid #303d4e;
    padding: 5px 10px;
    border-radius: 3px;
    font-size: 12.5px;
    outline: none;
    cursor: pointer;
  }
  .bib-bsh-select:hover, .bib-bsh-select:focus { border-color: #66c0f4; }
  .bib-bsh-search {
    width: 100%;
    box-sizing: border-box;
    background: #141a22;
    border: 1px solid #2b3746;
    color: #e5eef5;
    padding: 7px 10px;
    border-radius: 4px;
    font-size: 12.5px;
    outline: none;
  }
  .bib-bsh-search:focus { border-color: #66c0f4; }
`;

export function BshSettingsModal({ onClose, isNativePopup }: BshSettingsModalProps) {
  const [tick, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [infoItem, setInfoItem] = useState<SettingItemDef | null>(null);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const u1 = subscribeSettings(rerender);
    const u2 = subscribeIncognito(rerender);
    return () => {
      u1();
      u2();
    };
  }, []);

  useEffect(() => {
    if (!resetConfirmOpen) return;
    const targetWin = rootRef.current?.ownerDocument?.defaultView || window;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        setResetConfirmOpen(false);
      }
    };
    targetWin.addEventListener('keydown', onKey, true);
    return () => targetWin.removeEventListener('keydown', onKey, true);
  }, [resetConfirmOpen]);

  const cfg = getIncognitoSettings();

  const isItemEnabled = (item: SettingItemDef): boolean => {
    if (item.kind === 'module' && item.moduleId) {
      const mod = ALL_MODULES.find((m) => m.id === item.moduleId);
      return isModuleEnabled(item.moduleId, mod?.defaultEnabled ?? true);
    }
    if (item.kind === 'webkit-bool' && item.webkitKey) {
      return Boolean(cfg[item.webkitKey]);
    }
    return true;
  };

  const categoryCounts = useMemo(() => {
    const map: Record<string, { on: number; total: number }> = {};
    for (const cat of SETTINGS_CATEGORIES) {
      const items = SETTINGS_CATALOG.filter((i) => i.category === cat.id && i.kind !== 'webkit-select');
      const on = items.filter((i) => isItemEnabled(i)).length;
      map[cat.id] = { on, total: items.length };
    }
    return map;
  }, [cfg, tick]);

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length >= 2) {
      return SETTINGS_CATALOG.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.shortDesc.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q)
      );
    }
    return SETTINGS_CATALOG.filter((i) => i.category === activeCategory);
  }, [activeCategory, searchQuery]);

  const activeCategoryDef = SETTINGS_CATEGORIES.find((c) => c.id === activeCategory)!;

  const handleReset = async () => {
    setResetConfirmOpen(false);
    for (const mod of ALL_MODULES) {
      if (mod.id !== 'bsh-settings') {
        setModuleEnabled(mod.id, mod.defaultEnabled);
      }
    }
    await updateIncognitoSettings({ ...DEFAULT_INCOGNITO_SETTINGS });
    setNotice('Все настройки восстановлены по умолчанию.');
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
        left: '50%',
        top: '48px',
        transform: 'translateX(-50%)',
        width: '1080px',
        maxWidth: 'calc(100vw - 24px)',
        height: '90vh',
        maxHeight: 'calc(100vh - 60px)',
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

  return (
    <div ref={rootRef} onClick={(e) => e.stopPropagation()} style={containerStyle}>
      <style>{BSH_STYLES}</style>

      <div
        style={{
          padding: '11px 18px',
          backgroundColor: '#10151c',
          borderTop: isNativePopup ? '1px solid #26303d' : 'none',
          borderBottom: '1px solid #26303d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
          ...(isNativePopup ? ({ WebkitAppRegion: 'no-drag' } as any) : {}),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#66c0f4' }}>
            ⚙ Настройки Bibliotekarsha
          </span>
          <span style={{ fontSize: '12px', color: '#8f98a0' }}>v0.7.0</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button type="button" onClick={() => setBackupOpen(true)} className="bib-bsh-btn" title="Экспорт и импорт всех настроек и баз данных">
            💾 Бэкап
          </button>
          <button type="button" onClick={() => setAuthorOpen(true)} className="bib-bsh-btn">
            👤 Об авторе
          </button>
          <button type="button" onClick={() => setResetConfirmOpen(true)} className="bib-bsh-btn bib-bsh-btn-danger">
            Сбросить
          </button>
          {!isNativePopup && (
            <button type="button" onClick={onClose} className="bib-bsh-btn" style={{ padding: '5px 10px' }}>
              ×
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          style={{
            padding: '7px 18px',
            backgroundColor: 'rgba(102, 192, 244, 0.12)',
            borderBottom: '1px solid #242e3b',
            fontSize: '12.5px',
            color: '#8fd0f8',
            flexShrink: 0,
          }}
        >
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div
          className="bib-bsh-scroll"
          style={{
            width: '240px',
            flexShrink: 0,
            backgroundColor: '#121820',
            borderRight: '1px solid #242e3b',
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            overflowY: 'auto',
          }}
        >
          <input
            type="text"
            className="bib-bsh-search"
            placeholder="Поиск настройки..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: '6px' }}
          />

          {SETTINGS_CATEGORIES.map((cat) => {
            const isAct = searchQuery.trim().length < 2 && activeCategory === cat.id;
            const cnt = categoryCounts[cat.id];
            return (
              <button
                key={cat.id}
                type="button"
                className={`bib-bsh-nav-item ${isAct ? 'active' : ''}`}
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory(cat.id);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span>{cat.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.label}
                  </span>
                </span>
                <span style={{ fontSize: '11px', color: '#7d8c9c', flexShrink: 0 }}>
                  {cnt.on}/{cnt.total}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="bib-bsh-scroll"
          style={{
            flex: 1,
            padding: '16px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minWidth: 0,
          }}
        >
          <div style={{ borderBottom: '1px solid #26303d', paddingBottom: '10px', marginBottom: '2px' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#66c0f4' }}>
              {searchQuery.trim().length >= 2
                ? `Результаты поиска: «${searchQuery.trim()}» (${visibleItems.length})`
                : `${activeCategoryDef.icon} ${activeCategoryDef.label}`}
            </div>
            {searchQuery.trim().length < 2 && (
              <div style={{ fontSize: '12.5px', color: '#8f98a0', marginTop: '3px' }}>
                {activeCategoryDef.description}
              </div>
            )}
          </div>

          {visibleItems.length === 0 ? (
            <div style={{ color: '#8f98a0', fontSize: '13px', padding: '24px', textAlign: 'center' }}>
              По запросу ничего не найдено.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {visibleItems.map((item) => {
                const parentDisabled = Boolean(
                  (item.parentWebkitKey && !cfg[item.parentWebkitKey]) ||
                    (item.parentModuleId && !isModuleEnabled(item.parentModuleId, true))
                );
                const isSub =
                  Boolean(item.parentWebkitKey || item.parentModuleId) && searchQuery.trim().length < 2;

                return (
                  <div
                    key={item.id}
                    className="bib-bsh-row"
                    style={{
                      marginLeft: isSub ? '22px' : 0,
                      opacity: parentDisabled ? 0.55 : 1,
                    }}
                  >
                    {item.kind === 'webkit-select' && item.webkitKey ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#e5eef5' }}>{item.label}</div>
                          <div style={{ fontSize: '12px', color: '#8f98a0', marginTop: '2px' }}>{item.shortDesc}</div>
                        </div>
                        <select
                          className="bib-bsh-select"
                          disabled={parentDisabled}
                          value={String(cfg[item.webkitKey] || '')}
                          onChange={(e) => {
                            updateIncognitoSettings({ [item.webkitKey!]: e.target.value } as any);
                            setNotice(`Настройка «${item.label}» изменена на ${e.target.value}.`);
                          }}
                        >
                          {item.webkitKey === 'picsTargetRegion'
                            ? PICS_REGIONS.map(([code, title]) => (
                                <option key={code} value={code}>
                                  {title}
                                </option>
                              ))
                            : Object.entries(INCOGNITO_REGIONS).map(([code, title]) => (
                                <option key={code} value={code}>
                                  {title} ({code})
                                </option>
                              ))}
                        </select>
                      </div>
                    ) : (
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          flex: 1,
                          cursor: parentDisabled ? 'not-allowed' : 'pointer',
                          minWidth: 0,
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={parentDisabled}
                          checked={isItemEnabled(item)}
                          onChange={(e) => {
                            const next = e.target.checked;
                            if (item.kind === 'module' && item.moduleId) {
                              if (item.moduleId === 'game-nfo-button' && next) {
                                setModuleEnabled('game-page-slot', true);
                              }
                              setModuleEnabled(item.moduleId, next);
                            } else if (item.kind === 'webkit-bool' && item.webkitKey) {
                              updateIncognitoSettings({ [item.webkitKey]: next } as any);
                            }
                            setNotice(`«${item.label}» — ${next ? 'включено' : 'отключено'}.`);
                          }}
                          style={{
                            marginTop: '3px',
                            accentColor: '#66c0f4',
                            width: isSub ? '15px' : '16px',
                            height: isSub ? '15px' : '16px',
                            flexShrink: 0,
                            cursor: parentDisabled ? 'not-allowed' : 'pointer',
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: isSub ? '13px' : '13.5px', fontWeight: 600, color: '#e5eef5' }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: '12px', color: '#8f98a0', marginTop: '2px', lineHeight: 1.35 }}>
                            {item.shortDesc}
                          </div>
                        </div>
                      </label>
                    )}

                    <button
                      type="button"
                      className="bib-bsh-info-btn"
                      title="Подробнее и скриншоты..."
                      onClick={(e) => {
                        e.stopPropagation();
                        setInfoItem(item);
                      }}
                    >
                      ⓘ
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {infoItem && <SettingInfoModal item={infoItem} onClose={() => setInfoItem(null)} />}
      {authorOpen && <AuthorModal onClose={() => setAuthorOpen(false)} />}
      {backupOpen && <BackupModal onClose={() => setBackupOpen(false)} onRestored={(msg) => setNotice(msg)} />}

      {resetConfirmOpen && (
        <div
          onClick={() => setResetConfirmOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(8, 11, 16, 0.82)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000015,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '430px',
              maxWidth: '92vw',
              backgroundColor: '#1b2430',
              border: '1px solid #d9534f',
              borderRadius: '6px',
              boxShadow: '0 14px 45px rgba(0, 0, 0, 0.85)',
              padding: '20px 22px',
              color: '#dcdedf',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ff7b72', marginBottom: '10px' }}>
              Сбросить все настройки?
            </div>
            <div style={{ fontSize: '13px', color: '#c6d4df', lineHeight: 1.5, marginBottom: '18px' }}>
              Все включённые и отключённые модули, а также выбранные регионы (В.Р.И. и PICS) вернутся к значениям по умолчанию. Сохранённые заметки, скрытые новости и база Наблюдателя затронуты не будут.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setResetConfirmOpen(false)} className="bib-bsh-btn">
                Отмена
              </button>
              <button type="button" onClick={handleReset} className="bib-bsh-btn bib-bsh-btn-danger">
                Да, сбросить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
