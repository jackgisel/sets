import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// SETS_OFFLINE=1 runs without a Cloudflare login: Workers AI is disabled, so typed logs use the rule parser and voice returns an error.
export default defineConfig({
  plugins: [react(), cloudflare({ remoteBindings: !process.env.SETS_OFFLINE })],
});
