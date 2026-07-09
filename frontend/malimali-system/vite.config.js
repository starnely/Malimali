import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// Recreate __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Local self-signed certs for `vite dev` over HTTPS. Not present in CI/
// deploy environments (Vercel, etc.), which only run `vite build` and
// never need this — so only load them if they actually exist on disk.
const keyPath  = path.resolve(__dirname, 'certs/key.pem')
const certPath = path.resolve(__dirname, 'certs/cert.pem')
const httpsOptions = (fs.existsSync(keyPath) && fs.existsSync(certPath))
  ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
  : undefined

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    https: httpsOptions,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**'],
    },
  },
})
