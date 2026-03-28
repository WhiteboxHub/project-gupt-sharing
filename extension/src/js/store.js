import { createStore } from 'zustand/vanilla';

export const useSessionStore = createStore((set, get) => ({
    sessionId: null,
    statusText: 'Waiting',
    statusClass: 'status-waiting',
    peerConnection: null,
    dataChannel: null,
    localStream: null,
    remoteStream: null,
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],

    setSessionId: (id) => set({ sessionId: id }),
    setStatus: (text, className) => set({ statusText: text, statusClass: className }),
    setPeerConnection: (pc) => set({ peerConnection: pc }),
    setDataChannel: (dc) => set({ dataChannel: dc }),
    setLocalStream: (stream) => set({ localStream: stream }),
    setRemoteStream: (stream) => set({ remoteStream: stream }),
    setIceServers: (servers) => set({ iceServers: servers }),
    
    reset: () => set({
        sessionId: null,
        statusText: 'Waiting',
        statusClass: 'status-waiting',
        peerConnection: null,
        dataChannel: null,
        localStream: null,
        remoteStream: null
    })
}));
