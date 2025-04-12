document.addEventListener('DOMContentLoaded', async () => {
  // --- 要素取得 ---
  const globalToggle = document.getElementById('globalToggleSwitch');
  const globalStatus = document.getElementById('globalStatus');
  const currentSiteDisplay = document.getElementById('currentSite');
  const addSiteButton = document.getElementById('addCurrentSite');
  const removeSiteButton = document.getElementById('removeCurrentSite');
  const allowedSitesList = document.getElementById('allowed-sites-list');

  let currentHostname = null;
  let allowedSites = [];
  let isGloballyEnabled = false;

  // --- 初期化関数 ---
  async function initializePopup() {
    // グローバル設定の読み込み
    const globalResult = await chrome.storage.local.get('isGloballyEnabled');
    isGloballyEnabled = globalResult.isGloballyEnabled || false;
    globalToggle.checked = isGloballyEnabled;
    globalStatus.textContent = isGloballyEnabled ? '有効' : '無効';

    // 許可リストの読み込み
    const allowedResult = await chrome.storage.local.get('allowedSites');
    allowedSites = allowedResult.allowedSites || [];
    renderAllowedSitesList();

    // 現在のタブ情報を取得
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.startsWith('http')) {
            const url = new URL(tab.url);
            currentHostname = url.hostname;
            currentSiteDisplay.textContent = currentHostname;
            updateSiteButtons();
        } else {
            currentSiteDisplay.textContent = '有効なページではありません';
            addSiteButton.disabled = true;
            removeSiteButton.disabled = true;
        }
    } catch (e) {
        console.error("Error getting current tab:", e);
        currentSiteDisplay.textContent = 'エラーが発生しました';
        addSiteButton.disabled = true;
        removeSiteButton.disabled = true;
    }
  }

  // --- UI更新関数 ---
  function updateSiteButtons() {
    if (!currentHostname) return;
    const isAllowed = allowedSites.includes(currentHostname);
    addSiteButton.style.display = isAllowed ? 'none' : 'block';
    removeSiteButton.style.display = isAllowed ? 'block' : 'none';
    addSiteButton.disabled = false;
    removeSiteButton.disabled = false;
  }

  function renderAllowedSitesList() {
    allowedSitesList.innerHTML = ''; // 一旦クリア
    if (allowedSites.length === 0) {
      allowedSitesList.textContent = 'リストは空です';
      return;
    }
    allowedSites.forEach(site => {
      const siteElement = document.createElement('div');
      const siteName = document.createElement('span');
      siteName.textContent = site;
      const removeButton = document.createElement('button');
      removeButton.textContent = '削除';
      removeButton.dataset.site = site; // 削除対象を特定するためにdata属性を設定
      removeButton.addEventListener('click', handleRemoveFromList);
      siteElement.appendChild(siteName);
      siteElement.appendChild(removeButton);
      allowedSitesList.appendChild(siteElement);
    });
  }

  // --- イベントハンドラ ---
  // グローバルトグル
  globalToggle.addEventListener('change', async () => {
    isGloballyEnabled = globalToggle.checked;
    await chrome.storage.local.set({ isGloballyEnabled: isGloballyEnabled });
    globalStatus.textContent = isGloballyEnabled ? '有効' : '無効';
  });

  // 現在のサイトを追加
  addSiteButton.addEventListener('click', async () => {
    if (currentHostname && !allowedSites.includes(currentHostname)) {
      allowedSites.push(currentHostname);
      await chrome.storage.local.set({ allowedSites: allowedSites });
      renderAllowedSitesList();
      updateSiteButtons();
    }
  });

  // 現在のサイトを削除
  removeSiteButton.addEventListener('click', async () => {
    if (currentHostname && allowedSites.includes(currentHostname)) {
      allowedSites = allowedSites.filter(site => site !== currentHostname);
      await chrome.storage.local.set({ allowedSites: allowedSites });
      renderAllowedSitesList();
      updateSiteButtons();
    }
  });

  // リストからサイトを削除 (イベントデリゲーションを使わない場合)
  async function handleRemoveFromList(event) {
    const siteToRemove = event.target.dataset.site;
    if (siteToRemove) {
      allowedSites = allowedSites.filter(site => site !== siteToRemove);
      await chrome.storage.local.set({ allowedSites: allowedSites });
      renderAllowedSitesList();
      // 現在のサイトボタンも更新 (削除したのが現在のサイトの場合)
      if(currentHostname === siteToRemove) {
          updateSiteButtons();
      }
    }
  }

  // --- 初期化実行 ---
  initializePopup();
}); 