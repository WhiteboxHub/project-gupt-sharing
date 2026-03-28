require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const twilio = require('twilio');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow fetch from extension frontend!

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Sessions memory logic replacing the Redis
const sessions = new Map();

wss.on('connection', (ws) => {
    ws.id = uuidv4();
    console.log(`New connection: ${ws.id}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Invalid JSON received:', error);
        }
    });

    ws.on('close', () => {
        for (const [sessionId, session] of sessions.entries()) {
            if (session.hostWs === ws) {
                if (session.clientWs && session.clientWs.readyState === WebSocket.OPEN) {
                    session.clientWs.send(JSON.stringify({ type: 'session_ended' }));
                }
                sessions.delete(sessionId);
                console.log(`Session ${sessionId} terminated`);
            } else if (session.clientWs === ws) {
                if (session.hostWs && session.hostWs.readyState === WebSocket.OPEN) {
                    session.hostWs.send(JSON.stringify({ type: 'client_disconnected' }));
                }
                session.clientWs = null;
            }
        }
    });
});

function handleMessage(ws, data) {
    const { type, sessionId, payload } = data;
    switch (type) {
        case 'create_session': {
            const newSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
            sessions.set(newSessionId, { hostWs: ws, clientWs: null, createdAt: Date.now() });
            ws.send(JSON.stringify({ type: 'session_created', sessionId: newSessionId }));
            break;
        }
        case 'join_session': {
            const session = sessions.get(sessionId);
            if (!session) { ws.send(JSON.stringify({ type: 'error', message: 'Session not found.' })); return; }
            if (session.clientWs) { ws.send(JSON.stringify({ type: 'error', message: 'Session full.' })); return; }
            session.clientWs = ws;
            ws.send(JSON.stringify({ type: 'session_joined', sessionId }));
            session.hostWs.send(JSON.stringify({ type: 'client_joined', sessionId }));
            break;
        }
        case 'offer':
        case 'answer':
        case 'candidate': {
            const session = sessions.get(sessionId);
            if (!session) return;
            const targetWs = (ws === session.hostWs) ? session.clientWs : session.hostWs;
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({ type, sessionId, payload }));
            }
            break;
        }
    }
}

// Twilio Network Traversal API Endpoint
app.get('/turn-credentials', async (req, res) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        // Safe fallback if Twilio is not configured locally
        return res.json({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
    }

    try {
        const client = twilio(accountSid, authToken);
        const token = await client.tokens.create();
        res.json({ iceServers: token.iceServers });
    } catch (err) {
        console.error('Twilio Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch TURN credentials' });
    }
});

app.get('/', (req, res) => res.send('Gupt Service Signaling Server is Running'));

server.listen(PORT, () => {
    console.log(`Signaling server listening on port ${PORT}`);
});
