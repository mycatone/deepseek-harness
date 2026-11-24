import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('brand names remain literal React text and react to the injected name', () => {
  let descriptor
  runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(value) { descriptor = value } } },
  })
  const plugin = descriptor.factory(() => ({ createElement: (tag, props, text) => ({ tag, props, text }) }))
  const registrations = []
  const ctx = { slots: { inject: (_name, install) => install(), register: (slot, component) => registrations.push({ slot, component }) } }
  plugin.apply(ctx, { displayName: {} })
  const brand = registrations.find(row => row.slot.name === 'sidebar.brand.name')
  for (const name of ['555AI', 'Next $& <AI>']) {
    assert.equal(brand.component({ useDisplayName: select => select(name) }).text, name)
  }
  assert.equal(registrations.find(row => row.slot.name === 'conversation.hero.brand.mark').component(), null)
})
