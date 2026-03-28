chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== 'REMOTE_ACTION') return;
    
    const { type, x, y, key, code, modifiers, deltaX, deltaY } = message.data;

    let targetElement = document.activeElement || document.body;

    if (x !== undefined && y !== undefined) {
        // Map normalized coordinates (0.0 - 1.0) back to actual window dimensions
        const absX = window.innerWidth * x;
        const absY = window.innerHeight * y;

        targetElement = document.elementFromPoint(absX, absY) || document.body;

        if (type === 'click') {
            const clickEvent = new MouseEvent('click', {
                view: window, bubbles: true, cancelable: true,
                clientX: absX, clientY: absY
            });
            targetElement.dispatchEvent(clickEvent);

            if (targetElement.focus) {
                targetElement.focus({ preventScroll: true });
            }
        }
    } else if (type === 'scroll') {
        window.scrollBy({ left: deltaX, top: deltaY, behavior: 'instant' });
    } else if (type === 'keydown' || type === 'keyup') {
        const EventClass = type === 'keydown' ? KeyboardEvent : KeyboardEvent;
        const keyEvent = new EventClass(type, {
            key, code, bubbles: true, cancelable: true, ...modifiers
        });
        targetElement.dispatchEvent(keyEvent);

        // Browsers block real input simulation via KeyboardEvents for security,
        // so we manually mutate value on keyup for printable characters.
        if (type === 'keyup') {
            const isWritable = targetElement.tagName === 'TEXTAREA' || 
                (targetElement.tagName === 'INPUT' && ['text', 'password', 'email', 'search', 'tel', 'url', 'number'].includes(targetElement.type));
            
            if (isWritable) {
                if (key.length === 1 && !modifiers.ctrl && !modifiers.meta && !modifiers.alt) {
                    const start = targetElement.selectionStart;
                    const end = targetElement.selectionEnd;
                    const val = targetElement.value;
                    targetElement.value = val.substring(0, start) + key + val.substring(end);
                    targetElement.selectionStart = targetElement.selectionEnd = start + 1;
                    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
                    targetElement.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (key === 'Backspace' && targetElement.selectionStart > 0) {
                    const start = targetElement.selectionStart;
                    const val = targetElement.value;
                    targetElement.value = val.substring(0, start - 1) + val.substring(start);
                    targetElement.selectionStart = targetElement.selectionEnd = start - 1;
                    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
    }
});
