/** Public product configuration and its dedicated Harness home. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const manifestUrl = new URL('./product.json', import.meta.url)
const marker = '# Owned by the 555ai product launcher.'

/** Validate editable product values before building or writing a profile. */
export function validateProduct(value) {
  if (value === null || typeof value !== 'object' || typeof value.displayName !== 'string'
    || value.displayName.trim() !== value.displayName || value.displayName.length === 0
    || value.displayName.length > 64 || /[\r\n\x00-\x1f]/u.test(value.displayName)) {
    throw new Error('Product displayName must be one non-empty line of at most 64 characters')
  }
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(value.slug ?? '')
    || !/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/u.test(value.appId ?? '')) {
    throw new Error('Product slug and appId must be stable application identifiers')
  }
  for (const key of ['accountOrigin', 'inferenceOrigin']) {
    const url = new URL(value[key])
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`Product ${key} must be an HTTPS origin without credentials or a path`)
    }
  }
  if (value.icons !== null && (typeof value.icons !== 'string' || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/u.test(value.icons))) {
    throw new Error('Product icons must be a relative asset directory')
  }
  const model = value.defaultModel
  if (model !== null && (typeof model !== 'object' || model === undefined
    || ['provider', 'model'].some(key => typeof model[key] !== 'string' || !model[key].trim() || /[\r\n\x00-\x1f]/u.test(model[key]))
    || (model.reasoningEffort !== undefined && (typeof model.reasoningEffort !== 'string' || !model.reasoningEffort.trim())))) {
    throw new Error('Product defaultModel must be null or contain a provider and model id')
  }
  return value
}

/** Read the single editable product manifest. */
export function readProductConfig(path = manifestUrl) {
  return validateProduct(JSON.parse(readFileSync(path, 'utf8')))
}

/** Keep display names independent of data paths and the operating-system identity. */
export function productEnvironment(product, base = process.env) {
  validateProduct(product)
  const home = resolve(base.AI555_HOME ?? join(homedir(), `.${product.slug}`))
  return {
    ...base,
    DSH_BUILD_CLIENT_PROFILE: undefined,
    DSH_CLIENT_BUILD_PROFILE: product.slug,
    DSH_CLIENT_TITLE: product.displayName,
    DSH_CLIENT_ACCOUNT_NAME: product.displayName,
    DSH_CLIENT_PRODUCT_CONFIG: JSON.stringify(product),
    DSH_DESKTOP_PRODUCT_NAME: product.displayName,
    DSH_DESKTOP_ARTIFACT_PREFIX: product.slug,
    DSH_DESKTOP_APP_ID: product.appId,
    DSH_DESKTOP_ICON_DIR: product.icons === null ? undefined : fileURLToPath(new URL(`./${product.icons}/`, manifestUrl)),
    DSH_HOME: home,
    DSH_DESKTOP_USER_DATA_DIR: join(home, 'desktop'),
  }
}

/** Initialize only the product-owned home patch; existing user-authored patches are preserved. */
export function prepareProductHome(product, home) {
  validateProduct(product)
  mkdirSync(home, { recursive: true })
  const path = join(home, 'cordis.patch.yml')
  if (existsSync(path) && !readFileSync(path, 'utf8').startsWith(marker + '\n')) {
    throw new Error(`Existing user patch preserved: ${path}. Use a dedicated AI555_HOME directory.`)
  }
  const quote = value => JSON.stringify(value)
  const content = [
    marker,
    '- id: ui-brand-official',
    '  disabled: true',
    '- id: deepseek-account',
    '  config:',
    `    platformOrigin: ${quote(product.accountOrigin)}`,
    `    harnessOrigin: ${quote(product.accountOrigin)}`,
    `    inferenceOrigin: ${quote(product.inferenceOrigin)}`,
    `    desktopPlatform: !!js "ctx.get('profileContext')?.name === 'desktop' ? (process.platform === 'darwin' ? 'darwin' : 'win32') : null"`,
    '- id: llm-deepseek-account',
    '  config:',
    `    baseURL: ${quote(product.inferenceOrigin)}`,
    '- insert:',
    '    - id: ui-brand-555ai',
    "      name: '@555ai/brand'",
    '      config:',
    `        displayName: ${quote(product.displayName)}`,
    ...(product.defaultModel === null ? [] : [
      '- id: agent-default-model',
      '  config:',
      `    provider: ${quote(product.defaultModel.provider)}`,
      `    model: ${quote(product.defaultModel.model)}`,
      ...(product.defaultModel.reasoningEffort === undefined ? [] : [`    reasoningEffort: ${quote(product.defaultModel.reasoningEffort)}`]),
    ]),
    '',
  ].join('\n')
  if (!existsSync(path) || readFileSync(path, 'utf8') !== content) writeFileSync(path, content)
  return path
}
