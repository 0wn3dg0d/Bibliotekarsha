import { StoreWebkitConfig, idbGet, idbSet, injectStyleOnce } from '../../shared/ipc';

interface CriteriaScores {
  gfx: number;
  story: number;
  gameplay: number;
  audio: number;
  atmos: number;
}

interface GameNoteRecord {
  name: string;
  headerUrl: string;
  text: string;
  criteria: CriteriaScores;
  avgScore: number;
  manualScore: number | '';
  updated: number;
}

const DB_KEY = 'use_game_notes_db_v2';
const UGN_CHUNK_SIZE = 24;

const CRITERIA_MAP: Array<{ id: keyof CriteriaScores; name: string }> = [
  { id: 'gfx', name: 'Графика' },
  { id: 'story', name: 'Сюжет' },
  { id: 'gameplay', name: 'Геймплей' },
  { id: 'audio', name: 'Звук и музыка' },
  { id: 'atmos', name: 'Атмосфера' },
];

const UGN_CSS = `
  .ugn-modern-modal { position: fixed; top: 100px; left: 50%; transform: translateX(-50%); background: #1b2838; border: 1px solid #30363d; border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,0.9); z-index: 100050; display: flex; flex-direction: column; font-family: "Motiva Sans", sans-serif; color: #c6d4df; transition: width 0.2s, height 0.2s; }
  .ugn-btn-has-note svg { fill: #A3CF06 !important; filter: drop-shadow(0 0 4px rgba(163,207,6,0.6)); }
  .ugn-btn-danger { background: linear-gradient(to bottom, #7a2828 5%, #5a1c1c 95%) !important; border-color: #ff6961 !important; color: #ff6961 !important; }
  .ugn-btn-danger:hover { background: linear-gradient(to bottom, #9a3232 5%, #7a2828 95%) !important; color: #fff !important; border-color: #ff6961 !important; }
  .ugn-editor-mode { width: 550px; max-width: 94vw; }
  .ugn-gallery-mode { width: 90vw; max-width: 1300px; height: 85vh; }
  .ugn-minimized { top: auto !important; bottom: 20px !important; left: 20px !important; transform: none !important; width: 280px !important; height: auto !important; border-color: #66c0f4; }
  .ugn-minimized .ugn-modal-body { display: none !important; }
  .ugn-minimized .ugn-header-title::before { content: 'Развернуть: '; color: #8f98a0; font-size: 13px; font-weight: normal; }
  .ugn-modal-header { background: #101822; padding: 10px 15px; cursor: grab; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; border-radius: 6px 6px 0 0; user-select: none; }
  .ugn-modal-header:active { cursor: grabbing; }
  .ugn-header-title { color: #66c0f4; font-weight: bold; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75%; }
  .ugn-controls { display: flex; gap: 10px; }
  .ugn-ctrl-btn { background: none; border: none; color: #8f98a0; cursor: pointer; font-size: 18px; line-height: 1; font-family: monospace; font-weight: bold; padding: 0 4px; }
  .ugn-ctrl-btn:hover { color: #fff; }
  .ugn-modal-body { padding: 15px; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; flex-grow: 1; min-height: 0; }
  .ugn-textarea { background: #0d131a; border: 1px solid #30363d; color: #c6d4df; padding: 10px; border-radius: 4px; font-family: inherit; font-size: 13px; resize: vertical; min-height: 100px; outline: none; }
  .ugn-textarea:focus { border-color: #66c0f4; }
  .ugn-criteria-box { background: #101822; padding: 15px; border-radius: 4px; border: 1px solid #2a3a4c; display: flex; flex-direction: column; gap: 8px; }
  .ugn-criterion { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
  .ugn-stars { display: flex; gap: 2px; cursor: pointer; align-items: center; }
  .ugn-star { color: #30363d; font-size: 20px; user-select: none; line-height: 1; }
  .ugn-star.active { color: #FFD700; text-shadow: 0 0 5px rgba(255, 215, 0, 0.4); }
  .ugn-crit-val { display: inline-block; width: 30px; text-align: right; color: #66c0f4; font-weight: bold; margin-left: 10px; font-size: 14px; }
  .ugn-score-row { display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #30363d; padding-top: 12px; margin-top: 5px; }
  .ugn-avg-score { font-size: 14px; color: #8cc540; font-weight: bold; }
  .ugn-manual-score { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: bold; }
  .ugn-score-input { background: #223143; border: 1px solid #30363d; color: #fff; padding: 4px 8px; border-radius: 3px; outline: none; width: 55px; text-align: center; font-size: 15px; font-weight: bold; }
  .ugn-score-input:focus { border-color: #66c0f4; }
  .ugn-action-btn { background: linear-gradient(to bottom, #2a475e 5%, #1b2838 95%); border: 1px solid #3a4f6a; border-radius: 3px; color: #66c0f4; padding: 8px 15px; font-weight: bold; cursor: pointer; transition: 0.2s; text-align: center; }
  .ugn-action-btn:hover { background: linear-gradient(to bottom, #325875 5%, #223348 95%); color: #fff; border-color: #66c0f4; }
  .ugn-gallery-tools { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid #2a3a4c; background: #101822; flex-shrink: 0; flex-wrap: wrap; gap: 10px; }
  .ugn-gallery-select { background: #223143; border: 1px solid #30363d; color: #fff; padding: 6px 10px; border-radius: 3px; outline: none; cursor: pointer; font-size: 13px; }
  .ugn-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 15px; padding: 15px; overflow-y: auto; flex-grow: 1; align-content: start; }
  .ugn-card { background: #101822; border: 1px solid #30363d; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, border-color 0.2s; cursor: pointer; position: relative; }
  .ugn-card:hover { transform: translateY(-3px); border-color: #66c0f4; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
  .ugn-card img { width: 100%; height: 121px; object-fit: cover; border-bottom: 1px solid #30363d; }
  .ugn-card-body { padding: 12px; display: flex; flex-direction: column; gap: 6px; flex-grow: 1; }
  .ugn-card-title { color: #fff; font-weight: bold; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
  .ugn-card-stats { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: bold; background: #000; padding: 4px 8px; border-radius: 3px; }
  .ugn-card-desc { font-size: 11px; color: #8f98a0; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; word-break: break-word; line-height: 1.4; margin-top: 5px; }
  .ugn-card-delete { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.78); border: 1px solid #ff6961; color: #ff6961; border-radius: 4px; padding: 4px 7px; font-size: 12px; cursor: pointer; opacity: 0; transition: opacity 0.2s, background 0.2s; line-height: 1; font-weight: 700; }
  .ugn-card:hover .ugn-card-delete, .ugn-card-delete.confirming { opacity: 1; }
  .ugn-card-delete:hover, .ugn-card-delete.confirming { background: #ff6961; color: #fff; }
  .ugn-modern-modal *::-webkit-scrollbar { width: 8px; }
  .ugn-modern-modal *::-webkit-scrollbar-track { background: #0D1117; border-radius: 4px; }
  .ugn-modern-modal *::-webkit-scrollbar-thumb { background-color: #30363D; border-radius: 4px; border: 2px solid #0D1117; }
  .ugn-modern-modal *::-webkit-scrollbar-thumb:hover { background-color: #66c0f4; }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emptyCriteria(): CriteriaScores {
  return { gfx: 0, story: 0, gameplay: 0, audio: 0, atmos: 0 };
}

export function initStoreGameNotesModule(cfg: StoreWebkitConfig): void {
  if (!cfg.gameNotes) return;
  if (!window.location.pathname.includes('/app/')) return;

  injectStyleOnce('bsh-ugn-styles', UGN_CSS);

  let ugnDb: Record<string, GameNoteRecord> = {};
  let pageAppId: string | null = null;
  let pageAppName = 'Неизвестная игра';
  let pageAppHeader = '';

  let editAppId: string | null = null;
  let editAppName = '';
  let editAppHeader = '';
  let tempCriteria: CriteriaScores = emptyCriteria();
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  let galleryItems: Array<GameNoteRecord & { id: string }> = [];
  let galleryLimit = 0;

  const loadDb = async () => {
    const data = await idbGet<Record<string, GameNoteRecord>>(DB_KEY);
    ugnDb = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  };

  const saveDb = async () => {
    await idbSet(DB_KEY, ugnDb);
  };

  const toggleMinimize = (modal: HTMLElement) => {
    if (modal.classList.contains('ugn-minimized')) {
      modal.classList.remove('ugn-minimized');
      modal.style.top = modal.dataset.oldTop || '';
      modal.style.left = modal.dataset.oldLeft || '';
      modal.style.transform = modal.dataset.oldTransform || '';
    } else {
      modal.dataset.oldTop = modal.style.top;
      modal.dataset.oldLeft = modal.style.left;
      modal.dataset.oldTransform = modal.style.transform;
      modal.classList.add('ugn-minimized');
    }
  };

  const setupDraggable = (modal: HTMLElement, header: HTMLElement) => {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    header.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;
      if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (modal.classList.contains('ugn-minimized')) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = modal.getBoundingClientRect();
      modal.style.left = `${rect.left}px`;
      modal.style.top = `${rect.top}px`;
      modal.style.transform = 'none';
      modal.style.transition = 'none';
      initialX = rect.left;
      initialY = rect.top;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      modal.style.left = `${initialX + e.clientX - startX}px`;
      modal.style.top = `${initialY + e.clientY - startY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        modal.style.transition = 'width 0.2s, height 0.2s';
      }
    });
  };

  const updatePageBtnHighlight = () => {
    if (!pageAppId) return;
    const btn = document.querySelector('.ugn_button .btnv6_blue_hoverfade');
    if (!btn) return;
    if (ugnDb[pageAppId]) btn.classList.add('ugn-btn-has-note');
    else btn.classList.remove('ugn-btn-has-note');
  };

  const calcAverage = (): number => {
    let sum = 0;
    let count = 0;
    for (const k of Object.keys(tempCriteria) as Array<keyof CriteriaScores>) {
      if (tempCriteria[k] > 0) {
        sum += tempCriteria[k] * 10;
        count++;
      }
    }
    const avg = count > 0 ? Math.round(sum / count) : 0;
    const avgEl = document.getElementById('ugn-avg-val');
    if (avgEl) avgEl.textContent = String(avg);
    return avg;
  };

  const updateStarsUI = (container: Element, count: number) => {
    container.querySelectorAll('.ugn-star').forEach((s, idx) => {
      if (idx < count) s.classList.add('active');
      else s.classList.remove('active');
    });
    if (container.nextElementSibling) {
      container.nextElementSibling.textContent = String(count * 10);
    }
  };

  const silentSave = async () => {
    if (!editAppId) return;
    const textEl = document.getElementById('ugn-note-text') as HTMLTextAreaElement | null;
    const scoreEl = document.getElementById('ugn-score-val') as HTMLInputElement | null;
    if (!textEl || !scoreEl) return;

    const text = textEl.value.trim();
    const manualScore = scoreEl.value;
    const avgScore = calcAverage();

    if (text === '' && avgScore === 0 && manualScore === '') {
      delete ugnDb[editAppId];
    } else {
      ugnDb[editAppId] = {
        name: editAppName,
        headerUrl: editAppHeader,
        text,
        criteria: { ...tempCriteria },
        avgScore,
        manualScore: manualScore !== '' ? parseInt(manualScore, 10) : '',
        updated: Date.now(),
      };
    }

    await saveDb();
    if (editAppId === pageAppId) updatePageBtnHighlight();
  };

  const triggerAutosave = () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      silentSave();
    }, 1200);
  };

  const closeAndSaveEditor = (modal: HTMLElement) => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    silentSave();
    modal.style.display = 'none';
  };

  const renderGalleryChunk = () => {
    const grid = document.getElementById('ugn-gallery-grid');
    if (!grid) return;

    const startIndex = galleryLimit - UGN_CHUNK_SIZE;
    const itemsToRender = galleryItems.slice(Math.max(0, startIndex), galleryLimit);
    const frag = document.createDocumentFragment();

    itemsToRender.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'ugn-card';
      const imgSrc =
        item.headerUrl ||
        `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${item.id}/capsule_231x87.jpg`;
      const fallbackSrc = `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${item.id}/header.jpg`;

      card.onclick = (e) => {
        if ((e.target as HTMLElement).closest('.ugn-card-delete')) return;
        openEditorModal(item.id, item.name, imgSrc);
      };

      const avgStr =
        item.avgScore > 0
          ? `<span style="color:#8cc540;">Ср. балл: ${item.avgScore}</span>`
          : '<span style="color:#8f98a0;">Нет критериев</span>';
      const manualStr =
        item.manualScore !== ''
          ? `<span style="color:#66c0f4;">Оценка: ${item.manualScore}/100</span>`
          : '<span style="color:#8f98a0;">Без оценки</span>';

      card.innerHTML = `
        <button type="button" class="ugn-card-delete" title="Удалить заметку">🗑️</button>
        <img src="${escapeHtml(imgSrc)}" loading="lazy">
        <div class="ugn-card-body">
          <div class="ugn-card-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="ugn-card-stats">${avgStr}${manualStr}</div>
          <div class="ugn-card-desc">${item.text ? escapeHtml(item.text) : '<i>Нет текстовой заметки</i>'}</div>
        </div>
      `;

      const imgEl = card.querySelector('img') as HTMLImageElement;
      imgEl.onerror = () => {
        imgEl.onerror = null;
        imgEl.src = fallbackSrc;
      };

      const delBtn = card.querySelector('.ugn-card-delete') as HTMLButtonElement;
      let confirmTimeout: ReturnType<typeof setTimeout> | null = null;
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        if (!delBtn.classList.contains('confirming')) {
          delBtn.classList.add('confirming');
          delBtn.textContent = 'Точно?';
          confirmTimeout = setTimeout(() => {
            delBtn.classList.remove('confirming');
            delBtn.textContent = '🗑️';
          }, 3500);
          return;
        }
        if (confirmTimeout) clearTimeout(confirmTimeout);
        delete ugnDb[item.id];
        await saveDb();
        updatePageBtnHighlight();
        galleryLimit = UGN_CHUNK_SIZE;
        grid.innerHTML = '';
        sortAndRenderGallery();
      };

      frag.appendChild(card);
    });

    grid.appendChild(frag);
  };

  const sortAndRenderGallery = () => {
    const sortEl = document.getElementById('ugn-gallery-sort') as HTMLSelectElement | null;
    const grid = document.getElementById('ugn-gallery-grid');
    const countEl = document.getElementById('ugn-gallery-count');
    if (!grid) return;

    const sortMode = sortEl?.value || 'date_desc';
    galleryItems = Object.entries(ugnDb).map(([id, data]) => ({ id, ...data }));
    if (countEl) countEl.textContent = String(galleryItems.length);

    if (galleryItems.length === 0) {
      grid.innerHTML =
        '<div style="color:#8f98a0; grid-column: 1/-1; text-align:center; padding: 40px; font-size: 15px;">Заметок пока нет. Перейдите на страницу любой игры и нажмите кнопку с карандашом.</div>';
      return;
    }

    galleryItems.sort((a, b) => {
      const getCrit = (it: GameNoteRecord, c: keyof CriteriaScores) => (it.criteria ? it.criteria[c] || 0 : 0);
      const numManual = (it: GameNoteRecord) => (typeof it.manualScore === 'number' ? it.manualScore : -1);

      switch (sortMode) {
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'date_desc': return (b.updated || 0) - (a.updated || 0);
        case 'date_asc': return (a.updated || 0) - (b.updated || 0);
        case 'avg_desc': return (b.avgScore || 0) - (a.avgScore || 0);
        case 'avg_asc': return (a.avgScore || 0) - (b.avgScore || 0);
        case 'manual_desc': return numManual(b) - numManual(a);
        case 'manual_asc': return numManual(a) - numManual(b);
        case 'gfx_desc': return getCrit(b, 'gfx') - getCrit(a, 'gfx');
        case 'gfx_asc': return getCrit(a, 'gfx') - getCrit(b, 'gfx');
        case 'story_desc': return getCrit(b, 'story') - getCrit(a, 'story');
        case 'story_asc': return getCrit(a, 'story') - getCrit(b, 'story');
        case 'gameplay_desc': return getCrit(b, 'gameplay') - getCrit(a, 'gameplay');
        case 'gameplay_asc': return getCrit(a, 'gameplay') - getCrit(b, 'gameplay');
        case 'audio_desc': return getCrit(b, 'audio') - getCrit(a, 'audio');
        case 'audio_asc': return getCrit(a, 'audio') - getCrit(b, 'audio');
        case 'atmos_desc': return getCrit(b, 'atmos') - getCrit(a, 'atmos');
        case 'atmos_asc': return getCrit(a, 'atmos') - getCrit(b, 'atmos');
        default: return 0;
      }
    });

    renderGalleryChunk();
  };

  const exportData = async () => {
    await loadDb();
    const dataStr = JSON.stringify(ugnDb, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'USE_GameNotes_Backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openImportModal = () => {
    document.getElementById('ugn-import-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'ugn-import-modal';
    modal.className = 'ugn-modern-modal';
    modal.style.zIndex = '100060';
    modal.style.width = '450px';

    modal.innerHTML = `
      <div class="ugn-modal-header" id="ugn-import-header">
        <span class="ugn-header-title">Импорт заметок</span>
        <div class="ugn-controls">
          <button type="button" id="ugn-import-close" class="ugn-ctrl-btn" title="Закрыть">✖</button>
        </div>
      </div>
      <div class="ugn-modal-body">
        <p style="font-size:12px; color:#8f98a0; margin:0;">Вставьте содержимое JSON-файла резервной копии. Данные будут объединены с текущими (совпадающие игры перезапишутся из файла).</p>
        <textarea id="ugn-import-textarea" class="ugn-textarea" style="min-height: 200px;" placeholder="Вставьте JSON сюда..."></textarea>
        <div id="ugn-import-status" style="font-size:12px; min-height: 16px;"></div>
        <button type="button" id="ugn-import-submit" class="ugn-action-btn">Импортировать данные</button>
      </div>
    `;
    document.body.appendChild(modal);
    setupDraggable(modal, document.getElementById('ugn-import-header') as HTMLElement);

    document.getElementById('ugn-import-close')!.onclick = () => modal.remove();
    document.getElementById('ugn-import-submit')!.onclick = async () => {
      const statusEl = document.getElementById('ugn-import-status')!;
      try {
        const raw = (document.getElementById('ugn-import-textarea') as HTMLTextAreaElement).value;
        const importedData = JSON.parse(raw);
        if (typeof importedData !== 'object' || importedData === null || Array.isArray(importedData)) {
          throw new Error('Invalid root');
        }
        Object.assign(ugnDb, importedData);
        await saveDb();
        updatePageBtnHighlight();
        galleryLimit = UGN_CHUNK_SIZE;
        const grid = document.getElementById('ugn-gallery-grid');
        if (grid) grid.innerHTML = '';
        sortAndRenderGallery();
        statusEl.style.color = '#77dd77';
        statusEl.textContent = `Импортировано записей: ${Object.keys(importedData).length}`;
        setTimeout(() => modal.remove(), 900);
      } catch {
        statusEl.style.color = '#ff6961';
        statusEl.textContent = 'Ошибка парсинга JSON! Проверьте формат файла.';
      }
    };
    modal.style.display = 'flex';
  };

  const openGalleryModal = async () => {
    let modal = document.getElementById('ugn-gallery-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ugn-gallery-modal';
      modal.className = 'ugn-modern-modal ugn-gallery-mode';
      modal.innerHTML = `
        <div class="ugn-modal-header" id="ugn-gallery-header">
          <span class="ugn-header-title">Все заметки (<span id="ugn-gallery-count">0</span>)</span>
          <div class="ugn-controls">
            <button type="button" id="ugn-gallery-min" class="ugn-ctrl-btn" title="Свернуть/Развернуть">_</button>
            <button type="button" id="ugn-gallery-close" class="ugn-ctrl-btn" title="Закрыть">✖</button>
          </div>
        </div>
        <div class="ugn-modal-body" style="padding: 0;">
          <div class="ugn-gallery-tools">
            <span style="color:#8f98a0; font-size:13px;">Щёлкните по игре, чтобы открыть её редактор</span>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <button type="button" id="ugn-clear-all-btn" class="ugn-action-btn ugn-btn-danger" style="padding: 6px 12px; font-size:12px;">Очистить</button>
              <button type="button" id="ugn-export-btn" class="ugn-action-btn" style="padding: 6px 12px; font-size:12px;">Экспорт</button>
              <button type="button" id="ugn-import-open-btn" class="ugn-action-btn" style="padding: 6px 12px; font-size:12px;">Импорт</button>
              <select id="ugn-gallery-sort" class="ugn-gallery-select">
                <option value="date_desc">Сначала новые</option>
                <option value="date_asc">Сначала старые</option>
                <option value="name_asc">Название (А-Я)</option>
                <option value="name_desc">Название (Я-А)</option>
                <option value="avg_desc">Средний балл (Лучшие)</option>
                <option value="avg_asc">Средний балл (Худшие)</option>
                <option value="manual_desc">Личная оценка (Лучшие)</option>
                <option value="manual_asc">Личная оценка (Худшие)</option>
                <optgroup label="Оценки критериев">
                  <option value="gfx_desc">Лучшая графика</option>
                  <option value="gfx_asc">Худшая графика</option>
                  <option value="story_desc">Лучший сюжет</option>
                  <option value="story_asc">Худший сюжет</option>
                  <option value="gameplay_desc">Лучший геймплей</option>
                  <option value="gameplay_asc">Худший геймплей</option>
                  <option value="audio_desc">Лучший звук</option>
                  <option value="audio_asc">Худший звук</option>
                  <option value="atmos_desc">Лучшая атмосфера</option>
                  <option value="atmos_asc">Худшая атмосфера</option>
                </optgroup>
              </select>
            </div>
          </div>
          <div id="ugn-gallery-grid" class="ugn-gallery-grid"></div>
        </div>
      `;
      document.body.appendChild(modal);
      setupDraggable(modal, document.getElementById('ugn-gallery-header') as HTMLElement);

      document.getElementById('ugn-gallery-min')!.onclick = () => toggleMinimize(modal!);
      document.getElementById('ugn-gallery-close')!.onclick = () => (modal!.style.display = 'none');
      document.getElementById('ugn-export-btn')!.onclick = exportData;
      document.getElementById('ugn-import-open-btn')!.onclick = openImportModal;

      const clearBtn = document.getElementById('ugn-clear-all-btn') as HTMLButtonElement;
      let clearStep = 0;
      let clearTimer: ReturnType<typeof setTimeout> | null = null;
      clearBtn.onclick = async () => {
        if (clearStep === 0) {
          clearStep = 1;
          clearBtn.textContent = 'Удалить ВСЕ?';
          clearTimer = setTimeout(() => {
            clearStep = 0;
            clearBtn.textContent = 'Очистить';
          }, 4000);
          return;
        }
        if (clearTimer) clearTimeout(clearTimer);
        clearStep = 0;
        clearBtn.textContent = 'Очистить';
        ugnDb = {};
        await saveDb();
        updatePageBtnHighlight();
        galleryLimit = UGN_CHUNK_SIZE;
        document.getElementById('ugn-gallery-grid')!.innerHTML = '';
        sortAndRenderGallery();
      };

      (document.getElementById('ugn-gallery-sort') as HTMLSelectElement).onchange = () => {
        galleryLimit = UGN_CHUNK_SIZE;
        document.getElementById('ugn-gallery-grid')!.innerHTML = '';
        sortAndRenderGallery();
      };

      const grid = document.getElementById('ugn-gallery-grid')!;
      grid.addEventListener('scroll', () => {
        if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 200) {
          if (galleryLimit < galleryItems.length) {
            galleryLimit += UGN_CHUNK_SIZE;
            renderGalleryChunk();
          }
        }
      });
    }

    await loadDb();
    modal.classList.remove('ugn-minimized');
    modal.style.display = 'flex';
    galleryLimit = UGN_CHUNK_SIZE;
    document.getElementById('ugn-gallery-grid')!.innerHTML = '';
    sortAndRenderGallery();
  };

  const openEditorModal = async (appId: string, appName: string, appHeader: string) => {
    const galModal = document.getElementById('ugn-gallery-modal');
    if (galModal) galModal.style.display = 'none';

    editAppId = appId;
    editAppName = appName;
    editAppHeader =
      appHeader ||
      `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;

    let modal = document.getElementById('ugn-editor-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ugn-editor-modal';
      modal.className = 'ugn-modern-modal ugn-editor-mode';

      const criteriaHTML = CRITERIA_MAP.map(
        (c) => `
          <div class="ugn-criterion" data-key="${c.id}">
            <span>${c.name}</span>
            <div style="display:flex; align-items:center;">
              <div class="ugn-stars">
                ${Array.from({ length: 10 }, (_, i) => `<span class="ugn-star" data-val="${i + 1}">★</span>`).join('')}
              </div>
              <span class="ugn-crit-val">0</span>
            </div>
          </div>
        `
      ).join('');

      modal.innerHTML = `
        <div class="ugn-modal-header" id="ugn-editor-header">
          <span class="ugn-header-title" id="ugn-editor-title">Заметка</span>
          <div class="ugn-controls">
            <button type="button" id="ugn-editor-min" class="ugn-ctrl-btn" title="Свернуть/Развернуть">_</button>
            <button type="button" id="ugn-editor-close" class="ugn-ctrl-btn" title="Закрыть и сохранить">✖</button>
          </div>
        </div>
        <div class="ugn-modal-body">
          <textarea id="ugn-note-text" class="ugn-textarea" placeholder="Напишите здесь свои впечатления об игре..."></textarea>
          <div class="ugn-criteria-box">
            <div id="ugn-criteria-list" style="display:flex; flex-direction:column; gap:5px;">
              ${criteriaHTML}
            </div>
            <div class="ugn-score-row">
              <div class="ugn-avg-score">Средний балл: <span id="ugn-avg-val" style="font-size:18px;">0</span></div>
              <div class="ugn-manual-score">
                Личная оценка:
                <input type="number" id="ugn-score-val" class="ugn-score-input" min="0" max="100" placeholder="-">
              </div>
            </div>
          </div>
          <button type="button" id="ugn-open-gallery-btn" class="ugn-action-btn">Все заметки</button>
        </div>
      `;
      document.body.appendChild(modal);
      setupDraggable(modal, document.getElementById('ugn-editor-header') as HTMLElement);

      document.getElementById('ugn-editor-min')!.onclick = () => toggleMinimize(modal!);
      document.getElementById('ugn-editor-close')!.onclick = () => closeAndSaveEditor(modal!);
      document.getElementById('ugn-open-gallery-btn')!.onclick = () => {
        closeAndSaveEditor(modal!);
        openGalleryModal();
      };

      const critList = document.getElementById('ugn-criteria-list')!;
      critList.addEventListener('mouseover', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('ugn-star') && target.parentElement) {
          updateStarsUI(target.parentElement, parseInt(target.dataset.val || '0', 10));
        }
      });
      critList.addEventListener('mouseout', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('ugn-star')) {
          const row = target.closest('.ugn-criterion') as HTMLElement | null;
          if (!row) return;
          const key = row.dataset.key as keyof CriteriaScores;
          const stars = row.querySelector('.ugn-stars');
          if (stars) updateStarsUI(stars, tempCriteria[key] || 0);
        }
      });
      critList.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('ugn-star')) {
          const row = target.closest('.ugn-criterion') as HTMLElement | null;
          if (!row) return;
          const key = row.dataset.key as keyof CriteriaScores;
          tempCriteria[key] = parseInt(target.dataset.val || '0', 10);
          const stars = row.querySelector('.ugn-stars');
          if (stars) updateStarsUI(stars, tempCriteria[key]);
          calcAverage();
          triggerAutosave();
        }
      });

      const scoreInput = document.getElementById('ugn-score-val') as HTMLInputElement;
      scoreInput.addEventListener('input', () => {
        if (scoreInput.value !== '') {
          const v = parseInt(scoreInput.value, 10);
          if (v < 0) scoreInput.value = '0';
          if (v > 100) scoreInput.value = '100';
        }
        triggerAutosave();
      });

      document.getElementById('ugn-note-text')!.addEventListener('input', triggerAutosave);
    }

    await loadDb();
    document.getElementById('ugn-editor-title')!.textContent = editAppName;

    const existing = ugnDb[editAppId] || {
      text: '',
      criteria: emptyCriteria(),
      manualScore: '',
    };
    (document.getElementById('ugn-note-text') as HTMLTextAreaElement).value = existing.text || '';
    (document.getElementById('ugn-score-val') as HTMLInputElement).value =
      existing.manualScore !== undefined && existing.manualScore !== '' ? String(existing.manualScore) : '';

    tempCriteria = { ...emptyCriteria(), ...(existing.criteria || {}) };
    document.querySelectorAll('.ugn-criterion').forEach((row) => {
      const key = (row as HTMLElement).dataset.key as keyof CriteriaScores;
      const stars = row.querySelector('.ugn-stars');
      if (stars) updateStarsUI(stars, tempCriteria[key] || 0);
    });
    calcAverage();

    modal.classList.remove('ugn-minimized');
    modal.style.display = 'flex';
  };

  let isInjectingBtn = false;
  const injectButton = async () => {
    if (isInjectingBtn || document.querySelector('.ugn_button')) return;
    const appIdMatch = window.location.pathname.match(/\/app\/(\d+)/);
    if (!appIdMatch) return;
    pageAppId = appIdMatch[1];

    const titleEl = document.querySelector('#appHubAppName, .apphub_AppName');
    if (titleEl?.textContent) pageAppName = titleEl.textContent.trim();

    const imgEl = document.querySelector('.game_header_image_full') as HTMLImageElement | null;
    pageAppHeader =
      imgEl?.src ||
      `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${pageAppId}/header.jpg`;

    isInjectingBtn = true;
    try {
      await loadDb();
    } finally {
      isInjectingBtn = false;
    }
    if (document.querySelector('.ugn_button')) return;

    const btnWrap = document.createElement('div');
    btnWrap.className = 'ugn_button queue_control_button';
    btnWrap.style.marginLeft = '3px';

    const btn = document.createElement('div');
    btn.className = 'btnv6_blue_hoverfade btn_medium';
    btn.style.cssText =
      'height: 32px; padding: 0 10px; display: flex; align-items: center; justify-content: center; cursor: pointer;';
    btn.title = 'Личные заметки и оценки';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"></path></svg>`;

    if (ugnDb[pageAppId]) btn.classList.add('ugn-btn-has-note');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pageAppId) openEditorModal(pageAppId, pageAppName, pageAppHeader);
    });

    btnWrap.appendChild(btn);

    const pghButton = document.querySelector('.pgh_button');
    const shareBtn = document.getElementById('shareBtn');
    const queueCtn = document.getElementById('queueActionsCtn');
    const gamePurchaseAction = document.querySelector(
      '.game_area_purchase_section .game_area_purchase_game_wrapper .game_purchase_action'
    );
    const addToCart = document.querySelector('#add_to_cart');

    if (pghButton) {
      pghButton.insertAdjacentElement('afterend', btnWrap);
    } else if (shareBtn) {
      shareBtn.insertAdjacentElement('afterend', btnWrap);
    } else if (queueCtn) {
      const expandFill = queueCtn.querySelector('.expand_to_fill');
      if (expandFill) queueCtn.insertBefore(btnWrap, expandFill);
      else queueCtn.appendChild(btnWrap);
    } else if (gamePurchaseAction?.parentNode) {
      gamePurchaseAction.parentNode.insertBefore(btnWrap, gamePurchaseAction);
    } else if (addToCart?.parentNode) {
      addToCart.parentNode.insertBefore(btnWrap, addToCart);
    }
  };

  setTimeout(() => injectButton(), 800);
  const obs = new MutationObserver(() => {
    if (!document.querySelector('.ugn_button')) injectButton();
  });
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
}
