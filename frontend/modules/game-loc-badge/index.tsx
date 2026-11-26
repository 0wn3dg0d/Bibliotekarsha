import { useEffect, useState } from 'react';
import { TIER_INFO, formatLocDetail } from '../../config/tiers';
import { BibliotekarshaModule } from '../../core/types';
import {
  ReactRoot,
  classModuleFinder,
  getLibraryPath,
  libraryAppIdFromPath,
  mountReact,
} from '../../lib/steam';
import {
  LibraryEarlyAccessInfo,
  getLibraryEarlyAccessInfo,
} from '../../services/libraryEarlyAccessService';
import { cachedMeta, onMetaUpdate, requestMeta } from '../../stores/localization';
import { observeThrottled } from '../../utils/dom';

const colClasses = classModuleFinder('RightColumn', 'LeftColumn');

interface NativeSectionClasses {
  section: string;
  header: string;
  label: string;
  labelText: string;
  container: string;
  body: string;
}

function extractNativeClasses(rightCol: Element): NativeSectionClasses {
  const sec = rightCol.querySelector('[role="region"]');
  const h2 = sec?.querySelector('h2');
  const label = h2?.querySelector('[class*="Label"]') as HTMLElement | null;
  const labelText = h2?.querySelector('[class*="LabelText"]') as HTMLElement | null;
  const container = sec?.querySelector('[class*="RightColumnSection"]') as HTMLElement | null;
  const body = container?.querySelector('[class*="Body"]') as HTMLElement | null;

  return {
    section: sec?.className || 'AppDetailsSection Panel',
    header: h2?.className || 'SectionHeader PadLeft',
    label: label?.className || 'Label',
    labelText: labelText?.className || 'LabelText',
    container: container?.className || 'AppDetailsSectionContainer RightColumnSection Panel',
    body: body?.className || 'Body',
  };
}

function RightColumnStatusBadges({
  appId,
  nativeCls,
}: {
  appId: number;
  nativeCls: NativeSectionClasses;
}) {
  const [meta, setMeta] = useState(() => cachedMeta(appId));
  const [eaInfo, setEaInfo] = useState<LibraryEarlyAccessInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMeta(cachedMeta(appId));
    requestMeta(appId);

    const unsub = onMetaUpdate((updatedId, data) => {
      if (updatedId === appId) setMeta(data);
    });

    setEaInfo(null);
    getLibraryEarlyAccessInfo(appId).then((res) => {
      if (!cancelled) setEaInfo(res);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [appId]);

  const locColor = meta ? TIER_INFO[meta.tier].color : '#8b929a';
  const locText = formatLocDetail(meta);

  return (
    <div role="region" className={nativeCls.section}>
      <h2 className={nativeCls.header}>
        <div className={nativeCls.label}>
          <div className={nativeCls.labelText}>Сведения об игре</div>
        </div>
      </h2>

      <div className={nativeCls.container}>
        <div
          className={nativeCls.body}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '12px 14px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                backgroundColor: locColor,
                flexShrink: 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: '11px', color: 'var(--color-greyneutral-11, #8b929a)', lineHeight: 1.2 }}>
                Русский язык
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--color-text-body-title, #e5e7eb)',
                  lineHeight: 1.35,
                  marginTop: '1px',
                }}
              >
                {locText}
              </span>
            </div>
          </div>

          {eaInfo?.hasEarlyAccess && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  color: eaInfo.isReleased ? '#67c1f5' : '#f5a623',
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                {eaInfo.isReleased ? '➡️' : '⏳'}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--color-greyneutral-11, #8b929a)', lineHeight: 1.2 }}>
                  Ранний доступ
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--color-text-body-title, #e5e7eb)',
                    lineHeight: 1.35,
                    marginTop: '1px',
                  }}
                >
                  {eaInfo.message}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MountedRightCol {
  host: HTMLElement;
  root: ReactRoot;
  appId: number;
}

function initRightColumnBadges(doc: Document): () => void {
  const mounts = new Map<Element, MountedRightCol>();

  const unmount = (col: Element) => {
    const m = mounts.get(col);
    if (!m) return;
    m.root.unmount();
    m.host.remove();
    mounts.delete(col);
  };

  const unmountAll = () => {
    for (const col of Array.from(mounts.keys())) unmount(col);
  };

  const scan = () => {
    const appId = libraryAppIdFromPath(getLibraryPath());
    if (!appId) {
      unmountAll();
      return;
    }

    const cls = colClasses()?.RightColumn;
    const selector = cls ? `.${cls}, .RightColumn` : '.RightColumn';
    const columns = new Set<Element>(Array.from(doc.querySelectorAll(selector)));

    for (const [col, m] of Array.from(mounts)) {
      if (!columns.has(col) || !col.contains(m.host) || m.appId !== appId) {
        unmount(col);
      }
    }

    for (const col of columns) {
      if (mounts.has(col)) continue;
      const nativeCls = extractNativeClasses(col);
      const host = doc.createElement('div');
      host.className = 'bib-rightcol-status-host';
      col.prepend(host);
      mounts.set(col, {
        host,
        root: mountReact(host, <RightColumnStatusBadges appId={appId} nativeCls={nativeCls} />),
        appId,
      });
    }
  };

  const stopObserver = observeThrottled(doc, scan, 250);
  return () => {
    stopObserver();
    unmountAll();
  };
}

export const gameLocBadgeModule: BibliotekarshaModule = {
  id: 'game-loc-badge',
  name: 'Сведения об игре: Русский язык и Ранний доступ (Библиотека)',
  description:
    'Отображает нативную секцию «Сведения об игре» со статусом русской локализации и раннего доступа в правой колонке библиотеки.',
  defaultEnabled: true,
  mountDocument: initRightColumnBadges,
};
