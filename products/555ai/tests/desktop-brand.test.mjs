import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import sharp from 'sharp'
import { readProductConfig } from '../config.mjs'
import { renderDesktopInstallerAssets, renderInstallerHero } from '../desktop-brand.mjs'

const icons = fileURLToPath(new URL('../assets', import.meta.url))
const product = readProductConfig()

test('emits every installer bitmap at its native resolution with theme-aware text', async () => {
  const output = await mkdtemp(join(tmpdir(), '555ai-brand-'))
  try {
    await renderDesktopInstallerAssets(product, icons, output)
    for (const [name, width, height] of [['brand', 600, 196], ['brand-dark', 600, 196],
      ['brand-2x', 1200, 392], ['brand-dark-2x', 1200, 392], ['uninstaller-sidebar', 164, 314]]) {
      const metadata = await sharp(await readFile(join(output, `${name}.png`))).metadata()
      assert.equal(metadata.width, width)
      assert.equal(metadata.height, height)
    }
    const label = async name => sharp(join(output, `${name}.png`)).extract({ left: 0, top: 148, width: 600, height: 48 }).stats()
    assert.ok((await label('brand-dark')).channels[0].mean > (await label('brand')).channels[0].mean)
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

test('uses the configured name literally and fits the maximum supported length', async () => {
  const standard = await renderInstallerHero(product, icons)
  const custom = await renderInstallerHero({ ...product, displayName: '工具 & <$&> "555"' }, icons)
  assert.notDeepEqual(custom, standard)
  const long = await renderInstallerHero({ ...product, displayName: '自'.repeat(64) }, icons)
  const cropped = await sharp(long).extract({ left: 0, top: 140, width: 600, height: 56 }).png().toBuffer()
  const { info } = await sharp(cropped).trim().png().toBuffer({ resolveWithObject: true })
  assert.ok(info.width > 0 && info.width <= 520)
  await assert.rejects(renderInstallerHero(product, icons, false, 3), /1x and 2x/)
})
