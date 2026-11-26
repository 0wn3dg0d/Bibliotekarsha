import React, { useEffect, useRef, useState } from 'react';
import { BshSettingsModal } from '../../components/BshSettingsModal';
import { BibliotekarshaModule } from '../../core/types';
import { ReactRoot, mountReact } from '../../lib/steam';
import { syncIncognitoToPluginConfig } from '../../stores/incognito';
import { observeThrottled } from '../../utils/dom';
import { NativePopupHandle, openSteamNativePopup } from '../../utils/popup';

function BshTitleBarButton() {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const popupRef = useRef<NativePopupHandle | null>(null);

  useEffect(() => {
    syncIncognitoToPluginConfig();
    return () => {
      popupRef.current?.close();
    };
  }, []);

  const handleToggle = () => {
    if (popupRef.current) {
      popupRef.current.close();
      popupRef.current = null;
      rerender();
      return;
    }
    if (fallbackOpen) {
      setFallbackOpen(false);
      return;
    }

    const handle = openSteamNativePopup({
      title: 'Bibliotekarsha — Настройки BSH',
      width: 1080,
      height: 900,
      render: (close) => <BshSettingsModal onClose={close} isNativePopup />,
      onClosed: () => {
        popupRef.current = null;
        rerender();
      },
    });

    if (handle) {
      popupRef.current = handle;
      rerender();
    } else {
      setFallbackOpen(true);
    }
  };

  const isOpen = Boolean(popupRef.current) || fallbackOpen;
  const bgColor = isOpen
    ? 'rgba(103, 112, 123, 0.42)'
    : hovered
    ? 'rgba(103, 112, 123, 0.32)'
    : 'rgba(103, 112, 123, 0.2)';
  const textColor = isOpen || hovered ? '#ffffff' : 'rgb(139, 146, 154)';

  return (
    <>
      <div
        onClick={handleToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Настройки Bibliotekarsha (BSH): управление модулями и режимом Инкогнито"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          height: '24px',
          padding: '0 8px',
          marginRight: '6px',
          borderRadius: '2px',
          backgroundColor: bgColor,
          color: textColor,
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: '"Motiva Sans", Arial, sans-serif',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.15s ease, color 0.15s ease',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
          <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
        </svg>
        <span>BSH</span>
      </div>
      {fallbackOpen && <BshSettingsModal onClose={() => setFallbackOpen(false)} />}
    </>
  );
}

const HOST_ATTR = 'data-bibliotekarsha-bsh-btn';

function initBshSettingsModule(doc: Document): () => void {
  let mountedHost: HTMLElement | null = null;
  let mountedRoot: ReactRoot | null = null;

  const mount = () => {
    const titleBar = doc.querySelector('.TitleBarControls');
    if (!titleBar) return;
    if (titleBar.querySelector(`[${HOST_ATTR}]`)) return;

    const host = doc.createElement('div');
    host.setAttribute(HOST_ATTR, '1');
    host.style.display = 'inline-flex';
    host.style.alignItems = 'center';
    (host.style as any).WebkitAppRegion = 'no-drag';

    titleBar.insertBefore(host, titleBar.firstChild);
    mountedHost = host;
    mountedRoot = mountReact(host, <BshTitleBarButton />);
  };

  const stopObserver = observeThrottled(doc, mount, 300);

  return () => {
    stopObserver();
    if (mountedRoot) {
      mountedRoot.unmount();
      mountedRoot = null;
    }
    if (mountedHost) {
      mountedHost.remove();
      mountedHost = null;
    }
  };
}

export const bshSettingsModule: BibliotekarshaModule = {
  id: 'bsh-settings',
  name: 'Панель настроек BSH в верхней панели',
  description: 'Кнопка ⚙ BSH в заголовке Steam для управления модулями плагина и режимом Инкогнито.',
  defaultEnabled: true,
  mountDocument: initBshSettingsModule,
};
