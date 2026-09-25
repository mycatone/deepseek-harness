/** Cache DeepSeek `/models` metadata without patching the provider package. */

import type { Context } from '@deepseek-ai/cordis'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { PUBLIC_BASE_URL } from '@deepseek-ai/dsh-llm-deepseek'
import { refreshCachedModelInfo } from './fetcher.ts'

export { getCachedModelInfo, refreshCachedModelInfo } from './fetcher.ts'
export type { DeepSeekModelInfo } from './fetcher.ts'

/** Cordis plugin name. */
export const name = 'deepseek-model-cache'
export const inject = ['llm']

/**
 * Refresh the process-local model cache when the launch environment has a key.
 * @param ctx - plugin context used for the launch environment and logs.
 */
export function apply(ctx: Context): void {
  const apiKey = launchEnvironmentOf(ctx).get('DEEPSEEK_API_KEY')?.value
  if (apiKey === undefined || apiKey.length === 0) return
  void refreshCachedModelInfo(PUBLIC_BASE_URL, apiKey).catch((error: unknown) => {
    ctx.logger.warn('deepseek-model-cache: startup model discovery failed: %o', error)
  })
}
