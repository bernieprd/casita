import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: 'reuse',
  },
  preset: {
    ...minimal2023Preset,
    apple: {
      sizes: [180],
      padding: 0.3,
      resizeOptions: { background: '#fef9c3' },
    },
  },
  images: ['public/icon.svg'],
})
