import React, { useEffect, useRef } from 'react';

interface AuthorModalProps {
  onClose: () => void;
}

const AUTHOR_STYLES = `
  .bib-auth-alias {
    background: rgba(102, 192, 244, 0.14);
    color: #66c0f4;
    border: 1px solid rgba(102, 192, 244, 0.3);
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 3px;
  }
  .bib-auth-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    background-color: #212b3b;
    border: 1px solid #36485e;
    color: #c6d4df;
    border-radius: 4px;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.14s ease;
  }
  .bib-auth-link:hover {
    background-color: #2a3f5a;
    border-color: #67c1f5;
    color: #ffffff;
    transform: translateY(-1px);
  }
  .bib-auth-inline-link {
    color: #ffffff;
    text-decoration: none;
    border-bottom: 1px dotted #67c1f5;
    font-weight: 600;
  }
  .bib-auth-inline-link:hover { color: #67c1f5; }
`;

export function AuthorModal({ onClose }: AuthorModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const targetWin = overlayRef.current?.ownerDocument?.defaultView || window;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    targetWin.addEventListener('keydown', onKey, true);
    return () => targetWin.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(8, 11, 16, 0.84)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000010,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <style>{AUTHOR_STYLES}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '620px',
          maxWidth: '92vw',
          maxHeight: '88vh',
          overflowY: 'auto',
          backgroundColor: '#1b2838',
          color: '#c6d4df',
          padding: '28px 32px',
          borderRadius: '8px',
          border: '1px solid #67c1f5',
          boxShadow: '0 14px 48px rgba(0, 0, 0, 0.9)',
          textAlign: 'center',
        }}
      >
        <div style={{ borderBottom: '1px solid #2a475e', paddingBottom: '16px', marginBottom: '20px' }}>
          <h2 style={{ color: '#ffffff', fontSize: '23px', margin: '0 0 12px 0' }}>0wn3df1x</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="bib-auth-alias">Egor</span>
            <span className="bib-auth-alias">Egarchik</span>
            <span className="bib-auth-alias">Egar Popor</span>
            <span className="bib-auth-alias">0wn3dg0d</span>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: '#67c1f5', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
            💼 Профессиональная деятельность
          </div>
          <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '14.5px' }}>
            Инженер по локализации, переводчик, редактор
          </div>
          <div style={{ color: '#8f98a0', fontSize: '12.5px', marginTop: '3px' }}>
            12 лет в индустрии, 400+ проектов
          </div>
          <div style={{ marginTop: '12px', fontSize: '13.5px' }}>
            ⚙️{' '}
            <a href="https://vk.com/tolma4team" target="_blank" rel="noreferrer" className="bib-auth-inline-link">
              Tolma4 Team
            </a>{' '}
            <span style={{ color: '#8f98a0' }}>(Техлид)</span> &nbsp;|&nbsp; 🛡️{' '}
            <a href="https://www.zoneofgames.ru" target="_blank" rel="noreferrer" className="bib-auth-inline-link">
              ZoneOfGames
            </a>{' '}
            <span style={{ color: '#8f98a0' }}>(Администрация)</span>
          </div>
          <div style={{ marginTop: '14px' }}>
            <a
              href="https://0wn3dg0d.github.io/egar-portfolio/"
              target="_blank"
              rel="noreferrer"
              className="bib-auth-link"
              style={{ borderColor: '#67c1f5', background: 'rgba(103, 193, 245, 0.12)' }}
            >
              🌐 Смотреть Портфолио
            </a>
          </div>
        </div>

        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #4b6f9c, transparent)', margin: '18px 0', opacity: 0.45 }} />

        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: '#67c1f5', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
            🎭 Творческие проекты
          </div>
          <div style={{ marginBottom: '6px', fontSize: '13.5px' }}>
            📼{' '}
            <a href="https://www.youtube.com/@CHIPaev13/" target="_blank" rel="noreferrer" className="bib-auth-inline-link">
              Ретро-канал CHIPaev'a
            </a>{' '}
            <span style={{ color: '#8f98a0' }}>(Превью, мемы, песни)</span>
          </div>
          <div style={{ fontSize: '13.5px' }}>
            🗃️{' '}
            <a href="https://t.me/EgarArchive" target="_blank" rel="noreferrer" className="bib-auth-inline-link">
              Архив Egar'а
            </a>{' '}
            <span style={{ color: '#8f98a0' }}>(Песни, стихи, код, тексты)</span>
          </div>
        </div>

        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #4b6f9c, transparent)', margin: '18px 0', opacity: 0.45 }} />

        <div>
          <div style={{ color: '#67c1f5', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
            📫 Связь и поддержка
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <a href="https://t.me/Egarchik" target="_blank" rel="noreferrer" className="bib-auth-link">
              ✈️ Telegram
            </a>
            <a href="https://steamcommunity.com/id/0wn3df1x/" target="_blank" rel="noreferrer" className="bib-auth-link">
              ⚙️ Steam
            </a>
          </div>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.22)',
              border: '1px solid #36485e',
              borderRadius: '6px',
              padding: '12px 16px',
              margin: '0 auto',
              maxWidth: '360px',
            }}
          >
            <div style={{ color: '#ffffff', fontWeight: 700, marginBottom: '10px', fontSize: '13.5px' }}>
              Поддержать работу (TON / USDT)
            </div>
            <a
              href="https://tonviewer.com/egarchik.ton"
              target="_blank"
              rel="noreferrer"
              className="bib-auth-link"
              style={{ background: 'rgba(0, 136, 204, 0.2)', borderColor: '#0088cc', color: '#67c1f5' }}
            >
              💎 Отправить через TON
            </a>
            <div style={{ marginTop: '8px' }}>
              <code style={{ background: '#111822', color: '#a5d3f2', padding: '4px 10px', borderRadius: '4px', fontSize: '13px' }}>
                egarchik.ton
              </code>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="bib-bsh-btn"
          style={{ marginTop: '22px', padding: '8px 28px', fontWeight: 700 }}
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
