import { useSessionStore } from './store.js';
import { CONFIG, fetchIceServers } from './config.js';

const urlParams = new URLSearchParams(window.location.search);
const sessionIdParam = urlParams.get('id');

if (!sessionIdParam) {
    alert('No Session ID provided.');
    window.close();
}

useSessionStore.getState().setSessionId(sessionIdParam);

let ws;
const statusTextEl = document.getElementById('status-text');
const statusDot = document.querySelector('.status-dot');
const remoteVideo = document.getElementById('remote-video');
const interactionLayer = document.getElementById('interaction-layer');

document.getElementById('session-display').textContent = `ID: ${sessionIdParam}`;

// Subscribe to Zustand state
useSessionStore.subscribe((state) => {
    statusTextEl.textContent = state.statusText;
    if (state.statusClass === 'status-connected') {
        statusDot.classList.add('connected');
    } else {
        statusDot.classList.remove('connected');
    }

    if (state.remoteStream && remoteVideo.srcObject !== state.remoteStream) {
        remoteVideo.srcObject = state.remoteStream;
        console.log('Attached remote video stream to UI');
    }
});

document.getElementById('disconnect-btn').addEventListener('click', () => {
    if (ws) ws.close();
    window.close();
});

async function connectSignalingServer() {
    // Prevent fetching ICE while connected
    const ice = await fetchIceServers();
    useSessionStore.getState().setIceServers({ iceServers: ice });

    ws = new WebSocket(CONFIG.SIGNALING_URL);
    ws.onopen = () => {
        useSessionStore.getState().setStatus('Server Connected. Joining Session...', 'status-waiting');
        ws.send(JSON.stringify({ type: 'join_session', sessionId: sessionIdParam }));
    };
    ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        handleSignalingMessage(msg);
    };
    ws.onclose = () => {
        useSessionStore.getState().setStatus('Disconnected', 'status-waiting');
    };
}

async function handleSignalingMessage(msg) {
    const state = useSessionStore.getState();

    switch (msg.type) {
        case 'session_joined':
            state.setStatus('Session Joined. Waiting for Host WebRTC Offer...', 'status-waiting');
            break;

        case 'offer':
            state.setStatus('Received Offer. Establishing P2P...', 'status-waiting');
            await createPeerConnection();
            
            const pc = useSessionStore.getState().peerConnection;
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', sessionId: state.sessionId, payload: answer }));
            break;

        case 'candidate':
            if (state.peerConnection) {
                await state.peerConnection.addIceCandidate(new RTCIceCandidate(msg.payload));
            }
            break;

        case 'session_ended':
            alert('Host ended the session.');
            window.close();
            break;

        case 'error':
            alert(msg.message);
            window.close();
            break;
    }
}

async function createPeerConnection() {
    const state = useSessionStore.getState();
    const pc = new RTCPeerConnection(state.iceServers);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'candidate', sessionId: state.sessionId, payload: event.candidate }));
        }
    };

    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected') {
            useSessionStore.getState().setStatus('Connected & Viewing', 'status-connected');
        } else if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
            useSessionStore.getState().setStatus('Connection Lost', 'status-waiting');
        }
    };

    pc.ontrack = (event) => {
        useSessionStore.getState().setRemoteStream(event.streams[0]);
    };

    pc.ondatachannel = (event) => {
        const dc = event.channel;
        dc.onopen = () => console.log('Data channel open for remote control!');
        useSessionStore.getState().setDataChannel(dc);
    };

    state.setPeerConnection(pc);
}

// Coordinate mapping logic
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

    return { x: mouseX / drawWidth, y: mouseY / drawHeight };
}

function sendControlEvent(payload) {
    const dc = useSessionStore.getState().dataChannel;
    if (dc && dc.readyState === 'open') {
        dc.send(JSON.stringify(payload));
    }
}

interactionLayer.addEventListener('click', (e) => {
    const coords = getMappedCoordinates(e);
    if (!coords) return;
    sendControlEvent({ type: 'click', ...coords });
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

connectSignalingServer();
