/** Build and launch 555AI through the supported Harness profiles. */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, delimiter, join } from 'node:path'
import semver from 'semver'
import { prepareProductHome, productEnvironment, readProductConfig, validateProduct } from './config.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const engine = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).engines.node
if (!semver.satisfies(process.versions.node, engine)) {
  const runtime = join(root, '.dsh-build', 'product-node', 'node.exe')
  if (!existsSync(runtime) || runtime === process.execPath) throw new Error(`555AI requires Node.js ${engine}`)
  const result = spawnSync(runtime, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit' })
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}
process.env.PATH = dirname(process.execPath) + delimiter + (process.env.PATH ?? '')
const [command = 'check', ...args] = process.argv.slice(2)
let product = readProductConfig()
if (command === 'rename' || command === 'model') {
  if (command === 'rename' && args.length !== 1) throw new Error('Usage: node products/555ai/run.mjs rename "New name"')
  if (command === 'model' && ![2, 3].includes(args.length)) throw new Error('Usage: node products/555ai/run.mjs model PROVIDER MODEL [REASONING_EFFORT]')
  product = validateProduct({ ...product, ...(command === 'rename' ? { displayName: args[0] }
    : { defaultModel: { provider: args[0], model: args[1], ...(args[2] === undefined ? {} : { reasoningEffort: args[2] }) } }) })
  writeFileSync(new URL('./product.json', import.meta.url), JSON.stringify(product, null, 2) + '\n')
  console.log('Product configuration saved. Rebuild to update installed application assets.')
} else if (command === 'check') {
  const env = productEnvironment(product)
  console.log(JSON.stringify({ name: product.displayName, appId: product.appId, home: env.DSH_HOME,
    accountOrigin: product.accountOrigin, icons: product.icons, defaultModel: product.defaultModel }, null, 2))
} else {
  const commands = { build: ['run', 'build'], web: ['dsh', 'web'], desktop: ['run', 'start:desktop'],
    package: ['run', 'package:desktop'] }
  if (!Object.hasOwn(commands, command)) throw new Error('Expected check, rename, build, web, desktop, or package')
  const env = productEnvironment(product)
  if (command === 'package') {
    env.DSH_PACKAGING_PRESET = 'test'
    env.DSH_PACKAGING_CONFIG_DIR = join(root, 'products', '555ai', 'packaging')
    if (!args.includes('--unsigned')) args.push('--unsigned')
  }
  prepareProductHome(product, env.DSH_HOME)
  if (command !== 'build' && !(command === 'package' && args.includes('--check'))) {
    const record = join(root, '.dsh-build', 'client-build-environment.json')
    const environment = existsSync(record) ? JSON.parse(readFileSync(record, 'utf8')).environment : undefined
    if (environment?.DSH_CLIENT_TITLE !== product.displayName
      || environment?.DSH_CLIENT_PRODUCT_CONFIG !== JSON.stringify(product)) {
      throw new Error('Build 555AI first: node products/555ai/run.mjs build')
    }
  }
  const child = spawn(process.execPath, [join(root, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'), ...commands[command], ...args],
    { cwd: root, env, stdio: 'inherit' })
  child.once('error', error => { console.error(error.message); process.exitCode = 1 })
  child.once('exit', code => { process.exitCode = code ?? 1 })
}
