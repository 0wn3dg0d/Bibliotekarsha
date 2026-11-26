import {
  StoreWebkitConfig,
  getActiveSteamId64,
  idbGet,
  idbSet,
  injectStyleOnce,
} from '../../shared/ipc';

interface LocalWishlistEntry {
  name: string;
  headerUrl: string;
  addedAt: number;
}

const UIWL_CHUNK_SIZE = 24;

const UIWL_CSS = `
  @keyframes uiwlSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  #queueActionsCtn.uiwl-fixed-layout { justify-content: flex-start !important; }
  .uiwl-modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 100060; display: none; align-items: center; justify-content: center; backdrop-filter: blur(4px); font-family: "Motiva Sans", sans-serif; }
  .uiwl-modal-content { background: #1b2838; border: 1px solid #30363d; border-radius: 6px; width: 90vw; max-width: 1200px; height: 80vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.9); overflow: hidden; }
  .uiwl-modal-header { background: #101822; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; border-radius: 6px 6px 0 0; flex-shrink: 0; }
  .uiwl-header-title { color: #66c0f4; font-weight: bold; font-size: 18px; }
  .uiwl-close-btn { background: none; border: none; color: #8f98a0; font-size: 24px; cursor: pointer; line-height: 1; }
  .uiwl-close-btn:hover { color: #fff; }
  .uiwl-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); grid-auto-rows: max-content; gap: 15px; padding: 20px; overflow-y: auto; flex-grow: 1; align-content: start; min-height: 0; }
  .uiwl-card { background: #101822; border: 1px solid #30363d; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, border-color 0.2s; position: relative; min-height: 215px; }
  .uiwl-card:hover { transform: translateY(-3px); border-color: #66c0f4; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
  .uiwl-card img { width: 100%; height: 120px; flex-shrink: 0; object-fit: cover; border-bottom: 1px solid #30363d; display: block; }
  .uiwl-card-body { padding: 12px; display: flex; flex-direction: column; flex-grow: 1; min-height: 90px; }
  .uiwl-card-title { color: #fff; font-weight: bold; font-size: 14px; text-decoration: none; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; margin-bottom: auto; }
  .uiwl-card-title:hover { color: #66c0f4; }
  .uiwl-card-date { font-size: 11px; color: #8f98a0; margin-top: 8px; }
  .uiwl-card-remove { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.78); border: 1px solid #ff6961; color: #ff6961; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer; opacity: 0; transition: opacity 0.2s, background 0.2s; font-weight: bold; }
  .uiwl-card:hover .uiwl-card-remove, .uiwl-card-remove.confirming { opacity: 1; }
  .uiwl-card-remove:hover, .uiwl-card-remove.confirming { background: #ff6961; color: #fff; }
  .uiwl-gallery-grid::-webkit-scrollbar { width: 8px; }
  .uiwl-gallery-grid::-webkit-scrollbar-track { background: #101822; border-radius: 4px; }
  .uiwl-gallery-grid::-webkit-scrollbar-thumb { background-color: #30363D; border-radius: 4px; border: 2px solid #101822; }
  .uiwl-gallery-grid::-webkit-scrollbar-thumb:hover { background-color: #66c0f4; }
  .uiwl-btn-wrap { display: flex; align-items: center; margin-right: 3px; position: relative; }
  .uiwl-dropdown { position: absolute; background: #3d4450; border: 1px solid #000; box-shadow: 0 0 12px #000; z-index: 1000; display: none; top: 32px; left: 0; padding: 5px 0; min-width: 250px; }
  .uiwl-dropdown a { display: block; padding: 8px 15px; color: #c6d4df; text-decoration: none; font-size: 13px; text-align: left; }
  .uiwl-dropdown a:hover { background: #67c1f5; color: #fff; }
`;

