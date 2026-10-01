/**
 * Bounded automatic continuation for model responses truncated by their
 * output-token limit.
 * @module @deepseek-ai/dsh-max-token-continuation
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { AssistantStreamRecord, FinishReason } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /**
     * Attribution for a message this package writes.
     *
     * The `kind` is the package's own name rather than the literal `'plugin'`. Format V4 refuses
     * `'plugin'` — `session-format-v3-to-v4/src/message-sources.ts` throws
     * `format v4 message requires a producer-owned source kind` for it, and that file's own header calls it a
     * *retired plugin wrapper*. A producer names itself; there is no shared wrapper kind.
     */
    'max-token-continuation': {
      kind: 'max-token-continuation'
      form: 'notice'
      summary: string
    }
  }
}

/** Cordis plugin name. */
export const name = 'max-token-continuation'

const DEFAULT_PROMPT = 'Continue from the cutoff. Do not repeat finished text. Reissue any tool call that was cut off.'

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

interface LatestFinish {
  turn: number
  kind: FinishReason['kind']
}

/** Read the terminal finish embedded in one durable assistant stream. */
function finishKind(stream: readonly AssistantStreamRecord[]): FinishReason['kind'] | undefined {
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index]
    if (record?.type !== 'chunk' || record.chunk.type !== 'finish') continue
    return record.chunk.reason.kind
  }
  return undefined
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

  const finishes = new WeakMap<Session, LatestFinish>()
  const states = new WeakMap<Agent, ContinuationState>()

  ctx.on('session/event', (session, event) => {
    if (event.type !== 'assistant/message') return
    const kind = finishKind(event.data.stream)
    if (kind === undefined) return
    finishes.set(session, { turn: event.data.turn, kind })
  })

  if (maxContinuations === 0) return

  ctx.on('agent/turn-stopping', ({ agent, turn, signal }) => {
    signal.throwIfAborted()
    const finish = finishes.get(agent.session)
    if (finish?.turn !== turn || finish.kind !== 'max-tokens') {
      states.delete(agent)
      return
    }

    const previous = states.get(agent)
    const count = previous?.turn === turn ? previous.count : 0
    if (count >= maxContinuations) return

    agent.steer(createUserMessage({
      content: [{ type: 'text', text: prompt }],
      source: {
        kind: name,
        form: 'notice',
        summary: boundContextSummary(`Automatic continuation ${count + 1}/${maxContinuations}`),
      },
    }))
    states.set(agent, { turn, count: count + 1 })
  })
}
