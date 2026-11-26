import { ffi } from 'millennium';

const storageGet = ffi('bsh_storage_get');
const storageSet = ffi('bsh_storage_set');
const storageExport = ffi('bsh_storage_export_all');
const storageImport = ffi('bsh_storage_import_all');

function parseRes(raw: any): any {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function isDictStorageKey(key: string): boolean {
  return key.startsWith('use_game_notes_db') || key.startsWith('use_incognito_wishlist_db');
}

export async function sharedStorageGet<T = any>(key: string): Promise<T | undefined> {
  try {
    const res = parseRes(await storageGet(JSON.stringify({ key })));
    if (res?.ok && res?.found) {
      if (isDictStorageKey(key) && Array.isArray(res.value)) return {} as T;
      return res.value as T;
    }
  } catch {}
  return undefined;
}

export async function sharedStorageSet(key: string, value: any): Promise<boolean> {
  try {
    const res = parseRes(await storageSet(JSON.stringify({ key, value })));
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function sharedStorageExportAll(): Promise<Record<string, any>> {
  try {
    const res = parseRes(await storageExport());
    if (res?.ok && res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
      return res.data;
    }
  } catch {}
  return {};
}

export async function sharedStorageImportAll(
  data: Record<string, any>,
  mode: 'merge' | 'overwrite' = 'merge'
): Promise<{ ok: boolean; imported: number }> {
  try {
    const res = parseRes(await storageImport(JSON.stringify({ data, mode })));
    return { ok: Boolean(res?.ok), imported: Number(res?.imported || 0) };
  } catch {
    return { ok: false, imported: 0 };
  }
}
