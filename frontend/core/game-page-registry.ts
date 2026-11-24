import { GamePageWidget } from './types';

const widgets = new Map<string, GamePageWidget>();
const listeners = new Set<() => void>();

export function registerGamePageWidget(widget: GamePageWidget): () => void {
  widgets.set(widget.id, widget);
  listeners.forEach((fn) => fn());
  return () => {
    widgets.delete(widget.id);
    listeners.forEach((fn) => fn());
  };
}

export function getRegisteredGamePageWidgets(): GamePageWidget[] {
  return Array.from(widgets.values()).sort((a, b) => a.order - b.order);
}

export function subscribeGamePageWidgets(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
