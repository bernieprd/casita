import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path for GitHub Pages — override via VITE_BASE_PATH env var.
// Default matches the repo name: https://bernieprd.github.io/casita/
const base = process.env.VITE_BASE_PATH ?? '/casita/'

export default defineConfig({
  plugins: [react()],
  base,
})
