export const CONFIG = {
    SIGNALING_URL: 'ws://localhost:3000',
    TURN_CREDENTIALS_URL: 'http://localhost:3000/turn-credentials'
};

export async function fetchIceServers() {
    try {
        const res = await fetch(CONFIG.TURN_CREDENTIALS_URL);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        return data.iceServers;
    } catch(err) {
        console.warn('Failed to fetch TURN credentials, falling back to STUN only', err);
        return [{ urls: 'stun:stun.l.google.com:19302' }];
    }
}
