import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const frontendPort = Number(process.env.VITE_PORT || process.env.DEV_FRONTEND_PORT || '5173')
const frontendHost = process.env.DEV_FRONTEND_HOST || 'localhost'
const backendPort = process.env.VITE_BACKEND_PORT || process.env.DEV_BACKEND_PORT || '8000'
const backendTarget = process.env.VITE_BACKEND_TARGET || `http://127.0.0.1:${backendPort}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: frontendHost,
    port: frontendPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/process': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/task': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/login': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/register': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/upload-csv': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
})
