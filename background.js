// Delay time (milliseconds) before capture
const SCREENSHOT_DELAY_MS = 500; // Adjusted delay, might need tuning

// Main function to handle the screenshot request
// options を引数に追加
async function handleScreenshotRequest(tabId, options = {}) {
    let tab;
    let websiteName;
    let number;
    let immediateSuccess = false;
    let delayedSuccess = false;
    // オプションから即時キャプチャが必要か取得 (デフォルトは false)
    const captureImmediate = options.captureImmediate === true;

    try {
        // 1. Get Tab Info
        if (tabId) {
            tab = await chrome.tabs.get(tabId);
        } else {
            [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        }
        if (!tab || !tab.url || !tab.url.startsWith('http')) {
            console.warn('Cannot capture screenshot for current tab:', tab ? tab.url : 'No tab found');
            return false;
        }
        console.log('Processing screenshot request for tab:', tab.url);

        // 2. Check Whitelist (Added for robustness, might be redundant if checkSettings is reliable)
        // Assuming isUrlAllowed function exists and works correctly
        if (typeof isUrlAllowed === 'function' && !await isUrlAllowed(tab.url)) {
            console.log('URL not in whitelist (checked in handleScreenshotRequest), skipping screenshot:', tab.url);
            return false;
        }

        // 3. Get URL Details & Number
        let url = new URL(tab.url);
        websiteName = url.hostname.replace(/^www\./, '').split('.')[0] || 'local';
        const storageKey = `counter_${websiteName}`;
        const result = await chrome.storage.local.get(storageKey);
        const currentNumber = result[storageKey] || 0;
        number = currentNumber + 1;
        await chrome.storage.local.set({ [storageKey]: number });
        console.log(`Processing screenshot event number ${number} for ${websiteName}. Capture immediate: ${captureImmediate}`);

        // --- Capture Immediate Screenshot (Conditional) ---
        if (captureImmediate) {
            const immediateFilename = `${websiteName}_${number}_immediate.png`;
            console.log('Capturing immediate screenshot (requested): ', immediateFilename);
            try {
                const immediateDataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
                console.log('Immediate screenshot captured.');
                await chrome.downloads.download({
                    url: immediateDataUrl,
                    filename: immediateFilename,
                    saveAs: false
                });
                console.log('Immediate screenshot download initiated:', immediateFilename);
                immediateSuccess = true;
            } catch (captureError) {
                console.error('Error capturing immediate screenshot:', captureError);
            }
        } else {
            console.log('Immediate screenshot not requested, skipping.');
        }

        // --- Wait ---
        console.log(`Waiting ${SCREENSHOT_DELAY_MS}ms before delayed capture...`);
        await new Promise(resolve => setTimeout(resolve, SCREENSHOT_DELAY_MS));

        // --- Capture Delayed Screenshot ---
        const delayedFilename = `${websiteName}_${number}_delayed.png`;
        try {
            // Re-query tab to ensure it's still valid and on the same host
            let currentTabAfterDelay;
            const currentTabId = tabId || (tab ? tab.id : null);
            if (!currentTabId) {
                console.warn('Could not determine tab ID for delayed capture.');
                throw new Error('Missing tab ID');
            }
            currentTabAfterDelay = await chrome.tabs.get(currentTabId);

            if (!currentTabAfterDelay || !currentTabAfterDelay.url || !currentTabAfterDelay.url.startsWith('http')) {
                console.warn('Tab became invalid during delay, skipping delayed screenshot.', currentTabAfterDelay);
            } else if (new URL(currentTabAfterDelay.url).hostname !== url.hostname) {
                 console.warn(`Tab hostname changed during delay (from ${url.hostname} to ${new URL(currentTabAfterDelay.url).hostname}), skipping delayed screenshot.`);
            } else {
                 console.log('Capturing delayed screenshot:', delayedFilename);
                 const delayedDataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
                 console.log('Delayed screenshot captured.');
                 await chrome.downloads.download({
                     url: delayedDataUrl,
                     filename: delayedFilename,
                     saveAs: false
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
        if (websiteName && typeof number !== 'undefined') console.error('Error occurred for file base:', `${websiteName}_${number}`);
        return false;
    }
}

// Helper function to check if a URL is in the whitelist
// (Keep this function as it might be used by webNavigation listener)
async function isUrlAllowed(url) {
    try {
        const { allowedSites = [] } = await chrome.storage.local.get('allowedSites');
        const hostname = new URL(url).hostname;
        return allowedSites.some(site => hostname.includes(site));
    } catch (error) {
        console.error('Error checking URL allowlist:', error);
        return false;
    }
}

// Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const senderUrl = sender.tab ? sender.tab.url : 'unknown sender';
    console.log(`Message received: ${message.type} from ${senderUrl}`);

    if (message.type === 'checkSettings') {
        (async () => {
             try {
                if (!sender.tab || !sender.tab.url || !sender.tab.url.startsWith('http')) {
                    console.warn(`Cannot check settings for non-http sender: ${senderUrl}`);
                    sendResponse({ isAllowed: false }); return;
                }
                const settings = await chrome.storage.local.get(['isGloballyEnabled', 'allowedSites']);
                const isGloballyEnabled = settings.isGloballyEnabled ?? false;
                const allowedSites = settings.allowedSites || [];
                const currentHostname = new URL(sender.tab.url).hostname;
                const isAllowed = isGloballyEnabled && allowedSites.includes(currentHostname);
                console.log(`Checking settings for ${currentHostname}: Global=${isGloballyEnabled}, Allowed=${allowedSites.includes(currentHostname)}, Result=${isAllowed}`);
                sendResponse({ isAllowed: isAllowed });
            } catch (error) {
                console.error('Error during checkSettings processing:', error);
                sendResponse({ isAllowed: false });
            }
        })();
        return true;
    }

    if (message.type === 'takeScreenshot') {
        console.log(`Received takeScreenshot request with options:`, message.options);
        const tabId = sender.tab ? sender.tab.id : null;
        // message.options を handleScreenshotRequest に渡す
        const options = message.options || {}; // Ensure options is an object
        handleScreenshotRequest(tabId, options)
            .then(result => {
                 try {
                    console.log(`[takeScreenshot] Sending response: {success: ${result}}`);
                    sendResponse({ success: result });
                 } catch (e) { console.warn('Could not send response for takeScreenshot, channel likely closed:', e.message); }
            })
            .catch(error => {
                 try {
                     console.error('Error executing handleScreenshotRequest:', error);
                     sendResponse({ success: false, error: error.message });
                 } catch (e) { console.warn('Could not send error response for takeScreenshot, channel likely closed:', e.message); }
            });
        return true;
    }
});

// Navigation completion listener
chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (details.frameId === 0) { // Only main frame
        console.log('Page navigation completed:', details.url);
        try {
            const { autoCapture = true, allowedSites = [] } = await chrome.storage.local.get(['autoCapture', 'allowedSites']);
            const hostname = new URL(details.url).hostname;

            if (autoCapture && allowedSites.some(site => hostname.includes(site))) {
                 console.log('Auto-capturing screenshot after navigation...');
                 // Navigation should only trigger a delayed screenshot
                 await handleScreenshotRequest(details.tabId, { captureImmediate: false });
             } else {
                 console.log('Auto-capture disabled or site not allowed for navigation:', details.url);
             }
        } catch (error) {
            console.error('Error in webNavigation.onCompleted listener:', error);
        }
    }
}); 