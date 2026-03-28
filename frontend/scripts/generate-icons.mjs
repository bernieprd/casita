import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '../public')

mkdirSync(publicDir, { recursive: true })

// Pure-SVG house icon — no emoji, no font dependency, sharp renders this reliably.
function houseSvg(size) {
  const r = size * 0.22  // corner radius
  const cx = size / 2
  // House proportions
  const roofTop = size * 0.18
  const roofBase = size * 0.46
  const wallLeft = size * 0.20
  const wallRight = size * 0.80
  const wallBottom = size * 0.82
  const doorW = size * 0.18
  const doorH = size * 0.24
  const doorLeft = cx - doorW / 2
  const doorTop = wallBottom - doorH

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#2d6a4f"/>
  <!-- Roof -->
  <polygon points="${cx},${roofTop} ${wallRight + size * 0.04},${roofBase} ${wallLeft - size * 0.04},${roofBase}" fill="white"/>
  <!-- Walls -->
  <rect x="${wallLeft}" y="${roofBase}" width="${wallRight - wallLeft}" height="${wallBottom - roofBase}" fill="white"/>
  <!-- Door -->
  <rect x="${doorLeft}" y="${doorTop}" width="${doorW}" height="${doorH}" rx="${size * 0.02}" fill="#2d6a4f"/>
</svg>`
}

await sharp(Buffer.from(houseSvg(512))).png().toFile(join(publicDir, 'icon-512.png'))
console.log('✓ icon-512.png')

await sharp(Buffer.from(houseSvg(180))).png().toFile(join(publicDir, 'apple-touch-icon.png'))
console.log('✓ apple-touch-icon.png')
