document.addEventListener('DOMContentLoaded', async () => {
  const globalToggle = document.getElementById('globalToggle');
  const globalStatus = document.getElementById('globalStatus');

  // Load global setting
  const { isGloballyEnabled = false } =
    await chrome.storage.local.get('isGloballyEnabled');
  globalToggle.checked = isGloballyEnabled;
  globalStatus.textContent = isGloballyEnabled ? '有効' : '無効';

  // Event listener for global toggle
  globalToggle.addEventListener('change', async () => {
    const enabled = globalToggle.checked;
    await chrome.storage.local.set({ isGloballyEnabled: enabled });
    globalStatus.textContent = enabled ? '有効' : '無効';
    console.log('Global toggle changed:', enabled);
    // Reload current tab to reflect changes (optional, but good UX)
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab && tab.id) {
        chrome.tabs.reload(tab.id);
      }
    } catch (error) {
      console.error('Error reloading tab:', error);
    }
  });
});
