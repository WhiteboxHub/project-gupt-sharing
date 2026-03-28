import { createStore } from 'zustand/vanilla';

export const useSessionStore = createStore((set, get) => ({
    sessionId: null,
    statusText: 'Waiting',
    statusClass: 'status-waiting',
    peer: null,        // simple-peer instance
    socket: null,      // socket.io instance
    localStream: null,
    remoteStream: null,
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],

    setSessionId: (id) => set({ sessionId: id }),
    setStatus: (text, className) => set({ statusText: text, statusClass: className }),
    setPeer: (p) => set({ peer: p }),
    setSocket: (s) => set({ socket: s }),
    setLocalStream: (stream) => set({ localStream: stream }),
    setRemoteStream: (stream) => set({ remoteStream: stream }),
    setIceServers: (servers) => set({ iceServers: servers }),
    
    reset: () => {
        const { peer, socket, localStream } = get();
        if (peer) peer.destroy();
        if (socket) socket.disconnect();
        if (localStream) localStream.getTracks().forEach(t => t.stop());

        set({
            sessionId: null,
            statusText: 'Disconnected (Panic/Reset)',
            statusClass: 'text-red-500',
            peer: null,
            socket: null,
            localStream: null,
            remoteStream: null
        });
    }
}));
