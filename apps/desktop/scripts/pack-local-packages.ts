/** Stage local-branded DSH packages for unsigned Desktop builds without a publication record. */

import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { spawnSync } from 'node:child_process'
import {
  readClientBuildRecord,
  repositoryClientBuildEnvironment,
  resolveClientBuildEnvironment,
} from '../../../scripts/client-build-environment.ts'
import { releaseFamily } from '../../../scripts/release/families.ts'
import { packFamilyMembers, parsePackConcurrency } from '../../../scripts/release/pack.ts'

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { out: { type: 'string' }, concurrency: { type: 'string' } },
    allowPositionals: false,
  })
  if (values.out === undefined) throw new Error('desktop local pack: --out must name the package staging directory')
  const concurrency = parsePackConcurrency(values.concurrency)
  const root = process.cwd()
  const inputs = repositoryClientBuildEnvironment(root)
  const product = inputs.DSH_CLIENT_PRODUCT_CONFIG !== undefined
  const environment = resolveClientBuildEnvironment(inputs, product ? undefined : 'local')
  readClientBuildRecord(root, environment)
  const destination = resolve(root, values.out)
  const packed = await packFamilyMembers(root, releaseFamily('dsh'), destination, concurrency)
  if (product) {
    const pnpm = process.env.npm_execpath
    if (pnpm === undefined) throw new Error('desktop product pack: invoke through pnpm')
    const result = spawnSync(process.execPath, [pnpm, '--dir', 'products/555ai', 'pack', '--pack-destination', destination],
      { cwd: root, env: process.env, stdio: 'inherit' })
    if (result.error !== undefined) throw result.error
    if (result.status !== 0) throw new Error('desktop product pack: brand package could not be staged')
  }
  console.log(`desktop local pack: ${String(packed.length)} tarball(s) in ${destination}`)
}

await main()
