import { LibraryGameNotesModal, hasSharedGameNote } from './LibraryGameNotesModal';
import React, { useEffect, useRef, useState } from 'react';
import { getRegisteredNfoSections, subscribeNfoSections } from '../core/nfo-registry';
import { getGameNames } from '../services/net';

interface GameNfoModalProps {
  appId: number;
  onClose: () => void;
}

const LIB_NFO_STYLES = `
  .bib-nfo-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .bib-nfo-scroll::-webkit-scrollbar-track {
    background: #10161f;
    border-radius: 3px;
  }
  .bib-nfo-scroll::-webkit-scrollbar-thumb {
    background: #2f435a;
    border-radius: 3px;
  }
  .bib-nfo-scroll::-webkit-scrollbar-thumb:hover {
    background: #4b6f9c;
  }
  .bib-nfo-card {
    background-color: #11161d;
    border: 1px solid #242e3b;
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    min-height: 280px;
    max-height: 430px;
    overflow: hidden;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .bib-nfo-card:hover {
    border-color: rgba(102, 192, 244, 0.42);
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
  }
  .bib-nfo-item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background-color: #161d26;
    border: 1px solid #263241;
    border-radius: 4px;
    color: #e2e8f0;
    text-decoration: none;
    transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.14s ease;
  }
  .bib-nfo-item-row:hover {
    background-color: rgba(102, 192, 244, 0.13);
    border-color: #66c0f4;
    color: #ffffff;
    transform: translateX(2px);
  }
  .bib-nfo-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background-color: #161d26;
    border: 1px solid #263241;
    border-radius: 4px;
    transition: background-color 0.16s ease, border-color 0.16s ease;
  }
  .bib-nfo-stat-row:hover {
    background-color: rgba(102, 192, 244, 0.08);
    border-color: rgba(102, 192, 244, 0.35);
  }
  .bib-nfo-link {
    color: #66c0f4;
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .bib-nfo-link:hover {
    color: #9be0ff;
    text-decoration: underline;
  }
  .bib-nfo-pill-btn {
    background: #1f2937;
    border: 1px solid #354457;
    color: #c6d4df;
    padding: 3px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    flex-shrink: 0;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .bib-nfo-pill-btn:hover {
    background: rgba(102, 192, 244, 0.22);
    border-color: #66c0f4;
    color: #ffffff;
  }
  .bib-nfo-close-icon {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #8f98a0;
    font-size: 22px;
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    line-height: 1;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }
  .bib-nfo-close-icon:hover {
    background: rgba(102, 192, 244, 0.15);
    border-color: rgba(102, 192, 244, 0.4);
    color: #ffffff;
  }
  .bib-nfo-primary-btn {
    background: linear-gradient(to right, #47bfff 0%, #1a44c2 100%);
    border: none;
    color: #fff;
    font-weight: 600;
    padding: 7px 22px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    transition: filter 0.16s ease, transform 0.12s ease;
  }
  .bib-nfo-primary-btn:hover {
    filter: brightness(1.14);
  }
  .bib-nfo-primary-btn:active {
    transform: translateY(1px);
  }
`;

