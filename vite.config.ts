import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // "0.0.0.0" binds IPv4 so phones on the same Wi-Fi can reach the Network URL.
    // ("::" can leave the IPv4 LAN address unreachable on Windows.)
    host: "0.0.0.0",
    port: 8080,
    // Fail instead of silently switching ports, so the QR code address stays valid.
    strictPort: true,
    // Accept tunnel hostnames (cloudflared / ngrok) when testing on mobile data.
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));