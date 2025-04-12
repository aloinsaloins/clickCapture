document.addEventListener('DOMContentLoaded', async () => {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusText = document.getElementById('status');

  // 現在の状態を取得
  const result = await chrome.storage.local.get('isEnabled');
  const isEnabled = result.isEnabled || false;
  toggleSwitch.checked = isEnabled;
  statusText.textContent = isEnabled ? '有効' : '無効';

  // トグルスイッチの変更イベント
  toggleSwitch.addEventListener('change', async () => {
    const newState = toggleSwitch.checked;
    await chrome.storage.local.set({ isEnabled: newState });
    statusText.textContent = newState ? '有効' : '無効';
  });
}); 