export function GameNfoModal({ appId, onClose }: GameNfoModalProps) {
  const [sections, setSections] = useState(getRegisteredNfoSections);
  const [gameTitle, setGameTitle] = useState<string>(`App #${appId}`);
  const [notesOpen, setNotesOpen] = useState(false);
  const [hasNote, setHasNote] = useState(false);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const doc =
      anchorRef.current?.ownerDocument ||
      window.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0')?.m_popup?.document ||
      document;
    setPortalTarget(doc.body);
  }, []);

  useEffect(() => {
    getGameNames(appId).then((names) => {
      setGameTitle(names.localName || names.englishName || `App #${appId}`);
    });
    hasSharedGameNote(appId).then(setHasNote);
    return subscribeNfoSections(() => {
      setSections(getRegisteredNfoSections());
    });
  }, [appId]);

  useEffect(() => {
    const targetWin = portalTarget?.ownerDocument?.defaultView || window;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    targetWin.addEventListener('keydown', onKey);
    return () => targetWin.removeEventListener('keydown', onKey);
  }, [onClose, portalTarget]);

  const reactDom = (window as any).SP_REACTDOM;
  const modalNode = (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 14, 20, 0.84)',
        backdropFilter: 'blur(4px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: '"Motiva Sans", Arial, sans-serif',
      }}
    >
      <style>{LIB_NFO_STYLES}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: sections.length >= 4 ? '1080px' : sections.length >= 2 ? '1040px' : '680px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          backgroundColor: '#171d25',
          border: '1px solid #2d3846',
          borderRadius: '6px',
          boxShadow: '0 18px 54px rgba(0,0,0,0.8)',
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
            padding: '14px 22px',
            backgroundColor: '#10151c',
            borderBottom: '1px solid #26303d',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'rgba(102, 192, 244, 0.18)',
                border: '1px solid #66c0f4',
                color: '#66c0f4',
                fontWeight: 700,
                fontSize: '13px',
                fontStyle: 'italic',
                fontFamily: 'Georgia, serif',
              }}
            >
              i
            </span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#66c0f4' }}>NFO — Сводка об игре</span>
            <span
              style={{
                fontSize: '13px',
                backgroundColor: 'rgba(102, 192, 244, 0.14)',
                color: '#e5f2fc',
                padding: '3px 10px',
                borderRadius: '3px',
                fontWeight: 600,
              }}
            >
              {gameTitle}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="bib-nfo-pill-btn"
              title="Открыть личные заметки и оценки для этой игры"
              style={{
                padding: '5px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                borderColor: hasNote ? '#a3cf06' : '#354457',
                color: hasNote ? '#c5f030' : '#d6e2ed',
                background: hasNote ? 'rgba(163, 207, 6, 0.16)' : '#1f2937',
              }}
            >
              ✎ {hasNote ? 'Заметка' : 'Заметки'}
            </button>
            <button type="button" onClick={onClose} className="bib-nfo-close-icon" title="Закрыть">
              ×
            </button>
          </div>
        </div>

        <div
          className="bib-nfo-scroll"
          style={{
            padding: '18px 22px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns:
              sections.length === 4
                ? 'repeat(2, minmax(0, 1fr))'
                : sections.length >= 2
                ? 'repeat(auto-fit, minmax(300px, 1fr))'
                : '1fr',
            gap: '16px',
            alignItems: 'stretch',
          }}
        >
          {sections.length === 0 ? (
            <div style={{ color: '#8f98a0', fontSize: '13px' }}>
              Все NFO-модули отключены. Включите их в настройках Bibliotekarsha → Модули.
            </div>
          ) : (
            sections.map((sec) => (
              <div key={sec.id} className="bib-nfo-card">
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#141b24',
                    borderBottom: '1px solid #242e3b',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#66c0f4', textTransform: 'uppercase' }}>
                    {sec.title}
                  </span>
                  {sec.subtitle && <span style={{ fontSize: '11px', color: '#8f98a0' }}>{sec.subtitle}</span>}
                </div>

                <div
                  className="bib-nfo-scroll"
                  style={{
                    padding: '12px 14px',
                    overflowY: 'auto',
                    flex: 1,
                    fontSize: '13px',
                    lineHeight: 1.5,
                  }}
                >
                  {sec.render(appId)}
                </div>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: '11px 22px',
            backgroundColor: '#10151c',
            borderTop: '1px solid #26303d',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}
        >
          <button type="button" onClick={onClose} className="bib-nfo-primary-btn">
            Закрыть
          </button>
        </div>
      </div>
      {notesOpen && (
        <LibraryGameNotesModal
          appId={appId}
          gameTitle={gameTitle}
          onClose={() => {
            setNotesOpen(false);
            hasSharedGameNote(appId).then(setHasNote);
          }}
        />
      )}
    </div>
  );

  return (
    <>
      <span ref={anchorRef} style={{ display: 'none' }} />
      {portalTarget && reactDom?.createPortal ? reactDom.createPortal(modalNode, portalTarget) : modalNode}
    </>
  );
}
