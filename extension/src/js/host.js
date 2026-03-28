import { useSessionStore } from './store.js';
import { CONFIG, fetchIceServers } from './config.js';

let ws;
const statusTextEl = document.getElementById('status-text');
const shareBtn = document.getElementById('share-btn');
const sessionInfo = document.getElementById('session-info');
const sessionIdEl = document.getElementById('session-id');
const clientStatus = document.getElementById('client-status');
const clientText = document.getElementById('client-text');
const copyBtn = document.getElementById('copy-btn');
const localVideo = document.getElementById('local-video');

// Subscribe to Zustand store changes to update DOM gracefully
useSessionStore.subscribe((state) => {
    statusTextEl.textContent = state.statusText;
    statusTextEl.className = state.statusClass;

    if (state.sessionId) {
        sessionIdEl.textContent = state.sessionId;
        sessionInfo.classList.remove('hidden');
        clientStatus.classList.remove('hidden');
        shareBtn.classList.add('hidden');
    }

    if (state.localStream && localVideo.srcObject !== state.localStream) {
        localVideo.srcObject = state.localStream;
    }
});

async function connectSignalingServer() {
    ws = new WebSocket(CONFIG.SIGNALING_URL);
    ws.onopen = () => console.log('Connected to signaling server');
    ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        handleSignalingMessage(msg);
    };
    ws.onclose = () => {
        useSessionStore.getState().setStatus('Disconnected from Server', 'status-waiting');
        setTimeout(connectSignalingServer, 3000);
    };

    // Pre-fetch ICE servers while waiting
    const ice = await fetchIceServers();
    useSessionStore.getState().setIceServers(ice);
}

async function handleSignalingMessage(msg) {
    const state = useSessionStore.getState();

    switch (msg.type) {
        case 'session_created':
            state.setSessionId(msg.sessionId);
            state.setStatus('Session Active. Waiting for Peer.', 'status-waiting');
            break;

        case 'client_joined':
            clientText.textContent = 'Client connected. Establishing secure tunnel...';
            state.setStatus('Client Connecting...', 'status-waiting');
            await createPeerConnection();
            
            // State might have updated pc
            const pc = useSessionStore.getState().peerConnection;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', sessionId: state.sessionId, payload: pc.localDescription }));
            break;

        case 'answer':
            if (state.peerConnection) {
                await state.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.payload));
                clientText.textContent = 'Client is viewing your screen!';
                state.setStatus('Secure Session Active', 'status-connected');
            }
            break;

        case 'candidate':
            if (state.peerConnection) {
                await state.peerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
            }
            break;

        case 'client_disconnected':
            clientText.textContent = 'Client disconnected. Waiting for new client...';
            state.setStatus('Session Active. Waiting for Peer.', 'status-waiting');
            if (state.peerConnection) {
                state.peerConnection.close();
                state.setPeerConnection(null);
            }
            break;

        case 'session_ended':
            alert('Session ended');
            window.close();
            break;

        case 'error':
            alert(msg.message);
            break;
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
            if (ws && useSessionStore.getState().sessionId) {
                ws.close();
            }
            window.close();
        };

        ws.send(JSON.stringify({ type: 'create_session' }));

    } catch (err) {
        console.error('Error sharing screen:', err);
        useSessionStore.getState().setStatus('Screen share failed or denied.', 'status-waiting');
    }
}

async function createPeerConnection() {
    const state = useSessionStore.getState();
    const pc = new RTCPeerConnection({ iceServers: state.iceServers });

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'candidate', sessionId: useSessionStore.getState().sessionId, payload: event.candidate }));
        }
    };

    pc.oniceconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
            clientText.textContent = 'Connection lost. Waiting for reconnect...';
        } else if (pc.iceConnectionState === 'connected') {
            clientText.textContent = 'Client is controlling your screen!';
            useSessionStore.getState().setStatus('Connected (P2P)', 'status-connected');
        }
    };

    if (state.localStream) {
        state.localStream.getTracks().forEach(track => {
            pc.addTrack(track, state.localStream);
        });
    }

    const dc = pc.createDataChannel('controlChannel');
    dc.onopen = () => console.log('Data channel open');
    dc.onmessage = handleControlMessage;
    
    state.setPeerConnection(pc);
    state.setDataChannel(dc);
}

function handleControlMessage(event) {
    try {
        const ctrlData = JSON.parse(event.data);
        console.log('Received control data:', ctrlData);
        chrome.runtime.sendMessage({ action: 'REMOTE_CONTROL', data: ctrlData });
    } catch (e) {
        console.error('Invalid control data', e);
    }
}

shareBtn.addEventListener('click', startScreenShare);

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(useSessionStore.getState().sessionId);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => copyBtn.textContent = 'Copy', 2000);
});

connectSignalingServer();
