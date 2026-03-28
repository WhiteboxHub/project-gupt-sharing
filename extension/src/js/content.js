chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== 'REMOTE_ACTION') return;
    
    const { type, x, y, key, code, modifiers, deltaX, deltaY } = message.data;

    let targetElement = document.activeElement || document.body;
    let absX, absY;

    if (x !== undefined && y !== undefined) {
        // Map normalized coordinates (0.0 - 1.0) back to actual window dimensions
        absX = window.innerWidth * x;
        absY = window.innerHeight * y;
        targetElement = document.elementFromPoint(absX, absY) || document.body;

        // Shadow cursor logic
        let shadowCursor = document.getElementById('gupt-shadow-cursor');
        if (!shadowCursor) {
            shadowCursor = document.createElement('div');
            shadowCursor.id = 'gupt-shadow-cursor';
            Object.assign(shadowCursor.style, {
                position: 'fixed',
                width: '16px', height: '16px',
                backgroundColor: 'rgba(59, 130, 246, 0.8)', // Modern blue tailwind color
                border: '2px solid white',
                borderRadius: '50%',
                zIndex: '2147483647',
                pointerEvents: 'none',
                transition: 'top 0.03s linear, left 0.03s linear',
                boxShadow: '0 0 10px rgba(59, 130, 246, 0.8)',
                transform: 'translate(-50%, -50%)'
            });
            document.body.appendChild(shadowCursor);
        }
        shadowCursor.style.left = `${absX}px`;
        shadowCursor.style.top = `${absY}px`;
    }

    if (type === 'click' && absX !== undefined) {
        const clickEvent = new MouseEvent('click', {
            view: window, bubbles: true, cancelable: true,
            clientX: absX, clientY: absY
        });
        targetElement.dispatchEvent(clickEvent);
        if (targetElement.focus) targetElement.focus({ preventScroll: true });

        // Add a click ripple
        let shadowCursor = document.getElementById('gupt-shadow-cursor');
        if (shadowCursor) {
            shadowCursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
            setTimeout(() => shadowCursor.style.transform = 'translate(-50%, -50%) scale(1)', 100);
        }
    } else if (type === 'scroll') {
        window.scrollBy({ left: deltaX, top: deltaY, behavior: 'auto' });
    } else if (type === 'keydown' || type === 'keyup') {
        const EventClass = KeyboardEvent;
        const keyEvent = new EventClass(type, {
            key, code, bubbles: true, cancelable: true, ...modifiers
        });
        targetElement.dispatchEvent(keyEvent);

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
