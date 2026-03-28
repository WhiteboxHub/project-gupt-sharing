import { defineConfig } from "vite";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

function generateManifest() {
  const manifest = readJsonFile("src/manifest.json");
  return {
    ...manifest,
    host_permissions: ["<all_urls>", "http://localhost:3000/*"]
  };
}

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  plugins: [
    nodePolyfills({
      globals: { Buffer: true, process: true, global: true },
      protocolImports: true,
    }),
    webExtension({
      manifest: generateManifest,
      disableAutoLaunch: true,
    }),
  ],
});
