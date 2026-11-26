import React, { useEffect, useMemo, useState } from 'react';
import { Focusable } from 'millennium';
import { LibraryRouletteModal } from '../../../components/LibraryRouletteModal';
import { SmartFilterModal } from '../../../components/SmartFilterModal';
import { AppFilter, libraryApps } from '../../../lib/steam';
import { isScopeFilterActive, matchesGameMeta, resetScopeFilters, subscribeFilters } from '../../../stores/filters';
import { cachedMeta, onMetaUpdate, requestAllLibraryMeta } from '../../../stores/localization';
import { isModuleEnabled, subscribeSettings } from '../../../stores/settings';
import { GLOBAL_SCOPE } from '../filter-patch';

export type PanelClasses = Record<
  'Container' | 'WideFormat' | 'FilterArea' | 'FilterBucket' | 'FilterBucketLabel' | 'FilterBucketBoxes' | 'Row' | 'Checkbox',
  string
>;

export interface BucketProps {
  appFilter: AppFilter;
  fnOnChange?: () => void;
  classes: PanelClasses;
}

const BUCKET_BTN_STYLES = `
  .bib-native-btn {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 30px;
    line-height: 30px !important;
    padding: 0 12px !important;
    margin: 0;
    border-radius: 2px !important;
    border: none !important;
    background: rgba(103, 112, 123, 0.28) !important;
    color: #dfe3e6 !important;
    font-family: "Motiva Sans", Arial, sans-serif !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    cursor: pointer;
    user-select: none;
    box-sizing: border-box !important;
    transition: background-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease !important;
  }
  .bib-native-btn:hover {
    background: rgba(103, 112, 123, 0.48) !important;
    color: #ffffff !important;
  }
  .bib-native-btn:active {
    background: rgba(103, 112, 123, 0.2) !important;
  }
  .bib-native-btn.active {
    background: rgba(103, 112, 123, 0.45) !important;
    box-shadow: inset 0 0 0 1px rgba(102, 192, 244, 0.65) !important;
    color: #ffffff !important;
  }
  .bib-native-btn.active:hover {
    background: rgba(103, 112, 123, 0.62) !important;
  }
  .bib-native-btn-col {
    height: 28px;
    line-height: 28px !important;
  }
  .bib-native-btn-reset {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0 !important;
    margin: 0 !important;
    border-radius: 2px !important;
    border: none !important;
    background: rgba(103, 112, 123, 0.28) !important;
    color: #b8bcbf !important;
    font-size: 15px !important;
    cursor: pointer;
    flex-shrink: 0;
    transition: background-color 0.16s ease, color 0.16s ease !important;
  }
  .bib-native-btn-reset:hover {
    background: rgba(191, 64, 64, 0.55) !important;
    color: #ffffff !important;
  }
`;

function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0, opacity: 0.9 }}>
      <path d="M1.5 2h13a.5.5 0 0 1 .38.82L10 8.52v4.73a.5.5 0 0 1-.28.45l-3 1.5A.5.5 0 0 1 6 14.75V8.52L1.12 2.82A.5.5 0 0 1 1.5 2z" />
    </svg>
  );
}

export function RussianBucket({ appFilter, classes }: BucketProps) {
  const [tick, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [modalOpen, setModalOpen] = useState(false);
  const [rouletteOpen, setRouletteOpen] = useState(false);

  useEffect(() => {
    const unsubF = subscribeFilters((changedScope) => {
      if (changedScope === GLOBAL_SCOPE) {
        rerender();
      }
    });
    const unsubM = onMetaUpdate(() => {
      if (modalOpen || isScopeFilterActive(GLOBAL_SCOPE)) rerender();
    });
    const unsubS = subscribeSettings(() => rerender());
    return () => {
      unsubF();
      unsubM();
      unsubS();
    };
  }, [modalOpen]);

  const allApps = libraryApps();
  const active = isScopeFilterActive(GLOBAL_SCOPE);
  const rouletteEnabled = isModuleEnabled('library-roulette', true);

  const { cachedGames, matchedCount } = useMemo(() => {
    const list: any[] = [];
    let matched = 0;
    for (const app of allApps) {
      const meta = cachedMeta(app.appid);
      if (!meta) continue;
      list.push(meta);
      if (matchesGameMeta(GLOBAL_SCOPE, meta)) matched++;
    }
    return { cachedGames: list, matchedCount: matched };
  }, [allApps.length, active, modalOpen, tick]);

  return (
    <>
      <style>{BUCKET_BTN_STYLES}</style>
      <Focusable className={`${classes.FilterBucket} ruloc-bucket`} flow-children="column">
        <div className={classes.FilterBucketLabel}>Фильтрация</div>
        <div className={classes.FilterBucketBoxes} tabIndex={-1}>
          <Focusable className={classes.Row}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
              <button
                type="button"
                className={`DialogButton _DialogLayout Secondary bib-native-btn ${active ? 'active' : ''}`}
                title="Открыть фильтры Bibliotekarsha для всей библиотеки"
                onClick={() => {
                  requestAllLibraryMeta();
                  setModalOpen(true);
                }}
                style={{ flex: 1 }}
              >
                <FilterIcon />
                <span>BSH</span>
                {active && (
                  <span
                    style={{
                      backgroundColor: 'rgba(102, 192, 244, 0.22)',
                      color: '#b8e2fc',
                      borderRadius: '8px',
                      padding: '0 6px',
                      fontSize: '10px',
                      fontWeight: 700,
                      lineHeight: '16px',
                    }}
                  >
                    {matchedCount}/{allApps.length}
                  </span>
                )}
              </button>
              {active && (
                <button
                  type="button"
                  className="bib-native-btn-reset" style={{ height: '30px', width: '30px' }}
                  onClick={() => resetScopeFilters(GLOBAL_SCOPE)}
                  title="Сбросить фильтры"
                >
                  ×
                </button>
              )}
            </div>
          </Focusable>

          {rouletteEnabled && (
            <Focusable className={classes.Row}>
              <div style={{ width: '100%', marginTop: '8px' }}>
                <button
                  type="button"
                  className="DialogButton _DialogLayout Secondary bib-native-btn"
                  onClick={() => {
                    requestAllLibraryMeta();
                    setRouletteOpen(true);
                  }}
                  title="Открыть рулетку случайной игры по текущим фильтрам и коллекциям"
                  style={{ width: '100%' }}
                >
                  <span>🎲 Рулетка</span>
                </button>
              </div>
            </Focusable>
          )}
        </div>
      </Focusable>

      {modalOpen && (
        <SmartFilterModal
          scope={GLOBAL_SCOPE}
          scopeTitle="Вся библиотека"
          games={cachedGames}
          onClose={() => setModalOpen(false)}
        />
      )}

      {rouletteOpen && (
        <LibraryRouletteModal
          appFilter={appFilter}
          onClose={() => setRouletteOpen(false)}
        />
      )}
    </>
  );
}
