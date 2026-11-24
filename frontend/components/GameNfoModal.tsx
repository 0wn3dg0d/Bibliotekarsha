import React, { useEffect, useRef, useState } from 'react';
import { getRegisteredNfoSections, subscribeNfoSections } from '../core/nfo-registry';
import { getGameNames } from '../services/net';

interface GameNfoModalProps {
  appId: number;
  onClose: () => void;
}

export function GameNfoModal({ appId, onClose }: GameNfoModalProps) {
  const [sections, setSections] = useState(getRegisteredNfoSections);
  const [gameTitle, setGameTitle] = useState<string>(`App #${appId}`);
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
      onClick={onClose}
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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '680px',
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

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8f98a0',
              fontSize: '24px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '18px 22px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: sections.length >= 2 ? 'repeat(auto-fit, minmax(300px, 1fr))' : '1fr',
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
              <div
                key={sec.id}
                style={{
                  backgroundColor: '#11161d',
                  border: '1px solid #242e3b',
                  borderRadius: '5px',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '320px',
                  maxHeight: '440px',
                  overflow: 'hidden',
                }}
              >
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
          }}
        >
          <button
            type="button"
            onClick={onClose}
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
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <span ref={anchorRef} style={{ display: 'none' }} />
      {portalTarget && reactDom?.createPortal ? reactDom.createPortal(modalNode, portalTarget) : modalNode}
    </>
  );
}
