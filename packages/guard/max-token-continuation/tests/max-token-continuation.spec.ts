import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId, type TurnEndReason } from '@deepseek-ai/dsh-session'
import * as MaxTokenContinuation from '@deepseek-ai/dsh-max-token-continuation'
import type { Config } from '@deepseek-ai/dsh-max-token-continuation'
import { MockAdapter, maxTokensResponse, textResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

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

function send(agent: Agent): void {
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'go' }], source: { kind: 'user' } }))
}

describe('max-token continuation', () => {
  it('continues a truncated response and ends the turn completed', async () => {
    const ctx = await harness()
    const adapter = new MockAdapter([maxTokensResponse('first half'), textResponse('second half')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const agent = ctx.agentLoop.create(SessionId('continued'), { provider: 'mock', model: 'mock' })
    const idle = waitForIdle(ctx, agent)
    send(agent)
    await idle

    expect(adapter.requests).toHaveLength(2)
    expect(adapter.requests[1]!.messages.at(-1)).toMatchObject({
      role: 'user',
      source: { kind: 'plugin', plugin: 'max-token-continuation', form: 'notice' },
    })
    const turnEnd = agent.session.events.findLast(event => event.type === 'turn/end')
    expect(turnEnd?.data.reason).toEqual({ kind: 'completed' })
  })

  it('stops after the configured continuation cap and preserves max-tokens', async () => {
    const ctx = await harness({ maxContinuations: 2 })
    const adapter = new MockAdapter([
      maxTokensResponse('one'),
      maxTokensResponse('two'),
      maxTokensResponse('three'),
    ])
    ctx.llm.registerAdapter(['mock'], adapter)
    const agent = ctx.agentLoop.create(SessionId('capped'), { provider: 'mock', model: 'mock' })
    const reasons: TurnEndReason[] = []
    ctx.on('session/event', (_session, event) => {
      if (event.type === 'turn/end') reasons.push(event.data.reason)
    })
    const idle = waitForIdle(ctx, agent)
    send(agent)
    await idle

    expect(adapter.requests).toHaveLength(3)
    expect(reasons).toEqual([{ kind: 'max-tokens' }])
  })

  it('does not continue a normally completed response', async () => {
    const ctx = await harness()
    const adapter = new MockAdapter([textResponse('done')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const agent = ctx.agentLoop.create(SessionId('normal'), { provider: 'mock', model: 'mock' })
    const idle = waitForIdle(ctx, agent)
    send(agent)
    await idle
    expect(adapter.requests).toHaveLength(1)
  })

  it('rejects invalid configuration at load', async () => {
    const ctx = await harness()
    await expect(ctx.plugin(MaxTokenContinuation, { maxContinuations: -1 })).rejects.toThrow(/integer >= 0/)
    await expect(ctx.plugin(MaxTokenContinuation, { prompt: '   ' })).rejects.toThrow(/must not be empty/)
  })
})
