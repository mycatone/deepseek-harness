/** Render the dog mascot into the application's platform assets. */
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { packIco } from '../../apps/desktop/scripts/render-tray-icon.ts'

const directory = new URL('./assets/', import.meta.url)
const previewOnly = process.argv.includes('--preview')
const mascot = await sharp(await readFile(new URL('dog-mark.png', directory))).resize(448, 448).png().toBuffer()
await writeFile(new URL('icon.svg', directory), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect x="16" y="16" width="480" height="480" rx="112" fill="#181818"/><image x="32" y="32" width="448" height="448" href="data:image/png;base64,${mascot.toString('base64')}"/></svg>\n`)
const source = await readFile(new URL('icon.svg', directory))
const images = previewOnly ? [['icon-512.png', 512]] as const
  : [['icon.png', 1024], ['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]] as const
for (const [name, size] of images) {
  await writeFile(new URL(name, directory), await sharp(source).resize(size, size).png().toBuffer())
}
if (!previewOnly) {
  const entries = await Promise.all([16, 20, 24, 32, 40, 48, 64, 128, 256].map(async size => ({
    size, png: await sharp(source).resize(size, size).png().toBuffer(),
  })))
  await writeFile(new URL('tray.ico', directory), packIco(entries))
}
console.info(previewOnly ? '555AI: rendered one 512px dog icon preview' : '555AI: rendered dog application, PWA, touch and multi-size tray icons')
