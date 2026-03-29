document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('start-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('host.html') });
    });

    document.getElementById('join-btn').addEventListener('click', () => {
        const sessionId = document.getElementById('session-input').value.trim().toLowerCase();
        if (!sessionId || sessionId.length < 6) {
            const errorEl = document.getElementById('join-error');
            errorEl.textContent = 'Please enter a valid 6-character Session ID.';
            errorEl.classList.remove('hidden');
            return;
        }
        chrome.tabs.create({ url: chrome.runtime.getURL(`viewer.html?id=${sessionId}`) });
    });
});
