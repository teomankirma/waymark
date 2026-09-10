import { readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

// Never let inherited cloud credentials or a relinked project change the target.
const config = existsSync('.env.local')
  ? readFileSync('.env.local', 'utf8')
  : ''
const deployment = config
  .match(/^CONVEX_DEPLOYMENT=(.+)$/m)?.[1]
  .split('#')[0]
  .trim()
if (
  (deployment && !deployment.startsWith('anonymous:')) ||
  /^(CONVEX_DEPLOY_KEY|CONVEX_SELF_HOSTED_URL)=/m.test(config)
) {
  throw new Error(
    'This demo requires an anonymous local Convex deployment. Refusing non-local configuration.',
  )
}
const env = { ...process.env, CONVEX_AGENT_MODE: 'anonymous' }
delete env.CONVEX_DEPLOY_KEY
delete env.CONVEX_DEPLOYMENT
delete env.CONVEX_SELF_HOSTED_URL
delete env.CONVEX_SELF_HOSTED_ADMIN_KEY
const child = spawn(
  process.execPath,
  ['node_modules/convex/bin/main.js', ...process.argv.slice(2)],
  { stdio: 'inherit', env, detached: process.platform !== 'win32' },
)
// Convex handles SIGINT by stopping its backend and frontend process groups.
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill('SIGINT'))
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
child.on('error', () => {
  process.exitCode = 1
})
