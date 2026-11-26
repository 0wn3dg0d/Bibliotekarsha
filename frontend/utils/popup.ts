import { ReactNode } from 'react';
import { showModal } from 'millennium';

export interface NativePopupHandle {
  close: () => void;
  update: (node: ReactNode) => void;
}

export function openSteamNativePopup(options: {
  title: string;
  width: number;
  height: number;
  render: (close: () => void) => ReactNode;
  onClosed?: () => void;
}): NativePopupHandle | null {
  try {
    const parentWin: Window =
      (window as any).g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0')?.m_popup || window;

    let closed = false;
    let handle: ReturnType<typeof showModal> | null = null;

    const close = () => {
      if (closed) return;
      closed = true;
      try {
        handle?.Close();
      } catch {}
      options.onClosed?.();
    };

    handle = showModal(options.render(close), parentWin, {
      strTitle: options.title,
      popupWidth: options.width,
      popupHeight: options.height,
      bForcePopOut: true,
      fnOnClose: () => {
        if (!closed) {
          closed = true;
          options.onClosed?.();
        }
      },
    });

    if (!handle) return null;

    return {
      close,
      update: (node: ReactNode) => {
        try {
          handle?.Update(node);
        } catch {}
      },
    };
  } catch (err) {
    console.warn('[Bibliotekarsha] showModal fallback:', err);
    return null;
  }
}
