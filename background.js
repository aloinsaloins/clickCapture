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

// Message Listener with improved async handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(`Message received: ${message.type} from ${sender.tab ? sender.tab.url : 'unknown sender'}`);

    if (message.type === 'checkSettings') {
        // Use an async IIFE for cleaner async/await within the listener
        (async () => {
            try {
                // Ensure sender tab and URL exist and are http/https
                if (!sender.tab || !sender.tab.url || !sender.tab.url.startsWith('http')) {
                    console.warn(`Cannot check settings for non-http sender: ${sender.tab ? sender.tab.url : 'unknown'}`);
                    sendResponse({ isAllowed: false });
                    return;
                }

                const settings = await chrome.storage.local.get(['isGloballyEnabled', 'allowedSites']);
                const isGloballyEnabled = settings.isGloballyEnabled ?? false; // Default to false if undefined
                const allowedSites = settings.allowedSites || [];
                const currentHostname = new URL(sender.tab.url).hostname;

                const isAllowed = isGloballyEnabled && allowedSites.includes(currentHostname);
                console.log(`Checking settings for ${currentHostname}: Global=${isGloballyEnabled}, Allowed=${allowedSites.join(',')}, Result=${isAllowed}`);
                sendResponse({ isAllowed: isAllowed });

            } catch (error) {
                console.error('Error during checkSettings processing:', error);
                // Attempt to send an error response, but catch potential errors if channel is already closed
                try {
                    sendResponse({ isAllowed: false });
                } catch (responseError) {
                    console.warn('Could not send error response for checkSettings, channel likely closed:', responseError.message);
                }
            }
        })(); // Immediately invoke the async function

        return true; // Indicate asynchronous response is intended
    }

    if (message.type === 'takeScreenshot') {
        console.log(`Received takeScreenshot request.`);
        // Ensure tab ID is passed if available
        const tabId = sender.tab ? sender.tab.id : null;
        handleScreenshotRequest(tabId)
            .then(result => {
                console.log(`handleScreenshotRequest finished with result: ${result}`);
                 // Check if channel is still open before sending response
                try {
                    sendResponse({ success: result });
                    console.log('Sent response for takeScreenshot.');
                } catch (e) {
                    // Log if sending fails - channel might be closed if the content script navigated away
                    console.warn('Could not send response for takeScreenshot, channel likely closed:', e.message);
                }
            })
            .catch(error => {
                console.error('Error executing handleScreenshotRequest:', error);
                 // Check if channel is still open before sending error response
                try {
                    sendResponse({ success: false, error: error.message });
                    console.log('Sent error response for takeScreenshot.');
                } catch (e) {
                    console.warn('Could not send error response for takeScreenshot, channel likely closed:', e.message);
                }
            });
        return true; // Indicate asynchronous response is intended
    }
    
    // Handle other message types if needed, otherwise return false or undefined implicitly
});

// ... Navigation completion listener ... 