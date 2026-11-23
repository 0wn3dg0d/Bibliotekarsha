import { useEffect, useState } from 'react';
import { TIER_INFO, formatLocDetail } from '../../../config/tiers';
import { cachedMeta, onMetaUpdate, requestMeta } from '../../../stores/localization';

export type StatClasses = Record<string, string>;

export function RussianStat({ appId, classes }: { appId: number; classes: StatClasses }) {
  const [meta, setMeta] = useState(() => cachedMeta(appId));

  useEffect(() => {
    setMeta(cachedMeta(appId));
    requestMeta(appId);
    return onMetaUpdate((updatedId, data) => {
      if (updatedId === appId) setMeta(data);
    });
  }, [appId]);

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
