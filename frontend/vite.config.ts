import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// In dev the base is always '/' so you can open http://localhost:5173/ directly.
// In production builds it uses VITE_BASE_PATH (defaults to /casita/ for GitHub Pages).
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Casita',
        short_name: 'Casita',
        description: 'Home shopping & recipes',
        theme_color: '#fef9c3',
        background_color: '#fef9c3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['casita.png'], // 3.5 MB — too large to precache
        runtimeCaching: [
          {
            // Cache all worker API calls — shopping list available offline.
            urlPattern: ({ url }) =>
              url.hostname === 'casita-worker.bernardoprd.workers.dev' ||
              (url.hostname === 'localhost' && url.port === '8787'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  base: mode === 'production' ? (process.env.VITE_BASE_PATH ?? '/casita/') : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-mui':   ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
}))
