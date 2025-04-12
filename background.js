// Delay time (milliseconds) before capture
const SCREENSHOT_DELAY_MS = 500; // Adjusted delay, might need tuning

// Main function to handle the screenshot request (captures one delayed image)
async function handleScreenshotRequest() {
    let tab;
    let websiteName;
    let number;

    try {
        // 1. Get Tab Info and Filename Base Number
        [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !tab.url.startsWith('http')) { 
            console.warn('Cannot capture screenshot for current tab:', tab ? tab.url : 'No tab found');
            return;
        }
        console.log('Active tab found:', tab.url);

        let url;
        try {
            url = new URL(tab.url);
        } catch (e) {
            console.error('Invalid tab URL:', tab.url, e);
            return; 
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
        } catch (captureError) {
            console.error('Error capturing delayed screenshot:', captureError);
        }

    } catch (error) {
        console.error('Screenshot handling error:', error);
        if (tab) console.error('Error occurred for tab:', tab.url);
        if (websiteName && typeof number !== 'undefined') console.error('Error occurred for file base:', `${websiteName}_${number}`);
    }
}

// Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  if (message.type === 'takeScreenshot') {
    handleScreenshotRequest(); 
  }
  return true; 
}); 