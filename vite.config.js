import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  server: {
    proxy: {
      "/api/solve": { target: "http://127.0.0.1:8787", changeOrigin: true, timeout: 330_000, proxyTimeout: 330_000 },
    },
  },
  resolve: { preserveSymlinks: true },
});
