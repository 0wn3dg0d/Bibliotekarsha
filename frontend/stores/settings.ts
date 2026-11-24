const SETTINGS_KEY = 'bibliotekarsha_modules_v1';

let moduleStates: Record<string, boolean> = {};
const listeners = new Set<() => void>();

function loadSettings(): void {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        moduleStates = parsed;
      }
    }
  } catch {}
}

function saveSettings(): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(moduleStates));
  } catch {}
}

loadSettings();

export function isModuleEnabled(id: string, defaultEnabled: boolean): boolean {
  if (id in moduleStates) return Boolean(moduleStates[id]);
  return defaultEnabled;
}

export function setModuleEnabled(id: string, enabled: boolean): void {
  moduleStates[id] = enabled;
  saveSettings();
  listeners.forEach((fn) => fn());
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
