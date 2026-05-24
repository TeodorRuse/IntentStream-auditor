import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Allow overriding the backend host via VITE_BACKEND env var.
  // - In docker compose: BACKEND_HOST is "backend" (service name)
  // - In local dev (npm run dev): falls back to 127.0.0.1
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_BACKEND || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/intents': backend,
        '/chains':  backend,
        '/health':  backend,
      },
    },
  }
})
