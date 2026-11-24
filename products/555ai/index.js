/** Host schema publishes the editable name to the browser through ordinary synced configuration. */
import Schema from '@deepseek-ai/schemastery'

export const name = '555ai-brand'
export const Config = Schema.object({ displayName: Schema.string().required().volatile() })

/** The browser owns the brand slots; the Host owns only their validated configuration. */
export function apply() {}
