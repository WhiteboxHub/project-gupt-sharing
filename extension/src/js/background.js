chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'REMOTE_CONTROL') {
        // Find the currently active tab in the main focused window to inject events
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'REMOTE_ACTION',
                    data: message.data
                }).catch(err => {
                    // Ignore errors (e.g. if the active tab is chrome:// or extension page)
                    if (chrome.runtime.lastError) {}
                });
            }
        });
    }
});
