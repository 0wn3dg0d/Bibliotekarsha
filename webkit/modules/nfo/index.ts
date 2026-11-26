import { StoreWebkitConfig, injectStyleOnce } from '../../shared/ipc';
import { getFriendsSummary, getGlobalAchievementsStats, restoreIncognitoFriendsSidebar } from './friendsService';
import { HltbEntry, formatHltbTime, searchHltbForGame } from './hltbService';
import { fetchZogLocalizations, searchGamesOnZogStore } from './zogStoreService';

const NFO_CSS = `
  .bsh-nfo-trigger {
    position: absolute;
    top: 0px;
    left: calc(100% + 10px);
    width: 60px;
    height: 60px;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: rgba(27, 40, 56, 0.92);
    border: 1px solid #2a5891;
    color: #66c0f4;
    cursor: pointer;
    z-index: 5;
    user-select: none;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
    transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    font-family: "Motiva Sans", Arial, sans-serif;
  }
  .bsh-nfo-trigger:hover {
    transform: scale(1.07);
    background: rgba(42, 71, 94, 0.98);
    border-color: #66c0f4;
    color: #ffffff;
  }
  .bsh-nfo-trigger-code {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.8px;
    line-height: 1;
  }
  .bsh-nfo-trigger-sub {
    font-size: 9px;
    color: #8f98a0;
    letter-spacing: 0.3px;
    line-height: 1;
  }
  .bsh-nfo-trigger:hover .bsh-nfo-trigger-sub {
    color: #c6d4df;
  }

  #bshNfoModalOverlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 10005;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(4px);
    font-family: "Motiva Sans", Arial, sans-serif;
    color: #c6d4df;
    overflow-y: auto;
    padding: 36px 16px;
    box-sizing: border-box;
  }
  .bsh-nfo-modal {
    max-width: 980px;
    margin: 0 auto;
    background: #171d25;
    border: 1px solid #384658;
    border-radius: 6px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.88);
    overflow: hidden;
  }
  .bsh-nfo-header {
    padding: 14px 20px;
    background: #10151c;
    border-bottom: 1px solid #26303d;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .bsh-nfo-title {
    font-size: 17px;
    font-weight: 700;
    color: #66c0f4;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bsh-nfo-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bsh-nfo-btn {
    background: rgba(103, 193, 245, 0.14);
    border: 1px solid rgba(103, 193, 245, 0.3);
    color: #d6e2ed;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .bsh-nfo-btn:hover {
    background: rgba(103, 193, 245, 0.3);
    border-color: #66c0f4;
    color: #ffffff;
  }
  .bsh-nfo-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 18px 20px;
  }
  @media (max-width: 860px) {
    .bsh-nfo-grid {
      grid-template-columns: 1fr;
    }
  }
  .bsh-nfo-card {
    background: #1b2430;
    border: 1px solid #2a3748;
    border-radius: 5px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 420px;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .bsh-nfo-card:hover {
    border-color: rgba(102, 192, 244, 0.42);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }
  .bsh-nfo-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #2a3748;
    padding-bottom: 8px;
  }
  .bsh-nfo-card-title {
    font-size: 14px;
    font-weight: 700;
    color: #66c0f4;
    letter-spacing: 0.4px;
  }
  .bsh-nfo-card-body {
    font-size: 13px;
    line-height: 1.5;
    color: #c6d4df;
    overflow-y: auto;
    padding-right: 4px;
    scrollbar-width: thin;
    scrollbar-color: #2f435a #10161f;
  }
  .bsh-nfo-card-body::-webkit-scrollbar {
    width: 6px;
  }
  .bsh-nfo-card-body::-webkit-scrollbar-track {
    background: #10161f;
    border-radius: 3px;
  }
  .bsh-nfo-card-body::-webkit-scrollbar-thumb {
    background: #2f435a;
    border-radius: 3px;
  }
  .bsh-nfo-card-body::-webkit-scrollbar-thumb:hover {
    background: #4b6f9c;
  }
  .bsh-nfo-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 8px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.22);
    margin-bottom: 6px;
  }
  .bsh-nfo-stat-val {
    color: #ffffff;
    font-weight: 600;
  }
  .bsh-nfo-link {
    color: #66c0f4;
    text-decoration: none;
    cursor: pointer;
  }
  .bsh-nfo-link:hover {
    text-decoration: underline;
    color: #8fd0f8;
  }
  .bsh-nfo-list {
    margin: 6px 0 0 0;
    padding-left: 16px;
  }
  .bsh-nfo-list li {
    margin-bottom: 7px;
  }
`;

