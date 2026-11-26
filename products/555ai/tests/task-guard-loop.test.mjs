import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { LlmAdapter, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import * as Brand from '../index.js'
import { installTaskGuard } from '../task-guard.js'

class ScriptedAdapter extends LlmAdapter {
  requests = []
  constructor(script) { super(); this.script = [...script] }
  async resolveModel(provider, model) { return { provider, id: model, name: model } }
  async * stream(options) {
    this.requests.push(options)
    const text = this.script.shift()
    if (text === undefined) throw new Error('script exhausted')
    yield { type: 'block-start', index: 0, blockType: 'text' }
    if (text === null) {
      await new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
        setImmediate(() => this.cancel())
      })
      return
    }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

test('invalid recovery configuration fails before registering effects', async () => {
  for (const limit of [-1, 1.5, 4]) {
    await assert.rejects(installTaskGuard({}, { taskRecoveryLimit: limit, taskRecoveryPrompt: 'recover', taskIncompleteMessage: 'stopped' }),
      error => error.code === 'INVALID_CONFIG')
  }
})

async function boot(t, script, limit = 2) {
  const directory = await mkdtemp(join(tmpdir(), '555ai-task-guard-'))
  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose(); await rm(directory, { recursive: true, force: true }) })
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(Loader)
  ctx.baseUrl = pathToFileURL(directory).href + '/'
  ctx.loader.builtins.include = Include
  const modules = new Map([['@deepseek-ai/dsh-agent-loop', AgentLoop], ['@555ai/brand', Brand]])
  ctx.loader.internal = { version: 'v2', async import(name) {
    if (!modules.has(name)) throw new Error(`Unexpected import: ${name}`)
    return modules.get(name)
  } }
  const config = join(directory, 'cordis.yml')
  await writeFile(config, `- name: '@deepseek-ai/dsh-agent-loop'\n  config:\n    agents: []\n- name: '@555ai/brand'\n  config:\n    displayName: Test AI\n    taskRecoveryLimit: ${limit}\n`)
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  const adapter = new ScriptedAdapter(script)
  ctx.llm.registerAdapter(['mock'], adapter)
  const agent = await ctx.agentLoop.create(SessionId('task-guard'), { provider: 'mock', model: 'mock' })
  agent.session.append('todo/write', { todos: [{ content: 'create the requested document', status: 'in_progress' }] })
  adapter.cancel = () => agent.cancel()
  const run = async () => {
    const idle = new Promise(resolve => {
      const dispose = ctx.on('agent/status', ({ agent: subject, status }) => {
        if (subject === agent && status === 'idle') { dispose(); resolve() }
      })
    })
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'continue the task' }], source: { kind: 'user' } }))
    await idle
  }
  const events = () => agent.session.snapshotEvents()
  return { ctx, agent, adapter, run, events,
    recovery: () => events().filter(e => e.type === 'user/message' && e.data.source.kind === '555ai-task-recovery'),
    status: () => ctx.sessionProjections.snapshot(agent.session, ['ai555TaskCompletion']).values.ai555TaskCompletion }
}

test('real Loader and AgentLoop correct a placeholder once, with a durable model-visible instruction', { timeout: 15000 }, async t => {
  const h = await boot(t, ['[todo_write]', 'I need you to confirm the output folder.'])
  await h.run()
  assert.equal(h.adapter.requests.length, 2)
  const recovery = h.recovery()
  assert.equal(recovery.length, 1)
  assert.deepEqual(recovery[0].data.source, { kind: '555ai-task-recovery', form: 'notice', attempt: 1, summary: '555AI task correction 1/2' })
  assert.equal(recovery[0].data.content[0].text, 'Your last reply was only a tool-name placeholder. Use a structured tool call to perform the next unfinished task. Do not repeat the todo list without doing work. If you need user input or cannot proceed, explain the blocker in ordinary text. Never execute a tool name copied from text.')
  assert.deepEqual(h.status(), { remaining: 1, ended: true })
})

test('repeated placeholders stop after the configured budget, and a fresh turn gets a fresh budget', { timeout: 15000 }, async t => {
  const h = await boot(t, Array(6).fill('[todo_write]'))
  await h.run()
  assert.equal(h.adapter.requests.length, 3)
  let end = h.events().filter(e => e.type === 'turn/end').at(-1)
  assert.equal(end.data.reason.kind, 'error')
  assert.equal(end.data.reason.error.code, 'INVALID_RESPONSE')
  await h.run()
  assert.equal(h.adapter.requests.length, 6)
  assert.equal(h.recovery().length, 4)
})

test('normal questions and user cancellation are never automatically continued', { timeout: 15000 }, async t => {
  for (const reply of ['Please confirm before I overwrite the file.', null]) {
    const h = await boot(t, [reply])
    await h.run()
    assert.equal(h.adapter.requests.length, 1)
    assert.equal(h.recovery().length, 0)
  }
})

test('zero disables automatic correction and disposing the product removes the guard and view', { timeout: 15000 }, async t => {
  const h = await boot(t, ['[todo_write]', '[todo_write]'], 0)
  await h.run()
  assert.equal(h.recovery().length, 0)
  assert.equal(h.events().filter(e => e.type === 'turn/end').at(-1).data.reason.kind, 'error')
  const owner = [...h.ctx.loader.entries()].find(e => e.options.name === '@555ai/brand')
  await owner.fiber.dispose()
  await h.run()
  assert.equal(h.status(), undefined)
  assert.equal(h.events().filter(e => e.type === 'turn/end').at(-1).data.reason.kind, 'completed')
})
