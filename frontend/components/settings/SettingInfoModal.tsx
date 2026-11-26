import React, { useEffect, useRef, useState } from 'react';
import { SettingItemDef, SettingScreenshot, getScreenshotUrls } from '../../config/settingsCatalog';
import { NativePopupHandle, openSteamNativePopup } from '../../utils/popup';

interface SettingInfoModalProps {
  item: SettingItemDef;
  onClose: () => void;
}

const INFO_STYLES = `
  .bib-info-body p { margin: 0 0 10px 0; line-height: 1.55; color: #c6d4df; }
  .bib-info-body ul, .bib-info-body ol { margin: 6px 0 12px 20px; padding: 0; line-height: 1.55; }
  .bib-info-body li { margin-bottom: 5px; }
  .bib-info-body strong { color: #67c1f5; }
  .bib-info-body code { background: #10161e; color: #9cd4fa; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
  .bib-info-shot {
    background: #10151c;
    border: 1px solid #2b3848;
    border-radius: 5px;
    overflow: hidden;
    transition: border-color 0.16s ease, transform 0.16s ease;
  }
  .bib-info-shot.zoomable { cursor: zoom-in; }
  .bib-info-shot.zoomable:hover {
    border-color: #66c0f4;
    transform: translateY(-2px);
  }
`;

function FullscreenShotView({
  caption,
  src,
  onClose,
}: {
  caption: string;
  src: string;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const targetWin = rootRef.current?.ownerDocument?.defaultView || window;
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
      ref={rootRef}
      onClick={onClose}
      style={{
        width: '100%',
        height: '100%',
        paddingTop: '42px',
        boxSizing: 'border-box',
        backgroundColor: '#090d12',
        display: 'flex',
        flexDirection: 'column',
        color: '#e5eef5',
        fontFamily: '"Motiva Sans", Arial, sans-serif',
        cursor: 'zoom-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: '10px 18px',
          backgroundColor: '#10151c',
          borderTop: '1px solid #26303d',
          borderBottom: '1px solid #26303d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          cursor: 'default',
          ...({ WebkitAppRegion: 'no-drag' } as any),
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#66c0f4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {caption}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            style={{
              background: 'rgba(103, 193, 245, 0.14)',
              border: '1px solid rgba(103, 193, 245, 0.35)',
              color: '#d6e2ed',
              padding: '5px 11px',
              borderRadius: '3px',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Открыть оригинал ↗
          </a>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid #384658',
              color: '#e5eef5',
              padding: '5px 12px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Закрыть
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '18px',
          overflow: 'auto',
        }}
      >
        <img
          src={src}
          alt={caption}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '4px',
            border: '1px solid #2b3848',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.85)',
          }}
        />
      </div>
    </div>
  );
}

