import { defineConfig } from "vite";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";

function generateManifest() {
  const manifest = readJsonFile("src/manifest.json");
  return {
    ...manifest,
    host_permissions: ["<all_urls>", "http://localhost:3000/*"]
  };
}

export default defineConfig({
  root: "src", // Sets the source root
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  plugins: [
    webExtension({
      manifest: generateManifest,
      disableAutoLaunch: true, // Don't automatically launch Chrome on every dev run
    }),
  ],
});