export function initStoreIncognitoWishlistModule(cfg: StoreWebkitConfig): void {
  if (!cfg.incognitoWishlist) return;
  if (!window.location.pathname.includes('/app/')) return;

  const appIdMatch = window.location.pathname.match(/\/app\/(\d+)/);
  if (!appIdMatch) return;
  const appId = parseInt(appIdMatch[1], 10);

  injectStyleOnce('bsh-uiwl-styles', UIWL_CSS);

  let initialized = false;
  let dbKey = 'use_incognito_wishlist_db_v1';
  let galleryItems: Array<LocalWishlistEntry & { id: string }> = [];
  let galleryLimit = 0;

  const getDb = async (): Promise<Record<string, LocalWishlistEntry>> => {
    const data = await idbGet<Record<string, LocalWishlistEntry>>(dbKey);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  };

  const saveToDb = async (id: number | string, entry: LocalWishlistEntry) => {
    const db = await getDb();
    db[String(id)] = entry;
    await idbSet(dbKey, db);
    return db;
  };

  const deleteFromDb = async (id: number | string) => {
    const db = await getDb();
    if (db[String(id)]) {
      delete db[String(id)];
      await idbSet(dbKey, db);
    }
    return db;
  };

  const getAppMetaFromPage = () => {
    const name =
      document.querySelector('#appHubAppName, .apphub_AppName')?.textContent?.trim() || `App ${appId}`;
    const headerUrl =
      (document.querySelector('.game_header_image_full') as HTMLImageElement | null)?.src ||
      `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
    return { name, headerUrl };
  };

  const getRealUserData = async (): Promise<any | null> => {
    try {
      const res = await fetch(`https://store.steampowered.com/dynamicstore/userdata/?_t=${Date.now()}`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const isUserLoggedIn = (userData: any): boolean => {
    if (!userData || !Array.isArray(userData.rgOwnedApps)) return false;
    const hasAccountData =
      userData.rgOwnedApps.length > 0 ||
      (Array.isArray(userData.rgWishlist) && userData.rgWishlist.length > 0) ||
      (Array.isArray(userData.rgOwnedPackages) && userData.rgOwnedPackages.length > 0);
    const hasLoginCookie = /(?:^|;\s*)steamLoginSecure=/.test(document.cookie);
    return hasAccountData || hasLoginCookie;
  };

  const removeFromOfficialWishlist = async (targetAppId: number): Promise<boolean> => {
    const sessionidMatch = document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/);
    if (!sessionidMatch) return false;
    try {
      const res = await fetch('https://store.steampowered.com/api/removefromwishlist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `sessionid=${encodeURIComponent(sessionidMatch[1])}&appid=${targetAppId}`,
      });
      if (!res.ok) return false;
      const json = await res.json();
      return Boolean(json && json.success === true);
    } catch {
      return false;
    }
  };

  const updateGalleryHeaderCount = (count: number) => {
    const titleEl = document.querySelector('#uiwl-modal .uiwl-header-title');
    if (titleEl) {
      titleEl.textContent = `Недоступное желаемое (Локальный список: ${count})`;
    }
  };

  const renderGalleryChunk = (renderActionState: (st: 'in_library' | 'loading' | 'in_wishlist' | 'not_in_wishlist') => Promise<void>) => {
    const grid = document.getElementById('uiwl-gallery-grid');
    if (!grid) return;

    const startIndex = galleryLimit - UIWL_CHUNK_SIZE;
    const itemsToRender = galleryItems.slice(Math.max(0, startIndex), galleryLimit);
    const frag = document.createDocumentFragment();

    itemsToRender.forEach((data) => {
      const id = String(data.id).replace(/\D/g, '');
      const safeName = String(data.name || `App ${id}`);
      const fallbackImg = `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;
      const dateAdded = data.addedAt ? new Date(data.addedAt).toLocaleDateString('ru-RU') : '—';

      const card = document.createElement('div');
      card.className = 'uiwl-card';
      card.innerHTML = `
        <button type="button" class="uiwl-card-remove" title="Удалить из списка">X</button>
        <a href="https://store.steampowered.com/app/${id}" target="_blank" rel="noopener noreferrer">
          <img loading="lazy">
        </a>
        <div class="uiwl-card-body">
          <a href="https://store.steampowered.steamstatic.com/" class="uiwl-card-title"></a>
          <div class="uiwl-card-date"></div>
        </div>
      `;

      const imgEl = card.querySelector('img') as HTMLImageElement;
      imgEl.src = data.headerUrl || fallbackImg;
      imgEl.onerror = () => {
        imgEl.onerror = null;
        imgEl.src = fallbackImg;
      };

      const titleLink = card.querySelector('.uiwl-card-title') as HTMLAnchorElement;
      titleLink.href = `https://store.steampowered.com/app/${id}`;
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.textContent = safeName;
      titleLink.title = safeName;

      card.querySelector('.uiwl-card-date')!.textContent = `Добавлено: ${dateAdded}`;

      const removeBtn = card.querySelector('.uiwl-card-remove') as HTMLButtonElement;
      let confirmTimer: ReturnType<typeof setTimeout> | null = null;
      removeBtn.onclick = async (e) => {
        e.preventDefault();
        if (!removeBtn.classList.contains('confirming')) {
          removeBtn.classList.add('confirming');
          removeBtn.textContent = 'Точно?';
          confirmTimer = setTimeout(() => {
            removeBtn.classList.remove('confirming');
            removeBtn.textContent = 'X';
          }, 3500);
          return;
        }
        if (confirmTimer) clearTimeout(confirmTimer);
        const updatedDb = await deleteFromDb(id);
        const remainingCount = Object.keys(updatedDb).length;
        updateGalleryHeaderCount(remainingCount);
        card.remove();

        if (Number(id) === appId) {
          await renderActionState('not_in_wishlist');
        }
        if (remainingCount === 0) {
          grid.innerHTML =
            '<div style="color:#8f98a0; grid-column: 1/-1; text-align:center; padding: 40px; font-size: 15px;">Ваш локальный список желаемого пуст.</div>';
        }
      };

      frag.appendChild(card);
    });

    grid.appendChild(frag);

    setTimeout(() => {
      if (grid.scrollHeight <= grid.clientHeight && galleryLimit < galleryItems.length) {
        galleryLimit += UIWL_CHUNK_SIZE;
        renderGalleryChunk(renderActionState);
      }
    }, 50);
  };

  const openLocalWishlistGallery = async (
    renderActionState: (st: 'in_library' | 'loading' | 'in_wishlist' | 'not_in_wishlist') => Promise<void>
  ) => {
    const db = await getDb();
    let modal = document.getElementById('uiwl-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'uiwl-modal';
      modal.className = 'uiwl-modal-overlay';
      modal.innerHTML = `
        <div class="uiwl-modal-content">
          <div class="uiwl-modal-header">
            <span class="uiwl-header-title">Недоступное желаемое (Локальный список)</span>
            <button type="button" class="uiwl-close-btn">&times;</button>
          </div>
          <div class="uiwl-gallery-grid" id="uiwl-gallery-grid"></div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('.uiwl-close-btn')!.addEventListener('click', () => {
        modal!.style.display = 'none';
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal!.style.display = 'none';
      });

      const grid = modal.querySelector('#uiwl-gallery-grid')!;
      grid.addEventListener('scroll', () => {
        if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 200) {
          if (galleryLimit < galleryItems.length) {
            galleryLimit += UIWL_CHUNK_SIZE;
            renderGalleryChunk(renderActionState);
          }
        }
      });
    }

    galleryLimit = UIWL_CHUNK_SIZE;
    const grid = document.getElementById('uiwl-gallery-grid')!;
    grid.innerHTML = '';

    galleryItems = Object.entries(db).map(([id, data]) => ({ id, ...data }));
    galleryItems.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    updateGalleryHeaderCount(galleryItems.length);

    if (galleryItems.length === 0) {
      grid.innerHTML =
        '<div style="color:#8f98a0; grid-column: 1/-1; text-align:center; padding: 40px; font-size: 15px;">Ваш локальный список желаемого пуст.</div>';
    } else {
      renderGalleryChunk(renderActionState);
    }

    modal.style.display = 'flex';
  };

  const runIfReady = async (): Promise<boolean> => {
    if (initialized) return true;
    const queueActionsCtn = document.getElementById('queueActionsCtn');
    if (!queueActionsCtn) return false;

    const loginPromptP = queueActionsCtn.querySelector('p');
    const loginPromptA = loginPromptP ? loginPromptP.querySelector('a[href*="/login/"]') : null;
    const isIncognito = Boolean((window as any).__BSH_INCOGNITO_ACTIVE);

    if (!isIncognito && !loginPromptA) return false;
    initialized = true;

    const steamId = await getActiveSteamId64();
    if (steamId) {
      dbKey = `use_incognito_wishlist_db_v1_${steamId}`;
    }

    const attachDropdownMenu = async (wrapper: HTMLElement, showRemove: boolean) => {
      const dbCount = Object.keys(await getDb()).length;
      if (!showRemove && dbCount === 0) return;

      const mainBtn = wrapper.firstElementChild as HTMLElement | null;
      if (mainBtn) {
        mainBtn.style.borderTopRightRadius = '0';
        mainBtn.style.borderBottomRightRadius = '0';
      }

      const dropdownWrap = document.createElement('div');
      dropdownWrap.className = 'queue_control_button queue_btn_menu';
      dropdownWrap.style.cssText = 'margin: 0; border-top-left-radius: 0; border-bottom-left-radius: 0;';
      dropdownWrap.innerHTML = `
        <div class="queue_menu_arrow queue_btn_active btn_medium" style="height: 32px; display: flex; align-items: center;">
          <span><img src="https://store.fastly.steamstatic.com/public/images/v6/btn_arrow_down_padded.png"></span>
        </div>
        <div class="uiwl-dropdown">
          <a href="#" class="uiwl-opt-gallery">Управление недоступным желаемым</a>
          ${showRemove ? '<a href="#" class="uiwl-opt-remove">Удалить из списка</a>' : ''}
        </div>
      `;

      const menu = dropdownWrap.querySelector('.uiwl-dropdown') as HTMLElement;
      dropdownWrap.onmouseenter = () => (menu.style.display = 'block');
      dropdownWrap.onmouseleave = () => (menu.style.display = 'none');

      dropdownWrap.querySelector('.uiwl-opt-gallery')!.addEventListener('click', (e) => {
        e.preventDefault();
        menu.style.display = 'none';
        openLocalWishlistGallery(renderActionState);
      });

      if (showRemove) {
        dropdownWrap.querySelector('.uiwl-opt-remove')?.addEventListener('click', async (e) => {
          e.preventDefault();
          await deleteFromDb(appId);
          await renderActionState('not_in_wishlist');
        });
      }

      wrapper.appendChild(dropdownWrap);
    };

    const renderActionState = async (
      state: 'in_library' | 'loading' | 'in_wishlist' | 'not_in_wishlist'
    ) => {
      queueActionsCtn.classList.add('uiwl-fixed-layout');
      if (loginPromptP) (loginPromptP as HTMLElement).style.display = 'none';

      let wrapper = document.getElementById('uiwl-btn-wrapper');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'uiwl-btn-wrapper';
        wrapper.className = 'uiwl-btn-wrap queue_control_button';
        queueActionsCtn.prepend(wrapper);
      }

      wrapper.innerHTML = '';

      if (state === 'in_library') {
        wrapper.innerHTML = `
          <div class="btnv6_blue_hoverfade btn_medium queue_btn_active" style="cursor: default; opacity: 0.9;">
            <span><img src="https://store.fastly.steamstatic.com/public/images/v6/ico/ico_selected.png" border="0"> В библиотеке</span>
          </div>
        `;
        await attachDropdownMenu(wrapper, false);
      } else if (state === 'loading') {
        wrapper.innerHTML = `
          <div class="btnv6_blue_hoverfade btn_medium" style="opacity: 0.7; cursor: wait;">
            <span>Перенос из Steam... <span style="width: 1em; height: 1em; display: inline-block; vertical-align: middle; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: #fff; border-radius: 50%; animation: uiwlSpin 1s linear infinite;"></span></span>
          </div>
        `;
      } else if (state === 'in_wishlist') {
        wrapper.innerHTML = `
          <a href="#" class="btnv6_blue_hoverfade btn_medium queue_btn_active add_to_wishlist" id="uiwl-remove-btn" title="Удалить из локального списка желаемого">
            <span><img src="https://store.fastly.steamstatic.com/public/images/v6/ico/ico_selected.png" border="0"> В желаемом</span>
          </a>
        `;
        wrapper.querySelector('#uiwl-remove-btn')!.addEventListener('click', async (e) => {
          e.preventDefault();
          await deleteFromDb(appId);
          await renderActionState('not_in_wishlist');
        });
        await attachDropdownMenu(wrapper, true);
      } else {
        wrapper.innerHTML = `
          <a href="#" class="btnv6_blue_hoverfade btn_medium add_to_wishlist" id="uiwl-add-btn">
            <span>В желаемое</span>
          </a>
        `;
        wrapper.querySelector('#uiwl-add-btn')!.addEventListener('click', async (e) => {
          e.preventDefault();
          const { name, headerUrl } = getAppMetaFromPage();
          await saveToDb(appId, { name, headerUrl, addedAt: Date.now() });
          await renderActionState('in_wishlist');
        });
        await attachDropdownMenu(wrapper, false);
      }
    };

    const userData = await getRealUserData();
    if (!isUserLoggedIn(userData)) return true;

    if (loginPromptP) (loginPromptP as HTMLElement).style.display = 'none';

    if (userData.rgOwnedApps.includes(appId)) {
      await deleteFromDb(appId);
      await renderActionState('in_library');
      if (Array.isArray(userData.rgWishlist) && userData.rgWishlist.includes(appId)) {
        await removeFromOfficialWishlist(appId);
      }
      return true;
    }

    if (Array.isArray(userData.rgWishlist) && userData.rgWishlist.includes(appId)) {
      await renderActionState('loading');
      const currentDb = await getDb();
      if (!currentDb[String(appId)]) {
        const { name, headerUrl } = getAppMetaFromPage();
        await saveToDb(appId, { name, headerUrl, addedAt: Date.now() });
      }
      await removeFromOfficialWishlist(appId);
      await renderActionState('in_wishlist');
    } else {
      const currentDb = await getDb();
      await renderActionState(currentDb[String(appId)] ? 'in_wishlist' : 'not_in_wishlist');
    }

    return true;
  };

  runIfReady().then((done) => {
    if (done) return;
    const obs = new MutationObserver(async (_m, o) => {
      if (await runIfReady()) o.disconnect();
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      runIfReady();
    }, 10000);
  });
}
