import { ReactRoot, classModuleFinder, getLibraryPath, libraryAppIdFromPath, mountReact } from '../../lib/steam';
import { observeThrottled } from '../../utils/dom';
import { RussianStat, StatClasses } from './components/russian-stat';

const statClasses = classModuleFinder(
  'GameStat',
  'GameStatsSection',
  'GameStatIcon',
  'GameStatRight',
  'PlayBarLabel',
  'PlayBarDetailLabel'
);

interface Mounted {
  host: HTMLElement;
  root: ReactRoot;
  appId: number;
}

export function initStatRow(doc: Document): () => void {
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
    const classes = statClasses() as StatClasses | null;
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
        root: mountReact(host, <RussianStat appId={appId} classes={classes} />),
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
