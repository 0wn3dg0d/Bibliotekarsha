import { NfoSection } from './types';

const sections = new Map<string, NfoSection>();
const listeners = new Set<() => void>();

export function registerNfoSection(section: NfoSection): () => void {
  sections.set(section.id, section);
  listeners.forEach((fn) => fn());
  return () => {
    sections.delete(section.id);
    listeners.forEach((fn) => fn());
  };
}

export function getRegisteredNfoSections(): NfoSection[] {
  return Array.from(sections.values()).sort((a, b) => a.order - b.order);
}

export function subscribeNfoSections(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
