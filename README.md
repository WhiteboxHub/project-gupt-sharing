# Gupt Service - Peer to Peer WebRTC Screen Sharing

## Overview
Gupt Service is a Chrome extension that enables low-latency, peer-to-peer screen sharing and remote interaction securely orchestrated via a central signaling server.

## Setup Instructions

### 1. Start the Signaling Server
```bash
cd server
npm install
npm start
```
The signaling server runs on `http://localhost:3000` by default.

### 2. Install the Extension
1. Open Google Chrome.
2. Navigate to `chrome://extensions`.
3. Enable **Developer Mode** in the top right.
4. Click **Load unpacked** and select the `extension/` directory.

### 3. Usage Flow
- **Hosting**: Click the Gupt Service extension icon. Click **Start Sharing** to generate a session ID and pick the screen/tab you want to share. Share the 6-character ID with your client.
- **Viewing**: Click the Gupt Service extension icon. Enter the Host's 6-character Session ID and click **Join Session**. You will be securely connected through WebRTC and see the screen. Any keyboard or mouse clicks on the video will be dispatched silently to the Host's active Chrome tab!

## Project Structure
- `server/server.js`: Lightweight Signaling Server bridging Peer connection offers, answers, and ICE routing securely between endpoints.
- `extension/manifest.json`: WebExtension Manifest V3.
- `extension/js/host.js`: WebRTC Data channel and Peer Connection orchestration for the host. 
- `extension/js/viewer.js`: Mathematical mapping system converting local container clicks onto remote resolution agnostic dimensions.
- `extension/js/content.js`: Receives decoded payload and directly triggers low-level DOM events for `keydown`, `click`, etc., without violating standard security boundaries.
