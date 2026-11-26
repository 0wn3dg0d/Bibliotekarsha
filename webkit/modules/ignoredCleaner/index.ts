import { StoreWebkitConfig, fetchViaBackend, injectStyleOnce } from '../../shared/ipc';

const AIC_CSS = `
  #aic-modal {
    position: fixed;
    top: 100px;
    left: 50%;
    transform: translateX(-50%);
    width: 450px;
    max-width: 94vw;
    background: #1b2838;
    border: 1px solid #30363d;
    border-radius: 6px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.9);
    z-index: 100050;
    display: none;
    flex-direction: column;
    color: #c6d4df;
    font-family: "Motiva Sans", sans-serif;
  }
  #aic-modal-header {
    background: #101822;
    padding: 12px 15px;
    cursor: grab;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #30363d;
    border-radius: 6px 6px 0 0;
    user-select: none;
  }
  #aic-modal-header:active { cursor: grabbing; }
  .aic-header-title { color: #66c0f4; font-weight: bold; font-size: 16px; }
  .aic-header-controls button { background: none; border: none; color: #8f98a0; cursor: pointer; font-size: 18px; }
  .aic-header-controls button:hover { color: #fff; }
  #aic-modal-body { padding: 15px; display: flex; flex-direction: column; gap: 15px; }
  .aic-stats-box { background: #101822; padding: 12px; border-radius: 4px; font-size: 13px; line-height: 1.6; border: 1px solid #2a3a4c; }
  .aic-filters-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .aic-input-group { display: flex; flex-direction: column; font-size: 12px; color: #8f98a0; }
  .aic-input-group input { background: #223143; border: 1px solid #30363d; color: #fff; padding: 8px; border-radius: 3px; margin-top: 5px; outline: none; }
  .aic-input-group input:disabled { opacity: 0.5; cursor: not-allowed; }
  .aic-action-btn { background: linear-gradient(to bottom, #799905 5%, #536904 95%); border: none; border-radius: 3px; color: #fff; padding: 12px; font-weight: bold; cursor: pointer; text-align: center; font-size: 14px; width: 100%; transition: 0.2s; }
  .aic-action-btn:hover:not(:disabled) { background: linear-gradient(to bottom, #8cb306 5%, #637d05 95%); }
  .aic-action-btn:disabled { background: #4a4a4a; color: #888; cursor: not-allowed; }
  .aic-progress-container { display: none; flex-direction: column; gap: 5px; background: #101822; padding: 10px; border-radius: 4px; border: 1px solid #2a3a4c; }
  .aic-progress-bar-bg { background: #000; height: 10px; border-radius: 5px; overflow: hidden; width: 100%; }
  .aic-progress-bar-fill { background: #66c0f4; height: 100%; width: 0%; transition: width 0.3s; }
  .aic-progress-info { font-size: 12px; display: flex; justify-content: space-between; }
  .aic-resume-btn { background: #c13c37; border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer; display: none; font-size: 11px; margin-top: 5px; }
  #aic-console { background: #000; border: 1px solid #30363d; border-radius: 4px; padding: 8px; height: 130px; overflow-y: auto; font-family: monospace; font-size: 11px; color: #a3b0bb; display: flex; flex-direction: column; gap: 4px; }
  .aic-log-msg { border-bottom: 1px dashed #222; padding-bottom: 2px; }
  .aic-log-success { color: #8cc540; }
  .aic-log-error { color: #ff5252; }
  .aic-log-info { color: #66c0f4; }
`;

