chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'REMOTE_CONTROL') {
        // Forward cursor events + clicks to ALL active tabs in case Chrome lost OS focus
        chrome.tabs.query({ active: true }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'REMOTE_ACTION',
                    data: message.data
                }).catch(err => {
                    // Ignore if tab is a chrome:// page or not injected
                });
            });
        });
    }
});

chrome.commands.onCommand.addListener((command) => {
    if (command === 'panic_kill') {
        console.warn("🛡️ PANIC BUTTON ACTIVATED: Killing web streams!");
        chrome.runtime.sendMessage({ action: 'PANIC_KILL' }).catch(() => {});
    }
});
