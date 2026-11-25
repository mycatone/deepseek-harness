/** Render product-owned artwork for the Windows installer and uninstaller. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { validateProduct } from './config.mjs'

function markup(text) {
  return text.replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character])
}

/**
 * Render the installer hero at its actual native size, with theme-aware product text.
 * @param {object} product - Validated product configuration.
 * @param {string} iconDirectory - Directory containing the product's icon.png.
 * @param {boolean} dark - Whether the installer uses its dark background.
 * @param {number} scale - Native bitmap scale, either 1 or 2.
 * @returns {Promise<Buffer>} PNG artwork without upstream branding.
 */
export async function renderInstallerHero(product, iconDirectory, dark = false, scale = 1) {
  validateProduct(product)
  if (![1, 2].includes(scale)) throw new Error('Installer artwork supports 1x and 2x bitmaps')
  const icon = await sharp(await readFile(join(iconDirectory, 'icon.png'))).resize(120 * scale).png().toBuffer()
  const label = product.displayName === '555AI'
    ? await sharp(Buffer.from((await readFile(join(iconDirectory, 'wordmark.svg'), 'utf8'))
      .replace('currentColor', dark ? '#F9FAFB' : '#0F1115'))).resize(164 * scale).png().toBuffer()
    : await sharp({ text: {
    text: `<span foreground="${dark ? '#F9FAFB' : '#0F1115'}">${markup(product.displayName)}</span>`,
    font: `Segoe UI Medium ${32 * scale}`, rgba: true,
    } }).png().toBuffer()
  const wordmark = await sharp(label).resize({ width: 520 * scale, height: 44 * scale, fit: 'inside', withoutEnlargement: true })
    .png().toBuffer({ resolveWithObject: true })
  return sharp({ create: { width: 600 * scale, height: 196 * scale, channels: 4, background: '#00000000' } })
    .composite([
      { input: icon, left: 240 * scale, top: 2 * scale },
      { input: wordmark.data, left: Math.floor((600 * scale - wordmark.info.width) / 2), top: 148 * scale },
    ]).png().toBuffer()
}

/**
 * Prepare only generated product artwork; the upstream installer assets stay intact.
 * @param {object} product - Editable product identity.
 * @param {string} iconDirectory - Product icon source directory.
 * @param {string} outputDirectory - Owned build directory for generated PNG files.
 * @returns {Promise<void>} Completion after every required bitmap is written.
 */
export async function renderDesktopInstallerAssets(product, iconDirectory, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true })
  for (const [name, dark, scale] of [['brand', false, 1], ['brand-2x', false, 2], ['brand-dark', true, 1], ['brand-dark-2x', true, 2]]) {
    await writeFile(join(outputDirectory, `${name}.png`), await renderInstallerHero(product, iconDirectory, dark, scale))
  }
  const icon = await sharp(join(iconDirectory, 'icon.png')).resize(96, 96).png().toBuffer()
  await sharp({ create: { width: 164, height: 314, channels: 4, background: '#FFFFFF' } })
    .composite([{ input: icon, left: 34, top: 88 }]).png().toFile(join(outputDirectory, 'uninstaller-sidebar.png'))
}
