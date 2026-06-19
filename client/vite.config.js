import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
base: "/myob-app/",
  server: {
    port: 1152,
    proxy: {
      "/auth": {
        target: "http://localhost:7001",
        changeOrigin: true,
        secure: false,
      },
      "/api": {
        target: "http://localhost:7001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // SPA fallback for direct URL access
  appType: "spa",
});
