import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import { useSessionStore } from './store.js';
import { CONFIG, fetchIceServers } from './config.js';

const statusTextEl = document.getElementById('status-text');
const shareBtn = document.getElementById('share-btn');
const sessionInfo = document.getElementById('session-info');
const sessionIdEl = document.getElementById('session-id');
const clientStatus = document.getElementById('client-status');
const clientText = document.getElementById('client-text');
const copyBtn = document.getElementById('copy-btn');
const localVideo = document.getElementById('local-video');
const stopBtn = document.getElementById('stop-btn');

useSessionStore.subscribe((state) => {
    statusTextEl.textContent = state.statusText;
    // Basic class overriding if needed, tailwind handles default colors well but we can swap them
    if (state.statusClass) statusTextEl.className = `text-sm font-semibold ${state.statusClass}`;

    if (state.sessionId) {
        sessionIdEl.textContent = state.sessionId;
        sessionInfo.classList.remove('hidden');
        clientStatus.classList.remove('hidden');
        shareBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
    } else {
        sessionInfo.classList.add('hidden');
        clientStatus.classList.add('hidden');
        shareBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
    }

    if (state.localStream && localVideo.srcObject !== state.localStream) {
        localVideo.srcObject = state.localStream;
    }
});

function connectSignalingServer() {
    const socket = io(CONFIG.SIGNALING_URL);
    useSessionStore.getState().setSocket(socket);

    socket.on('connect', async () => {
        console.log('socket.io connected');
        const ice = await fetchIceServers();
        useSessionStore.getState().setIceServers(ice);
    });

    socket.on('client_joined', ({ sessionId }) => {
        clientText.textContent = 'Client connected. Establishing secure tunnel...';
        useSessionStore.getState().setStatus('Client Connecting...', 'text-yellow-400');
        
        const state = useSessionStore.getState();
        const peer = new Peer({
            initiator: true,
            stream: state.localStream,
            config: { iceServers: state.iceServers },
            trickle: true
        });
        
        peer.on('signal', data => {
            socket.emit('signal', { sessionId, signalData: data });
        });

        peer.on('connect', () => {
            useSessionStore.getState().setStatus('Connected (P2P)', 'text-emerald-400');
            clientText.textContent = 'Client is controlling your screen!';
        });

        peer.on('data', data => {
            handleControlMessage({ data });
        });

        peer.on('close', () => {
            clientText.textContent = 'Client disconnected. Waiting for new client...';
            useSessionStore.getState().setStatus('Session Active. Waiting for Peer.', 'text-yellow-400');
        });

        useSessionStore.getState().setPeer(peer);
    });

    socket.on('signal', ({ signalData }) => {
        const peer = useSessionStore.getState().peer;
        if (peer && !peer.destroyed) {
            peer.signal(signalData);
        }
    });

    socket.on('client_disconnected', () => {
        clientText.textContent = 'Client disconnected. Waiting for new client...';
        useSessionStore.getState().setStatus('Session Active. Waiting for Peer.', 'text-yellow-400');
        const peer = useSessionStore.getState().peer;
        if (peer) peer.destroy();
    });

    socket.on('disconnect', () => {
        useSessionStore.getState().setStatus('Disconnected from Server', 'text-red-500');
    });
}

function handleControlMessage(event) {
    try {
        const ctrlData = JSON.parse(event.data.toString());
        chrome.runtime.sendMessage({ action: 'REMOTE_CONTROL', data: ctrlData });
    } catch (e) {
        console.error('Invalid control data', e);
    }
}

async function startScreenShare() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: { max: 1280 }, height: { max: 720 }, frameRate: { max: 30 } },
            audio: false
        });

        useSessionStore.getState().setLocalStream(stream);

        stream.getVideoTracks()[0].onended = () => {
            alert('Screen share ended locally.');
            const { socket } = useSessionStore.getState();
            if (socket) socket.disconnect();
            window.close();
        };

        const socket = useSessionStore.getState().socket;
        socket.emit('create_session', (res) => {
            useSessionStore.getState().setSessionId(res.sessionId);
            useSessionStore.getState().setStatus('Session Active. Waiting for Peer.', 'text-yellow-400');
        });

    } catch (err) {
        console.error('Error:', err);
        useSessionStore.getState().setStatus('Screen share failed.', 'text-red-500');
    }
}

shareBtn.addEventListener('click', startScreenShare);

stopBtn.addEventListener('click', () => {
    const state = useSessionStore.getState();
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
    }
    const socket = state.socket;
    if (socket) socket.disconnect();
    window.close();
});

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(useSessionStore.getState().sessionId);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => copyBtn.textContent = 'Copy', 2000);
});

// Listen for Panic kill from global hotkey
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'PANIC_KILL') {
        useSessionStore.getState().reset();
    }
});

connectSignalingServer();
