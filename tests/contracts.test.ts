import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actionSchema } from '../automation/contracts/actions.ts'
import {
  capabilitySchema,
  parseInvocation,
  parseOutputs,
} from '../automation/contracts/capability.ts'
import {
  parseResult,
  policySchema,
  sessionSchema,
} from '../automation/contracts/execution.ts'
import { resolveValue } from '../automation/contracts/values.ts'
import { balanceCapability } from './capability.fixture.ts'

test('a serializable balance contract binds two members without changing its actions', () => {
  const artifact = balanceCapability()
  const serialized = JSON.stringify(artifact)
  assert.deepEqual(capabilitySchema.parse(JSON.parse(serialized)), artifact)
  const fill = artifact.steps.find(
    (step) => step.action.kind === 'fill',
  )?.action
  assert.ok(fill?.kind === 'fill')
  for (const memberId of ['DEMO-001', 'DEMO-002']) {
    assert.equal(
      resolveValue(fill.value, parseInvocation(artifact, { memberId })),
      memberId,
    )
    assert.ok(!serialized.includes(memberId))
  }
  assert.equal(JSON.stringify(artifact), serialized)
  assert.throws(() => resolveValue({ kind: 'input', name: 'missing' }, {}))
})

for (const action of [
  { kind: 'execute', script: 'arbitrary code' },
  { kind: 'navigate', url: 'not a URL' },
  { kind: 'navigate', url: 'javascript:alert(1)' },
  { kind: 'navigate', url: 'https://user:password@example.com' },
  { kind: 'navigate', url: 'http://localhost:3000', extra: true },
  { kind: 'fill', value: { kind: 'literal', value: 'value' } },
]) {
  test(`reject malformed action: ${JSON.stringify(action)}`, () => {
    assert.equal(actionSchema.safeParse(action).success, false)
  })
}

test('reject unsupported versions, extra fields and duplicate steps', () => {
  const artifact = balanceCapability()
  assert.equal(
    capabilitySchema.safeParse({ ...artifact, schemaVersion: 2 }).success,
    false,
  )
  assert.equal(
    capabilitySchema.safeParse({ ...artifact, transcript: [] }).success,
    false,
  )
  assert.equal(
    capabilitySchema.safeParse({
      ...artifact,
      steps: [...artifact.steps, artifact.steps[0]],
    }).success,
    false,
  )
})

test('reject undeclared references in action values, targets and checkpoints', () => {
  const artifact = balanceCapability()
  // This one reference is used in all three positions by the fixture.
  const invalid = JSON.parse(
    JSON.stringify(artifact).replaceAll(
      '"name":"memberId"',
      '"name":"unknown"',
    ),
  )
  const result = capabilitySchema.safeParse(invalid)
  assert.equal(result.success, false)
  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join('.'))
    assert.ok(paths.some((path) => path.includes('action.value.name')))
    assert.ok(paths.some((path) => path.includes('locator.name.name')))
    assert.ok(paths.some((path) => path.includes('expected.name')))
  }
})

test('output writers must match declared outputs exactly once', () => {
  const artifact = balanceCapability()
  const steps = artifact.steps.filter((step) => step.action.kind !== 'read')
  assert.equal(
    capabilitySchema.safeParse({ ...artifact, steps }).success,
    false,
  )
  assert.equal(
    capabilitySchema.safeParse({
      ...artifact,
      outputs: { balance: { type: 'decimal' } },
    }).success,
    false,
  )
  const read = artifact.steps.find((step) => step.action.kind === 'read')!
  assert.equal(
    capabilitySchema.safeParse({
      ...artifact,
      steps: [...artifact.steps, { ...read, id: 'duplicate-read' }],
    }).success,
    false,
  )
})

test('invocation rejects missing, extra, empty, overlong and non-string inputs', () => {
  for (const inputs of [
    {},
    { memberId: 'A', secret: 'B' },
    { memberId: '' },
    { memberId: 'A'.repeat(65) },
    { memberId: 123 },
    null,
  ]) {
    assert.throws(() => parseInvocation(balanceCapability(), inputs))
  }
})

test('outputs preserve exact money and reject undeclared or malformed values', () => {
  const artifact = balanceCapability()
  const outputs = { balance: '9007199254740993.01', currency: 'USD' }
  assert.deepEqual(parseOutputs(artifact, outputs), outputs)
  for (const invalid of [
    { ...outputs, balance: 10.1 },
    { ...outputs, balance: '1e3' },
    { ...outputs, balance: '01.00' },
    { ...outputs, currency: 'usd' },
    { ...outputs, extra: 'value' },
    { balance: '1.00' },
  ])
    assert.throws(() => parseOutputs(artifact, invalid))
})

