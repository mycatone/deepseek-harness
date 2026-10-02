import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import * as MaxTokenContinuation from '@deepseek-ai/dsh-max-token-continuation'
import type { Config } from '@deepseek-ai/dsh-max-token-continuation'
import { MockAdapter, maxTokensResponse, textResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

/**
 * Behavior suite for bounded max-token continuation, driven through a real agent loop against a
 * scripted mock adapter: the bound is per turn and inclusive, the continuation message the model
 * receives carries its own name as the source kind with a `Automatic continuation N/M` summary, a
 * turn that ends for any other reason is never continued, and a fresh turn gets a fresh budget.
 */

/** Boot the core spine + the guard; the caller registers the scripted adapter. */
async function harness(config: Config = {}): Promise<Context> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(MaxTokenContinuation, config)
  return ctx
}

function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') {
        dispose()
        resolve()
      }
    })
  })
}

/** Every continuation message this guard injected into the agent's log, with its durable source. */
function continuations(agent: Agent): { text: string; source: unknown }[] {
  return agent.session.snapshotEvents()
    .filter((event): event is SessionEvent<'user/message'> =>
      event.type === 'user/message' && event.data.source.kind === 'max-token-continuation')
    .map(event => ({
      text: event.data.content.map(block => block.type === 'text' ? block.text : '').join('|'),
      source: event.data.source,
    }))
}

/** The continuation message as a producer-owned notice naming its position in the budget. */
const continuationSource = (position: number, of: number) => ({
  kind: 'max-token-continuation',
  form: 'notice',
  summary: `Automatic continuation ${position}/${of}`,
})

async function runTurn(ctx: Context, responses: Parameters<typeof textResponse>[] | unknown[][], session = 'a1'): Promise<Agent> {
  const agent = await ctx.agentLoop.create(SessionId(session), { provider: 'mock', model: 'mock' })
  ctx.llm.registerAdapter(['mock'], new MockAdapter(responses as never[]))
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'go' }], source: { kind: 'user' } }))
  await waitForIdle(ctx, agent)
  return agent
}

/** `cut` max-token truncations followed by a clean stop, so a run terminates instead of exhausting the mock. */
const truncatedThenDone = (cut: number, tail = 'tail') =>
  [...Array.from({ length: cut }, (_, index) => maxTokensResponse(`part${index}`)), textResponse(tail)]

/** `cut` max-token truncations and nothing else, for a turn whose budget runs out before any clean stop. */
const truncatedOnly = (cut: number) =>
  Array.from({ length: cut }, (_, index) => maxTokensResponse(`part${index}`))

describe('bounded continuation', () => {
  it('continues a max-token-truncated turn exactly maxContinuations times and then stops', async () => {
    const ctx = await harness({ maxContinuations: 2 })
    const agent = await runTurn(ctx, truncatedThenDone(5))

    const found = continuations(agent)
    expect(found).toHaveLength(2)
    expect(found[0]!.text).toBe('Continue from the cutoff. Do not repeat finished text. Reissue any tool call that was cut off.')
    expect(found[0]!.source).toEqual(continuationSource(1, 2))
    expect(found[1]!.source).toEqual(continuationSource(2, 2))
  })

  it('uses the configured prompt for every continuation', async () => {
    const ctx = await harness({ maxContinuations: 1, prompt: 'resume please' })
    const agent = await runTurn(ctx, truncatedThenDone(3))

    const found = continuations(agent)
    expect(found).toHaveLength(1)
    expect(found[0]!.text).toBe('resume please')
  })

  it('gives a new turn the full budget instead of the previous turn count', async () => {
    const ctx = await harness({ maxContinuations: 1 })
    const agent = await ctx.agentLoop.create(SessionId('a1'), { provider: 'mock', model: 'mock' })
    // Each turn spends maxContinuations + 1 responses: one that triggers a continuation, one
    // that exhausts the budget and ends the turn without steering.
    ctx.llm.registerAdapter(['mock'], new MockAdapter([...truncatedOnly(2), ...truncatedOnly(2)]))
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'first' }], source: { kind: 'user' } }))
    await waitForIdle(ctx, agent)

    // The same agent, same session, a second turn: the budget must not carry over.
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'second' }], source: { kind: 'user' } }))
    await waitForIdle(ctx, agent)

    expect(continuations(agent)).toHaveLength(2)
  })

  it('leaves a turn that ended for any other reason uncontinued', async () => {
    const ctx = await harness({ maxContinuations: 3 })
    const agent = await runTurn(ctx, [textResponse('done')])

    expect(continuations(agent)).toHaveLength(0)
  })

  it('does not reuse the previous turn finish when a later turn ends normally', async () => {
    const ctx = await harness({ maxContinuations: 3 })
    const agent = await ctx.agentLoop.create(SessionId('a1'), { provider: 'mock', model: 'mock' })
    ctx.llm.registerAdapter(['mock'], new MockAdapter([textResponse('one'), textResponse('two')]))
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'first' }], source: { kind: 'user' } }))
    await waitForIdle(ctx, agent)
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'second' }], source: { kind: 'user' } }))
    await waitForIdle(ctx, agent)

    // The first turn's cached finish is stale by the second turn; a stale kind must not steer.
    expect(continuations(agent)).toHaveLength(0)
  })

  it('ignores an assistant message whose durable stream records no finish', async () => {
    const ctx = await harness({ maxContinuations: 2 })
    const agent = await runTurn(ctx, [
      [{ type: 'block-start', index: 0, blockType: 'text' }, { type: 'block-end', index: 0, block: { type: 'text', text: 'cut' } }],
      textResponse('done'),
    ])

    // No terminal finish means no known truncation reason, so there is nothing to continue from.
    expect(continuations(agent)).toHaveLength(0)
  })

  it('continues nothing when maxContinuations is 0', async () => {
    const ctx = await harness({ maxContinuations: 0 })
    const agent = await runTurn(ctx, truncatedThenDone(3))

    expect(continuations(agent)).toHaveLength(0)
  })

  it('defaults to three continuations', async () => {
    const ctx = await harness()
    const agent = await runTurn(ctx, truncatedThenDone(9))

    expect(continuations(agent)).toHaveLength(3)
    expect(continuations(agent).at(-1)!.source).toEqual(continuationSource(3, 3))
  })
})

describe('fail-loud configuration', () => {
  it('rejects a non-integer maxContinuations', async () => {
    const ctx = await harness()
    await expect(ctx.plugin(MaxTokenContinuation, { maxContinuations: 1.5 }))
      .rejects.toThrow('invalid maxContinuations 1.5')
  })

  it('rejects a negative maxContinuations', async () => {
    const ctx = await harness()
    await expect(ctx.plugin(MaxTokenContinuation, { maxContinuations: -1 }))
      .rejects.toThrow('invalid maxContinuations -1')
  })

  it('rejects an empty prompt', async () => {
    const ctx = await harness()
    await expect(ctx.plugin(MaxTokenContinuation, { prompt: '   ' }))
      .rejects.toThrow('must not be empty')
  })
})
