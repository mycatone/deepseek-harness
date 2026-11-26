/** Build a standalone download site from an actual Windows installer; never publish from this script. */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, open, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { readProductConfig, validateProduct } from './config.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const source = fileURLToPath(new URL('./site/', import.meta.url))
const html = value => String(value).replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

/**
 * Copy the verified installer and brand assets into a self-contained static site.
 * @param {object} options - Installer path, output directory and optional product/version overrides.
 * @returns {Promise<object>} Release metadata with a relative download URL and SHA-256.
 */
export async function buildSite({ installer, output, product = readProductConfig(), version } = {}) {
  validateProduct(product)
  if (!installer) throw new Error('An actual Windows installer is required: --installer PATH')
  if (!output) throw new Error('A dedicated output directory is required')
  version ??= JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version
  if (!/^[0-9A-Za-z.+-]+$/u.test(version)) throw new Error('Invalid release version')
  const input = resolve(installer)
  if (!input.toLowerCase().endsWith('.exe') || !(await stat(input)).isFile()) throw new Error('Installer must be an .exe file')
  const header = await open(input, 'r')
  try {
    const bytes = Buffer.alloc(2)
    await header.read(bytes, 0, 2, 0)
    if (bytes.toString('ascii') !== 'MZ') throw new Error('Installer is not a Windows executable')
  } finally { await header.close() }
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(input)) digest.update(chunk)
  const sha256 = digest.digest('hex')
  const filename = `${product.slug}-${version}-win-x64-${sha256.slice(0, 12)}-setup.exe`
  const target = resolve(output)
  if (target === root || target === source || target === dirname(input)) throw new Error('Use a dedicated site output directory')
  const download = `downloads/${filename}`
  const release = { name: product.displayName, version, platform: 'win-x64', signed: false,
    filename, url: download, bytes: (await stat(input)).size, sha256 }
  await mkdir(join(target, 'downloads'), { recursive: true })
  await mkdir(join(target, 'assets'), { recursive: true })
  await mkdir(join(target, 'licenses'), { recursive: true })
  await copyFile(input, join(target, download))
  await writeFile(join(target, `${download}.sha256`), `${sha256}  ${filename}\n`)
  for (const asset of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'wordmark.svg']) {
    await copyFile(join(root, 'products/555ai', product.icons, asset), join(target, 'assets', asset))
  }
  await copyFile(join(root, 'LICENSE'), join(target, 'licenses/LICENSE.txt'))
  for (const file of ['styles.css', 'site.js']) await copyFile(join(source, file), join(target, file))
  const tokens = { PRODUCT_NAME: product.displayName, ACCOUNT_ORIGIN: product.accountOrigin,
    VERSION: version, DOWNLOAD_URL: `./${download}`, DOWNLOAD_FILE: filename,
    DOWNLOAD_SIZE: `${(release.bytes / 1024 / 1024).toFixed(1)} MB`, SHA256: sha256, CHECKSUM_URL: `./${download}.sha256` }
  const template = await readFile(join(source, 'index.html'), 'utf8')
  const page = template.replace(/__([A-Z0-9_]+)__/gu, (_match, token) => {
    if (!Object.hasOwn(tokens, token)) throw new Error(`Unknown site placeholder: ${token}`)
    return html(tokens[token])
  })
  await writeFile(join(target, 'index.html'), page)
  await writeFile(join(target, 'release.json'), JSON.stringify(release, null, 2) + '\n')
  return release
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { installer: { type: 'string' }, output: { type: 'string' } }, allowPositionals: false })
  const output = values.output ?? join(root, '.dsh-build', '555ai-site')
  const release = await buildSite({ installer: values.installer, output })
  console.log(JSON.stringify({ output: resolve(output), ...release }, null, 2))
}
