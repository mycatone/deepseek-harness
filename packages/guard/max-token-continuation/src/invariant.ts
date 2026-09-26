/** Package invariant companion. @module @deepseek-ai/dsh-max-token-continuation/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-max-token-continuation'

/** Cordis companion plugin name. */
export const name = 'max-token-continuation-invariant'
/** Service required before package ownership is registered. */
export const inject = ['invariants']

/** No runtime invariant: continuation state is private and the session log already validates its messages and turn sequence. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - plugin context carrying the invariant registry.
 * @returns the registration disposer.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
