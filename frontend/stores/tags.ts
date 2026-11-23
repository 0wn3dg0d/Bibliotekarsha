const TAGS_STORAGE_KEY = 'bibliotekarsha_tags_v1';
const TAGS_TTL = 30 * 24 * 60 * 60 * 1000;

let tagsMap = new Map();
let loadingPromise: any = null;

function loadCachedTags(): boolean {
  try {
    const raw = localStorage.getItem(TAGS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return false;
    Object.entries(parsed.data).forEach(([id, name]) => tagsMap.set(Number(id), name));
    return Date.now() - parsed.timestamp < TAGS_TTL && tagsMap.size > 0;
  } catch {
    return false;
  }
}

export async function ensureTagsLoaded() {
  if (tagsMap.size > 0) return tagsMap;
  if (loadCachedTags()) return tagsMap;
  if (loadingPromise) {
    await loadingPromise;
    return tagsMap;
  }

  loadingPromise = (async () => {
    try {
      const res = await fetch('https://store.steampowered.com/search/?l=russian');
      if (!res.ok) return;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const obj: any = {};
      doc.querySelectorAll('[data-param="tags"][data-value][data-loc]').forEach((el) => {
        const id = el.getAttribute('data-value');
        const name = el.getAttribute('data-loc');
        if (id && name) {
          obj[id] = name;
          tagsMap.set(Number(id), name);
        }
      });
      if (tagsMap.size > 0) {
        localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), data: obj }));
      }
    } catch {}
  })();

  await loadingPromise;
  loadingPromise = null;
  return tagsMap;
}

export function getTagName(tagId: number): string {
  return tagsMap.get(tagId) || `Метка #${tagId}`;
}

export function getAllTags() {
  return tagsMap;
}
