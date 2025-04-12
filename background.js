// ファイル名生成関数
async function generateFileName(tab) {
  try {
    const url = new URL(tab.url);
    const websiteName = url.hostname.replace(/^www\./, '').split('.')[0];
    
    const storageKey = `counter_${websiteName}`;
    const result = await chrome.storage.local.get(storageKey);
    const currentNumber = result[storageKey] || 0;
    const newNumber = currentNumber + 1;
    
    await chrome.storage.local.set({ [storageKey]: newNumber });
    
    return `${websiteName}_${newNumber}.png`;
  } catch (error) {
    console.error('Error generating filename:', error);
    return `screenshot_${Date.now()}.png`;
  }
}

// 遅延時間 (ミリ秒)
const SCREENSHOT_DELAY_MS = 500;

// スクリーンショット取得と保存
async function captureAndSaveScreenshot() {
  console.log(`Waiting ${SCREENSHOT_DELAY_MS}ms before capturing...`);
  
  // 指定時間待機
  await new Promise(resolve => setTimeout(resolve, SCREENSHOT_DELAY_MS));

  try {
    console.log('Starting screenshot capture after delay...');
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.error('No active tab found');
      return;
    }
    console.log('Active tab found:', tab.url);

    const fileName = await generateFileName(tab);
    console.log('Generated filename:', fileName);
    
    const dataUrl = await chrome.tabs.captureVisibleTab();
    console.log('Screenshot captured (Data URL length:', dataUrl.length, ')');
    
    await chrome.downloads.download({
      url: dataUrl,
      filename: fileName,
      saveAs: false
    });
    console.log('Screenshot download initiated:', fileName);
  } catch (error) {
    console.error('Screenshot error:', error);
  }
}

// メッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  if (message.type === 'takeScreenshot') {
    // 既に実行中のキャプチャ処理がないか確認（連続クリック対策）
    // 簡単な対策として、前回の実行から一定時間経過していない場合は無視するなど
    // ここではひとまずそのまま実行
    captureAndSaveScreenshot();
  }
}); 