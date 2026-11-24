/** Render the original 555 vector into the application's platform assets. */
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { packIco } from '../../apps/desktop/scripts/render-tray-icon.ts'

const directory = new URL('./assets/', import.meta.url)
const source = await readFile(new URL('icon.svg', directory))
for (const [name, size] of [['icon.png', 1024], ['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]] as const) {
  await writeFile(new URL(name, directory), await sharp(source).resize(size, size).png().toBuffer())
}
const entries = await Promise.all([16, 20, 24, 32, 40, 48, 64, 128, 256].map(async size => ({
  size, png: await sharp(source).resize(size, size).png().toBuffer(),
})))
await writeFile(new URL('tray.ico', directory), packIco(entries))
console.info('555AI: rendered application, PWA, touch and multi-size tray icons')
