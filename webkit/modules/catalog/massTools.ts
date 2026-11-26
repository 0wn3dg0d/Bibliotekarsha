import { attachCollapseToggle, findSidebarAnchor } from './filters';
import {
  catalogCollectedStats,
  catalogIgnoredApps,
  onCatalogDataUpdated,
  resolveSteamSessionId,
} from './store';

const ACTION_DELAY = 2500;
const ERROR_WAIT = 180;

export interface MassToolsHandle {
  onNewDomRows: () => void;
}

function makeDraggable(modal: HTMLElement, header: HTMLElement): void {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialX = 0;
  let initialY = 0;

  header.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = modal.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    modal.style.left = `${rect.left}px`;
    modal.style.top = `${rect.top}px`;
    modal.style.right = 'auto';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    modal.style.left = `${initialX + e.clientX - startX}px`;
    modal.style.top = `${initialY + e.clientY - startY}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

async function sendIgnoreRecommendation(appId: number, removeFlag: 0 | 1): Promise<number> {
  const sessionId = resolveSteamSessionId();
  if (!sessionId) return 0;

  const res = await fetch('https://store.steampowered.com/recommended/ignorerecommendation/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `sessionid=${encodeURIComponent(sessionId)}&appid=${appId}&remove=${removeFlag}&snr=1_account_notinterested_`,
  });
  return res.status;
}

export function initCatalogMassTools(): MassToolsHandle {
  const orbState = {
    queue: [] as number[],
    isProcessing: false,
    isPaused: false,
    processedCount: 0,
    totalToProcess: 0,
    pauseTimer: null as ReturnType<typeof setTimeout> | null,
  };

  const hiderState = {
    isActive: false,
    isProcessing: false,
    isPaused: false,
    selectedIds: new Set<number>(),
    queue: [] as number[],
    processedCount: 0,
    totalToProcess: 0,
    pauseTimer: null as ReturnType<typeof setTimeout> | null,
  };

  const orbLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const el = document.getElementById('orb-console');
    if (!el) return;
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const line = document.createElement('div');
    line.className = `orb-log-msg orb-log-${type}`;
    line.textContent = `[${time}] ${msg}`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  };

  const hiderLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const el = document.getElementById('sth-console');
    if (!el) return;
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const line = document.createElement('div');
    line.className = `sth-log-msg sth-log-${type}`;
    line.textContent = `[${time}] ${msg}`;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  };

  const updateOrbStats = () => {
    const statTotal = document.getElementById('orb-stat-total');
    const statIgnored = document.getElementById('orb-stat-ignored');
    if (!statTotal || !statIgnored) return;

    let total = 0;
    let ignoredOnPage = 0;
    for (const [id, data] of catalogCollectedStats.entries()) {
      if (!data.fetched) continue;
      total++;
      const row = document.querySelector(`a.search_result_row[data-ds-appid="${id}"]`);
      if (catalogIgnoredApps.has(id) || row?.classList.contains('ds_ignored')) {
        ignoredOnPage++;
      }
    }
    statTotal.textContent = String(total);
    statIgnored.textContent = String(ignoredOnPage);
  };

  const updateOrbMatching = () => {
    if (orbState.isProcessing) return;
    const minRevStr = (document.getElementById('orb-min-rev') as HTMLInputElement | null)?.value || '';
    const maxRevStr = (document.getElementById('orb-max-rev') as HTMLInputElement | null)?.value || '';
    const minRatStr = (document.getElementById('orb-min-rat') as HTMLInputElement | null)?.value || '';
    const maxRatStr = (document.getElementById('orb-max-rat') as HTMLInputElement | null)?.value || '';

    const minRev = minRevStr !== '' ? parseInt(minRevStr, 10) : 0;
    const maxRev = maxRevStr !== '' ? parseInt(maxRevStr, 10) : Infinity;
    const minRat = minRatStr !== '' ? parseInt(minRatStr, 10) : 0;
    const maxRat = maxRatStr !== '' ? parseInt(maxRatStr, 10) : 100;

    const matched: number[] = [];
    for (const [id, data] of catalogCollectedStats.entries()) {
      if (!data.fetched) continue;
      const row = document.querySelector(`a.search_result_row[data-ds-appid="${id}"]`);
      const isIgnored = catalogIgnoredApps.has(id) || Boolean(row?.classList.contains('ds_ignored'));
      if (!isIgnored) continue;
      if (data.reviews >= minRev && data.reviews <= maxRev && data.rating >= minRat && data.rating <= maxRat) {
        matched.push(id);
      }
    }

    orbState.queue = matched;
    const statMatched = document.getElementById('orb-stat-matched');
    if (statMatched) statMatched.textContent = String(matched.length);
    const btn = document.getElementById('orb-action-btn') as HTMLButtonElement | null;
    if (btn) btn.disabled = matched.length === 0;
  };

  const updateOrbProgress = (appId: number) => {
    const total = Math.max(1, orbState.totalToProcess);
    const done = orbState.processedCount;
    const secLeft = Math.ceil(((total - done) * ACTION_DELAY) / 1000);
    const mins = Math.floor(secLeft / 60);
    const secs = secLeft % 60;
    const pct = Math.round((done / total) * 100);

    const pText = document.getElementById('orb-progress-text');
    const pTime = document.getElementById('orb-progress-time');
    const pFill = document.getElementById('orb-progress-fill');
    if (pText) pText.innerHTML = `Игра: <b>${appId}</b> (${done}/${total})`;
    if (pTime) pTime.textContent = `~${mins}:${secs.toString().padStart(2, '0')}`;
    if (pFill) pFill.style.width = `${pct}%`;
  };

  const finishOrb = () => {
    orbState.isProcessing = false;
    orbLog('✅ Все подходящие игры успешно раскрыты!', 'success');
    const pText = document.getElementById('orb-progress-text');
    const pTime = document.getElementById('orb-progress-time');
    const pFill = document.getElementById('orb-progress-fill');
    if (pText) pText.textContent = 'Завершено';
    if (pTime) pTime.textContent = '';
    if (pFill) pFill.style.width = '100%';

    ['orb-min-rev', 'orb-max-rev', 'orb-min-rat', 'orb-max-rat'].forEach((id) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.disabled = false;
    });

    try {
      (window as any).GDynamicStore?.InvalidateCache?.();
    } catch {}
    updateOrbStats();
    updateOrbMatching();
  };

  const pauseOrb = (seconds: number) => {
    orbState.isPaused = true;
    let wait = seconds;
    const resumeBtn = document.getElementById('orb-resume-btn') as HTMLButtonElement | null;
    if (resumeBtn) resumeBtn.style.display = 'inline-block';

    const tick = () => {
      if (!orbState.isPaused) return;
      const pText = document.getElementById('orb-progress-text');
      const pTime = document.getElementById('orb-progress-time');
      if (pText) pText.textContent = 'Пауза (Лимит запросов)';
      if (pTime) pTime.textContent = `Ждём ${wait} сек`;
      if (wait <= 0) {
        orbState.isPaused = false;
        if (resumeBtn) resumeBtn.style.display = 'none';
        orbLog('Пауза окончена. Продолжаем...', 'info');
        processOrbQueue();
      } else {
        wait--;
        orbState.pauseTimer = setTimeout(tick, 1000);
      }
    };
    tick();
  };

  const processOrbQueue = async () => {
    if (orbState.queue.length === 0) {
      finishOrb();
      return;
    }
    if (orbState.isPaused) return;

    const appId = orbState.queue.shift()!;
    updateOrbProgress(appId);

    try {
      const status = await sendIgnoreRecommendation(appId, 1);
      if (status === 429) {
        orbLog(`Ошибка 429: Лимит запросов. Пауза ${ERROR_WAIT} сек.`, 'error');
        orbState.queue.unshift(appId);
        pauseOrb(ERROR_WAIT);
        return;
      }
      if (status !== 200) {
        orbLog(`Ошибка HTTP ${status} при ID ${appId}. Пропускаем.`, 'error');
        orbState.processedCount++;
        setTimeout(processOrbQueue, ACTION_DELAY);
        return;
      }

      orbState.processedCount++;
      catalogIgnoredApps.delete(appId);

      const row = document.querySelector(`a.search_result_row[data-ds-appid="${appId}"]`);
      if (row) {
        row.classList.remove('ds_ignored', 'ds_flagged');
        row.querySelector('.ds_ignored_flag')?.remove();
        row.querySelectorAll('.as-tags span').forEach((tag) => {
          if (tag.textContent?.trim() === 'Не интересно') {
            const parent = tag.closest('.as-tags');
            tag.remove();
            if (parent && parent.children.length === 0) parent.remove();
          }
        });
      }

      orbLog(`Игра ID ${appId} успешно раскрыта.`, 'success');
      setTimeout(processOrbQueue, ACTION_DELAY);
    } catch {
      orbLog(`Сетевая ошибка при ID ${appId}. Пропускаем.`, 'error');
      orbState.processedCount++;
      setTimeout(processOrbQueue, ACTION_DELAY);
    }
  };

  const updateHiderStats = () => {
    const availEl = document.getElementById('sth-stat-available');
    const checkedEl = document.getElementById('sth-stat-checked');
    if (!availEl || !checkedEl) return;

    const rows = document.querySelectorAll(
      'a.search_result_row:not(.ds_ignored):not(.ds_excluded_by_preferences):not(.ds_owned)'
    );
    availEl.textContent = String(rows.length);
    checkedEl.textContent = String(hiderState.selectedIds.size);
    const actBtn = document.getElementById('sth-action-btn') as HTMLButtonElement | null;
    if (actBtn) actBtn.disabled = hiderState.selectedIds.size === 0 || hiderState.isProcessing;
  };

  const injectHiderCheckboxes = () => {
    const container = document.getElementById('search_resultsRows');
    if (!container) return;

    const targets = container.querySelectorAll(
      'a.search_result_row:not(.ds_ignored):not(.ds_excluded_by_preferences):not(.ds_owned)'
    );
    targets.forEach((raw) => {
      const link = raw as HTMLElement;
      const rawId = link.dataset.dsAppid;
      if (!rawId || rawId.includes(',') || link.querySelector('.steam-hider-checkbox')) return;

      const appId = parseInt(rawId, 10);
      if (!appId) return;

      const cb = document.createElement('button');
      cb.type = 'button';
      cb.setAttribute('role', 'checkbox');
      cb.className = 'steam-hider-checkbox';
      cb.dataset.appid = String(appId);

      const isSelected = hiderState.selectedIds.has(appId);
      cb.classList.toggle('is-checked', isSelected);
      cb.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      link.classList.toggle('steam-hider-row-selected', isSelected);

      link.insertBefore(cb, link.firstChild);

      cb.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      cb.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (hiderState.isProcessing) return;

        if (hiderState.selectedIds.has(appId)) {
          hiderState.selectedIds.delete(appId);
          cb.classList.remove('is-checked');
          cb.setAttribute('aria-checked', 'false');
          link.classList.remove('steam-hider-row-selected');
        } else {
          hiderState.selectedIds.add(appId);
          cb.classList.add('is-checked');
          cb.setAttribute('aria-checked', 'true');
          link.classList.add('steam-hider-row-selected');
        }
        updateHiderStats();
      });
    });
  };

  const clearHiderCheckboxes = () => {
    hiderState.selectedIds.clear();
    document.querySelectorAll('.steam-hider-checkbox').forEach((el) => el.remove());
    document.querySelectorAll('.steam-hider-row-selected').forEach((el) => el.classList.remove('steam-hider-row-selected'));
  };

  const toggleHiderMode = (enable: boolean) => {
    hiderState.isActive = enable;
    const toggle = document.getElementById('sth-mode-toggle') as HTMLInputElement | null;
    if (toggle) toggle.checked = enable;

    if (enable) {
      injectHiderCheckboxes();
      updateHiderStats();
    } else {
      clearHiderCheckboxes();
      const checkedEl = document.getElementById('sth-stat-checked');
      if (checkedEl) checkedEl.textContent = '0';
      const actBtn = document.getElementById('sth-action-btn') as HTMLButtonElement | null;
      if (actBtn) actBtn.disabled = true;
    }
  };

  const updateHiderProgress = (appId: number) => {
    const total = Math.max(1, hiderState.totalToProcess);
    const done = hiderState.processedCount;
    const secLeft = Math.ceil(((total - done) * ACTION_DELAY) / 1000);
    const mins = Math.floor(secLeft / 60);
    const secs = secLeft % 60;
    const pct = Math.round((done / total) * 100);

    const pText = document.getElementById('sth-progress-text');
    const pTime = document.getElementById('sth-progress-time');
    const pFill = document.getElementById('sth-progress-fill');
    if (pText) pText.innerHTML = `Скрытие: <b>${appId}</b> (${done}/${total})`;
    if (pTime) pTime.textContent = `~${mins}:${secs.toString().padStart(2, '0')}`;
    if (pFill) pFill.style.width = `${pct}%`;
  };

  const finishHider = () => {
    hiderState.isProcessing = false;
    hiderLog('✅ Скрытие выбранных игр завершено!', 'success');
    const pText = document.getElementById('sth-progress-text');
    const pTime = document.getElementById('sth-progress-time');
    const pFill = document.getElementById('sth-progress-fill');
    if (pText) pText.textContent = 'Завершено';
    if (pTime) pTime.textContent = '';
    if (pFill) pFill.style.width = '100%';

    const toggle = document.getElementById('sth-mode-toggle') as HTMLInputElement | null;
    if (toggle) toggle.disabled = false;

    try {
      (window as any).GDynamicStore?.InvalidateCache?.();
    } catch {}
    toggleHiderMode(false);
    updateOrbStats();
    updateOrbMatching();
  };

  const pauseHider = (seconds: number) => {
    hiderState.isPaused = true;
    let wait = seconds;
    const resumeBtn = document.getElementById('sth-resume-btn') as HTMLButtonElement | null;
    if (resumeBtn) resumeBtn.style.display = 'inline-block';

    const tick = () => {
      if (!hiderState.isPaused) return;
      const pText = document.getElementById('sth-progress-text');
      const pTime = document.getElementById('sth-progress-time');
      if (pText) pText.textContent = 'Пауза (Лимит запросов)';
      if (pTime) pTime.textContent = `Ждём ${wait} сек`;
      if (wait <= 0) {
        hiderState.isPaused = false;
        if (resumeBtn) resumeBtn.style.display = 'none';
        hiderLog('Пауза окончена. Продолжаем...', 'info');
        processHiderQueue();
      } else {
        wait--;
        hiderState.pauseTimer = setTimeout(tick, 1000);
      }
    };
    tick();
  };

  const processHiderQueue = async () => {
    if (hiderState.queue.length === 0) {
      finishHider();
      return;
    }
    if (hiderState.isPaused) return;

    const appId = hiderState.queue.shift()!;
    updateHiderProgress(appId);

    try {
      const status = await sendIgnoreRecommendation(appId, 0);
      if (status === 429) {
        hiderLog(`Ошибка 429: Лимит запросов. Пауза ${ERROR_WAIT} сек.`, 'error');
        hiderState.queue.unshift(appId);
        pauseHider(ERROR_WAIT);
        return;
      }
      if (status !== 200) {
        hiderLog(`Ошибка HTTP ${status} при ID ${appId}. Пропускаем.`, 'error');
        hiderState.processedCount++;
        setTimeout(processHiderQueue, ACTION_DELAY);
        return;
      }

      hiderState.processedCount++;
      hiderState.selectedIds.delete(appId);
      catalogIgnoredApps.add(appId);

      const row = document.querySelector(`a.search_result_row[data-ds-appid="${appId}"]`);
      if (row) {
        row.classList.add('ds_ignored', 'ds_flagged');
        if (!row.querySelector('.ds_ignored_flag')) {
          const flag = document.createElement('div');
          flag.className = 'ds_flag ds_ignored_flag';
          flag.innerHTML = 'СКРЫТО&nbsp;&nbsp;';
          row.appendChild(flag);
        }
        row.querySelector('.steam-hider-checkbox')?.remove();
        row.classList.remove('steam-hider-row-selected');
      }

      hiderLog(`Игра ID ${appId} добавлена в игнорируемые.`, 'success');
      setTimeout(processHiderQueue, ACTION_DELAY);
    } catch {
      hiderLog(`Сетевая ошибка при ID ${appId}. Пропускаем.`, 'error');
      hiderState.processedCount++;
      setTimeout(processHiderQueue, ACTION_DELAY);
    }
  };

  const buildOrbModal = () => {
    if (document.getElementById('orb-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'orb-modal';
    modal.innerHTML = `
      <div id="orb-modal-header">
        <span class="orb-header-title">Управление каталогом (Раскрыватель)</span>
        <div class="orb-header-controls">
          <button type="button" id="orb-minimize-btn">_</button>
          <button type="button" id="orb-close-btn">✖</button>
        </div>
      </div>
      <div id="orb-modal-body">
        <button type="button" id="orb-all-ignored-btn" class="orb-action-btn" style="background: linear-gradient(to bottom, #2a475e 5%, #1b2838 95%); margin-bottom: 5px;">Все игнорируемые</button>
        <div class="orb-stats-box">
          <div>Обработано игр со страницы: <b id="orb-stat-total" style="color:#fff;">0</b></div>
          <div>Из них находятся в игноре: <b id="orb-stat-ignored" style="color:#ffc107;">0</b></div>
        </div>
        <div class="orb-filters-grid">
          <div class="orb-input-group"><label>Мин. обзоров</label><input type="number" id="orb-min-rev" placeholder="Например: 100"></div>
          <div class="orb-input-group"><label>Макс. обзоров</label><input type="number" id="orb-max-rev" placeholder="Без лимита"></div>
          <div class="orb-input-group"><label>Мин. рейтинг (%)</label><input type="number" id="orb-min-rat" placeholder="Например: 70"></div>
          <div class="orb-input-group"><label>Макс. рейтинг (%)</label><input type="number" id="orb-max-rat" placeholder="Например: 100"></div>
        </div>
        <div class="orb-stats-box" style="text-align: center; font-size: 14px;">
          Игр, подходящих под критерии: <b id="orb-stat-matched" style="color:#8cc540; font-size: 16px;">0</b>
        </div>
        <button type="button" id="orb-action-btn" class="orb-action-btn" disabled>Начать раскрытие игр</button>
        <div id="orb-progress-wrap" class="orb-progress-container">
          <div class="orb-progress-info"><span id="orb-progress-text">Ожидание...</span><span id="orb-progress-time">--:--</span></div>
          <div class="orb-progress-bar-bg"><div id="orb-progress-fill" class="orb-progress-bar-fill"></div></div>
          <div style="text-align: right;"><button type="button" id="orb-resume-btn" class="orb-resume-btn">Продолжить вручную</button></div>
        </div>
        <div id="orb-console"></div>
      </div>
    `;
    document.body.appendChild(modal);

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.id = 'orb-restore-btn';
    restoreBtn.textContent = 'Раскрыватель 🛠';
    document.body.appendChild(restoreBtn);

    makeDraggable(modal, document.getElementById('orb-modal-header')!);

    restoreBtn.onclick = () => {
      modal.style.display = 'flex';
      restoreBtn.style.display = 'none';
    };
    document.getElementById('orb-close-btn')!.onclick = () => (modal.style.display = 'none');
    document.getElementById('orb-minimize-btn')!.onclick = () => {
      modal.style.display = 'none';
      restoreBtn.style.display = 'block';
    };
    document.getElementById('orb-all-ignored-btn')!.onclick = () => {
      window.location.href = 'https://store.steampowered.com/account/notinterested/';
    };
    ['orb-min-rev', 'orb-max-rev', 'orb-min-rat', 'orb-max-rat'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', updateOrbMatching);
    });
    document.getElementById('orb-action-btn')!.onclick = () => {
      if (orbState.queue.length === 0) return;
      orbState.isProcessing = true;
      orbState.processedCount = 0;
      orbState.totalToProcess = orbState.queue.length;
      (document.getElementById('orb-action-btn') as HTMLButtonElement).disabled = true;
      document.getElementById('orb-progress-wrap')!.style.display = 'flex';
      ['orb-min-rev', 'orb-max-rev', 'orb-min-rat', 'orb-max-rat'].forEach((id) => {
        (document.getElementById(id) as HTMLInputElement).disabled = true;
      });
      orbLog(`Начинаем раскрытие ${orbState.totalToProcess} игр...`, 'info');
      processOrbQueue();
    };
    document.getElementById('orb-resume-btn')!.onclick = () => {
      if (!orbState.isPaused) return;
      if (orbState.pauseTimer) clearTimeout(orbState.pauseTimer);
      orbState.isPaused = false;
      orbLog('Продолжено вручную.', 'info');
      document.getElementById('orb-resume-btn')!.style.display = 'none';
      document.getElementById('orb-progress-text')!.textContent = 'Возобновление...';
      processOrbQueue();
    };
  };

  const buildHiderModal = () => {
    if (document.getElementById('sth-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'sth-modal';
    modal.innerHTML = `
      <div id="sth-modal-header">
        <span class="sth-header-title">Массовое скрытие игр</span>
        <div class="sth-header-controls">
          <button type="button" id="sth-minimize-btn">_</button>
          <button type="button" id="sth-close-btn">✖</button>
        </div>
      </div>
      <div id="sth-modal-body">
        <button type="button" id="sth-all-ignored-btn" class="sth-action-btn" style="background: linear-gradient(to bottom, #2a475e 5%, #1b2838 95%); margin-bottom: 5px;">Все игнорируемые</button>
        <div class="sth-stats-box" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px;">
          <span style="font-weight: bold; font-size: 14px;">Режим выделения чекбоксов</span>
          <label class="sth-switch">
            <input type="checkbox" id="sth-mode-toggle">
            <span class="sth-slider"></span>
          </label>
        </div>
        <div class="sth-stats-box">
          <div>Доступно для скрытия на странице: <b id="sth-stat-available" style="color:#fff;">0</b></div>
          <div>Выбрано вами игр: <b id="sth-stat-checked" style="color:#ffc107;">0</b></div>
        </div>
        <button type="button" id="sth-action-btn" class="sth-action-btn" disabled>Скрыть выбранное</button>
        <div id="sth-progress-wrap" class="sth-progress-container">
          <div class="sth-progress-info"><span id="sth-progress-text">Ожидание...</span><span id="sth-progress-time">--:--</span></div>
          <div class="sth-progress-bar-bg"><div id="sth-progress-fill" class="sth-progress-bar-fill"></div></div>
          <div style="text-align: right;"><button type="button" id="sth-resume-btn" class="sth-resume-btn">Продолжить вручную</button></div>
        </div>
        <div id="sth-console"></div>
      </div>
    `;
    document.body.appendChild(modal);

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.id = 'sth-restore-btn';
    restoreBtn.textContent = 'Скрыватель ❌';
    document.body.appendChild(restoreBtn);

    makeDraggable(modal, document.getElementById('sth-modal-header')!);

    restoreBtn.onclick = () => {
      modal.style.display = 'flex';
      restoreBtn.style.display = 'none';
      updateHiderStats();
    };
    document.getElementById('sth-close-btn')!.onclick = () => {
      modal.style.display = 'none';
      toggleHiderMode(false);
    };
    document.getElementById('sth-minimize-btn')!.onclick = () => {
      modal.style.display = 'none';
      restoreBtn.style.display = 'block';
    };
    document.getElementById('sth-all-ignored-btn')!.onclick = () => {
      window.location.href = 'https://store.steampowered.com/account/notinterested/';
    };
    (document.getElementById('sth-mode-toggle') as HTMLInputElement).onchange = (e) => {
      toggleHiderMode((e.target as HTMLInputElement).checked);
    };
    document.getElementById('sth-action-btn')!.onclick = () => {
      if (hiderState.isProcessing || hiderState.selectedIds.size === 0) return;
      hiderState.isProcessing = true;
      hiderState.processedCount = 0;
      hiderState.queue = Array.from(hiderState.selectedIds);
      hiderState.totalToProcess = hiderState.queue.length;
      (document.getElementById('sth-action-btn') as HTMLButtonElement).disabled = true;
      (document.getElementById('sth-mode-toggle') as HTMLInputElement).disabled = true;
      document.getElementById('sth-progress-wrap')!.style.display = 'flex';
      hiderLog(`Начинаем скрытие ${hiderState.totalToProcess} игр...`, 'info');
      processHiderQueue();
    };
    document.getElementById('sth-resume-btn')!.onclick = () => {
      if (!hiderState.isPaused) return;
      if (hiderState.pauseTimer) clearTimeout(hiderState.pauseTimer);
      hiderState.isPaused = false;
      hiderLog('Продолжено вручную.', 'info');
      document.getElementById('sth-resume-btn')!.style.display = 'none';
      document.getElementById('sth-progress-text')!.textContent = 'Возобновление...';
      processHiderQueue();
    };
  };

  const mountSidebarToolsBlock = (): boolean => {
    if (document.getElementById('bsh-catalog-hide-block')) return true;

    const tagsBlock = document.getElementById('bsh-catalog-tags-block');
    const anchor = tagsBlock?.parentNode
      ? { parent: tagsBlock.parentNode, insertAfter: tagsBlock }
      : findSidebarAnchor();
    if (!anchor) return false;

    const block = document.createElement('div');
    block.id = 'bsh-catalog-hide-block';
    block.className = 'block search_collapse_block';
    block.innerHTML = `
      <div class="block_header labs_block_header"><div>Скрытие</div></div>
      <div class="block_content block_content_inner">
        <div class="tab_filter_control_row" style="margin-bottom: 5px;"><span id="open-unhider-modal-btn" class="tab_filter_control_label">Раскрытие</span></div>
        <div class="tab_filter_control_row"><span id="open-hider-modal-btn" class="tab_filter_control_label">Массовое скрытие</span></div>
      </div>
    `;
    attachCollapseToggle(block);
    anchor.parent.insertBefore(block, anchor.insertAfter ? anchor.insertAfter.nextSibling : null);

    document.getElementById('open-unhider-modal-btn')?.addEventListener('click', () => {
      const modal = document.getElementById('orb-modal');
      if (modal) {
        modal.style.display = 'flex';
        updateOrbStats();
        updateOrbMatching();
      }
    });

    document.getElementById('open-hider-modal-btn')?.addEventListener('click', () => {
      const modal = document.getElementById('sth-modal');
      if (modal) {
        modal.style.display = 'flex';
        updateHiderStats();
      }
    });

    return true;
  };

  buildOrbModal();
  buildHiderModal();

  onCatalogDataUpdated(() => {
    updateOrbStats();
    updateOrbMatching();
  });

  if (!mountSidebarToolsBlock()) {
    setTimeout(mountSidebarToolsBlock, 1400);
  }

  return {
    onNewDomRows: () => {
      if (hiderState.isActive) {
        injectHiderCheckboxes();
        updateHiderStats();
      }
    },
  };
}
