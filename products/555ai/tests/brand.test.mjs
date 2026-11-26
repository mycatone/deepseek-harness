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
  const ctx = { effect: install => install(), locale: { register: () => () => {} },
    slots: { inject: (_name, install) => install(), register: (slot, component) => registrations.push({ slot, component }) } }
  plugin.apply(ctx, { displayName: {} })
  const brand = registrations.find(row => row.slot.name === 'sidebar.brand.name')
  for (const name of ['555AI', 'Next $& <AI>']) {
    assert.equal(brand.component({ useDisplayName: select => select(name) }).text, name)
  }
  const mark = registrations.find(row => row.slot.name === 'conversation.hero.brand.mark').component()
  assert.equal(mark.tag, 'img')
  assert.equal(mark.props.src, '/favicon.svg')
  const status = registrations.find(row => row.slot.id === '555ai-task-status').component
  assert.equal(status({ useProjection: () => ({ ended: false, remaining: 2 }) }), null)
  assert.equal(status({ useProjection: () => ({ ended: true, remaining: 0 }) }), null)
  const warning = status({ useProjection: () => ({ ended: true, remaining: 2 }), t: (_key, value) => `remaining ${value.count}` })
  assert.equal(warning.props.role, 'status')
  assert.equal(warning.text, 'remaining 2')
})
