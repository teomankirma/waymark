/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { memberSearchText } from './searchText'
const modules = import.meta.glob('./**/*.ts')

async function setup() {
  const t = convexTest(schema, modules)
  await t.mutation(internal.fixtures.seed, {})
  return t
}

test('indexed name and member ID prefixes return only matching members', async () => {
  const t = await setup()
  for (const [query, ids] of [
    ['demo-001', ['DEMO-001']],
    ['demo', ['DEMO-001', 'DEMO-002', 'DEMO-003']],
    ['demo001', ['DEMO-001']],
    ['001', ['DEMO-001']],
    ['DEMO 001', ['DEMO-001']],
    ['org', ['DEMO-001', 'DEMO-003']],
    ['avery morg', ['DEMO-001']],
    ['', ['DEMO-001', 'DEMO-002', 'DEMO-003']],
    ['  ', ['DEMO-001', 'DEMO-002', 'DEMO-003']],
    ['Mor', ['DEMO-001', 'DEMO-003']],
    ['DEMO-00', ['DEMO-001', 'DEMO-002', 'DEMO-003']],
    ['DEMO-999', []],
  ] as const) {
    const result = await t.query(api.members.search, { query })
    expect(result.status).toBe('success')
    if (result.status === 'success')
      expect(result.members.map((m) => m.id).sort()).toEqual([...ids])
  }
})
test('punctuation-only and overlong searches are invalid', async () => {
  const t = await setup()
  for (const query of ['---', 'a'.repeat(65)])
    expect(await t.query(api.members.search, { query })).toEqual({
      status: 'invalid',
    })
})
test('seeding is idempotent and results are bounded', async () => {
  const t = await setup()
  await t.mutation(internal.fixtures.seed, {})
  const before = await t.query(api.members.search, { query: 'DEMO-00' })
  expect(before.status === 'success' && before.members.length).toBe(3)
  await t.run(async (ctx) => {
    for (let i = 0; i < 25; i++)
      await ctx.db.insert('members', {
        searchText: memberSearchText({ id: `DEMO-1${i}`, name: `Extra ${i}` }),
        id: `DEMO-1${i}`,
        name: `Extra ${i}`,
        branch: 'Test',
        memberSince: '2020',
      })
  })
  const result = await t.query(api.members.search, { query: 'DEMO-' })
  expect(result.status === 'success' && result.members.length).toBe(20)
  expect(result.status === 'success' && result.hasMore).toBe(true)
})
test('unavailable fixture recovers without a new search', async () => {
  const t = await setup()
  await t.mutation(internal.fixtures.setScenario, { scenario: 'unavailable' })
  expect(await t.query(api.members.search, { query: 'Morgan' })).toEqual({
    status: 'unavailable',
  })
  await t.mutation(internal.fixtures.setScenario, { scenario: 'normal' })
  expect((await t.query(api.members.search, { query: 'Morgan' })).status).toBe(
    'success',
  )
})
test('slow scenario completes and an older timer cannot clear a new outage', async () => {
  vi.useFakeTimers()
  try {
    const t = await setup()
    await t.mutation(internal.fixtures.setScenario, { scenario: 'slow' })
    expect(await t.query(api.members.search, { query: 'Morgan' })).toEqual({
      status: 'loading',
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(
      (await t.query(api.members.search, { query: 'Morgan' })).status,
    ).toBe('success')
    await t.mutation(internal.fixtures.setScenario, { scenario: 'slow' })
    await t.mutation(internal.fixtures.setScenario, { scenario: 'unavailable' })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(await t.query(api.members.search, { query: 'Morgan' })).toEqual({
      status: 'unavailable',
    })
  } finally {
    vi.useRealTimers()
  }
})
