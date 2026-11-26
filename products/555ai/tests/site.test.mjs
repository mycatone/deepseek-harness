import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { test } from 'node:test'
import vm from 'node:vm'
import { buildSite } from '../build-site.mjs'
import { readProductConfig } from '../config.mjs'

async function fixture(t) {
  const parent = await realpath(tmpdir())
  const directory = await mkdtemp(join(parent, '555ai-download-test-'))
  t.after(async () => {
    const path = await realpath(directory)
    assert.ok(relative(parent, path).startsWith('555ai-download-test-'))
    await rm(path, { recursive: true, force: true, maxRetries: 3 })
  })
  const installer = join(directory, 'fixture.exe')
  const bytes = Buffer.concat([Buffer.from('MZ'), Buffer.from('isolated test fixture, never distributed')])
  await writeFile(installer, bytes)
  return { installer, bytes, output: join(directory, 'site') }
}

test('download page includes the exact installer and independently verifiable checksum', async t => {
  const sample = await fixture(t)
  const release = await buildSite({ ...sample, version: '0.2.3-alpha.2' })
  assert.deepEqual(await readFile(join(sample.output, release.url)), sample.bytes)
  assert.equal(release.bytes, sample.bytes.length)
  assert.equal(release.sha256, createHash('sha256').update(sample.bytes).digest('hex'))
  assert.equal(await readFile(join(sample.output, `${release.url}.sha256`), 'utf8'), `${release.sha256}  ${release.filename}\n`)
  assert.deepEqual(JSON.parse(await readFile(join(sample.output, 'release.json'), 'utf8')), release)
  const page = await readFile(join(sample.output, 'index.html'), 'utf8')
  assert.ok(!/__([A-Z0-9_]+)__/u.test(page))
  assert.equal([...page.matchAll(new RegExp(`href="\\./${release.url.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}"`, 'gu'))].length, 2)
  assert.ok(page.includes('未进行代码签名'))
  assert.ok(page.includes('使用场景示意'))
  assert.ok(!page.includes('download.deepseek.com'))
  const paths = [...page.matchAll(/(?:href|src)="\.\/([^"#]+)"/gu)].map(match => match[1])
  for (const path of paths) assert.ok((await readFile(join(sample.output, path))).length > 0, path)
  assert.ok((await readdir(join(sample.output, 'assets'))).includes('icon-192.png'))
})

test('a configurable product name remains literal text without escaping into page markup', async t => {
  const sample = await fixture(t)
  await buildSite({ ...sample, product: { ...readProductConfig(), displayName: '<Next & "AI">' } })
  const page = await readFile(join(sample.output, 'index.html'), 'utf8')
  assert.ok(page.includes('&lt;Next &amp; &quot;AI&quot;&gt;'))
  assert.ok(!page.includes('<Next'))
})

test('missing installers and non-executable files stop site generation before a download is advertised', async t => {
  const sample = await fixture(t)
  await assert.rejects(buildSite({ output: sample.output }), /actual Windows installer/u)
  await writeFile(sample.installer, 'not an executable')
  await assert.rejects(buildSite(sample), /Windows executable/u)
  await assert.rejects(buildSite({ ...sample, version: '../escape' }), /release version/u)
})

test('scenario tabs support keyboard navigation and clipboard failure preserves a manual route', async () => {
  const panels = Object.fromEntries(['work', 'code', 'research', 'plugins'].map(name => [`case-${name}`, { hidden: name !== 'work' }]))
  const tabs = Object.keys(panels).map(id => ({
    attributes: { 'aria-controls': id }, events: {}, tabIndex: -1, focused: false,
    getAttribute(name) { return this.attributes[name] },
    setAttribute(name, value) { this.attributes[name] = value },
    addEventListener(name, handler) { this.events[name] = handler },
    focus() { this.focused = true },
  }))
  const copy = { addEventListener(_name, handler) { this.click = handler } }
  const status = { textContent: '' }
  let copied
  const browser = { clipboard: { async writeText(value) { copied = value } } }
  const nodes = { ...panels, 'copy-checksum': copy, 'copy-status': status, checksum: { textContent: 'a'.repeat(64) } }
  const context = vm.createContext({ document: { querySelectorAll: () => tabs, getElementById: id => nodes[id] }, navigator: browser })
  vm.runInContext(await readFile(new URL('../site/site.js', import.meta.url), 'utf8'), context)
  tabs[1].events.click()
  assert.equal(panels['case-code'].hidden, false)
  assert.equal(panels['case-work'].hidden, true)
  assert.equal(tabs[1].attributes['aria-selected'], 'true')
  let prevented = false
  tabs[1].events.keydown({ key: 'End', preventDefault() { prevented = true } })
  assert.equal(panels['case-plugins'].hidden, false)
  assert.equal(tabs[3].focused, true)
  assert.equal(prevented, true)
  await copy.click()
  assert.equal(copied, 'a'.repeat(64))
  assert.match(status.textContent, /已复制/u)
  browser.clipboard.writeText = async () => { throw new Error('clipboard denied') }
  await copy.click()
  assert.match(status.textContent, /下载校验文件/u)
})
