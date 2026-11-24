import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareProductHome, productEnvironment, readProductConfig } from '../config.mjs'

test('renaming preserves the account data directory and application identity', () => {
  const original = readProductConfig()
  const renamed = { ...original, displayName: 'Future $& <AI>' }
  const before = productEnvironment(original, { AI555_HOME: join(tmpdir(), '555ai-identity') })
  const after = productEnvironment(renamed, { AI555_HOME: join(tmpdir(), '555ai-identity') })
  assert.equal(after.DSH_HOME, before.DSH_HOME)
  assert.equal(after.DSH_DESKTOP_APP_ID, before.DSH_DESKTOP_APP_ID)
  assert.equal(after.DSH_DESKTOP_USER_DATA_DIR, before.DSH_DESKTOP_USER_DATA_DIR)
  assert.equal(after.DSH_CLIENT_TITLE, renamed.displayName)
  assert.equal(after.DSH_CLIENT_ACCOUNT_NAME, renamed.displayName)
  assert.equal(JSON.parse(after.DSH_CLIENT_PRODUCT_CONFIG).displayName, renamed.displayName)
})

test('product patches update their own name and retain all three hiAi destinations', t => {
  const home = mkdtempSync(join(tmpdir(), '555ai-product-'))
  const product = readProductConfig()
  const path = prepareProductHome(product, home)
  t.after(() => { unlinkSync(path); rmdirSync(home) })
  const renamed = { ...product, displayName: 'AI $& "Next"' }
  prepareProductHome(renamed, home)
  const source = readFileSync(path, 'utf8')
  assert.ok(source.includes(`displayName: ${JSON.stringify(renamed.displayName)}`))
  assert.ok(source.includes(`platformOrigin: ${JSON.stringify(product.accountOrigin)}`))
  assert.ok(source.includes(`harnessOrigin: ${JSON.stringify(product.accountOrigin)}`))
  assert.ok(source.includes(`baseURL: ${JSON.stringify(product.inferenceOrigin)}`))
})

test('a pre-existing user patch survives initialization unchanged', t => {
  const home = mkdtempSync(join(tmpdir(), '555ai-owned-'))
  const path = join(home, 'cordis.patch.yml')
  t.after(() => { unlinkSync(path); rmdirSync(home) })
  writeFileSync(path, '# My existing configuration\n')
  assert.throws(() => prepareProductHome(readProductConfig(), home), /Existing user patch preserved/)
  assert.equal(readFileSync(path, 'utf8'), '# My existing configuration\n')
})
