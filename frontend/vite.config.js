import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function securityHeadersPlugin() {
  return {
    name: "security-headers",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("X-XSS-Protection", "1; mode=block");
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        res.setHeader(
          "Content-Security-Policy",
          "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://*.firebaseio.com; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:8000 http://localhost:8000 https://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com https://accounts.google.com; frame-src 'self' https://accounts.google.com https://*.google.com https://*.firebaseapp.com; img-src 'self' data: blob: https://*.googleusercontent.com; font-src 'self' data:;"
        );
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), securityHeadersPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  }
});
