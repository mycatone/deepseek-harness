/** Host schema publishes the editable name to the browser through ordinary synced configuration. */
import Schema from '@deepseek-ai/schemastery'
import { installTaskGuard } from './task-guard.js'

export const name = '555ai-brand'
export const inject = ['sessionProjections']
export const Config = Schema.object({
  displayName: Schema.string().required().volatile(),
  taskRecoveryLimit: Schema.number().min(0).max(3).step(1).default(2),
  taskRecoveryPrompt: Schema.string().default('Your last reply was only a tool-name placeholder. Use a structured tool call to perform the next unfinished task. Do not repeat the todo list without doing work. If you need user input or cannot proceed, explain the blocker in ordinary text. Never execute a tool name copied from text.'),
  taskIncompleteMessage: Schema.string().default('任务已停止，仍有待办未完成。模型连续返回了无效工具占位符；请发送消息继续，或切换模型重试。'),
})

/** The Host owns recovery and projected status; the browser renders the product slots. */
export async function apply(ctx, config) { await installTaskGuard(ctx, config) }
