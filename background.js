// Delay time (milliseconds) before capture
const SCREENSHOT_DELAY_MS = 500; // Adjusted delay, might need tuning

// Main function to handle the screenshot request (captures one delayed image)
async function handleScreenshotRequest(tabId) {
    let tab;
    let websiteName;
    let number;

    try {
        // 1. Get Tab Info and Filename Base Number
        if (tabId) {
            tab = await chrome.tabs.get(tabId);
        } else {
            tab = await chrome.tabs.query({ active: true, currentWindow: true });
        }
        if (!tab || !tab.url || !tab.url.startsWith('http')) { 
            console.warn('Cannot capture screenshot for current tab:', tab ? tab.url : 'No tab found');
            return false;
        }
        console.log('Active tab found:', tab.url);

        let url;
        try {
            url = new URL(tab.url);
        } catch (e) {
            console.error('Invalid tab URL:', tab.url, e);
            return false; 
        }

        websiteName = url.hostname.replace(/^www\./, '').split('.')[0];
        if (!websiteName) { 
            websiteName = url.hostname || 'local';
        }

        // Get the number for this click event
        const storageKey = `counter_${websiteName}`;
        const result = await chrome.storage.local.get(storageKey);
        const currentNumber = result[storageKey] || 0;
        number = currentNumber + 1;
        await chrome.storage.local.set({ [storageKey]: number }); 

        console.log(`Processing screenshot event number ${number} for ${websiteName}`);

        // --- Wait --- 
        console.log(`Waiting ${SCREENSHOT_DELAY_MS}ms before capture...`);
        await new Promise(resolve => setTimeout(resolve, SCREENSHOT_DELAY_MS));

        // --- Capture Delayed Screenshot --- 
        const filename = `${websiteName}_${number}.png`; // Use original naming scheme
        console.log('Capturing delayed screenshot:', filename);
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
            console.log('Delayed screenshot captured.');
            await chrome.downloads.download({
                url: dataUrl,
                filename: filename,
                saveAs: false
            });
            console.log('Delayed screenshot download initiated:', filename);
            return true;
        } catch (captureError) {
            console.error('Error capturing delayed screenshot:', captureError);
            return false;
        }

    } catch (error) {
        console.error('Screenshot handling error:', error);
        if (tab) console.error('Error occurred for tab:', tab.url);
        if (websiteName && typeof number !== 'undefined') console.error('Error occurred for file base:', `${websiteName}_${number}`);
        return false;
    }
}

// Message Listener with improved async handling and logging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const senderUrl = sender.tab ? sender.tab.url : 'unknown sender';
    console.log(`Message received: ${message.type} from ${senderUrl}`);

    if (message.type === 'checkSettings') {
        (async () => {
            try {
                if (!sender.tab || !sender.tab.url || !sender.tab.url.startsWith('http')) {
                    console.warn(`Cannot check settings for non-http sender: ${senderUrl}`);
                    console.log('[checkSettings] Sending response: {isAllowed: false} (invalid sender)');
                    sendResponse({ isAllowed: false });
                    return;
                }

                const settings = await chrome.storage.local.get(['isGloballyEnabled', 'allowedSites']);
                const isGloballyEnabled = settings.isGloballyEnabled ?? false;
                const allowedSites = settings.allowedSites || [];
                const currentHostname = new URL(sender.tab.url).hostname;
                const isAllowed = isGloballyEnabled && allowedSites.includes(currentHostname);

                console.log(`Checking settings for ${currentHostname}: Global=${isGloballyEnabled}, Allowed=${allowedSites.join(',')}, Result=${isAllowed}`);
                console.log(`[checkSettings] Sending response: {isAllowed: ${isAllowed}}`);
                sendResponse({ isAllowed: isAllowed });

            } catch (error) {
                console.error('Error during checkSettings processing:', error);
                try {
                    console.log('[checkSettings] Sending error response: {isAllowed: false}');
                    sendResponse({ isAllowed: false });
                } catch (responseError) {
                    console.warn('Could not send error response for checkSettings, channel likely closed:', responseError.message);
                }
            }
        })();
        return true;
    }

    if (message.type === 'takeScreenshot') {
        console.log(`Received takeScreenshot request.`);
        const tabId = sender.tab ? sender.tab.id : null;
        handleScreenshotRequest(tabId)
            .then(result => {
                console.log(`handleScreenshotRequest finished with result: ${result}`);
                try {
                    console.log(`[takeScreenshot] Sending response: {success: ${result}}`);
                    sendResponse({ success: result });
                    console.log('Sent response for takeScreenshot.');
                } catch (e) {
                    console.warn('Could not send response for takeScreenshot, channel likely closed:', e.message);
                }
            })
            .catch(error => {
                console.error('Error executing handleScreenshotRequest:', error);
                try {
                    console.log(`[takeScreenshot] Sending error response: {success: false, error: ...}`);
                    sendResponse({ success: false, error: error.message });
                    console.log('Sent error response for takeScreenshot.');
                } catch (e) {
                    console.warn('Could not send error response for takeScreenshot, channel likely closed:', e.message);
                }
            });
        return true;
    }
});

// ... Navigation completion listener ... 