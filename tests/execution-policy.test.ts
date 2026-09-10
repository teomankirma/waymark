import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  executorPolicySchema,
  routeIndex,
  sameTarget,
} from '../automation/execution/policy.ts'
import type { Target } from '../automation/contracts/actions.ts'

const target: Target = {
  description: 'Continue',
  frames: [],
  locator: {
    by: 'role',
    role: 'button',
    name: { kind: 'literal', value: 'Continue' },
  },
}
const configuration = {
  allowedRoutes: [{ origin: 'http://127.0.0.1:4173', pathname: '/members' }],
  allowedActions: ['navigate', 'click'],
  restrictedActions: 'require-human',
  maxSteps: 10,
  maxRunMs: 5000,
  grants: [
    {
      route: 0,
      target,
      actions: ['click'],
      risk: 'safe',
      publicLabel: 'Continue',
    },
  ],
}

test('route policy matches canonical origin and path without logging query state', () => {
  const policy = executorPolicySchema.parse(configuration)

  assert.equal(
    routeIndex(policy, 'http://127.0.0.1:4173/members?q=secret#section'),
    0,
  )

  for (const url of [
    'http://127.0.0.1:4174/members',
    'https://127.0.0.1:4173/members',
    'http://127.0.0.1:4173/members/other',
    'http://user:secret@127.0.0.1:4173/members',
    'javascript:alert(1)',
  ]) {
    assert.equal(routeIndex(policy, url), -1)
  }
})

test('grant validation rejects unresolved inputs, unknown routes, and interactive CSS', () => {
  const grant = configuration.grants[0]!

  for (const patch of [
    { route: 1 },
    {
      target: {
        ...target,
        locator: { by: 'label', text: { kind: 'input', name: 'memberId' } },
      },
    },
    {
      target: {
        ...target,
        locator: { by: 'css', selector: 'button', reason: 'Fallback' },
      },
    },
  ]) {
    assert.equal(
      executorPolicySchema.safeParse({
        ...configuration,
        grants: [{ ...grant, ...patch }],
      }).success,
      false,
    )
  }
})

test('local network permission is opt-in and limited to approved loopback origins', () => {
  assert.equal(
    executorPolicySchema.safeParse({
      ...configuration,
      allowedRoutes: [{ origin: 'invalid', pathname: '/' }],
      localNetworkOrigins: ['invalid'],
    }).success,
    false,
  )
  assert.deepEqual(
    executorPolicySchema.parse(configuration).localNetworkOrigins,
    [],
  )
  assert.equal(
    executorPolicySchema.safeParse({
      ...configuration,
      localNetworkOrigins: ['http://127.0.0.1:4173'],
    }).success,
    true,
  )
  assert.equal(
    executorPolicySchema.safeParse({
      ...configuration,
      localNetworkOrigins: ['http://127.0.0.1:4174'],
    }).success,
    false,
  )
  assert.equal(
    executorPolicySchema.safeParse({
      ...configuration,
      allowedRoutes: [{ origin: 'https://example.com', pathname: '/' }],
      localNetworkOrigins: ['https://example.com'],
    }).success,
    false,
  )
})

test('descriptions cannot change a grant match, but frame scope and exact names do', () => {
  assert.equal(
    sameTarget(target, { ...target, description: 'Different narrative' }),
    true,
  )
  assert.equal(sameTarget(target, { ...target, frames: ['iframe'] }), false)
  assert.equal(
    sameTarget(target, {
      ...target,
      locator: {
        by: 'role',
        role: 'button',
        name: { kind: 'literal', value: 'continue' },
      },
    }),
    false,
  )
})
