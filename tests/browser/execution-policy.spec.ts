import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Browser } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { PolicyExecutor } from '../../automation/execution/executor.ts'
import type { ExecutorPolicy } from '../../automation/execution/policy.ts'
import type { Action, Target } from '../../automation/contracts/actions.ts'

const role = (name: string): Target => ({
  description: name,
  frames: [],
  locator: {
    by: 'role',
    role: 'button',
    name: { kind: 'literal', value: name },
  },
})
const search: Target = {
  description: 'Search',
  frames: [],
  locator: {
    by: 'label',
    text: { kind: 'literal', value: 'Member ID or name' },
  },
}
const step = (action: Action, risk = 'read', timeoutMs = 2000) => ({
  id: 'step',
  risk,
  timeoutMs,
  action,
  before: [],
  after: [],
})
const executors: PolicyExecutor[] = []
let origin: string
const hits = new Map<string, number>()
const server = createServer((request, response) => {
  const path = new URL(request.url!, 'http://localhost').pathname

  hits.set(path, (hits.get(path) ?? 0) + 1)

  if (path === '/redirect') {
    response.writeHead(302, { location: '/forbidden' }).end()

    return
  }

  response.setHeader('Content-Type', 'text/html')

  const extras =
    path === '/frame'
      ? '<iframe src="/forbidden"></iframe>'
      : path === '/spa'
        ? '<script>history.replaceState(null,"","/forbidden")</script>'
        : ''

  response.end(
    `<label for="member">Member ID or name</label><input id="member" value="secret-value"><button onclick="document.querySelector('p').textContent='clicked'">Continue</button><button disabled id="delayed" onclick="document.querySelector('p').textContent='clicked'">Delayed</button><button>Close account</button><button onclick="window.open('/forbidden')">Popup</button><button onclick="confirm('secret-dialog')">Dialog</button><p>unchanged</p>${extras}`,
  )
})

function policy(base: string, paths = ['/']): ExecutorPolicy {
  return {
    localNetworkOrigins: [],
    allowedRoutes: paths.map((pathname) => ({ origin: base, pathname })),
    allowedActions: ['navigate', 'click', 'fill', 'select', 'read', 'assert'],
    restrictedActions: 'require-human',
    maxSteps: 30,
    maxRunMs: 30_000,
    grants: [
      {
        route: 0,
        target: search,
        actions: ['fill'],
        risk: 'safe',
        publicLabel: 'Member search',
      },
      ...['Continue', 'Delayed', 'Popup', 'Dialog'].map((name) => ({
        route: 0,
        target: role(name),
        actions: ['click'] as 'click'[],
        risk: 'safe' as const,
        publicLabel: name,
      })),
      {
        route: 0,
        target: role('Close account'),
        actions: ['click'],
        risk: 'restricted',
        publicLabel: 'Account closure',
      },
    ],
  }
}

test.beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
})
test.afterEach(async () => {
  await Promise.all(executors.splice(0).map((executor) => executor.close()))
})

function create(browser: Browser, config: unknown, evidenceDirectory?: string) {
  return PolicyExecutor.create(browser, config, {
    evidenceDirectory,
    viewport: test.info().project.use.viewport ?? undefined,
  })
}

async function register(executor: Promise<PolicyExecutor>) {
  const instance = await executor

  executors.push(instance)

  return instance
}

