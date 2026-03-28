require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { uniqueNamesGenerator, adjectives, colors, animals } = require('unique-names-generator');
const twilio = require('twilio');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// Memory sessions: slug -> { hostSocket, clientSocket, createdAt }
const sessions = new Map();

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    socket.on('create_session', (callback) => {
        const slug = uniqueNamesGenerator({
            dictionaries: [adjectives, colors, animals],
            separator: '-',
            length: 3
        }).toLowerCase();

        sessions.set(slug, { hostSocket: socket, clientSocket: null, createdAt: Date.now() });
        callback({ sessionId: slug });
        console.log(`Session created: ${slug}`);
    });

    socket.on('join_session', ({ sessionId }, callback) => {
        const session = sessions.get(sessionId);
        if (!session) {
            callback({ error: 'Session not found.' });
            return;
        }
        if (session.clientSocket) {
            callback({ error: 'Session full.' });
            return;
        }

        session.clientSocket = socket;
        callback({ success: true, sessionId });
        // Notify host
        session.hostSocket.emit('client_joined', { sessionId });
        console.log(`Client ${socket.id} joined session ${sessionId}`);
    });

    socket.on('signal', ({ sessionId, signalData }) => {
        const session = sessions.get(sessionId);
        if (!session) return;

        const targetSocket = (socket === session.hostSocket) ? session.clientSocket : session.hostSocket;
        if (targetSocket) {
            targetSocket.emit('signal', { sessionId, signalData });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${socket.id}`);
        for (const [sessionId, session] of sessions.entries()) {
            if (session.hostSocket === socket) {
                if (session.clientSocket) {
                    session.clientSocket.emit('session_ended');
                }
                sessions.delete(sessionId);
                console.log(`Session ${sessionId} terminated`);
            } else if (session.clientSocket === socket) {
                if (session.hostSocket) {
                    session.hostSocket.emit('client_disconnected');
                }
                session.clientSocket = null;
            }
        }
    });
});

app.get('/turn-credentials', async (req, res) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        return res.json({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    }

    try {
        const client = twilio(accountSid, authToken);
        const token = await client.tokens.create();
        res.json({ iceServers: token.iceServers });
    } catch (err) {
        console.error('Twilio Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch' });
    }
});

server.listen(PORT, () => console.log(`Socket.io server running on port ${PORT}`));
