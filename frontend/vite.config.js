import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server: http://localhost:5173 — proxies API + WebSocket to the gateway,
// so the browser always talks to ONE origin (no CORS needed, same as nginx in Docker).
export default defineConfig({
  plugins: [react()],
  define: { global: 'globalThis' }, // sockjs-client expects `global`
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/ws': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
    },
  },
})