test('approved UI actions work; observations and persisted events exclude raw values', async ({
  browser,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'waymark-policy-'))
  const executor = await register(create(browser, policy(origin), directory))

  try {
    expect(
      await executor.execute(
        step({ kind: 'navigate', url: `${origin}/?token=secret-query` }),
      ),
    ).toEqual({ status: 'success' })
    expect(
      await executor.execute(
        step({
          kind: 'fill',
          target: search,
          value: { kind: 'literal', value: 'secret-input' },
        }),
      ),
    ).toEqual({ status: 'success' })
    expect(await executor.observe()).toMatchObject({
      status: 'success',
      observation: {
        controls: expect.arrayContaining([
          { label: 'Member search', visible: true, restricted: false },
        ]),
      },
    })

    const content = await readFile(
      join(directory, `${executor.runId}.jsonl`),
      'utf8',
    )

    expect(content).not.toMatch(/secret|token|Member|127\.0\.0\.1/)
    expect(executor.events.map((event) => event.outcome)).toEqual([
      'completed',
      'completed',
      'completed',
    ])
  } finally {
    await executor.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('restricted action cannot be downgraded by caller risk or description', async ({
  browser,
}) => {
  const executor = await register(create(browser, policy(origin)))

  await executor.execute(step({ kind: 'navigate', url: origin }))
  expect(
    await executor.execute(
      step(
        {
          kind: 'click',
          target: {
            ...role('Close account'),
            description: 'Harmless balance read',
          },
        },
        'read',
      ),
    ),
  ).toEqual({ status: 'failure', code: 'restricted_action' })
  expect(executor.events.at(-1)).toMatchObject({
    action: 'click',
    outcome: 'restricted_action',
  })
})

test('ungranted CSS target cannot bypass semantic permission', async ({
  browser,
}) => {
  const executor = await register(create(browser, policy(origin)))

  await executor.execute(step({ kind: 'navigate', url: origin }))
  expect(
    await executor.execute(
      step({
        kind: 'click',
        target: {
          description: 'Continue',
          frames: [],
          locator: { by: 'css', selector: 'button', reason: 'Fallback' },
        },
      }),
    ),
  ).toEqual({ status: 'failure', code: 'policy_denied' })
})

for (const path of ['/redirect', '/frame', '/spa']) {
  test(`rejects unsafe navigation from ${path}`, async ({ browser }) => {
    const before = hits.get('/forbidden') ?? 0
    const executor = await register(create(browser, policy(origin, [path])))
    const result = await executor.execute(
      step({ kind: 'navigate', url: `${origin}${path}` }),
    )

    if (result.status === 'success') {
      expect(await executor.observe()).toMatchObject({
        status: 'failure',
        code: 'boundary_violation',
      })
    } else {
      expect(result.code).toBe('boundary_violation')
    }

    expect(hits.get('/forbidden') ?? 0).toBe(before)
  })
}

for (const name of ['Popup', 'Dialog']) {
  test(`stops on an unexpected ${name}`, async ({ browser }) => {
    const executor = await register(create(browser, policy(origin)))

    await executor.execute(step({ kind: 'navigate', url: origin }))

    const result = await executor.execute(
      step({ kind: 'click', target: role(name) }),
    )

    if (result.status === 'success') {
      expect(await executor.observe()).toMatchObject({ status: 'failure' })
    } else {
      expect(result.code).toBe('boundary_violation')
    }
  })
}

test('handoff cancels pending interaction before human ownership and rejects overlap', async ({
  browser,
}) => {
  const executor = await register(create(browser, policy(origin)))

  await executor.execute(step({ kind: 'navigate', url: origin }))

  const pending = executor.execute(
    step({ kind: 'click', target: role('Delayed') }),
  )

  expect(await executor.observe()).toEqual({ status: 'failure', code: 'busy' })

  // Let Playwright enter the disabled button's actionability wait.
  await delay(100)

  const human = await executor.giveToHuman()

  expect(await pending).toEqual({ status: 'failure', code: 'ownership_denied' })
  expect(executor.state).toBe('human')
  expect(await human.locator('p').innerText()).toBe('unchanged')
  expect(
    await executor.execute(step({ kind: 'click', target: role('Continue') })),
  ).toMatchObject({ status: 'failure' })
})

test('validates inputs, snapshots trusted config, and enforces operation limits', async ({
  browser,
}) => {
  const config = policy(origin)

  config.maxSteps = 1

  const executor = await register(create(browser, config))

  config.maxSteps = 99
  expect(
    await executor.execute(step({ kind: 'navigate', url: origin })),
  ).toEqual({ status: 'success' })
  expect(await executor.observe()).toEqual({
    status: 'failure',
    code: 'limit_reached',
  })

  const invalid = await register(create(browser, policy(origin)))

  expect(
    await invalid.execute({ kind: 'execute', script: 'secret-script' }),
  ).toEqual({ status: 'failure', code: 'invalid_input' })
  expect(JSON.stringify(invalid.events)).not.toContain('secret-script')

  const forbidden = await register(create(browser, policy(origin)))

  expect(
    await forbidden.execute(
      step({ kind: 'navigate', url: `${origin}/forbidden` }),
    ),
  ).toEqual({ status: 'failure', code: 'policy_denied' })
})

test('approved real member-to-savings flow runs through the policy executor', async ({
  browser,
  baseURL,
}) => {
  const frames = ['iframe[title="Savings account details"]']
  const link = (name: string): Target => ({
    description: name,
    frames: [],
    locator: {
      by: 'role',
      role: 'link',
      name: { kind: 'literal', value: name },
    },
  })
  const member = link('View profile for Avery Morgan')
  const savings = link('View savings account')
  const identity: Target = {
    description: 'Member identity',
    frames,
    locator: { by: 'text', text: { kind: 'literal', value: 'DEMO-001' } },
  }
  const balance: Target = {
    description: 'Balance',
    frames,
    locator: {
      by: 'css',
      selector: '.tabular-nums',
      reason: 'Visible monetary value within the savings panel',
    },
  }
  const config = policy(baseURL!, [
    '/',
    '/members/DEMO-001',
    '/members/DEMO-001/savings',
    '/account-panel/DEMO-001',
  ])

  config.localNetworkOrigins = [baseURL!]
  config.grants = [
    {
      route: 0,
      target: search,
      actions: ['fill'],
      risk: 'safe',
      publicLabel: 'Member search',
    },
    {
      route: 0,
      target: member,
      actions: ['click'],
      risk: 'safe',
      publicLabel: 'Member profile',
    },
    {
      route: 1,
      target: savings,
      actions: ['click'],
      risk: 'safe',
      publicLabel: 'Savings account',
    },
    {
      route: 2,
      target: identity,
      actions: ['assert'],
      risk: 'safe',
      publicLabel: 'Member identity',
    },
    {
      route: 2,
      target: balance,
      actions: ['read'],
      risk: 'safe',
      publicLabel: 'Balance',
    },
    {
      route: 2,
      target: { ...role('Close account'), frames },
      actions: ['click'],
      risk: 'restricted',
      publicLabel: 'Account closure',
    },
  ]

  const executor = await register(create(browser, config))

  for (const action of [
    { kind: 'navigate', url: baseURL! },
    {
      kind: 'fill',
      target: search,
      value: { kind: 'literal', value: 'demo-001' },
    },
    { kind: 'click', target: member },
    { kind: 'click', target: savings },
  ] satisfies Action[]) {
    const result = await executor.execute(step(action, 'interaction', 5000))

    expect(result).toEqual({ status: 'success' })
  }

  const read = step({ kind: 'read', target: balance, output: 'balance' })

  expect(
    await executor.execute({
      ...read,
      before: [
        {
          kind: 'text_equals',
          target: identity,
          expected: { kind: 'literal', value: 'DEMO-001' },
        },
      ],
    }),
  ).toEqual({ status: 'success', value: '12,450.75' })
  expect(JSON.stringify(executor.events)).not.toMatch(/DEMO|Morgan|12,450/)
  expect(
    await executor.execute(
      step({ kind: 'click', target: { ...role('Close account'), frames } }),
    ),
  ).toEqual({ status: 'failure', code: 'restricted_action' })
})

test('failed precondition prevents the click and stops later steps', async ({
  browser,
}) => {
  const config = policy(origin)
  const outcome: Target = {
    description: 'Outcome',
    frames: [],
    locator: { by: 'css', selector: 'p', reason: 'Fixture status' },
  }

  config.grants.push({
    route: 0,
    target: outcome,
    actions: ['assert'],
    risk: 'safe',
    publicLabel: 'Outcome',
  })

  const executor = await register(create(browser, config))

  await executor.execute(step({ kind: 'navigate', url: origin }))
  expect(
    await executor.execute({
      ...step({ kind: 'click', target: role('Continue') }, 'interaction', 150),
      before: [
        {
          kind: 'text_equals',
          target: outcome,
          expected: { kind: 'literal', value: 'ready' },
        },
      ],
    }),
  ).toEqual({ status: 'failure', code: 'checkpoint_mismatch' })
  expect(await executor.observe()).toEqual({
    status: 'failure',
    code: 'run_stopped',
  })

  const human = await executor.giveToHuman()

  expect(await human.locator('p').innerText()).toBe('unchanged')
})

test('wall-clock and allowed-action limits apply independently of target grants', async ({
  browser,
}) => {
  const config = policy(origin)

  config.allowedActions = ['navigate']

  const executor = await register(create(browser, config))

  await executor.execute(step({ kind: 'navigate', url: origin }))
  expect(
    await executor.execute(step({ kind: 'click', target: role('Continue') })),
  ).toEqual({ status: 'failure', code: 'policy_denied' })

  const timed = await register(
    create(browser, { ...policy(origin), maxRunMs: 30 }),
  )

  await delay(50)
  expect(await timed.execute(step({ kind: 'navigate', url: origin }))).toEqual({
    status: 'failure',
    code: 'limit_reached',
  })
})
