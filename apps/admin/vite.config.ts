import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../../dist/admin",
    emptyOutDir: true,
  },
  plugins: [react()],
  root: "apps/admin",
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      "/ws": {
        target: "ws://localhost:4000",
        ws: true,
      },
    },
  },
});
