import { subscribeAccountChange } from '../../services/accountContext';
import React, { useEffect, useRef, useState } from 'react';
import { WatcherModal } from '../../components/WatcherModal';
import { BibliotekarshaModule } from '../../core/types';
import { ReactRoot, mountReact } from '../../lib/steam';
import {
  ensureWatcherLoaded,
  getWatcherState,
  runWatcherUpdate,
  subscribeWatcher,
} from '../../stores/watcher';
import { observeThrottled } from '../../utils/dom';
import { NativePopupHandle, openSteamNativePopup } from '../../utils/popup';

function formatFreshness(lastTs: number, prefix: string): { text: string; bg: string; color: string; title: string } {
  if (!lastTs) {
    return {
      text: `${prefix}:??`,
      bg: 'rgba(103, 112, 123, 0.22)',
      color: 'rgb(139, 146, 154)',
      title: 'Данные ни разу не обновлялись',
    };
  }
  const hours = (Date.now() - lastTs) / (60 * 60 * 1000);
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  const title = `Обновлено ${d} д. ${h} ч. назад`;
  if (hours < 12) {
    return { text: `${prefix}:OK`, bg: 'rgba(103, 112, 123, 0.25)', color: '#b8bcbf', title };
  }
  if (hours < 24) {
    return { text: `${prefix}:OK?`, bg: 'rgba(103, 112, 123, 0.25)', color: '#d4e157', title };
  }
  if (hours < 48) {
    return { text: `${prefix}:!`, bg: 'rgba(191, 166, 90, 0.25)', color: '#ffd700', title };
  }
  return { text: `${prefix}:!!`, bg: 'rgba(191, 64, 64, 0.3)', color: '#ffb3b3', title };
}

function WatcherTitleBarButton() {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const popupRef = useRef<NativePopupHandle | null>(null);

  useEffect(() => {
    ensureWatcherLoaded();
    const unsub = subscribeWatcher(rerender);
    return () => {
      unsub();
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
      title: 'Bibliotekarsha — Наблюдатель',
      width: 1200,
      height: 800,
      render: (close) => <WatcherModal onClose={close} isNativePopup />,
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

  const st = getWatcherState();
  const unreadCount = st.notifications.filter((n) => !n.read).length;
  const wBadge = formatFreshness(st.lastUpdateWishlist, 'Ж');
  const lBadge = formatFreshness(st.lastUpdateLibrary, 'Б');
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
        title={
          st.updating
            ? `Идёт сбор данных: ${st.progress}% (${st.statusText})`
            : 'Наблюдатель: отслеживание изменений в списке желаемого и библиотеке'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '24px',
          padding: '0 8px',
          marginRight: '6px',
          borderRadius: '2px',
          backgroundColor: bgColor,
          color: textColor,
          fontSize: '12px',
          fontFamily: '"Motiva Sans", Arial, sans-serif',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.15s ease, color 0.15s ease',
        }}
      >
        <span style={{ fontWeight: 500 }}>Наблюдатель</span>
        {st.updating && (
          <span
            style={{
              backgroundColor: 'rgba(26, 159, 255, 0.25)',
              border: '1px solid rgba(102, 192, 244, 0.5)',
              color: '#66c0f4',
              padding: '0px 5px',
              borderRadius: '2px',
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            {st.progress}%
          </span>
        )}
        <span
          title={wBadge.title}
          style={{
            backgroundColor: wBadge.bg,
            color: wBadge.color,
            padding: '1px 4px',
            borderRadius: '2px',
            fontSize: '10px',
            fontWeight: 700,
          }}
        >
          {wBadge.text}
        </span>
        <span
          title={lBadge.title}
          style={{
            backgroundColor: lBadge.bg,
            color: lBadge.color,
            padding: '1px 4px',
            borderRadius: '2px',
            fontSize: '10px',
            fontWeight: 700,
          }}
        >
          {lBadge.text}
        </span>
        <span
          style={{
            backgroundColor: unreadCount > 0 ? '#1a9fff' : 'rgba(103, 112, 123, 0.28)',
            color: unreadCount > 0 ? '#ffffff' : 'rgb(139, 146, 154)',
            padding: '1px 5px',
            borderRadius: '2px',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          {unreadCount}
        </span>
      </div>
      {fallbackOpen && <WatcherModal onClose={() => setFallbackOpen(false)} />}
    </>
  );
}

const HOST_ATTR = 'data-bibliotekarsha-watcher';

function initWatcherModule(doc: Document): () => void {
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
    mountedRoot = mountReact(host, <WatcherTitleBarButton />);
  };

  const stopObserver = observeThrottled(doc, mount, 350);

  const checkAutoUpdateForCurrentAccount = () => {
    ensureWatcherLoaded().then(() => {
      const st = getWatcherState();
      if (!st.accountId || st.accountId === 'default' || st.updating) return;

      const isInitialEmpty =
        (st.settings.wishlist && st.lastUpdateWishlist === 0) ||
        (st.settings.library && st.lastUpdateLibrary === 0);

      if (isInitialEmpty) {
        setTimeout(() => runWatcherUpdate(), 3000);
        return;
      }

      if (st.settings.autoUpdate && (st.settings.wishlist || st.settings.library)) {
        const intervalMs = (Number(st.settings.autoUpdateIntervalHours) || 24) * 60 * 60 * 1000;
        const now = Date.now();
        const needW = st.settings.wishlist && now - st.lastUpdateWishlist >= intervalMs;
        const needL = st.settings.library && now - st.lastUpdateLibrary >= intervalMs;
        if (needW || needL) {
          setTimeout(() => runWatcherUpdate(), 5000);
        }
      }
    });
  };

  checkAutoUpdateForCurrentAccount();
  const unsubAcc = subscribeAccountChange((acc, prevId) => {
    if (acc.steamId64 && acc.steamId64 !== prevId) {
      setTimeout(checkAutoUpdateForCurrentAccount, 1500);
    }
  });

  return () => {
    unsubAcc();
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

export const watcherModule: BibliotekarshaModule = {
  id: 'watcher',
  name: 'Наблюдатель (уведомления и календарь релизов)',
  description: 'Отслеживает изменения дат выхода, русской локализации, раннего доступа, демо и снятия игр в списке желаемого и библиотеке.',
  defaultEnabled: true,
  mountDocument: initWatcherModule,
};
