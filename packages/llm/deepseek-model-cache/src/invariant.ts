/** Package invariant companion. @module @deepseek-ai/dsh-deepseek-model-cache/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-deepseek-model-cache'

/** Cordis companion plugin name. */
export const name = 'deepseek-model-cache-invariant'
/** Service required before package ownership is registered. */
export const inject = ['invariants']

/** No runtime invariant: the cache is process-local and does not write the session log. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - plugin context carrying the invariant registry.
 * @returns the registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
