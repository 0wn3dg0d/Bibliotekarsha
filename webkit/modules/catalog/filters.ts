import {
  CatalogGameData,
  ROW_SELECTOR,
  catalogGameCache,
  getAllCatalogTags,
  onCatalogRowHydrated,
} from './store';

export function attachCollapseToggle(block: HTMLElement): void {
  const header = block.querySelector('.block_header');
  if (!header) return;
  header.addEventListener('click', () => {
    block.classList.toggle('collapsed');
  });
}

export function findSidebarAnchor(): { parent: Node; insertAfter: Element | null } | null {
  const priceBlock = document.querySelector('.block.search_collapse_block[data-collapse-name="price"]');
  if (priceBlock?.parentNode) {
    return { parent: priceBlock.parentNode, insertAfter: priceBlock };
  }
  const container = document.querySelector('#additional_search_filters');
  if (container) {
    return { parent: container, insertAfter: container.firstElementChild };
  }
  return null;
}

export function initCatalogFilters(): void {
  const activeTagFilters: Record<string, number> = {};
  const hiddenTagFilters: Record<string, boolean> = {};

  const animateHide = (el: HTMLElement) => {
    if (el.dataset.bshHidden === '1') return;
    el.dataset.bshHidden = '1';
    el.style.transition = 'opacity 0.35s ease-out, transform 0.35s ease-out';
    el.style.opacity = '0';
    el.style.transform = 'translateX(-40%)';
    setTimeout(() => {
      if (el.dataset.bshHidden === '1') {
        el.style.display = 'none';
      }
    }, 350);
  };

  const animateShow = (el: HTMLElement) => {
    if (el.dataset.bshHidden !== '1') return;
    el.dataset.bshHidden = '0';
    el.style.display = '';
    el.style.opacity = '0';
    el.style.transform = 'translateX(-40%)';
    el.style.transition = 'opacity 0.35s ease-in-out, transform 0.35s ease-in-out';
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    });
    setTimeout(() => {
      if (el.dataset.bshHidden === '0') {
        el.style.transition = '';
        el.style.transform = '';
      }
    }, 360);
  };

  const applyAllFiltersToRow = (row: HTMLElement, explicitData?: CatalogGameData) => {
    const appId = row.dataset.dsAppid;
    const gameData = explicitData || (appId ? catalogGameCache.get(appId) : undefined);
    if (!gameData) return;

    let isVisible = true;

    const dlcFilterActive = Boolean(
      document.querySelector('[data-param="your_dlc"] .tab_filter_control')?.classList.contains('checked')
    );
    if (dlcFilterActive && !row.classList.contains('es_highlighted_dlcforya')) {
      isVisible = false;
    }

    if (isVisible) {
      const hasRussianText = Boolean(
        gameData.language_support_russian?.supported || gameData.language_support_russian?.subtitles
      );
      const hasRussianVoice = Boolean(gameData.language_support_russian?.full_audio);
      const hasAnyRussian = hasRussianText || hasRussianVoice;

      const translationChecked = Boolean(
        document.querySelector('[data-param="russian_translation"] .tab_filter_control')?.classList.contains('checked')
      );
      const voiceChecked = Boolean(
        document.querySelector('[data-param="russian_voice"] .tab_filter_control')?.classList.contains('checked')
      );
      const noRussianChecked = Boolean(
        document.querySelector('[data-param="no_russian"] .tab_filter_control')?.classList.contains('checked')
      );

      if (translationChecked && (!hasRussianText || hasRussianVoice)) isVisible = false;
      else if (voiceChecked && !hasRussianVoice) isVisible = false;
      else if (noRussianChecked && hasAnyRussian) isVisible = false;
    }

    if (isVisible) {
      const eaOnlyChecked = Boolean(
        document.querySelector('[data-param="ea_only"] .tab_filter_control')?.classList.contains('checked')
      );
      const eaWasChecked = Boolean(
        document.querySelector('[data-param="ea_was"] .tab_filter_control')?.classList.contains('checked')
      );
      const eaHideChecked = Boolean(
        document.querySelector('[data-param="ea_hide"] .tab_filter_control')?.classList.contains('checked')
      );

      if (eaOnlyChecked && !gameData.is_early_access) isVisible = false;
      else if (eaWasChecked && (gameData.is_early_access || !gameData.has_original_release_date)) isVisible = false;
      else if (eaHideChecked && gameData.is_early_access) isVisible = false;
    }

    if (isVisible) {
      const dpRow = document.querySelector('#dp_filter_container .tab_filter_control_row.checked') as HTMLElement | null;
      const dpMode = dpRow?.dataset.dp || 'any';
      if (dpMode === 'both' && !gameData.has_demo && !gameData.has_playtest) isVisible = false;
      if (dpMode === 'demo' && !gameData.has_demo) isVisible = false;
      if (dpMode === 'playtest' && !gameData.has_playtest) isVisible = false;
    }

    if (isVisible) {
      const readNum = (id: string): number | null => {
        const raw = (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() || '';
        if (raw === '') return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
      };
      const revMin = readNum('bsh-cat-rev-min');
      const revMax = readNum('bsh-cat-rev-max');
      const ratMin = readNum('bsh-cat-rat-min');
      const ratMax = readNum('bsh-cat-rat-max');

      if (revMin !== null && gameData.review_count < revMin) isVisible = false;
      if (isVisible && revMax !== null && gameData.review_count > revMax) isVisible = false;
      if (isVisible && ratMin !== null && gameData.percent_positive < ratMin) isVisible = false;
      if (isVisible && ratMax !== null && gameData.percent_positive > ratMax) isVisible = false;
    }

    if (isVisible && (Object.keys(activeTagFilters).length > 0 || Object.keys(hiddenTagFilters).length > 0)) {
      const tags = gameData.tagids || [];
      if (tags.length === 0) {
        if (Object.keys(activeTagFilters).length > 0) isVisible = false;
      } else {
        for (const tagId of Object.keys(hiddenTagFilters)) {
          if (tags.includes(parseInt(tagId, 10))) {
            isVisible = false;
            break;
          }
        }
        if (isVisible) {
          for (const tagId of Object.keys(activeTagFilters)) {
            const maxPos = activeTagFilters[tagId];
            const idx = tags.indexOf(parseInt(tagId, 10));
            if (idx === -1 || idx >= maxPos) {
              isVisible = false;
              break;
            }
          }
        }
      }
    }

    if (isVisible) animateShow(row);
    else animateHide(row);
  };

  const applyAllFilters = () => {
    document.querySelectorAll(ROW_SELECTOR).forEach((el) => applyAllFiltersToRow(el as HTMLElement));
  };

  onCatalogRowHydrated((row, data) => {
    applyAllFiltersToRow(row, data);
  });

  const renderTagFilters = () => {
    const activeCtn = document.getElementById('active-tag-filters-container');
    const hiddenCtn = document.getElementById('hidden-tag-filters-container');
    if (!activeCtn || !hiddenCtn) return;

    const allTags = getAllCatalogTags();
    activeCtn.innerHTML = '';
    hiddenCtn.innerHTML = '';

    for (const tagId of Object.keys(activeTagFilters)) {
      const tagName = allTags[tagId] || `TagID: ${tagId}`;
      const pos = activeTagFilters[tagId];
      const row = document.createElement('div');
      row.className = 'active-tag-filter-row';
      row.draggable = true;
      row.dataset.tagid = tagId;
      row.innerHTML = `
        <span>${tagName}</span>
        <input type="number" class="tag-position-input" value="${pos}" min="1" max="20" data-tagid="${tagId}">
        <button type="button" class="btn-remove-tag" data-tagid="${tagId}">X</button>
      `;
      row.querySelector('.tag-position-input')?.addEventListener('mousedown', (e) => e.stopPropagation());
      activeCtn.appendChild(row);
    }

    for (const tagId of Object.keys(hiddenTagFilters)) {
      const tagName = allTags[tagId] || `TagID: ${tagId}`;
      const row = document.createElement('div');
      row.className = 'hidden-tag-filter-row';
      row.draggable = true;
      row.dataset.tagid = tagId;
      row.innerHTML = `
        <span>${tagName}</span>
        <button type="button" class="btn-remove-tag" data-tagid="${tagId}">X</button>
      `;
      hiddenCtn.appendChild(row);
    }
  };

  const createTagFilterModal = () => {
    if (document.getElementById('tag-filter-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'tag-filter-modal';
    overlay.className = 'tag-modal-overlay';
    overlay.innerHTML = `
      <div class="tag-modal">
        <div class="tag-modal-header">
          <h2>Настройка умных меток</h2>
          <button type="button" class="tag-modal-close" data-action="close-tag-modal">&times;</button>
        </div>
        <div class="tag-modal-body">
          <input type="text" id="tag-search-input" class="tag-search-input" placeholder="Введите название метки...">
          <div id="tag-search-results" class="tag-search-results"></div>
          <div class="tag-filters-sections">
            <div id="active-tags-section" class="tag-filters-section">
              <div class="tag-filters-section-title">Активные фильтры (по приоритету 1–20)</div>
              <div id="active-tag-filters-container"></div>
            </div>
            <div id="hidden-tags-section" class="tag-filters-section">
              <div class="tag-filters-section-title">Скрытые фильтры (исключить)</div>
              <div id="hidden-tag-filters-container"></div>
            </div>
          </div>
        </div>
        <div class="tag-modal-footer">
          <button type="button" class="btn_green_white_innerfade btn_medium" data-action="apply-tags-and-close">
            <span>Применить и закрыть</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const searchInput = document.getElementById('tag-search-input') as HTMLInputElement;
    const searchResults = document.getElementById('tag-search-results')!;
    const activeCtn = document.getElementById('active-tag-filters-container')!;
    const hiddenCtn = document.getElementById('hidden-tag-filters-container')!;

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      searchResults.innerHTML = '';
      if (q.length < 2) return;

      const allTags = getAllCatalogTags();
      Object.entries(allTags)
        .filter(([id, name]) => name.toLowerCase().includes(q) && !activeTagFilters[id] && !hiddenTagFilters[id])
        .slice(0, 50)
        .forEach(([id, name]) => {
          const item = document.createElement('div');
          item.className = 'tag-search-result-item';
          item.textContent = name;
          item.dataset.tagid = id;
          searchResults.appendChild(item);
        });
    });

    searchResults.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('tag-search-result-item') || !target.dataset.tagid) return;
      activeTagFilters[target.dataset.tagid] = 20;
      target.remove();
      renderTagFilters();
      searchInput.value = '';
      searchResults.innerHTML = '';
    });

    activeCtn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('btn-remove-tag') && target.dataset.tagid) {
        delete activeTagFilters[target.dataset.tagid];
        renderTagFilters();
      }
    });

    activeCtn.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains('tag-position-input') && target.dataset.tagid) {
        let v = parseInt(target.value, 10);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 20) v = 20;
        activeTagFilters[target.dataset.tagid] = v;
        target.value = String(v);
      }
    });

    hiddenCtn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('btn-remove-tag') && target.dataset.tagid) {
        delete hiddenTagFilters[target.dataset.tagid];
        renderTagFilters();
      }
    });

    let draggedEl: HTMLElement | null = null;
    [activeCtn, hiddenCtn].forEach((ctn) => {
      ctn.addEventListener('dragstart', (e) => {
        draggedEl = e.target as HTMLElement;
        setTimeout(() => {
          if (draggedEl) draggedEl.style.opacity = '0.5';
        }, 0);
      });
      ctn.addEventListener('dragend', (e) => {
        (e.target as HTMLElement).style.opacity = '1';
        draggedEl = null;
      });
    });

    const setupDropZone = (zoneId: string, toHidden: boolean) => {
      const zone = document.getElementById(zoneId);
      if (!zone) return;
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const tagId = draggedEl?.dataset.tagid;
        if (!tagId) return;
        if (toHidden) {
          delete activeTagFilters[tagId];
          hiddenTagFilters[tagId] = true;
        } else {
          delete hiddenTagFilters[tagId];
          if (!activeTagFilters[tagId]) activeTagFilters[tagId] = 20;
        }
        renderTagFilters();
      });
    };

    setupDropZone('active-tags-section', false);
    setupDropZone('hidden-tags-section', true);

    overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === overlay) {
        overlay.style.display = 'none';
        return;
      }
      const actionEl = target.closest('[data-action]') as HTMLElement | null;
      if (actionEl?.dataset.action === 'close-tag-modal') {
        overlay.style.display = 'none';
      } else if (actionEl?.dataset.action === 'apply-tags-and-close') {
        overlay.style.display = 'none';
        applyAllFilters();
      }
    });
  };

  const mountSidebarFilterBlocks = (): boolean => {
    if (document.getElementById('bsh-catalog-ru-block')) return true;
    const anchor = findSidebarAnchor();
    if (!anchor) return false;

    const ruBlock = document.createElement('div');
    ruBlock.id = 'bsh-catalog-ru-block';
    ruBlock.className = 'block search_collapse_block';
    ruBlock.innerHTML = `
      <div class="block_header labs_block_header"><div>Русский перевод</div></div>
      <div class="block_content block_content_inner">
        <div class="tab_filter_control_row" data-param="russian_translation"><span class="tab_filter_control tab_filter_control_include"><span><span class="tab_filter_control_checkbox"></span><span class="tab_filter_control_label">Только текст</span></span></span></div>
        <div class="tab_filter_control_row" data-param="russian_voice"><span class="tab_filter_control tab_filter_control_include"><span><span class="tab_filter_control_checkbox"></span><span class="tab_filter_control_label">Озвучка</span></span></span></div>
        <div class="tab_filter_control_row" data-param="no_russian"><span class="tab_filter_control tab_filter_control_include"><span><span class="tab_filter_control_checkbox"></span><span class="tab_filter_control_label">Без перевода</span></span></span></div>
      </div>
    `;

    const dlcBlock = document.createElement('div');
    dlcBlock.id = 'bsh-catalog-dlc-block';
    dlcBlock.className = 'block search_collapse_block';
    dlcBlock.innerHTML = `
      <div class="block_header labs_block_header"><div>DLC</div></div>
      <div class="block_content block_content_inner">
        <div class="tab_filter_control_row" data-param="your_dlc"><span class="tab_filter_control tab_filter_control_include"><span><span class="tab_filter_control_checkbox"></span><span class="tab_filter_control_label">Только ваши DLC</span></span></span></div>
      </div>
    `;

    const eaBlock = document.createElement('div');
    eaBlock.id = 'bsh-catalog-ea-block';
    eaBlock.className = 'block search_collapse_block';
    eaBlock.innerHTML = `
      <div class="block_header labs_block_header"><div>Ранний доступ</div></div>
      <div class="block_content block_content_inner">
        <div class="tab_filter_control_row" data-param="ea_only"><span class="tab_filter_control tab_filter_control_include"><span><span class="tab_filter_control_checkbox"></span><span class="tab_filter_control_label">Только ранний доступ</span></span></span></div>
        <div class="tab_filter_control_row" data-param="ea_was"><span class="tab_filter_control tab_filter_control_include"><span><span class="tab_filter_control_checkbox"></span><span class="tab_filter_control_label">Бывший EA / Переиздание</span></span></span></div>
        <div class="tab_filter_control_row" data-param="ea_hide"><span class="tab_filter_control tab_filter_control_include"><span><span class="tab_filter_control_checkbox"></span><span class="tab_filter_control_label">Скрыть ранний доступ</span></span></span></div>
      </div>
    `;

    const dpBlock = document.createElement('div');
    dpBlock.id = 'bsh-catalog-dp-block';
    dpBlock.className = 'block search_collapse_block';
    dpBlock.innerHTML = `
      <div class="block_header labs_block_header"><div>Демо и плейтесты</div></div>
      <div class="block_content block_content_inner" id="dp_filter_container">
        <div class="tab_filter_control_row" data-dp="both"><span class="tab_filter_control tab_filter_control_include"><span><span class="tab_filter_control_checkbox"></span><span class="tab_filter_control_label">С демо или плейтестом</span></span></span></div>
        <div class="tab_filter_control_row" data-dp="demo"><span class="tab_filter_control tab_filter_control_include"><span><span class="tab_filter_control_checkbox"></span><span class="tab_filter_control_label">Только демо</span></span></span></div>
        <div class="tab_filter_control_row" data-dp="playtest"><span class="tab_filter_control tab_filter_control_include"><span><span class="tab_filter_control_checkbox"></span><span class="tab_filter_control_label">Только плейтесты</span></span></span></div>
      </div>
    `;

    const reviewsBlock = document.createElement('div');
    reviewsBlock.id = 'bsh-catalog-reviews-block';
    reviewsBlock.className = 'block search_collapse_block';
    reviewsBlock.innerHTML = `
      <div class="block_header labs_block_header"><div>Обзоры и рейтинг</div></div>
      <div class="block_content block_content_inner">
        <div class="bsh-cat-range-grid">
          <div class="bsh-cat-range-field">
            <label for="bsh-cat-rev-min">Обзоров от</label>
            <input type="number" id="bsh-cat-rev-min" min="0" placeholder="0">
          </div>
          <div class="bsh-cat-range-field">
            <label for="bsh-cat-rev-max">Обзоров до</label>
            <input type="number" id="bsh-cat-rev-max" min="0" placeholder="∞">
          </div>
          <div class="bsh-cat-range-field">
            <label for="bsh-cat-rat-min">Рейтинг от %</label>
            <input type="number" id="bsh-cat-rat-min" min="0" max="100" placeholder="0">
          </div>
          <div class="bsh-cat-range-field">
            <label for="bsh-cat-rat-max">Рейтинг до %</label>
            <input type="number" id="bsh-cat-rat-max" min="0" max="100" placeholder="100">
          </div>
        </div>
        <button type="button" id="bsh-cat-reviews-reset" class="bsh-cat-reset-btn" style="display:none;">Сбросить</button>
      </div>
    `;

    const tagBlock = document.createElement('div');
    tagBlock.id = 'bsh-catalog-tags-block';
    tagBlock.className = 'block search_collapse_block';
    tagBlock.innerHTML = `
      <div class="block_header labs_block_header"><div>Умные метки</div></div>
      <div class="block_content block_content_inner">
        <div class="tab_filter_control_row"><span id="open-tag-modal-btn-styled" class="tab_filter_control_label">Настроить метки...</span></div>
      </div>
    `;

    const blocks = [ruBlock, dlcBlock, eaBlock, dpBlock, reviewsBlock, tagBlock];
    let refNode: Node | null = anchor.insertAfter ? anchor.insertAfter.nextSibling : null;
    blocks.forEach((b) => {
      attachCollapseToggle(b);
      anchor.parent.insertBefore(b, refNode);
      refNode = b.nextSibling;
    });

    const wireExclusiveGroup = (container: HTMLElement) => {
      const rows = Array.from(container.querySelectorAll('.tab_filter_control_row'));
      rows.forEach((row) => {
        row.addEventListener('click', () => {
          const ctrl = row.querySelector('.tab_filter_control');
          const wasChecked = Boolean(ctrl?.classList.contains('checked'));
          rows.forEach((r) => {
            r.classList.remove('checked');
            r.querySelector('.tab_filter_control')?.classList.remove('checked');
          });
          if (!wasChecked) {
            row.classList.add('checked');
            ctrl?.classList.add('checked');
          }
          applyAllFilters();
        });
      });
    };

    wireExclusiveGroup(ruBlock);
    wireExclusiveGroup(eaBlock);
    wireExclusiveGroup(dpBlock);

    const dlcRow = dlcBlock.querySelector('[data-param="your_dlc"]');
    dlcRow?.addEventListener('click', () => {
      dlcRow.classList.toggle('checked');
      dlcRow.querySelector('.tab_filter_control')?.classList.toggle('checked');
      applyAllFilters();
    });

    let revDebounce: ReturnType<typeof setTimeout> | null = null;
    const revInputIds = ['bsh-cat-rev-min', 'bsh-cat-rev-max', 'bsh-cat-rat-min', 'bsh-cat-rat-max'];
    const revResetBtn = document.getElementById('bsh-cat-reviews-reset') as HTMLButtonElement | null;
    const syncRevResetVisibility = () => {
      if (!revResetBtn) return;
      const anyFilled = revInputIds.some((id) => ((document.getElementById(id) as HTMLInputElement | null)?.value?.trim() || '') !== '');
      revResetBtn.style.display = anyFilled ? 'block' : 'none';
    };
    revInputIds.forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => {
        syncRevResetVisibility();
        if (revDebounce) clearTimeout(revDebounce);
        revDebounce = setTimeout(applyAllFilters, 250);
      });
    });
    revResetBtn?.addEventListener('click', () => {
      revInputIds.forEach((id) => {
        const inp = document.getElementById(id) as HTMLInputElement | null;
        if (inp) inp.value = '';
      });
      syncRevResetVisibility();
      applyAllFilters();
    });

    document.getElementById('open-tag-modal-btn-styled')?.addEventListener('click', () => {
      const modal = document.getElementById('tag-filter-modal');
      if (modal) {
        modal.style.display = 'flex';
        renderTagFilters();
      }
    });

    return true;
  };

  createTagFilterModal();
  if (!mountSidebarFilterBlocks()) {
    setTimeout(mountSidebarFilterBlocks, 1200);
  }
}