function resolveSessionId(): string {
  const fromGlobal = (window as any).g_sessionID;
  if (typeof fromGlobal === 'string' && fromGlobal.length > 0) return fromGlobal;
  const m = document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export function initAccountIgnoredCleanerModule(cfg: StoreWebkitConfig): void {
  if (!cfg.ignoredCleaner) return;
  if (!window.location.hostname.includes('store.steampowered.com')) return;
  if (!window.location.pathname.includes('/account/notinterested')) return;

  injectStyleOnce('bsh-aic-css', AIC_CSS);

  const BATCH_SIZE = 200;
  const API_DELAY = 500;
  const ACTION_DELAY = 2500;
  const ERROR_WAIT = 180;

  let ignoredAppIds: number[] = [];
  const gameData = new Map<number, { reviews: number; rating: number }>();
  let matchedIds: number[] = [];
  let sessionID = '';
  let isFetching = false;
  let isProcessing = false;
  let isPaused = false;
  let processedCount = 0;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;

  const log = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const consoleEl = document.getElementById('aic-console');
    if (!consoleEl) return;
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const line = document.createElement('div');
    line.className = `aic-log-msg aic-log-${type}`;
    line.textContent = `[${time}] ${message}`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  };

  const getInputEl = (id: string) => document.getElementById(id) as HTMLInputElement | null;
  const getBtnEl = (id: string) => document.getElementById(id) as HTMLButtonElement | null;

  const updateMatchedCount = () => {
    if (isProcessing) return;
    const minRev = parseInt(getInputEl('aic-min-rev')?.value || '', 10) || 0;
    const maxRevRaw = parseInt(getInputEl('aic-max-rev')?.value || '', 10);
    const maxRev = Number.isNaN(maxRevRaw) ? Infinity : maxRevRaw;
    const minRat = parseInt(getInputEl('aic-min-rat')?.value || '', 10) || 0;
    const maxRatRaw = parseInt(getInputEl('aic-max-rat')?.value || '', 10);
    const maxRat = Number.isNaN(maxRatRaw) ? 100 : maxRatRaw;

    matchedIds = [];
    for (const [id, data] of gameData.entries()) {
      if (data.reviews >= minRev && data.reviews <= maxRev && data.rating >= minRat && data.rating <= maxRat) {
        matchedIds.push(id);
      }
    }

    const statMatched = document.getElementById('aic-stat-matched');
    if (statMatched) statMatched.textContent = String(matchedIds.length);
    const procBtn = getBtnEl('aic-process-btn');
    if (procBtn) procBtn.disabled = matchedIds.length === 0;
  };

  const fetchGameStats = async () => {
    gameData.clear();
    const ids = ignoredAppIds;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      log(`Запрос данных: ${i} - ${Math.min(i + BATCH_SIZE, ids.length)} из ${ids.length}...`);

      const inputJson = {
        ids: batch.map((id) => ({ appid: id })),
        context: { language: 'english', country_code: 'US', steam_realm: 1 },
        data_request: { include_reviews: true },
      };

      const res = await fetchViaBackend(
        `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(
          JSON.stringify(inputJson)
        )}`
      );

      if (res.ok && res.body) {
        try {
          const data = JSON.parse(res.body);
          if (Array.isArray(data?.response?.store_items)) {
            data.response.store_items.forEach((item: any) => {
              gameData.set(Number(item.id), {
                reviews: Number(item.reviews?.summary_filtered?.review_count) || 0,
                rating: Number(item.reviews?.summary_filtered?.percent_positive) || 0,
              });
            });
          }
          const fetchedEl = document.getElementById('aic-stat-fetched');
          if (fetchedEl) fetchedEl.textContent = String(gameData.size);
        } catch {
          log('Ошибка разбора ответа Steam API.', 'error');
        }
      } else {
        log(`Ошибка HTTP ${res.status} при обработке пачки ID.`, 'error');
      }

      await new Promise((r) => setTimeout(r, API_DELAY));
    }

    log('Сбор данных завершён! Укажите критерии фильтрации.', 'success');
    ['aic-min-rev', 'aic-max-rev', 'aic-min-rat', 'aic-max-rat'].forEach((id) => {
      const el = getInputEl(id);
      if (el) el.disabled = false;
    });
    updateMatchedCount();
  };

  const fetchIgnoredData = async () => {
    if (isFetching) return;
    isFetching = true;
    const fetchBtn = getBtnEl('aic-fetch-btn');
    if (fetchBtn) fetchBtn.disabled = true;

    log('Запрашиваем данные аккаунта (userdata)...', 'info');

    try {
      const resp = await fetch(`https://store.steampowered.com/dynamicstore/userdata/?_t=${Date.now()}`, {
        credentials: 'include',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (data?.rgIgnoredApps && typeof data.rgIgnoredApps === 'object') {
        ignoredAppIds = Object.keys(data.rgIgnoredApps).map(Number).filter((n) => n > 0);
        const totalEl = document.getElementById('aic-stat-total');
        if (totalEl) totalEl.textContent = String(ignoredAppIds.length);
        log(`Найдено ${ignoredAppIds.length} скрытых игр. Начинаем сбор статистики...`, 'info');
        await fetchGameStats();
      } else {
        log('Скрытых игр не найдено.', 'error');
      }
    } catch {
      log('Ошибка при получении userdata.', 'error');
    }

    isFetching = false;
    if (fetchBtn) fetchBtn.disabled = false;
  };

  const finishProcessing = () => {
    isProcessing = false;
    log('✅ Все подходящие игры успешно раскрыты!', 'success');

    const progressText = document.getElementById('aic-progress-text');
    const progressTime = document.getElementById('aic-progress-time');
    const progressFill = document.getElementById('aic-progress-fill');
    if (progressText) progressText.textContent = 'Завершено';
    if (progressTime) progressTime.textContent = '';
    if (progressFill) progressFill.style.width = '100%';

    ['aic-min-rev', 'aic-max-rev', 'aic-min-rat', 'aic-max-rat', 'aic-fetch-btn'].forEach((id) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLButtonElement | null;
      if (el) el.disabled = false;
    });

    try {
      (window as any).GDynamicStore?.InvalidateCache?.();
    } catch {}
  };

  const updateProgressUI = (currentAppId: number) => {
    const total = processedCount + matchedIds.length + 1;
    const done = processedCount;
    const remaining = total - done;
    const secLeft = Math.ceil((remaining * ACTION_DELAY) / 1000);
    const mins = Math.floor(secLeft / 60);
    const secs = secLeft % 60;
    const pct = Math.round((done / Math.max(1, total)) * 100);

    const pText = document.getElementById('aic-progress-text');
    const pTime = document.getElementById('aic-progress-time');
    const pFill = document.getElementById('aic-progress-fill');
    if (pText) pText.innerHTML = `Обработка: <b>${currentAppId}</b> (${done}/${total})`;
    if (pTime) pTime.textContent = `~${mins}:${secs.toString().padStart(2, '0')}`;
    if (pFill) pFill.style.width = `${pct}%`;
  };

  const initiatePause = () => {
    isPaused = true;
    let currentWait = ERROR_WAIT;
    const resumeBtn = getBtnEl('aic-resume-btn');
    if (resumeBtn) resumeBtn.style.display = 'inline-block';

    const tick = () => {
      if (!isPaused) return;
      const pText = document.getElementById('aic-progress-text');
      const pTime = document.getElementById('aic-progress-time');
      if (pText) pText.textContent = 'Пауза (Лимит запросов)';
      if (pTime) pTime.textContent = `Ждём ${currentWait} сек`;

      if (currentWait <= 0) {
        isPaused = false;
        if (resumeBtn) resumeBtn.style.display = 'none';
        log('Пауза окончена. Продолжаем...', 'info');
        processQueue();
      } else {
        currentWait--;
        pauseTimer = setTimeout(tick, 1000);
      }
    };
    tick();
  };

  const processQueue = async () => {
    if (matchedIds.length === 0) {
      finishProcessing();
      return;
    }
    if (isPaused) return;

    const appId = matchedIds.shift()!;
    updateProgressUI(appId);

    try {
      const res = await fetch('https://store.steampowered.com/recommended/ignorerecommendation/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `sessionid=${encodeURIComponent(sessionID)}&appid=${appId}&remove=1&snr=1_account_notinterested_`,
      });

      if (res.status === 429) {
        log(`Ошибка 429: Лимит запросов. Пауза ${ERROR_WAIT} сек.`, 'error');
        matchedIds.unshift(appId);
        initiatePause();
        return;
      }

      if (!res.ok) {
        log(`Ошибка HTTP ${res.status} при ID ${appId}. Пропускаем.`, 'error');
        processedCount++;
        setTimeout(processQueue, ACTION_DELAY);
        return;
      }

      processedCount++;
      const gameRow = document.getElementById(`ignored_app_${appId}`);
      if (gameRow) {
        gameRow.style.transition = 'opacity 0.5s';
        gameRow.style.opacity = '0';
        setTimeout(() => gameRow.remove(), 500);
      }
      log(`Игра ID ${appId} успешно раскрыта.`, 'success');
      setTimeout(processQueue, ACTION_DELAY);
    } catch {
      log(`Сетевая ошибка при ID ${appId}. Пропускаем.`, 'error');
      processedCount++;
      setTimeout(processQueue, ACTION_DELAY);
    }
  };

  const startProcessing = () => {
    if (matchedIds.length === 0) return;
    sessionID = resolveSessionId();
    if (!sessionID) {
      log('Не найден sessionid Steam. Перезагрузите страницу.', 'error');
      return;
    }

    isProcessing = true;
    processedCount = 0;

    ['aic-process-btn', 'aic-min-rev', 'aic-max-rev', 'aic-min-rat', 'aic-max-rat', 'aic-fetch-btn'].forEach((id) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLButtonElement | null;
      if (el) el.disabled = true;
    });

    const wrap = document.getElementById('aic-progress-wrap');
    if (wrap) wrap.style.display = 'flex';
    log(`Начинаем извлечение ${matchedIds.length} игр из игнора...`, 'info');
    processQueue();
  };

  const openModal = () => {
    let modal = document.getElementById('aic-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'aic-modal';
      modal.innerHTML = `
        <div id="aic-modal-header">
          <span class="aic-header-title">Умная очистка игнор-листа</span>
          <div class="aic-header-controls">
            <button type="button" id="aic-close-btn">✖</button>
          </div>
        </div>
        <div id="aic-modal-body">
          <button type="button" id="aic-fetch-btn" class="aic-action-btn" style="background: linear-gradient(to bottom, #2a475e 5%, #1b2838 95%); margin-bottom: 5px;">Собрать данные о скрытых играх</button>
          <div class="aic-stats-box">
            <div>Всего игр в игноре: <b id="aic-stat-total" style="color:#fff;">0</b></div>
            <div>Данные получены для: <b id="aic-stat-fetched" style="color:#66c0f4;">0</b></div>
          </div>
          <div class="aic-filters-grid">
            <div class="aic-input-group">
              <label>Мин. обзоров</label>
              <input type="number" id="aic-min-rev" placeholder="Например: 500" disabled>
            </div>
            <div class="aic-input-group">
              <label>Макс. обзоров</label>
              <input type="number" id="aic-max-rev" placeholder="Без лимита" disabled>
            </div>
            <div class="aic-input-group">
              <label>Мин. рейтинг (%)</label>
              <input type="number" id="aic-min-rat" placeholder="Например: 80" disabled>
            </div>
            <div class="aic-input-group">
              <label>Макс. рейтинг (%)</label>
              <input type="number" id="aic-max-rat" placeholder="Например: 100" disabled>
            </div>
          </div>
          <div class="aic-stats-box" style="text-align: center; font-size: 14px;">
            Подходит под критерии: <b id="aic-stat-matched" style="color:#8cc540; font-size: 16px;">0</b>
          </div>
          <button type="button" id="aic-process-btn" class="aic-action-btn" disabled>Извлечь подходящие из игнора</button>
          <div id="aic-progress-wrap" class="aic-progress-container">
            <div class="aic-progress-info">
              <span id="aic-progress-text">Ожидание...</span>
              <span id="aic-progress-time">--:--</span>
            </div>
            <div class="aic-progress-bar-bg"><div id="aic-progress-fill" class="aic-progress-bar-fill"></div></div>
            <div style="text-align: right;"><button type="button" id="aic-resume-btn" class="aic-resume-btn">Продолжить вручную</button></div>
          </div>
          <div id="aic-console"></div>
        </div>
      `;
      document.body.appendChild(modal);

      const header = document.getElementById('aic-modal-header')!;
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
        const rect = modal!.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        modal!.style.left = `${rect.left}px`;
        modal!.style.top = `${rect.top}px`;
        modal!.style.transform = 'none';
      });
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        modal!.style.left = `${initialX + e.clientX - startX}px`;
        modal!.style.top = `${initialY + e.clientY - startY}px`;
      });
      document.addEventListener('mouseup', () => {
        isDragging = false;
      });

      document.getElementById('aic-close-btn')!.onclick = () => (modal!.style.display = 'none');
      document.getElementById('aic-fetch-btn')!.onclick = fetchIgnoredData;
      document.getElementById('aic-process-btn')!.onclick = startProcessing;
      document.getElementById('aic-resume-btn')!.onclick = () => {
        if (!isPaused) return;
        if (pauseTimer) clearTimeout(pauseTimer);
        isPaused = false;
        log('Продолжено вручную.', 'info');
        const rBtn = getBtnEl('aic-resume-btn');
        if (rBtn) rBtn.style.display = 'none';
        const pText = document.getElementById('aic-progress-text');
        if (pText) pText.textContent = 'Возобновление...';
        processQueue();
      };

      ['aic-min-rev', 'aic-max-rev', 'aic-min-rat', 'aic-max-rat'].forEach((id) => {
        getInputEl(id)?.addEventListener('input', updateMatchedCount);
      });
    }

    sessionID = resolveSessionId();
    modal.style.display = 'flex';
  };

  const injectButton = () => {
    const header = document.querySelector('.account_header_line.noicon') as HTMLElement | null;
    if (!header || document.getElementById('aic-open-btn')) return;

    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'aic-open-btn';
    btn.className = 'btnv6_blue_hoverfade btn_medium';
    btn.innerHTML = '<span>Управление очисткой</span>';
    btn.style.padding = '0 15px';
    btn.style.height = '32px';
    btn.style.lineHeight = '32px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });

    header.appendChild(btn);
  };

  setTimeout(injectButton, 800);
}
