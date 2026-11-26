/** Product-owned recovery through the Agent lifecycle; the upstream loop stays unchanged. */
import { z } from 'zod'
import { createUserMessage, LlmError } from '@deepseek-ai/dsh-llm'
import { initialTaskState, foldTaskState } from './task-guard-state.mjs'

const viewSchema = z.object({ remaining: z.number().int().nonnegative(), ended: z.boolean() })

/** Install a replayable status and a bounded correction of tool-name placeholders. */
export async function installTaskGuard(ctx, config) {
  if (!Number.isInteger(config.taskRecoveryLimit) || config.taskRecoveryLimit < 0 || config.taskRecoveryLimit > 3
    || !config.taskRecoveryPrompt.trim() || !config.taskIncompleteMessage.trim()) {
    throw new LlmError('Invalid 555AI task recovery configuration', 'INVALID_CONFIG')
  }
  const projection = await ctx.sessionProjections.register({
    key: 'ai555TaskCompletion',
    stateVersion: 1,
    stateSchema: z.object({ turn: z.number().int().nonnegative(), placeholder: z.boolean(),
      recoveries: z.number().int().nonnegative(), view: viewSchema }),
    init: initialTaskState,
    apply: foldTaskState,
    wire: { viewSchema, view: state => state.view, summary: false },
  })
  ctx.on('agent/turn-stopping', ({ agent, turn, signal }) => {
    signal.throwIfAborted()
    const state = projection.stateOf(agent.session)
    if (state.turn !== turn || !state.placeholder || state.view.remaining === 0) return
    if (state.recoveries >= config.taskRecoveryLimit) {
      throw new LlmError(config.taskIncompleteMessage, 'INVALID_RESPONSE')
    }
    const attempt = state.recoveries + 1
    agent.steer(createUserMessage({
      content: [{ type: 'text', text: config.taskRecoveryPrompt }],
      source: { kind: '555ai-task-recovery', form: 'notice', attempt,
        summary: `555AI task correction ${attempt}/${config.taskRecoveryLimit}` },
    }))
  })
}