test('terminal results are validated against capability outputs and outcomes', () => {
  const artifact = balanceCapability()
  assert.equal(
    parseResult(artifact, {
      status: 'success',
      outputs: { balance: '10.00', currency: 'USD' },
    }).status,
    'success',
  )
  assert.equal(
    parseResult(artifact, {
      status: 'business_outcome',
      code: 'member_not_found',
      stepId: 'search',
    }).status,
    'business_outcome',
  )
  assert.equal(
    parseResult(artifact, {
      status: 'failure',
      code: 'invalid_input',
      stepId: null,
      expected: 'Valid inputs',
      observed: 'Validation failed',
      evidence: [],
    }).status,
    'failure',
  )
  for (const result of [
    {
      status: 'success',
      outputs: { balance: '10.00', currency: 'USD', secret: 'hidden' },
    },
    { status: 'business_outcome', code: 'unknown', stepId: 'search' },
    { status: 'business_outcome', code: 'member_not_found', stepId: 'unknown' },
    { status: 'human_control', owner: 'human' },
  ])
    assert.throws(() => parseResult(artifact, result))
})

test('policy requires bounded execution and exact origin/path pairs', () => {
  const policy = {
    allowedRoutes: [{ origin: 'http://localhost:3000', pathname: '/members' }],
    allowedActions: ['read'],
    restrictedActions: 'require-human',
    maxSteps: 20,
    maxRunMs: 60_000,
  }
  assert.equal(policySchema.safeParse(policy).success, true)
  for (const patch of [
    { maxSteps: 0 },
    { maxRunMs: Infinity },
    { allowedActions: ['execute'] },
    { restrictedActions: 'allow' },
    { allowedRoutes: [] },
    ...['//elsewhere.test', '/a/../b', '/members?all=true'].map((pathname) => ({
      allowedRoutes: [{ origin: 'http://localhost:3000', pathname }],
    })),
    {
      allowedRoutes: [{ origin: 'http://localhost:3000/path', pathname: '/' }],
    },
  ])
    assert.equal(policySchema.safeParse({ ...policy, ...patch }).success, false)
})

test('human takeover and resume verification cannot claim automation ownership', () => {
  const intervention = {
    stepId: 'search',
    reason: 'session_expired',
    summary: 'Restore the demo session',
    resumeCheckpoint: balanceCapability().success[0],
  }
  for (const [state, owner] of [
    ['automating', 'automation'],
    ['awaiting_human', 'none'],
    ['human_control', 'human'],
    ['verifying_resume', 'none'],
    ['closed', 'none'],
  ]) {
    const session = {
      state,
      owner,
      sessionId: 'demo-session',
      ...(['automating', 'closed'].includes(state!) ? {} : { intervention }),
    }
    assert.equal(sessionSchema.safeParse(session).success, true)
    if (state !== 'automating')
      assert.equal(
        sessionSchema.safeParse({ ...session, owner: 'automation' }).success,
        false,
      )
  }
  assert.equal(
    sessionSchema.safeParse({
      state: 'human_control',
      owner: 'human',
      sessionId: 'demo-session',
    }).success,
    false,
  )
})

test('invalid origins return validation errors instead of throwing URL errors', () => {
  assert.equal(
    policySchema.safeParse({
      allowedRoutes: [{ origin: 'invalid', pathname: '/' }],
      allowedActions: ['read'],
      restrictedActions: 'require-human',
      maxSteps: 1,
      maxRunMs: 1000,
    }).success,
    false,
  )
})

test('all six action variants parse and reject invalid nested targets', () => {
  const target = {
    description: 'Demo control',
    frames: [],
    locator: { by: 'label', text: { kind: 'literal', value: 'Account' } },
  }
  const checkpoint = { kind: 'visible', target }
  for (const action of [
    { kind: 'navigate', url: 'http://localhost:3000' },
    { kind: 'click', target },
    { kind: 'fill', target, value: { kind: 'input', name: 'memberId' } },
    { kind: 'select', target, value: { kind: 'literal', value: 'savings' } },
    { kind: 'read', target, output: 'balance' },
    { kind: 'assert', checkpoint },
  ])
    assert.equal(actionSchema.safeParse(action).success, true)
  assert.equal(
    actionSchema.safeParse({
      kind: 'click',
      target: { ...target, frames: [123] },
    }).success,
    false,
  )
})

test('duplicate outcomes and reserved field names are rejected', () => {
  const artifact = balanceCapability()
  assert.equal(
    capabilitySchema.safeParse({
      ...artifact,
      businessOutcomes: [
        ...artifact.businessOutcomes,
        artifact.businessOutcomes[0],
      ],
    }).success,
    false,
  )
  assert.equal(
    capabilitySchema.safeParse({
      ...artifact,
      inputs: { constructor: { type: 'text', maxLength: 64 } },
    }).success,
    false,
  )
})
