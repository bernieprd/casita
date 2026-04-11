// One-time script to generate PWA icon PNGs from casita.png
// Run: node scripts/resize-icon.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '../public/casita.png')
const publicDir = join(__dirname, '../public')

const BG = { r: 254, g: 249, b: 195, alpha: 1 } // #fef9c3 light yellow

async function generate(size, outName) {
  const padding = Math.round(size * 0.1)
  const inner = size - padding * 2
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{
      input: await sharp(src).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(),
      gravity: 'centre',
    }])
    .png()
    .toFile(join(publicDir, outName))
  console.log(`✓ ${outName} (${size}×${size})`)
}

await generate(192, 'icon-192.png')
await generate(512, 'icon-512.png')
await generate(180, 'apple-touch-icon.png')
console.log('Done.')
