// Delay time (milliseconds) before capture
const SCREENSHOT_DELAY_MS = 500;

// Main function to handle the screenshot request
// options を引数に追加
async function handleScreenshotRequest(tabId, options = {}) {
  let tab;
  let websiteName;
  let number;
  let immediateSuccess = false;
  let delayedSuccess = false;
  const captureImmediate = options.captureImmediate === true;

  try {
    // 1. Get Tab Info
    if (tabId) {
      tab = await chrome.tabs.get(tabId);
    } else {
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    }
    if (!tab || !tab.url || !tab.url.startsWith('http')) {
      console.warn(
        'Cannot capture screenshot for current tab:',
        tab ? tab.url : 'No tab found'
      );
      return false;
    }
    console.log('Processing screenshot request for tab:', tab.url);

    // 2. Get URL Details & Number (Whitelist check removed)
    let url = new URL(tab.url);
    websiteName = url.hostname.replace(/^www\./, '').split('.')[0] || 'local';
    const storageKey = `counter_${websiteName}`;
    const result = await chrome.storage.local.get(storageKey);
    const currentNumber = result[storageKey] || 0;
    number = currentNumber + 1;
    await chrome.storage.local.set({ [storageKey]: number });
    console.log(
      `Processing screenshot event number ${number} for ${websiteName}. Capture immediate: ${captureImmediate}`
    );

    // --- Capture Immediate Screenshot (Conditional) ---
    if (captureImmediate) {
      const immediateFilename = `${websiteName}_${number}_immediate.png`;
      console.log(
        'Capturing immediate screenshot (requested): ',
        immediateFilename
      );
      try {
        const immediateDataUrl = await chrome.tabs.captureVisibleTab({
          format: 'png',
        });
        console.log('Immediate screenshot captured.');
        await chrome.downloads.download({
          url: immediateDataUrl,
          filename: immediateFilename,
          saveAs: false,
        });
        console.log(
          'Immediate screenshot download initiated:',
          immediateFilename
        );
        immediateSuccess = true;
      } catch (captureError) {
        console.error('Error capturing immediate screenshot:', captureError);
      }
    } else {
      console.log('Immediate screenshot not requested, skipping.');
    }

    // --- Wait ---
    console.log(`Waiting ${SCREENSHOT_DELAY_MS}ms before delayed capture...`);
    await new Promise((resolve) => setTimeout(resolve, SCREENSHOT_DELAY_MS));

    // --- Capture Delayed Screenshot ---
    const delayedFilename = `${websiteName}_${number}_delayed.png`;
    try {
      let currentTabAfterDelay;
      const currentTabId = tabId || (tab ? tab.id : null);
      if (!currentTabId) {
        console.warn('Could not determine tab ID for delayed capture.');
        throw new Error('Missing tab ID');
      }
      currentTabAfterDelay = await chrome.tabs.get(currentTabId);

      if (
        !currentTabAfterDelay ||
        !currentTabAfterDelay.url ||
        !currentTabAfterDelay.url.startsWith('http')
      ) {
        console.warn(
          'Tab became invalid during delay, skipping delayed screenshot.',
          currentTabAfterDelay
        );
      } else if (new URL(currentTabAfterDelay.url).hostname !== url.hostname) {
        console.warn(
          `Tab hostname changed during delay (from ${url.hostname} to ${new URL(currentTabAfterDelay.url).hostname}), skipping delayed screenshot.`
        );
      } else {
        console.log('Capturing delayed screenshot:', delayedFilename);
        const delayedDataUrl = await chrome.tabs.captureVisibleTab({
          format: 'png',
        });
        console.log('Delayed screenshot captured.');
        await chrome.downloads.download({
          url: delayedDataUrl,
          filename: delayedFilename,
          saveAs: false,
        });
        console.log('Delayed screenshot download initiated:', delayedFilename);
        delayedSuccess = true;
      }
    } catch (e) {
      console.error('Error during delayed capture or tab re-query:', e);
    }

    return immediateSuccess || delayedSuccess;
  } catch (error) {
    console.error('General screenshot handling error:', error);
    if (tab) console.error('Error occurred for tab:', tab.url);
    if (websiteName && typeof number !== 'undefined')
      console.error(
        'Error occurred for file base:',
        `${websiteName}_${number}`
      );
    return false;
  }
}

// Helper function isUrlAllowed REMOVED

// Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const senderUrl = sender.tab ? sender.tab.url : 'unknown sender';
  console.log(`Message received: ${message.type} from ${senderUrl}`);

  if (message.type === 'checkSettings') {
    (async () => {
      try {
        // Only check isGloballyEnabled
        const { isGloballyEnabled = false } =
          await chrome.storage.local.get('isGloballyEnabled');
        console.log(`Checking global setting: Enabled=${isGloballyEnabled}`);
        // Respond with only the global status
        sendResponse({ isGloballyEnabled: isGloballyEnabled });
      } catch (error) {
        console.error('Error during checkSettings processing:', error);
        sendResponse({ isGloballyEnabled: false }); // Send false on error
      }
    })();
    return true; // Indicate asynchronous response is intended
  }

  if (message.type === 'takeScreenshot') {
    // Before processing, check if globally enabled
    (async () => {
      const { isGloballyEnabled = false } =
        await chrome.storage.local.get('isGloballyEnabled');
      if (!isGloballyEnabled) {
        console.log(
          'Extension globally disabled, skipping takeScreenshot request.'
        );
        sendResponse({ success: false, reason: 'Globally disabled' });
        return;
      }

      // If enabled, proceed with handling the screenshot request
      console.log(
        `Received takeScreenshot request with options:`,
        message.options
      );
      const tabId = sender.tab ? sender.tab.id : null;
      const options = message.options || {};
      try {
        const result = await handleScreenshotRequest(tabId, options);
        console.log(`[takeScreenshot] Sending response: {success: ${result}}`);
        sendResponse({ success: result });
      } catch (error) {
        console.error('Error executing handleScreenshotRequest:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Indicate asynchronous response is intended
  }
});

// Navigation completion listener
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0) {
    // Only main frame
    console.log('Page navigation completed:', details.url);
    try {
      // Check only global and autoCapture settings
      const { isGloballyEnabled = false, autoCapture = true } =
        await chrome.storage.local.get(['isGloballyEnabled', 'autoCapture']);

      if (isGloballyEnabled && autoCapture) {
        console.log(
          'Auto-capturing screenshot after navigation (Globally enabled & Auto-capture enabled)...'
        );
        await handleScreenshotRequest(details.tabId, {
          captureImmediate: false,
        });
      } else {
        console.log(
          `Auto-capture skipped. Globally enabled: ${isGloballyEnabled}, Auto-capture: ${autoCapture}`
        );
      }
    } catch (error) {
      console.error('Error in webNavigation.onCompleted listener:', error);
    }
  }
});