export function initStoreNfoModule(cfg: StoreWebkitConfig): void {
  if (!cfg.storeNfo) return;
  if (!window.location.pathname.includes('/app/')) return;

  const appIdMatch = window.location.pathname.match(/\/app\/(\d+)/);
  const appId = appIdMatch ? appIdMatch[1] : null;
  if (!appId) return;

  let loadedOnce = false;

  const getGameName = () => (document.querySelector('.apphub_AppName')?.textContent || '').trim();

  function renderHltbEntry(container: HTMLElement, entry: HltbEntry | null, allMatches?: HltbEntry[]): void {
    container.innerHTML = '';
    if (!entry) {
      container.innerHTML = `<div style="color:#8f98a0;">Игра не найдена в базе HowLongToBeat.</div>`;
      return;
    }

    const titleLink = document.createElement('a');
    titleLink.href = `https://howlongtobeat.com/game/${entry.game_id}`;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLink.className = 'bsh-nfo-link';
    titleLink.style.fontWeight = '700';
    titleLink.style.display = 'inline-block';
    titleLink.style.marginBottom = '10px';
    titleLink.textContent = entry.game_name || 'Открыть на HLTB';
    container.appendChild(titleLink);

    const rows = [
      { label: 'Только сюжет', time: entry.comp_main, count: entry.comp_main_count },
      { label: 'Сюжет + доп.', time: entry.comp_plus, count: entry.comp_plus_count },
      { label: 'Комплеционист', time: entry.comp_100, count: entry.comp_100_count },
      { label: 'Все стили', time: entry.comp_all, count: entry.comp_all_count },
    ];

    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'bsh-nfo-stat-row';
      row.innerHTML = `
        <span>${r.label}</span>
        <span><span class="bsh-nfo-stat-val">${formatHltbTime(r.time)}</span> <span style="color:#8f98a0;font-size:11px;">(${r.count || 0})</span></span>
      `;
      container.appendChild(row);
    }

    if (allMatches && allMatches.length > 1) {
      const othersWrap = document.createElement('div');
      othersWrap.style.marginTop = '10px';
      othersWrap.style.fontSize = '12px';
      othersWrap.innerHTML = `<div style="color:#8f98a0;margin-bottom:4px;">Другие совпадения:</div>`;
      const ul = document.createElement('ul');
      ul.className = 'bsh-nfo-list';
      allMatches.forEach((m) => {
        if (m.game_id === entry.game_id) return;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'bsh-nfo-link';
        a.textContent = `${m.game_name} (${m.percentage || 0}%)`;
        a.onclick = () => renderHltbEntry(container, m, allMatches);
        li.appendChild(a);
        ul.appendChild(li);
      });
      othersWrap.appendChild(ul);
      container.appendChild(othersWrap);
    }
  }

  async function loadHltbCard(bodyEl: HTMLElement): Promise<void> {
    bodyEl.innerHTML = `<div style="color:#8f98a0;">Запрос токена и поиск в HowLongToBeat...</div>`;
    const gameName = getGameName();
    if (!gameName) {
      bodyEl.innerHTML = `<div style="color:#ff7b72;">Не удалось определить название игры.</div>`;
      return;
    }

    const res = await searchHltbForGame(appId!, gameName);
    if (res.status === 'error') {
      bodyEl.innerHTML = `<div style="color:#ff7b72;">${res.error}</div>`;
      return;
    }
    if (res.status === 'not_found') {
      renderHltbEntry(bodyEl, null);
      return;
    }
    if (res.status === 'matches' && res.matches) {
      bodyEl.innerHTML = `<div style="color:#66c0f4;margin-bottom:6px;">Выберите игру из совпадений:</div>`;
      const ul = document.createElement('ul');
      ul.className = 'bsh-nfo-list';
      res.matches.forEach((m) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'bsh-nfo-link';
        a.textContent = `${m.game_name} (${m.percentage || 0}%)`;
        a.onclick = () => renderHltbEntry(bodyEl, m, res.matches);
        li.appendChild(a);
        ul.appendChild(li);
      });
      const noneLi = document.createElement('li');
      const noneA = document.createElement('a');
      noneA.className = 'bsh-nfo-link';
      noneA.style.color = '#8f98a0';
      noneA.textContent = 'Ничего не подходит';
      noneA.onclick = () => renderHltbEntry(bodyEl, null);
      noneLi.appendChild(noneA);
      ul.appendChild(noneLi);
      bodyEl.appendChild(ul);
      return;
    }

    renderHltbEntry(bodyEl, res.entry || null, res.matches);
  }

  async function renderZogDetails(bodyEl: HTMLElement, path: string): Promise<void> {
    bodyEl.innerHTML = `<div style="color:#8f98a0;">Загрузка списка русификаторов...</div>`;
    try {
      const details = await fetchZogLocalizations(path);
      bodyEl.innerHTML = '';

      const headerLink = document.createElement('a');
      headerLink.href = details.url;
      headerLink.target = '_blank';
      headerLink.rel = 'noopener noreferrer';
      headerLink.className = 'bsh-nfo-link';
      headerLink.style.fontWeight = '700';
      headerLink.style.display = 'inline-block';
      headerLink.style.marginBottom = '8px';
      headerLink.textContent = details.title;
      bodyEl.appendChild(headerLink);

      if (details.localizations.length === 0) {
        const empty = document.createElement('div');
        empty.style.color = '#8f98a0';
        empty.textContent = 'Русификаторы на странице игры отсутствуют.';
        bodyEl.appendChild(empty);
        return;
      }

      const ul = document.createElement('ul');
      ul.className = 'bsh-nfo-list';
      for (const loc of details.localizations) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = loc.link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'bsh-nfo-link';
        a.textContent = loc.size ? `${loc.name} (${loc.size})` : loc.name;
        li.appendChild(a);
        ul.appendChild(li);
      }
      bodyEl.appendChild(ul);
    } catch (e: any) {
      bodyEl.innerHTML = `<div style="color:#ff7b72;">Ошибка загрузки страницы ZOG (${e?.message || 'сбой'}).</div>`;
    }
  }

  async function loadZogCard(bodyEl: HTMLElement): Promise<void> {
    bodyEl.innerHTML = `<div style="color:#8f98a0;">Поиск игры на ZoneOfGames.ru...</div>`;
    try {
      const matches = await searchGamesOnZogStore(appId!, getGameName());
      if (matches.length === 0) {
        bodyEl.innerHTML = `<div style="color:#8f98a0;">Игра не найдена в базе ZoneOfGames.</div>`;
        return;
      }

      if (matches.length === 1 || matches[0].percentage >= 94) {
        await renderZogDetails(bodyEl, matches[0].path);
        return;
      }

      bodyEl.innerHTML = `<div style="color:#66c0f4;margin-bottom:6px;">Возможные совпадения на ZOG:</div>`;
      const ul = document.createElement('ul');
      ul.className = 'bsh-nfo-list';
      for (const m of matches) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'bsh-nfo-link';
        a.textContent = `${m.title} (${m.percentage}%)`;
        a.onclick = () => renderZogDetails(bodyEl, m.path);
        li.appendChild(a);
        ul.appendChild(li);
      }
      bodyEl.appendChild(ul);
    } catch (e: any) {
      bodyEl.innerHTML = `<div style="color:#ff7b72;">Ошибка поиска на ZOG (${e?.message || 'сеть'}).</div>`;
    }
  }

  async function loadFriendsAndAchCard(bodyEl: HTMLElement): Promise<void> {
    bodyEl.innerHTML = `<div style="color:#8f98a0;">Загрузка статистики друзей и достижений...</div>`;
    const [friendsData, achData] = await Promise.all([
      getFriendsSummary(appId!),
      getGlobalAchievementsStats(appId!),
    ]);

    bodyEl.innerHTML = '';

    const friendsHeader = document.createElement('div');
    friendsHeader.style.cssText = 'font-size:12px;font-weight:700;color:#66c0f4;margin-bottom:6px;text-transform:uppercase;';
    friendsHeader.textContent = 'Время друзей';
    bodyEl.appendChild(friendsHeader);

    if (friendsData.playtimes.length > 0) {
      const maxH = Math.max(...friendsData.playtimes.map((f) => f.hours));
      const minH = Math.min(...friendsData.playtimes.map((f) => f.hours));
      const avgH = friendsData.playtimes.reduce((s, f) => s + f.hours, 0) / friendsData.playtimes.length;
      const topPlayers = friendsData.playtimes.filter((f) => f.hours === maxH);

      const maxRow = document.createElement('div');
      maxRow.className = 'bsh-nfo-stat-row';
      const namesHtml = topPlayers
        .map((p) => `<a href="${p.profile}" target="_blank" class="bsh-nfo-link">${p.name}</a>`)
        .join(', ');
      maxRow.innerHTML = `<span>Максимум:</span><span><span class="bsh-nfo-stat-val">${maxH.toFixed(1)} ч.</span> (${namesHtml})</span>`;

      const avgRow = document.createElement('div');
      avgRow.className = 'bsh-nfo-stat-row';
      avgRow.innerHTML = `<span>Среднее (${friendsData.playtimes.length} чел.):</span><span class="bsh-nfo-stat-val">${avgH.toFixed(1)} ч.</span>`;

      const minRow = document.createElement('div');
      minRow.className = 'bsh-nfo-stat-row';
      minRow.innerHTML = `<span>Минимум:</span><span class="bsh-nfo-stat-val">${minH.toFixed(1)} ч.</span>`;

      bodyEl.append(maxRow, avgRow, minRow);
    } else {
      const noFriends = document.createElement('div');
      noFriends.style.cssText = 'color:#8f98a0;margin-bottom:10px;';
      noFriends.textContent = 'Друзья не играли или данные недоступны.';
      bodyEl.appendChild(noFriends);
    }

    const achHeader = document.createElement('div');
    achHeader.style.cssText = 'font-size:12px;font-weight:700;color:#66c0f4;margin:12px 0 6px 0;text-transform:uppercase;';
    achHeader.textContent = 'Глобальные достижения';
    bodyEl.appendChild(achHeader);

    if (achData.hasAchievements) {
      const platRow = document.createElement('div');
      platRow.className = 'bsh-nfo-stat-row';
      platRow.innerHTML = `<span>Платина (редчайшее):</span><span class="bsh-nfo-stat-val">${achData.platinumPercent}%</span>`;

      const avgAchRow = document.createElement('div');
      avgAchRow.className = 'bsh-nfo-stat-row';
      avgAchRow.innerHTML = `<span>Средний прогресс:</span><span class="bsh-nfo-stat-val">${achData.averageAdjustedPercent}%</span>`;

      bodyEl.append(platRow, avgAchRow);
    } else {
      const noAch = document.createElement('div');
      noAch.style.color = '#8f98a0';
      noAch.textContent = achData.error || 'Достижения отсутствуют.';
      bodyEl.appendChild(noAch);
    }
  }

  function closeNfoModal(): void {
    const overlay = document.getElementById('bshNfoModalOverlay') as any;
    if (overlay) {
      overlay.style.display = 'none';
      if (overlay._escHandler) {
        document.removeEventListener('keydown', overlay._escHandler);
        delete overlay._escHandler;
      }
    }
    document.body.style.overflow = '';
  }

  function openNfoModal(): void {
    let overlay = document.getElementById('bshNfoModalOverlay') as any;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bshNfoModalOverlay';
      overlay.innerHTML = `
        <div class="bsh-nfo-modal">
          <div class="bsh-nfo-header">
            <div class="bsh-nfo-title">
              <span>NFO — Сводка об игре</span>
              <span id="bsh-nfo-game-title" style="font-size:13px;color:#8f98a0;font-weight:400;"></span>
            </div>
            <div class="bsh-nfo-actions">
              <button type="button" id="bsh-nfo-refresh-all" class="bsh-nfo-btn">⟳ Обновить всё</button>
              <button type="button" id="bsh-nfo-close" class="bsh-nfo-btn">×</button>
            </div>
          </div>
          <div class="bsh-nfo-grid">
            <div class="bsh-nfo-card">
              <div class="bsh-nfo-card-head">
                <span class="bsh-nfo-card-title">⏱ HowLongToBeat</span>
                <button type="button" id="bsh-nfo-reload-hltb" class="bsh-nfo-btn" style="padding:2px 8px;font-size:12px;">⟳</button>
              </div>
              <div id="bsh-nfo-hltb-body" class="bsh-nfo-card-body">Нажмите ⟳ для загрузки.</div>
            </div>

            <div class="bsh-nfo-card">
              <div class="bsh-nfo-card-head">
                <span class="bsh-nfo-card-title">🇷🇺 Русификаторы (ZOG)</span>
                <button type="button" id="bsh-nfo-reload-zog" class="bsh-nfo-btn" style="padding:2px 8px;font-size:12px;">⟳</button>
              </div>
              <div id="bsh-nfo-zog-body" class="bsh-nfo-card-body">Нажмите ⟳ для загрузки.</div>
            </div>

            <div class="bsh-nfo-card">
              <div class="bsh-nfo-card-head">
                <span class="bsh-nfo-card-title">👥 Друзья и Достижения</span>
                <button type="button" id="bsh-nfo-reload-friends" class="bsh-nfo-btn" style="padding:2px 8px;font-size:12px;">⟳</button>
              </div>
              <div id="bsh-nfo-friends-body" class="bsh-nfo-card-body">Нажмите ⟳ для загрузки.</div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('#bsh-nfo-close').addEventListener('click', closeNfoModal);
      overlay.addEventListener('click', (e: MouseEvent) => {
        if (e.target === overlay) closeNfoModal();
      });

      const hltbBody = overlay.querySelector('#bsh-nfo-hltb-body') as HTMLElement;
      const zogBody = overlay.querySelector('#bsh-nfo-zog-body') as HTMLElement;
      const friendsBody = overlay.querySelector('#bsh-nfo-friends-body') as HTMLElement;

      const triggerAll = () => {
        loadedOnce = true;
        loadHltbCard(hltbBody);
        loadZogCard(zogBody);
        loadFriendsAndAchCard(friendsBody);
      };

      overlay.querySelector('#bsh-nfo-refresh-all').addEventListener('click', triggerAll);
      overlay.querySelector('#bsh-nfo-reload-hltb').addEventListener('click', () => loadHltbCard(hltbBody));
      overlay.querySelector('#bsh-nfo-reload-zog').addEventListener('click', () => loadZogCard(zogBody));
      overlay.querySelector('#bsh-nfo-reload-friends').addEventListener('click', () => loadFriendsAndAchCard(friendsBody));
    }

    const titleSpan = overlay.querySelector('#bsh-nfo-game-title');
    if (titleSpan) titleSpan.textContent = getGameName();

    if (!overlay._escHandler) {
      overlay._escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeNfoModal();
      };
      document.addEventListener('keydown', overlay._escHandler);
    }

    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';

    if (!loadedOnce && cfg.nfoAutoLoad) {
      loadedOnce = true;
      loadHltbCard(overlay.querySelector('#bsh-nfo-hltb-body'));
      loadZogCard(overlay.querySelector('#bsh-nfo-zog-body'));
      loadFriendsAndAchCard(overlay.querySelector('#bsh-nfo-friends-body'));
    }
  }

  function mountNfoButton(): void {
    const headerCtn = document.querySelector('#gameHeaderImageCtn') as HTMLElement | null;
    if (!headerCtn) return;
    if (headerCtn.querySelector('.bsh-nfo-trigger')) return;

    injectStyleOnce('bsh-store-nfo-styles', NFO_CSS);
    headerCtn.style.position = 'relative';

    const btn = document.createElement('div');
    btn.className = 'bsh-nfo-trigger';
    btn.title = 'Открыть сводку NFO: HLTB, русификаторы ZOG, время друзей и достижения';
    btn.innerHTML = `
      <span class="bsh-nfo-trigger-code">NFO</span>
      <span class="bsh-nfo-trigger-sub">HLTB·ZOG</span>
    `;
    if (!cfg.gamePage) {
      btn.style.left = 'calc(100% + 10px)';
    }

    btn.addEventListener('click', openNfoModal);
    headerCtn.appendChild(btn);

    const updateNfoPosition = () => {
      const rus = headerCtn.querySelector('.use-rus-indicator-container') as HTMLElement | null;
      if (rus && rus.offsetHeight > 0) {
        btn.style.top = `${rus.offsetTop + rus.offsetHeight + 16}px`;
      } else {
        btn.style.top = '0px';
      }
      btn.style.left = 'calc(100% + 10px)';
    };

    updateNfoPosition();
    const posObs = new MutationObserver(() => updateNfoPosition());
    posObs.observe(headerCtn, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', updateNfoPosition);

    restoreIncognitoFriendsSidebar(appId!);
  }

  let mounted = false;
  const tryMount = () => {
    if (mounted) return true;
    const headerCtn = document.querySelector('#gameHeaderImageCtn');
    if (headerCtn) {
      mounted = true;
      mountNfoButton();
      return true;
    }
    return false;
  };

  if (!tryMount()) {
    const observer = new MutationObserver((_m, obs) => {
      if (tryMount()) obs.disconnect();
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    setTimeout(() => {
      observer.disconnect();
      tryMount();
    }, 8000);
  }
}
