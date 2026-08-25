/**
 * Bounded automatic continuation for model responses truncated by their
 * output-token limit.
 * @module @deepseek-ai/dsh-max-token-continuation
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

/** Cordis plugin name. */
export const name = 'max-token-continuation'

const DEFAULT_PROMPT = 'Continue the interrupted response from exactly where it stopped. Do not repeat completed content. If a tool call was cut off, issue the complete tool call again.'

/** Plugin configuration. */
export interface Config {
  /** Maximum automatic continuations in one turn (default 3; 0 disables continuation). */
  maxContinuations?: number
  /** Model-facing instruction used for each automatic continuation. */
  prompt?: string
}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({
  maxContinuations: z.number().default(3),
  prompt: z.string().default(DEFAULT_PROMPT),
})

interface ContinuationState {
  turn: number
  count: number
}

/**
 * Install bounded max-token continuation.
 * @param ctx - plugin context that owns the listener.
 * @param config - validated continuation limit and model instruction.
 */
export function apply(ctx: Context, config: Config): void {
  const maxContinuations = config.maxContinuations as number
  const prompt = config.prompt as string
  if (!Number.isInteger(maxContinuations) || maxContinuations < 0) {
    throw new Error(`max-token-continuation: invalid maxContinuations ${maxContinuations} — must be an integer >= 0`)
  }
  if (prompt.trim().length === 0) {
    throw new Error('max-token-continuation: `prompt` must not be empty')
  }

  const states = new WeakMap<Agent, ContinuationState>()

  ctx.on('agent/turn-stopping', ({ agent, turn, signal }) => {
    signal.throwIfAborted()
    const finish = agent.session.events.findLast((event): event is SessionEvent<'assistant/chunk'> =>
      event.type === 'assistant/chunk'
      && event.data.turn === turn
      && event.data.chunk.type === 'finish',
    )
    if (finish?.data.chunk.type !== 'finish' || finish.data.chunk.reason.kind !== 'max-tokens') {
      states.delete(agent)
      return
    }

    const previous = states.get(agent)
    const count = previous?.turn === turn ? previous.count : 0
    if (count >= maxContinuations) return

    agent.steer(createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: {
        kind: 'plugin',
        plugin: name,
        form: 'notice',
        summary: `Automatic continuation ${count + 1}/${maxContinuations}`,
      },
    }))
    states.set(agent, { turn, count: count + 1 })
  })
}
