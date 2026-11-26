export const SM_CSS = `
  #salesMasterModal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(20, 20, 25, 0.92);
    backdrop-filter: blur(3px);
    z-index: 99990;
    display: none;
    color: #c6d4df;
    font-family: "Motiva Sans", Sans-serif, Arial;
  }
  #salesMasterModal * { box-sizing: border-box; }
  #salesMasterContainer { padding-top: 0; height: 100%; display: flex; flex-direction: column; }
  #salesMasterCloseBtn {
    position: fixed; top: 10px; right: 20px; font-size: 35px; color: #aaa;
    background: none; border: none; cursor: pointer; line-height: 1; z-index: 100020; padding: 5px;
    transition: color 0.2s, transform 0.2s;
  }
  #salesMasterCloseBtn:hover { color: #fff; transform: scale(1.1); }
  #salesMasterMinimizeBtn {
    position: fixed; top: 15px; right: 65px; font-size: 24px; font-weight: bold; color: #aaa;
    background: none; border: none; cursor: pointer; line-height: 1; z-index: 100020; padding: 5px;
    transition: color 0.2s, transform 0.2s;
  }
  #salesMasterMinimizeBtn:hover { color: #fff; transform: scale(1.1); }
  #salesMasterRestoreBtn {
    position: fixed; bottom: 20px; right: 20px; z-index: 100080;
    background-color: #1b2838; color: #c6d4df; border: 1px solid #67c1f5;
    border-radius: 4px; padding: 10px 15px; font-size: 14px; cursor: pointer;
    box-shadow: 0 5px 15px rgba(0,0,0,0.5); display: none; align-items: center; gap: 8px;
    transition: all 0.2s;
  }
  #salesMasterRestoreBtn:hover { background-color: #2a475e; color: #fff; }
  #salesMasterHeader {
    display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; position: relative; z-index: 1001;
    background-color: rgba(27, 40, 56, 0.95); backdrop-filter: blur(5px);
    padding: 10px 15px; border-bottom: 1px solid #3a4f6a;
    transition: padding-left 0.2s ease-out, padding-right 0.2s ease-out; flex-shrink: 0;
  }
  #salesMasterHeaderStatus {
    text-align: left; font-size: 13.5px; color: #aaa; padding: 0 10px 0 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    display: flex; align-items: center; min-height: 36px; flex-shrink: 0;
  }
  #smTitleFilterInput {
    width: 240px; height: 36px; padding: 6px 12px; font-size: 14px;
    background-color: rgba(10, 10, 15, 0.7); border: 1px solid #3a4f6a; color: #c6d4df;
    border-radius: 3px; outline: none; margin-left: 5px; flex-shrink: 0;
  }
  #smTitleFilterInput:focus { border-color: #67c1f5; background-color: rgba(0, 0, 0, 0.8); }
  .smInsertTitleBtn { padding: 0 10px; font-size: 12px; }
  #salesMasterSortButtons { display: flex; gap: 5px; align-items: center; margin-left: 10px; }
  #smTitleFilterWrapper { position: relative; display: flex; flex-shrink: 0; }
  #smTitleFilterGroup { display: flex; }
  #smTitleFilterWrapper #smTitleFilterInput { border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: none; }
  #smTitleFilterWrapper .sm-filter-help-btn { border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: -1px; width: auto; padding: 0 8px; }
  #smFilterHelpPanel {
    position: absolute; top: calc(100% + 5px); right: 0; z-index: 1005;
    background-color: #1f2c3a; border: 1px solid #67c1f5; border-radius: 4px;
    padding: 15px; width: 380px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); display: none; text-align: left;
  }
  .sm-filter-help-operators { display: flex; gap: 10px; margin-bottom: 12px; }
  .sm-operator-btn { padding: 5px 10px; height: auto; font-size: 13px; flex-grow: 1; }
  .sm-filter-help-text code { background: #1a2635; padding: 2px 5px; border-radius: 3px; }
  .salesMasterBtn {
    padding: 0 12px; font-size: 13px; color: #c6d4df; border: 1px solid #4b6f9c;
    border-radius: 3px; cursor: pointer; white-space: nowrap; height: 36px;
    display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    background-color: rgba(42, 71, 94, 0.8); transition: background-color 0.2s, border-color 0.2s;
  }
  .salesMasterBtn:hover:not(:disabled) { background-color: rgba(67, 103, 133, 0.9); border-color: #67c1f5; color: #fff; }
  .salesMasterBtn:disabled { opacity: 0.6; cursor: default; }
  #salesMasterSearchGoBtn { background-color: rgba(77, 136, 255, 0.8); border-color: #4d88ff; color: #fff; }
  #salesMasterSearchGoBtn:hover:not(:disabled) { background-color: rgba(51, 102, 204, 0.9); }
  .salesMasterBtn.sortBtn.active { background-color: rgba(0, 123, 255, 0.8); border-color: #007bff; color: #fff; }
  #salesMasterResetSortBtn { background-color: rgba(119, 119, 119, 0.8); border-color: #777; padding: 0 8px; }
  #salesMasterResetSortBtn svg { width: 14px; height: 14px; fill: currentColor; }
  #salesMasterResetSortBtn.active { background-color: rgba(0, 123, 255, 0.8); border-color: #007bff; }
  #smEditQueryModal {
    position: fixed; inset: 0; background-color: rgba(0,0,0,0.8); z-index: 100070;
    display: flex; align-items: center; justify-content: center; font-family: "Motiva Sans", Arial, sans-serif;
  }
  .sm-edit-query-content {
    background-color: #1f2c3a; color: #c6d4df; padding: 25px; border-radius: 5px;
    border: 1px solid #67c1f5; width: 90%; max-width: 900px; display: flex; flex-direction: column; max-height: 90vh;
  }
  .sm-edit-columns { display: flex; gap: 20px; margin-bottom: 18px; overflow: hidden; flex-grow: 1; }
  .sm-edit-column { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .sm-edit-controls { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
  .sm-edit-filter-input { flex-grow: 1; padding: 5px 8px; background-color: #1a2635; border: 1px solid #3a4f6a; color: #c6d4df; border-radius: 3px; font-size: 13px; }
  .sm-edit-sort-buttons { display: flex; gap: 4px; }
  .sm-edit-sort-btn { padding: 4px 8px; font-size: 12px; background-color: #2a3f5a; border: 1px solid #3a4f6a; color: #c6d4df; cursor: pointer; border-radius: 3px; }
  .sm-edit-sort-btn.active { background-color: #4b6f9c; border-color: #67c1f5; color: #fff; }
  .sm-edit-list { list-style: none; padding: 5px; margin: 0; overflow-y: auto; background-color: #1a2635; border: 1px solid #3a4f6a; border-radius: 3px; height: 360px; }
  .sm-edit-list li { padding: 8px 10px; cursor: pointer; border-radius: 3px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .sm-edit-list li:hover { background-color: #2a3f5a; }
  .sm-edit-list li.selected { background-color: #4b6f9c; color: #fff; font-weight: bold; }
  .sm-edit-price { color: #a4d007; flex-shrink: 0; }
  #smContextMenu {
    position: fixed; z-index: 100100; background-color: #1f2c3a; border: 1px solid #67c1f5;
    border-radius: 4px; padding: 5px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); min-width: 210px; font-size: 13.5px;
  }
  .sm-context-menu-item { padding: 7px 12px; color: #c6d4df; cursor: pointer; border-radius: 3px; }
  .sm-context-menu-item:hover { background-color: #2a475e; color: #fff; }
  .sm-context-menu-separator { height: 1px; background-color: #3a4f6a; margin: 4px 0; }
  #salesMasterFiltersPanel, #salesMasterExclusionTags {
    position: fixed; top: 60px; max-height: calc(100vh - 80px); overflow-y: auto; z-index: 1000;
    padding: 15px; background-color: rgba(23, 26, 33, 0.88); backdrop-filter: blur(4px);
    border-radius: 6px; visibility: hidden;
  }
  #salesMasterFiltersPanel { left: 15px; width: 240px; }
  #salesMasterExclusionTags { right: 15px; width: 260px; }
  .smFilterGroup { margin-bottom: 18px; }
  .smFilterGroup h4 {
    font-size: 14px; color: #67c1f5; margin: 0 0 8px 0; padding-bottom: 5px;
    display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #3a4f6a;
  }
  .smFilterResetBtn { color: #8f98a0; background: none; border: none; cursor: pointer; padding: 0 3px; }
  .smFilterResetBtn:hover { color: #fff; }
  .smFilterResetBtn svg { width: 14px; height: 14px; fill: currentColor; }
  .smFilterRangeInputs { display: flex; gap: 8px; }
  .smFilterRangeInputs input[type="number"] {
    width: calc(50% - 4px); padding: 6px 8px; font-size: 13px; background-color: rgba(10, 10, 15, 0.7);
    border: 1px solid #3a4f6a; color: #c6d4df; border-radius: 3px; height: 32px; text-align: center; outline: none;
  }
  .smFilterRangeInputs input[type="number"]:focus { border-color: #67c1f5; }
  .smFilterCheckbox { margin-bottom: 8px; }
  .smFilterCheckbox label { display: flex; align-items: center; font-size: 13.5px; cursor: pointer; color: #c6d4df; }
  .smFilterCheckbox input[type="checkbox"] { margin-right: 8px; width: 16px; height: 16px; accent-color: #67c1f5; cursor: pointer; flex-shrink: 0; }
  .smFilterCheckbox.sm-store-error label { background-color: rgba(139, 0, 0, 0.35); border: 1px solid rgba(255, 100, 100, 0.3); border-radius: 3px; padding: 1px 4px; margin: -1px -4px; }
  #smFilterStoreCheckboxes { max-height: 300px; padding-right: 5px; overflow-y: auto; }
  #smResetAllFiltersBtn { width: 100%; margin-top: 10px; background-color: rgba(108, 117, 125, 0.6); border: 1px solid #5a6268; }
  .smExclusionInputGroup {
    display: flex; align-items: stretch; border: 1px solid #3a4f6a; border-radius: 4px;
    background-color: rgba(10, 10, 15, 0.7); overflow: hidden; height: 36px; margin-bottom: 10px;
  }
  #salesMasterExcludeInput { padding: 6px 10px; font-size: 13.5px; background: transparent; border: none; color: #c6d4df; outline: none; flex-grow: 1; }
  #salesMasterAddExcludeBtn { display: flex; align-items: center; justify-content: center; width: 36px; background-color: #4b6f9c; border: none; border-left: 1px solid #3a4f6a; cursor: pointer; color: #c6d4df; }
  #salesMasterAddExcludeBtn:hover { background-color: #67c1f5; color: #fff; }
  #salesMasterAddExcludeBtn svg { width: 16px; height: 16px; fill: currentColor; }
  #salesMasterExclusionTagsList { display: flex; flex-wrap: wrap; gap: 8px; overflow-y: auto; }
  .smExclusionTag {
    display: inline-block; background-color: rgba(75, 111, 156, 0.7); color: #c6d4df;
    padding: 5px 10px; border-radius: 14px; font-size: 13px; cursor: pointer; border: 1px solid #4b6f9c;
  }
  .smExclusionTag:hover { background-color: rgba(220, 53, 69, 0.8); border-color: rgba(255, 80, 90, 0.9); color: #fff; }
  .smExclusionTag::after { content: ' ×'; font-weight: bold; margin-left: 4px; }
  .smExclusionActions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #3a4f6a; }
  .smExclusionActionBtn { padding: 0 8px; height: 30px; width: 40px; font-weight: bold; }
  #smImportModal { position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.75); z-index: 100030; display: flex; align-items: center; justify-content: center; }
  .smImportModalContent { background-color: #1b2838; padding: 22px; border-radius: 5px; border: 1px solid #67c1f5; width: 90%; max-width: 500px; }
  #smImportTextarea { width: 100%; padding: 10px; font-size: 13.5px; background-color: rgba(10, 10, 15, 0.7); border: 1px solid #3a4f6a; color: #c6d4df; border-radius: 3px; margin-bottom: 16px; min-height: 100px; }
  .smImportModalActions { display: flex; justify-content: flex-end; gap: 10px; }
  #salesMasterResultsContainer { position: relative; flex-grow: 1; overflow-y: auto; transition: padding-left 0.2s ease-out, padding-right 0.2s ease-out; }
  #salesMasterResults { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; padding-top: 15px; padding-bottom: 20px; }
  .salesMasterItem.hidden-by-filter { display: none !important; }
  .salesMasterItem {
    background-color: rgba(42, 46, 51, 0.88); border-radius: 4px; padding: 14px;
    display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4); color: #c6d4df; font-size: 14px; min-height: 360px; border: 1px solid #333941;
  }
  .salesMasterItem:hover { transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5); border-color: #67c1f5; }
  .salesMasterItem a { text-decoration: none; color: inherit; display: flex; flex-direction: column; height: 100%; user-select: text; -webkit-user-drag: none; }
  .salesMasterItem.steam-page-offer { background-color: #202c24; border-color: #354f3a; }
  .salesMasterItem.steam-page-offer .sm-buyButton { background-color: #5c9d4f; color: #1a2f1f; }
  .sm-card-image-wrapper { position: relative; width: 100%; aspect-ratio: 16 / 9; margin-bottom: 10px; background: #111; border-radius: 3px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #333941; }
  .sm-card-image-wrapper img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .sm-price-container { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px 10px; margin-bottom: 8px; min-height: 24px; }
  .sm-current-price { font-size: 18px; font-weight: 700; color: #66c0f4; }
  .sm-original-price { font-size: 13.5px; color: #8f98a0; text-decoration: line-through; }
  .sm-discount-badge { background-color: #e2004b; color: white; padding: 2px 6px; font-size: 12.5px; border-radius: 3px; font-weight: 600; }
  .sm-title { font-size: 14.5px; font-weight: 500; line-height: 1.35; height: 4.05em; overflow: hidden; margin-bottom: 8px; color: #e5e5e5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
  .sm-store-info-container { margin-top: auto; padding-top: 8px; text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
  .sm-store-name, .sm-seller-link { font-size: 12px; color: #8f98a0; }
  .sm-seller-link:hover { color: #c6d4df; text-decoration: underline; }
  .smStoreSelectAllControls { margin-top: -4px; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #3a4f6a; text-align: center; }
  .smStoreSelectAllLink { font-size: 12px; color: #8f98a0; cursor: pointer; padding: 0 5px; }
  .smStoreSelectAllLink:hover { color: #c6d4df; text-decoration: underline; }
  .sm-buyButton { display: block; text-align: center; padding: 9px; margin-top: 10px; background-color: #67c1f5; color: #1b2838; border-radius: 3px; font-size: 13.5px; font-weight: 600; }
  .sm-buyButton:hover { background-color: #8ad3f7; }
  .salesMaster_button .btnv6_blue_hoverfade { margin: 0; padding: 0 10px; font-size: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  @keyframes salesMasterSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  .sm-spinner { border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 50%; border-top-color: #fff; width: 1em; height: 1em; animation: salesMasterSpin 1s linear infinite; display: inline-block; vertical-align: middle; margin-left: 6px; }
`;
