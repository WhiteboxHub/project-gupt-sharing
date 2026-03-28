chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'REMOTE_CONTROL') {
        // Forward cursor events + clicks
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'REMOTE_ACTION',
                    data: message.data
                }).catch(err => {
                    // Ignore injection errors
                });
            }
        });
    }
});

chrome.commands.onCommand.addListener((command) => {
    if (command === 'panic_kill') {
        console.warn("🛡️ PANIC BUTTON ACTIVATED: Killing web streams!");
        chrome.runtime.sendMessage({ action: 'PANIC_KILL' }).catch(() => {});
    }
});
