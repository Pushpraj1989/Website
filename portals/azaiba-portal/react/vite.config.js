import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The React app is served from /app/ next to the CMS data in /data/ and media in /media/.
// HashRouter keeps deep links working on any static host without rewrite rules.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../dist/app",
    emptyOutDir: true,
  },
});
