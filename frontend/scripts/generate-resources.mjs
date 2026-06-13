// Generates source images for @capacitor/assets from public/icon.svg using sharp.
// Run via: pnpm generate-native-assets
import { createRequire } from 'module'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const sharp = require(join(__dirname, '../node_modules/sharp/lib/index.js'))

const root = join(__dirname, '..')
mkdirSync(join(root, 'resources'), { recursive: true })

const svg = join(root, 'public/icon.svg')

await sharp(svg)
  .resize(880, 880, { fit: 'contain', background: '#fef9c3' })
  .extend({ top: 72, bottom: 72, left: 72, right: 72, background: '#fef9c3' })
  .flatten({ background: '#fef9c3' })
  .png()
  .toFile(join(root, 'resources/icon.png'))

await sharp(svg)
  .resize(660, 660, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({ top: 182, bottom: 182, left: 182, right: 182, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(join(root, 'resources/icon-foreground.png'))

await sharp(svg)
  .resize(600, 600, { fit: 'contain', background: '#fef9c3' })
  .extend({ top: 1066, bottom: 1066, left: 1066, right: 1066, background: '#fef9c3' })
  .flatten({ background: '#fef9c3' })
  .png()
  .toFile(join(root, 'resources/splash.png'))

console.log('resources/ generated')
