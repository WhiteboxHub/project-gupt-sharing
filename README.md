# 🕵️‍♂️ Gupt Service (WebRTC Remote Control Extension)

A powerful, high-performance Google Chrome extension that allows secure peer-to-peer screen sharing and **full remote interaction** (mouse clicks, scrolling, and keyboard typing) using WebRTC and JavaScript.

## 🚀 How It Works
The host generates a 3-word secure Session ID. The viewer connects to that Session ID and instantly receives a live video feed of the host's Chrome Tab. Any click or keystroke the viewer makes on the video feed is mathematically translated and injected (as a "ghost click" and a visible blue shadow cursor) directly into the Host's active website!

---

## 🛠️ Step 1: Initial Setup (The Host Computer)

You must run the underlying Signaling Server (Node.js) to broker the WebRTC connection between two computers.

1. **Install Dependencies:**
   Navigate to the `server/` directory and run:
   ```bash
   cd server
   npm install
   ```

2. **Start the Signaling Server:**
   ```bash
   npm start
   ```
   *(Keep this terminal window completely open!)*

3. **Expose the Server to the Internet (Crucial for Remote Use):**
   Open a **second, brand new terminal window**. Run Ngrok to create a secure global tunnel to your `localhost:3000`:
   ```bash
   npx ngrok http 3000
   ```
   *(Ngrok will give you a public URL like `https://xyz-123.ngrok-free.dev`)*

---

## 🏗️ Step 2: Build the Extension

Now you must configure the actual Chrome Extension to point to your new Ngrok URL.

1. **Update the Config Source Code:**
   Open `extension/src/js/config.js` in your editor. Replace the old URLs with the exact Ngrok URL you just generated:
   ```javascript
   export const CONFIG = {
       SIGNALING_URL: 'https://xyz-abc.ngrok-free.dev',
       TURN_CREDENTIALS_URL: 'https://xyz-abc.ngrok-free.dev/turn-credentials'
   };
   ```

2. **Build the Code:**
   Open a **third terminal window**. Navigate to the `extension/` directory and install/build:
   ```bash
   cd extension
   npm install
   npm run build
   ```
   *This magically compiles everything into a ready-to-use `dist/` folder!*

---

## 💻 Step 3: Install in Chrome

Now you must load the compiled extension into your Chrome browser. Both the Host and the Viewer must do this! (You can Zip the `dist/` folder and email it to your partner, or they can clone your repo and run `npm run build` themselves).

1. Go to `chrome://extensions` in your browser.
2. Turn on **Developer mode** in the top right corner.
3. Click **Load unpacked** in the top left.
4. Select the `extension/dist` folder you just built.

⚠️ **MANDATORY SECURITY BYPASS:** Because Ngrok has an anti-phishing wall on free accounts, **both** computers must manually bypass it once! 
Open a normal Chrome tab, paste your Ngrok URL (`https://xyz-abc.ngrok-free.dev`), and hit enter. When the blue Ngrok warning page appears, click the **"Visit Site"** button. You can now close that tab!

---

## 🎮 Step 4: How to Remote Control!

### For the Host (Sharing the Screen):
1. Navigate to the actual website you want the other person to control (e.g., `https://wikipedia.org`).
2. **Hit Refresh (F5)** to guarantee the extension is natively loaded on that page.
3. Click the Gupt Service puzzle piece icon in your Chrome toolbar.
4. Click **Start Sharing**.
5. When Chrome asks what to share, **you MUST select "Chrome Tab"** (Do not select Entire Screen, or the mouse math will be misaligned!).
6. Provide the 3-word Session ID to your partner (the Viewer).
7. **Crucial:** Keep your focus completely on that Wikipedia tab! Your partner can only control the tab you are currently actively looking at!

### For the Viewer (Taking Control):
1. Click the Gupt Service puzzle piece icon.
2. Type in the 3-word Session ID you received.
3. Click **Join Session**.
4. You will instantly see the Host's screen. Simply click your mouse anywhere on the video player, and watch the blue Shadow Cursor do your bidding on their computer!

⚠️ *Note: You cannot test the Host and Viewer on the exact same computer inside the exact same Chrome profile. Chrome's internal "Active Tab" logic will mathematically cause the mouse clicks to loop back into the viewer window instead of the host window! For testing, use two different computers, or use a completely separate Chrome Profile!*
