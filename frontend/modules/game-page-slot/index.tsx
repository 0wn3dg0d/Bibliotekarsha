import React, { useEffect, useState } from 'react';
import { getRegisteredGamePageWidgets, subscribeGamePageWidgets } from '../../core/game-page-registry';
import { BibliotekarshaModule } from '../../core/types';
import { ReactRoot, classModuleFinder, getLibraryPath, libraryAppIdFromPath, mountReact } from '../../lib/steam';
import { observeThrottled } from '../../utils/dom';

const statClasses = classModuleFinder(
  'GameStat',
  'GameStatsSection',
  'GameStatIcon',
  'GameStatRight',
  'PlayBarLabel',
  'PlayBarDetailLabel'
);

export function useGameStatClasses() {
  return statClasses();
}

function GamePageSlotHost({ appId }: { appId: number }) {
  const [widgets, setWidgets] = useState(getRegisteredGamePageWidgets);

  useEffect(() => {
    return subscribeGamePageWidgets(() => {
      setWidgets(getRegisteredGamePageWidgets());
    });
  }, []);

  return (
    <>
      {widgets.map((w) => (
        <React.Fragment key={w.id}>{w.render(appId)}</React.Fragment>
      ))}
    </>
  );
}

interface Mounted {
  host: HTMLElement;
  root: ReactRoot;
  appId: number;
}

function initGamePageSlot(doc: Document): () => void {
  const mounts = new Map<Element, Mounted>();

  const unmount = (section: Element) => {
    const mounted = mounts.get(section);
    if (!mounted) return;
    mounted.root.unmount();
    mounted.host.remove();
    mounts.delete(section);
  };

  const unmountAll = () => {
    for (const section of Array.from(mounts.keys())) unmount(section);
  };

  const scan = () => {
    const appId = libraryAppIdFromPath(getLibraryPath());
    const classes = statClasses();
    if (!appId || !classes) {
      unmountAll();
      return;
    }
    const sections = new Set<Element>(Array.from(doc.querySelectorAll('.' + classes.GameStatsSection)));
    for (const [section, mounted] of Array.from(mounts)) {
      if (!sections.has(section) || !section.contains(mounted.host) || mounted.appId !== appId) unmount(section);
    }
    for (const section of sections) {
      if (mounts.has(section)) continue;
      const host = doc.createElement('div');
      host.style.display = 'contents';
      section.appendChild(host);
      mounts.set(section, {
        host,
        root: mountReact(host, <GamePageSlotHost appId={appId} />),
        appId,
      });
    }
  };

  const stopObserver = observeThrottled(doc, scan, 200);
  return () => {
    stopObserver();
    unmountAll();
  };
}

export const gamePageSlotModule: BibliotekarshaModule = {
  id: 'game-page-slot',
  name: 'Панель виджетов на странице игры',
  description: 'Базовый контейнер для отображения модулей (перевод, HLTB, ZOG, статистика друзей) на странице игры.',
  defaultEnabled: true,
  mountDocument: initGamePageSlot,
};
