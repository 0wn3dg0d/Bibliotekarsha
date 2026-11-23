import React, { useEffect, useMemo, useState } from 'react';
import { Focusable } from 'millennium';
import { AppFilter, libraryApps } from '../../../lib/steam';
import { isScopeFilterActive, matchesGameMeta, resetScopeFilters, subscribeFilters } from '../../../stores/filters';
import { cachedMeta, onMetaUpdate, requestAllLibraryMeta } from '../../../stores/localization';
import { SmartFilterModal } from '../../../components/SmartFilterModal';
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

export function RussianBucket({ fnOnChange, classes }: BucketProps) {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const unsubF = subscribeFilters((changedScope) => {
      if (changedScope === GLOBAL_SCOPE) {
        fnOnChange?.();
        rerender();
      }
    });
    const unsubM = onMetaUpdate(() => {
      if (modalOpen) rerender();
    });
    return () => {
      unsubF();
      unsubM();
    };
  }, [fnOnChange, modalOpen]);

  const allApps = libraryApps();
  const active = isScopeFilterActive(GLOBAL_SCOPE);

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
  }, [allApps.length, active, modalOpen]);

  return (
    <>
      <Focusable className={`${classes.FilterBucket} ruloc-bucket`} flow-children="column">
        <div className={classes.FilterBucketLabel}>Фильтрация</div>
        <div className={classes.FilterBucketBoxes} tabIndex={-1}>
          <Focusable className={classes.Row}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
              <button
                type="button"
                onClick={() => {
                  requestAllLibraryMeta();
                  setModalOpen(true);
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: '3px',
                  border: active ? '1px solid #66c0f4' : '1px solid rgba(255,255,255,0.16)',
                  backgroundColor: active ? 'rgba(102, 192, 244, 0.2)' : 'rgba(255,255,255,0.07)',
                  color: active ? '#ffffff' : '#dfe3e6',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <span>Bibliotekarsha</span>
                {active && (
                  <span
                    style={{
                      backgroundColor: '#66c0f4',
                      color: '#0e141b',
                      borderRadius: '8px',
                      padding: '0 6px',
                      fontSize: '10px',
                      fontWeight: 700,
                    }}
                  >
                    {matchedCount}/{allApps.length}
                  </span>
                )}
              </button>
              {active && (
                <button
                  type="button"
                  onClick={() => resetScopeFilters(GLOBAL_SCOPE)}
                  title="Сбросить фильтры"
                  style={{
                    padding: '5px 8px',
                    borderRadius: '3px',
                    border: '1px solid rgba(255,255,255,0.16)',
                    backgroundColor: 'rgba(167, 67, 67, 0.35)',
                    color: '#ff9b9b',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </Focusable>
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
    </>
  );
}
