import { useEffect, useState } from 'react';
import { TIER_INFO, formatLocDetail } from '../../config/tiers';
import { registerGamePageWidget } from '../../core/game-page-registry';
import { BibliotekarshaModule } from '../../core/types';
import { cachedMeta, onMetaUpdate, requestMeta } from '../../stores/localization';
import { useGameStatClasses } from '../game-page-slot';

function RussianLocWidget({ appId }: { appId: number }) {
  const [meta, setMeta] = useState(() => cachedMeta(appId));
  const classes = useGameStatClasses();

  useEffect(() => {
    setMeta(cachedMeta(appId));
    requestMeta(appId);
    return onMetaUpdate((updatedId, data) => {
      if (updatedId === appId) setMeta(data);
    });
  }, [appId]);

  if (!classes) return null;
  const color = meta ? TIER_INFO[meta.tier].color : '#8b949e';

  return (
    <div className={classes.GameStat}>
      <div className={classes.GameStatIcon} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: color,
            display: 'inline-block',
          }}
        />
      </div>
      <div className={classes.GameStatRight}>
        <div className={classes.PlayBarLabel}>Русский язык</div>
        <div className={classes.PlayBarDetailLabel} style={{ color }}>
          {formatLocDetail(meta)}
        </div>
      </div>
    </div>
  );
}

export const gameLocBadgeModule: BibliotekarshaModule = {
  id: 'game-loc-badge',
  name: 'Индикатор русского языка на странице игры',
  description: 'Отображает статус русской озвучки, субтитров и интерфейса рядом с кнопкой Играть.',
  defaultEnabled: true,
  mountGlobal: () =>
    registerGamePageWidget({
      id: 'russian-loc',
      order: 10,
      render: (appId: number) => <RussianLocWidget appId={appId} />,
    }),
};
