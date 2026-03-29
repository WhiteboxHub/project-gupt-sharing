import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import { useSessionStore } from './store.js';
import { CONFIG, fetchIceServers } from './config.js';

const urlParams = new URLSearchParams(window.location.search);
const sessionIdParam = urlParams.get('id');

if (!sessionIdParam) {
    alert('No Session ID provided.');
    window.close();
}

useSessionStore.getState().setSessionId(sessionIdParam);

const statusTextEl = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const remoteVideo = document.getElementById('remote-video');
const interactionLayer = document.getElementById('interaction-layer');

document.getElementById('session-display').textContent = `ID: ${sessionIdParam}`;

useSessionStore.subscribe((state) => {
    statusTextEl.textContent = state.statusText;
    if (state.statusClass === 'status-connected') {
        statusDot.classList.replace('bg-red-500', 'bg-emerald-500');
        statusDot.classList.replace('shadow-[0_0_8px_rgba(239,68,68,1)]', 'shadow-[0_0_8px_rgba(16,185,129,1)]');
    } else {
        statusDot.classList.replace('bg-emerald-500', 'bg-red-500');
        statusDot.classList.replace('shadow-[0_0_8px_rgba(16,185,129,1)]', 'shadow-[0_0_8px_rgba(239,68,68,1)]');
    }

    if (state.remoteStream && remoteVideo.srcObject !== state.remoteStream) {
        remoteVideo.srcObject = state.remoteStream;
    }
});

document.getElementById('disconnect-btn').addEventListener('click', () => {
    useSessionStore.getState().reset();
    window.close();
});

async function connectSignalingServer() {
    const ice = await fetchIceServers();
    useSessionStore.getState().setIceServers({ iceServers: ice });

    const socket = io(CONFIG.SIGNALING_URL);
    useSessionStore.getState().setSocket(socket);

    socket.on('connect', () => {
        useSessionStore.getState().setStatus('Server Connected. Joining...', 'status-waiting');
        socket.emit('join_session', { sessionId: sessionIdParam }, (res) => {
            if (res.error) {
                alert(res.error);
                window.close();
                return;
            }
            useSessionStore.getState().setStatus('Session Joined. Waiting for Host...', 'status-waiting');
            initializePeer(socket);
        });
    });

    socket.on('signal', ({ signalData }) => {
        const peer = useSessionStore.getState().peer;
        if (peer && !peer.destroyed) {
            peer.signal(signalData);
        }
    });

    socket.on('session_ended', () => {
        alert('Host ended the session.');
        window.close();
    });

    socket.on('disconnect', () => {
        useSessionStore.getState().setStatus('Disconnected', 'status-waiting');
    });
}

function initializePeer(socket) {
    const state = useSessionStore.getState();
    const peer = new Peer({
        initiator: false, // The host is initiator
        config: state.iceServers,
        trickle: true
    });

    peer.on('signal', data => {
        socket.emit('signal', { sessionId: sessionIdParam, signalData: data });
    });

    peer.on('connect', () => {
        useSessionStore.getState().setStatus('Connected & Viewing', 'status-connected');
    });

    peer.on('stream', stream => {
        useSessionStore.getState().setRemoteStream(stream);
    });

    peer.on('close', () => {
        useSessionStore.getState().setStatus('Connection Lost', 'status-waiting');
    });

    useSessionStore.getState().setPeer(peer);
}

// Coordinate mapping (Using explicit percentages)
function getMappedCoordinates(e) {
    if (!remoteVideo.videoWidth) return null;
    
    const rect = remoteVideo.getBoundingClientRect();
    const videoRatio = remoteVideo.videoWidth / remoteVideo.videoHeight;
    const containerRatio = rect.width / rect.height;

    let drawWidth, drawHeight, offsetX = 0, offsetY = 0;

    if (videoRatio > containerRatio) {
        drawWidth = rect.width;
        drawHeight = drawWidth / videoRatio;
        offsetY = (rect.height - drawHeight) / 2;
    } else {
        drawHeight = rect.height;
        drawWidth = drawHeight * videoRatio;
        offsetX = (rect.width - drawWidth) / 2;
    }

    const mouseX = e.clientX - rect.left - offsetX;
    const mouseY = e.clientY - rect.top - offsetY;

    if (mouseX < 0 || mouseX > drawWidth || mouseY < 0 || mouseY > drawHeight) {
        return null;
    }

    // percentage-based coordinate system mathematically represented as strict ratios
    return { x: mouseX / drawWidth, y: mouseY / drawHeight };
}

function sendControlEvent(payload) {
    const peer = useSessionStore.getState().peer;
    if (peer && peer.connected) {
        peer.send(JSON.stringify(payload));
    }
}

// Interactive layer listeners
interactionLayer.addEventListener('click', (e) => {
    const coords = getMappedCoordinates(e);
    if (!coords) return;
    sendControlEvent({ type: 'click', ...coords });
});

let lastMouseMove = 0;
interactionLayer.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastMouseMove < 30) return; // Throttle to ~30fps
    lastMouseMove = now;

    // Send mousemove for shadow cursor
    const coords = getMappedCoordinates(e);
    if (!coords) return;
    sendControlEvent({ type: 'mousemove', ...coords });
});

interactionLayer.addEventListener('wheel', (e) => {
    e.preventDefault();
    sendControlEvent({ type: 'scroll', deltaX: e.deltaX, deltaY: e.deltaY });
}, { passive: false });

window.addEventListener('keydown', (e) => {
    sendControlEvent({ type: 'keydown', key: e.key, code: e.code, modifiers: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey }});
});

window.addEventListener('keyup', (e) => {
    sendControlEvent({ type: 'keyup', key: e.key, code: e.code, modifiers: { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey }});
});

// Listen for Panic kill from global hotkey
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'PANIC_KILL') {
        useSessionStore.getState().reset();
    }
});

connectSignalingServer();