export function SettingInfoModal({ item, onClose }: SettingInfoModalProps) {
  const [urlIndexMap, setUrlIndexMap] = useState<Record<string, number>>({});
  const [fallbackZoom, setFallbackZoom] = useState<{ src: string; caption: string } | null>(null);
  const zoomPopupRef = useRef<NativePopupHandle | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUrlIndexMap({});
  }, [item]);

  useEffect(() => {
    const targetWin = overlayRef.current?.ownerDocument?.defaultView || window;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (zoomPopupRef.current) {
        zoomPopupRef.current.close();
        zoomPopupRef.current = null;
      } else if (fallbackZoom) {
        setFallbackZoom(null);
      } else {
        onClose();
      }
    };
    targetWin.addEventListener('keydown', onKey, true);
    return () => {
      targetWin.removeEventListener('keydown', onKey, true);
      zoomPopupRef.current?.close();
    };
  }, [fallbackZoom, onClose]);

  const openZoomedShot = (shot: SettingScreenshot, activeSrc: string) => {
    zoomPopupRef.current?.close();
    const availW = window.screen?.availWidth || 1600;
    const availH = window.screen?.availHeight || 960;
    const width = Math.max(960, Math.min(1500, availW - 80));
    const height = Math.max(640, Math.min(940, availH - 80));

    const handle = openSteamNativePopup({
      title: `Bibliotekarsha — ${shot.caption}`,
      width,
      height,
      render: (closePopup) => (
        <FullscreenShotView caption={shot.caption} src={activeSrc} onClose={closePopup} />
      ),
      onClosed: () => {
        zoomPopupRef.current = null;
      },
    });

    if (handle) {
      zoomPopupRef.current = handle;
    } else {
      setFallbackZoom({ src: activeSrc, caption: shot.caption });
    }
  };

  const mainSteamBody = window.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0')?.m_popup?.document?.body;
  const reactDom = window.SP_REACTDOM;

  const fallbackLightboxNode = fallbackZoom ? (
    <div
      onClick={() => setFallbackZoom(null)}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(4, 6, 10, 0.94)',
        zIndex: 1000050,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        cursor: 'zoom-out',
      }}
    >
      <img
        src={fallbackZoom.src}
        alt={fallbackZoom.caption}
        style={{
          maxWidth: '94vw',
          maxHeight: '84vh',
          objectFit: 'contain',
          borderRadius: '4px',
          border: '1px solid #4b6582',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.9)',
        }}
      />
      <div style={{ marginTop: '12px', color: '#c6d4df', fontSize: '13px' }}>
        {fallbackZoom.caption} <span style={{ color: '#8f98a0' }}>(щелчок или Esc — закрыть)</span>
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={overlayRef}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(8, 11, 16, 0.82)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000010,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <style>{INFO_STYLES}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '760px',
          maxWidth: '94vw',
          maxHeight: '86vh',
          backgroundColor: '#1b2430',
          border: '1px solid #4b6582',
          borderRadius: '6px',
          boxShadow: '0 14px 45px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          color: '#c6d4df',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '13px 18px',
            backgroundColor: '#121821',
            borderBottom: '1px solid #263241',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#67c1f5' }}>{item.title}</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8f98a0',
              fontSize: '24px',
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, fontSize: '13.5px' }}>
          <div className="bib-info-body" dangerouslySetInnerHTML={{ __html: item.detailsHtml }} />

          {item.warning && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                backgroundColor: 'rgba(255, 179, 0, 0.1)',
                border: '1px solid rgba(255, 179, 0, 0.4)',
                borderRadius: '4px',
                fontSize: '13px',
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 700, color: '#ffb300', marginBottom: '4px' }}>⚠️ Важно</div>
              <div>{item.warning}</div>
            </div>
          )}

          {item.screenshots && item.screenshots.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', color: '#8f98a0', marginBottom: '8px' }}>
                Скриншоты (нажмите на изображение, чтобы открыть его в большом окне):
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: item.screenshots.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '12px',
                }}
              >
                {item.screenshots.map((shot) => {
                  const urls = getScreenshotUrls(shot.url);
                  const idx = urlIndexMap[shot.url] ?? 0;
                  const activeSrc = urls[idx];
                  const shortName = shot.url.split('/').pop() || shot.url;

                  return (
                    <div
                      key={shot.url}
                      className={`bib-info-shot ${activeSrc ? 'zoomable' : ''}`}
                      onClick={() => {
                        if (activeSrc) openZoomedShot(shot, activeSrc);
                      }}
                    >
                      {activeSrc ? (
                        <img
                          src={activeSrc}
                          alt={shot.caption}
                          loading="lazy"
                          onError={() =>
                            setUrlIndexMap((prev) => ({
                              ...prev,
                              [shot.url]: (prev[shot.url] ?? 0) + 1,
                            }))
                          }
                          style={{
                            width: '100%',
                            maxHeight: item.screenshots!.length === 1 ? '300px' : '155px',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div
                          title={`Ожидаемый файл в репозитории: ${shot.url}`}
                          style={{
                            height: '112px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px',
                            textAlign: 'center',
                            color: '#6e7e91',
                            fontSize: '12px',
                            borderBottom: '1px solid #222c38',
                          }}
                        >
                          <span style={{ fontSize: '20px', marginBottom: '4px' }}>🖼️</span>
                          <span>Скриншот ещё не загружен в репозиторий</span>
                          <span style={{ fontSize: '10.5px', color: '#8fa4b8', marginTop: '3px', fontFamily: 'monospace' }}>
                            {shortName}
                          </span>
                        </div>
                      )}
                      <div style={{ padding: '7px 10px', fontSize: '12px', color: '#9eb1c2' }}>{shot.caption}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '10px 18px',
            backgroundColor: '#121821',
            borderTop: '1px solid #263241',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" onClick={onClose} className="bib-bsh-btn">
            Закрыть
          </button>
        </div>
      </div>

      {fallbackLightboxNode &&
        (mainSteamBody && reactDom?.createPortal
          ? reactDom.createPortal(fallbackLightboxNode, mainSteamBody)
          : fallbackLightboxNode)}
    </div>
  );
}
