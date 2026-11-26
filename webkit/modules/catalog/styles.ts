export const CATALOG_CSS = `
  .bsh-catalog-tooltip {
    position: absolute;
    background: linear-gradient(to bottom, #e3eaef, #c7d5e0);
    color: #30455a;
    padding: 12px;
    border-radius: 2px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.78);
    font-size: 12px;
    max-width: 310px;
    display: none;
    z-index: 10005;
    opacity: 0;
    transition: opacity 0.25s ease-in-out;
    pointer-events: none;
    font-family: "Motiva Sans", Arial, sans-serif;
  }
  .bsh-catalog-tooltip .tooltip-arrow {
    position: absolute;
    right: -9px;
    top: 28px;
    width: 0;
    height: 0;
    border-top: 10px solid transparent;
    border-bottom: 10px solid transparent;
    border-left: 10px solid #E1E8ED;
  }
  .catalog-positive { color: #2B80E9; font-weight: 600; }
  .catalog-mixed { color: #997a00; font-weight: 600; }
  .catalog-negative { color: #E53E3E; font-weight: 600; }
  .catalog-no-reviews { color: #6e7680; }
  .catalog-language-yes { color: #2B80E9; }
  .catalog-language-no { color: #E53E3E; }
  .catalog-early-access-yes { color: #2B80E9; font-weight: 600; }
  .catalog-early-access-no { color: #6e7680; }
  .search_result_row { transition: opacity 0.35s ease-in-out, transform 0.35s ease-in-out; }
  .custom-tags-container { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 6px; }
  .custom-tag {
    background-color: #96a3ae;
    color: #e3eaef;
    padding: 0 5px;
    border-radius: 2px;
    font-size: 11px;
    line-height: 19px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
    margin-bottom: 2px;
  }
  .es_highlighted_dlcforya {
    background: #822dbf linear-gradient(135deg, rgba(0, 0, 0, 0.70) 10%, rgba(0, 0, 0, 0) 100%) !important;
  }

  .tag-modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); z-index: 100050; display: none;
    justify-content: center; align-items: center;
    font-family: "Motiva Sans", Sans-serif, Arial;
  }
  .tag-modal {
    background: #1b2838; color: #c6d4df; padding: 20px; border-radius: 6px;
    width: 780px; max-width: 94vw; box-shadow: 0 5px 25px rgba(0,0,0,0.65);
    border: 1px solid #30363d;
  }
  .tag-modal-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 15px; border-bottom: 1px solid #2a3a4d; padding-bottom: 10px;
  }
  .tag-modal-header h2 { color: #66c0f4; margin: 0; font-size: 18px; }
  .tag-modal-close {
    background: none; border: none; color: #c6d4df; font-size: 24px;
    cursor: pointer; line-height: 1; padding: 0 5px;
  }
  .tag-modal-close:hover { color: #66c0f4; }
  .tag-search-input {
    width: 100%; box-sizing: border-box; background: #1a2635; border: 1px solid #2a3a4d;
    border-radius: 4px; color: #c6d4df; font-size: 14px;
    padding: 8px; margin-bottom: 10px; outline: none;
  }
  .tag-search-input:focus { border-color: #66c0f4; }
  .tag-search-results { max-height: 150px; overflow-y: auto; border: 1px solid #2a3a4d; border-radius: 4px; }
  .tag-search-result-item { padding: 8px; cursor: pointer; border-bottom: 1px solid #2a3a4d; }
  .tag-search-result-item:last-child { border-bottom: none; }
  .tag-search-result-item:hover { background: #2a3a4d; }
  .tag-search-results::-webkit-scrollbar, .tag-modal-body::-webkit-scrollbar,
  #orb-console::-webkit-scrollbar, #sth-console::-webkit-scrollbar { width: 6px; }
  .tag-search-results::-webkit-scrollbar-thumb, .tag-modal-body::-webkit-scrollbar-thumb,
  #orb-console::-webkit-scrollbar-thumb, #sth-console::-webkit-scrollbar-thumb { background: #233c51; border-radius: 3px; }
  .tag-filters-sections { display: flex; gap: 20px; margin-top: 15px; }
  .tag-filters-section {
    flex: 1; border: 1px solid #2a3a4d; border-radius: 4px; padding: 10px;
    background: #16202d; min-height: 150px; max-height: 280px; overflow-y: auto;
  }
  .tag-filters-section-title {
    color: #66c0f4; font-size: 13.5px; margin-bottom: 10px;
    text-align: center; border-bottom: 1px solid #2a3a4d; padding-bottom: 5px;
    white-space: nowrap;
  }
  .active-tag-filter-row, .hidden-tag-filter-row {
    display: flex; align-items: center; gap: 10px; background: #2a3a4d;
    padding: 8px; border-radius: 4px; margin-bottom: 8px; cursor: grab;
  }
  .active-tag-filter-row:active, .hidden-tag-filter-row:active { cursor: grabbing; background: #354658; }
  .active-tag-filter-row span, .hidden-tag-filter-row span { flex-grow: 1; }
  .active-tag-filter-row input {
    width: 60px; text-align: center; background: #1a2635;
    border: 1px solid #2a3a4d; color: #c6d4df; border-radius: 3px; padding: 4px;
  }
  .btn-remove-tag {
    background-color: #a74343; color: white; font-size: 11px;
    padding: 3px 8px; border-radius: 3px; border: none; cursor: pointer;
  }
  .btn-remove-tag:hover { background-color: #c45252; }
  .tag-modal-footer { margin-top: 20px; text-align: right; }
  .drag-over { background-color: rgba(102, 192, 244, 0.12); border-style: dashed; }

  #open-tag-modal-btn-styled, #open-unhider-modal-btn, #open-hider-modal-btn {
    display: block; width: 100%; text-align: center; padding: 5px 0;
    border-radius: 2px; background-color: rgba(103, 193, 245, 0.1);
    border: 1px solid rgba(103, 193, 245, 0.2); cursor: pointer;
    transition: background-color 0.2s, border-color 0.2s;
  }
  #open-tag-modal-btn-styled:hover, #open-unhider-modal-btn:hover, #open-hider-modal-btn:hover {
    background-color: rgba(103, 193, 245, 0.22); border-color: rgba(103, 193, 245, 0.45);
  }

  #orb-restore-btn, #sth-restore-btn {
    position: fixed; bottom: 30px; right: 30px; z-index: 100040;
    background: linear-gradient(to right, #16202D, #1B2838);
    border: 1px solid #66c0f4; border-radius: 5px; padding: 12px 20px;
    color: #66c0f4; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    transition: 0.2s; font-family: "Motiva Sans", sans-serif; display: none;
  }
  #sth-restore-btn { right: 230px; }
  #orb-restore-btn:hover, #sth-restore-btn:hover { background: linear-gradient(to right, #1b2838, #2a3f5a); color: #fff; }

  #orb-modal, #sth-modal {
    position: fixed; top: 50px; right: 50px; width: 420px; max-width: 92vw;
    background: #1b2838; border: 1px solid #30363d; border-radius: 6px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.85); z-index: 100050;
    display: none; flex-direction: column; color: #c6d4df;
    font-family: "Motiva Sans", sans-serif;
  }
  #sth-modal { right: 490px; }
  #orb-modal-header, #sth-modal-header {
    background: #101822; padding: 10px 15px; cursor: grab; display: flex;
    justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d;
    border-radius: 6px 6px 0 0; user-select: none;
  }
  #orb-modal-header:active, #sth-modal-header:active { cursor: grabbing; }
  .orb-header-title, .sth-header-title { color: #66c0f4; font-weight: bold; font-size: 15px; }
  .orb-header-controls button, .sth-header-controls button {
    background: none; border: none; color: #8f98a0; cursor: pointer; font-size: 16px; margin-left: 10px;
  }
  .orb-header-controls button:hover, .sth-header-controls button:hover { color: #fff; }

  #orb-modal-body, #sth-modal-body { padding: 15px; display: flex; flex-direction: column; gap: 15px; }
  .orb-stats-box, .sth-stats-box {
    background: #101822; padding: 10px; border-radius: 4px; font-size: 13px;
    line-height: 1.5; border: 1px solid #2a3a4c;
  }
  .orb-filters-grid, .sth-filters-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .orb-input-group, .sth-input-group { display: flex; flex-direction: column; font-size: 12px; color: #8f98a0; }
  .orb-input-group input, .sth-input-group input {
    background: #223143; border: 1px solid #30363d; color: #fff; padding: 6px;
    border-radius: 3px; margin-top: 4px; outline: none; font-family: inherit;
  }
  .orb-action-btn, .sth-action-btn {
    background: linear-gradient(to bottom, #799905 5%, #536904 95%);
    border: none; border-radius: 3px; color: #fff; padding: 10px; font-weight: bold;
    cursor: pointer; text-align: center; font-size: 14px; width: 100%;
  }
  .orb-action-btn:hover:not(:disabled), .sth-action-btn:hover:not(:disabled) {
    background: linear-gradient(to bottom, #8cb306 5%, #637d05 95%);
  }
  .orb-action-btn:disabled, .sth-action-btn:disabled { background: #4a4a4a; color: #888; cursor: not-allowed; }
  .orb-progress-container, .sth-progress-container {
    display: none; flex-direction: column; gap: 5px; background: #101822;
    padding: 10px; border-radius: 4px; border: 1px solid #2a3a4c;
  }
  .orb-progress-bar-bg, .sth-progress-bar-bg { background: #000; height: 10px; border-radius: 5px; overflow: hidden; width: 100%; }
  .orb-progress-bar-fill, .sth-progress-bar-fill { background: #66c0f4; height: 100%; width: 0%; transition: width 0.3s; }
  .orb-progress-info, .sth-progress-info { font-size: 12px; display: flex; justify-content: space-between; }
  .orb-resume-btn, .sth-resume-btn {
    background: #c13c37; border: none; color: white; padding: 5px 10px;
    border-radius: 3px; cursor: pointer; display: none; font-size: 11px;
  }
  #orb-console, #sth-console {
    background: #000; border: 1px solid #30363d; border-radius: 4px; padding: 8px;
    height: 120px; overflow-y: auto; font-family: monospace; font-size: 11px;
    color: #a3b0bb; display: flex; flex-direction: column; gap: 4px;
  }
  .orb-log-msg, .sth-log-msg { border-bottom: 1px dashed #222; padding-bottom: 2px; }
  .orb-log-success, .sth-log-success { color: #8cc540; }
  .orb-log-error, .sth-log-error { color: #ff5252; }
  .orb-log-info, .sth-log-info { color: #66c0f4; }

  .steam-hider-checkbox {
    -webkit-appearance: none; -moz-appearance: none; appearance: none;
    border: 6px inset rgba(102, 192, 244, 0.8); border-radius: 50%;
    width: 42px; height: 42px; outline: none; transition: .15s ease-in-out;
    position: absolute; left: 0px; top: 50%; transform: translateY(-50%);
    background-color: rgba(0, 0, 0, 0.0);
    box-shadow: inset 0 0 0 0 rgba(255, 255, 255, 0.5);
    cursor: pointer; z-index: 999; margin: 0; padding: 0;
  }
  .steam-hider-checkbox.is-checked {
    background-color: rgba(0, 0, 0, 0.5); border-color: #2a475e;
    box-shadow: inset 0 0 0 12px rgba(102, 192, 244, 0.5);
  }
  .steam-hider-checkbox:after {
    content: ""; display: block; position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%) scale(0); width: 25px; height: 25px;
    border-radius: 50%; background-color: rgba(0, 0, 0, 0.9); opacity: 0.9;
    box-shadow: 0 0 0 0 #66c0f4; transition: transform .15s ease-in-out, box-shadow .15s ease-in-out;
  }
  .steam-hider-checkbox.is-checked:after {
    transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 4px #66c0f4;
  }

  .bsh-cat-range-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px 2px 2px;
  }
  .bsh-cat-range-field {
    display: flex; flex-direction: column; gap: 3px;
  }
  .bsh-cat-range-field label {
    font-size: 11px; color: #8f98a0; line-height: 1.2;
  }
  .bsh-cat-range-field input {
    width: 100%; box-sizing: border-box;
    background: #16202d; border: 1px solid #2a3f5a; border-radius: 2px;
    color: #e5eef5; padding: 4px 6px; font-size: 12px; outline: none;
  }
  .bsh-cat-range-field input:focus { border-color: #66c0f4; }
  .bsh-cat-reset-btn {
    margin-top: 7px; width: 100%; padding: 4px 0;
    background: rgba(167, 67, 67, 0.28); border: 1px solid rgba(205, 92, 92, 0.45);
    color: #ffb3b3; border-radius: 2px; font-size: 11.5px; cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
  }
  .bsh-cat-reset-btn:hover { background: rgba(196, 82, 82, 0.5); color: #fff; }
  .steam-hider-row-selected { background: rgba(102, 192, 244, 0.08) !important; }

  .sth-switch { position: relative; display: inline-block; width: 44px; height: 22px; flex-shrink: 0; }
  .sth-switch input { opacity: 0; width: 0; height: 0; }
  .sth-slider {
    position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
    background-color: #233c51; transition: .3s; border-radius: 22px;
    border: 1px solid #3d5a75;
  }
  .sth-slider:before {
    position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px;
    background-color: #93b3ce; transition: .3s; border-radius: 50%;
  }
  .sth-switch input:checked + .sth-slider { background-color: #66c0f4; border-color: #66c0f4; }
  .sth-switch input:checked + .sth-slider:before { transform: translateX(22px); background-color: #1b2838; }
`;
