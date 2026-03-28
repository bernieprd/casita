import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev the base is always '/' so you can open http://localhost:5173/ directly.
// In production builds it uses VITE_BASE_PATH (defaults to /casita/ for GitHub Pages).
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? (process.env.VITE_BASE_PATH ?? '/casita/') : '/',
}))
