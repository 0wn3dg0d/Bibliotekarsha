import { BibliotekarshaModule } from '../../core/types';
import { AppFilter, ReactRoot, classModuleFinder, findFiberProps, mountReact } from '../../lib/steam';
import { subscribeFilters } from '../../stores/filters';
import { onMetaUpdate } from '../../stores/localization';
import { observeThrottled } from '../../utils/dom';
import { BucketProps, PanelClasses, RussianBucket } from './components/russian-bucket';
import { GLOBAL_SCOPE, installFilterPatch, rematchLibrary, uninstallFilterPatch } from './filter-patch';

const HOST_CLASS = 'bibliotekarsha-bucket-host';

const panelClasses = classModuleFinder(
  'Container',
  'WideFormat',
  'FilterArea',
  'FilterBucket',
  'FilterBucketLabel',
  'FilterBucketBoxes',
  'Row',
  'Checkbox'
);

type PanelProps = Pick<BucketProps, 'appFilter' | 'fnOnChange'>;

const isPanelProps = (props: any): props is PanelProps =>
  typeof props?.appFilter?.SelectOption === 'function';

interface Mounted {
  host: HTMLElement;
  root: ReactRoot;
}

const filterAreas = (doc: Document, c: PanelClasses): HTMLElement[] =>
  Array.from(doc.querySelectorAll<HTMLElement>('.' + c.FilterArea)).filter((el) => !el.id);

function initLibraryFilter(doc: Document): () => void {
  const mounts = new Map<Element, Mounted>();

  const unmount = (area: Element) => {
    const mounted = mounts.get(area);
    if (!mounted) return;
    try {
      mounted.root.unmount();
    } catch {}
    mounted.host.remove();
    mounts.delete(area);
  };

  const unmountAll = () => {
    for (const area of Array.from(mounts.keys())) unmount(area);
  };

  const mountInto = (area: HTMLElement): Mounted => {
    const host = doc.createElement('div');
    host.className = HOST_CLASS;
    host.style.display = 'contents';
    area.appendChild(host);
    const mounted = { host, root: mountReact(host, null) };
    mounts.set(area, mounted);
    return mounted;
  };

  const scan = () => {
    installFilterPatch();
    const classes = panelClasses();
    if (!classes) return;

    const areas = filterAreas(doc, classes);
    for (const [area, mounted] of Array.from(mounts)) {
      if (!areas.includes(area as HTMLElement) || !area.contains(mounted.host)) unmount(area);
    }
    for (const area of areas) {
      const props = findFiberProps(area, isPanelProps);
      if (!props) continue;
      const mounted = mounts.get(area) ?? mountInto(area);
      mounted.root.render(<RussianBucket appFilter={props.appFilter} fnOnChange={props.fnOnChange} classes={classes} />);
    }
  };

  const stopMeta = onMetaUpdate(() => rematchLibrary());
  const stopFilters = subscribeFilters((changedScope) => {
    if (changedScope === GLOBAL_SCOPE) rematchLibrary();
  });
  const stopObserver = observeThrottled(doc, scan, 200);

  return () => {
    stopObserver();
    stopMeta();
    stopFilters();
    unmountAll();
    uninstallFilterPatch();
  };
}

export const libraryFilterModule: BibliotekarshaModule = {
  id: 'library-filter',
  name: 'Общая фильтрация библиотеки',
  description: 'Добавляет кнопку Bibliotekarsha в стандартную панель фильтров Steam для просеивания всех игр аккаунта.',
  defaultEnabled: true,
  mountDocument: initLibraryFilter,
};
