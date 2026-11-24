import { useState } from 'react';
import { GameNfoModal } from '../../components/GameNfoModal';
import { registerGamePageWidget } from '../../core/game-page-registry';
import { BibliotekarshaModule } from '../../core/types';
import { useGameStatClasses } from '../game-page-slot';

function GameNfoButtonWidget({ appId }: { appId: number }) {
  const [open, setOpen] = useState(false);
  const classes = useGameStatClasses();

  if (!classes) return null;

  return (
    <>
      <div className={classes.GameStat} style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Открыть NFO — поиск русификаторов на Zone of Games"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: 'rgba(102, 192, 244, 0.16)',
            border: '1px solid rgba(102, 192, 244, 0.55)',
            color: '#66c0f4',
            fontWeight: 700,
            fontSize: '16px',
            fontStyle: 'italic',
            fontFamily: 'Georgia, serif',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(102, 192, 244, 0.3)';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(102, 192, 244, 0.16)';
            e.currentTarget.style.color = '#66c0f4';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          i
        </button>
      </div>
      {open && <GameNfoModal appId={appId} onClose={() => setOpen(false)} />}
    </>
  );
}

export const gameNfoButtonModule: BibliotekarshaModule = {
  id: 'game-nfo-button',
  name: 'Кнопка NFO (i) на странице игры',
  description: 'Добавляет круглую кнопку i рядом с кнопкой Играть для открытия сводки и поиска русификаторов ZOG.',
  defaultEnabled: true,
  mountGlobal: () =>
    registerGamePageWidget({
      id: 'game-nfo-btn',
      order: 5,
      render: (appId: number) => <GameNfoButtonWidget appId={appId} />,
    }),
};
