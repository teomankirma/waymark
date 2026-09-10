/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
const modules = import.meta.glob('./**/*.ts')
async function setup() {
  const t = convexTest(schema, modules)
  await t.mutation(internal.fixtures.seed, {})
  return t
}
test('savings balances belong to the requested member and remain exact', async () => {
  const t = await setup()
  await t.mutation(internal.fixtures.seed, {})
  for (const [memberId, name, balance] of [
    ['DEMO-001', 'Avery Morgan', '12450.75'],
    ['DEMO-002', 'Jordan Ellis', '8320.10'],
  ]) {
    const profile = await t.query(api.details.profile, { memberId })
    expect(profile).toMatchObject({
      status: 'success',
      member: { id: memberId, name },
      hasSavings: true,
    })
    expect(profile).not.toHaveProperty('balance')
    expect(await t.query(api.details.savings, { memberId })).toMatchObject({
      status: 'success',
      member: { id: memberId, name },
      balance,
      currency: 'USD',
    })
  }
})
test('missing members and accounts return a business outcome', async () => {
  const t = await setup()
  expect(await t.query(api.details.profile, { memberId: 'DEMO-999' })).toEqual({
    status: 'not_found',
  })
  await t.run(async (ctx) => {
    const account = await ctx.db
      .query('savings')
      .withIndex('by_memberId', (q) => q.eq('memberId', 'DEMO-001'))
      .unique()
    if (account) await ctx.db.delete('savings', account._id)
  })
  expect(
    await t.query(api.details.profile, { memberId: 'DEMO-001' }),
  ).toMatchObject({ status: 'success', hasSavings: false })
  expect(await t.query(api.details.savings, { memberId: 'DEMO-001' })).toEqual({
    status: 'not_found',
  })
})
test('blocked queries return no member or balance, and restore cannot bypass denial', async () => {
  const t = await setup()
  for (const scenario of [
    'denied',
    'expired',
    'unavailable',
    'slow',
  ] as const) {
    await t.mutation(internal.fixtures.setScenario, { scenario })
    for (const query of [api.details.profile, api.details.savings]) {
      expect(await t.query(query, { memberId: 'DEMO-001' })).toEqual({
        status: scenario === 'slow' ? 'loading' : scenario,
      })
    }
  }
  await t.mutation(internal.fixtures.setScenario, { scenario: 'denied' })
  await t.mutation(api.details.restoreSession, {})
  expect(await t.query(api.details.savings, { memberId: 'DEMO-001' })).toEqual({
    status: 'denied',
  })
  await t.mutation(internal.fixtures.setScenario, { scenario: 'expired' })
  await t.mutation(api.details.restoreSession, {})
  expect(
    (await t.query(api.details.savings, { memberId: 'DEMO-001' })).status,
  ).toBe('success')
})
test('restricted closure never changes the account', async () => {
  const t = await setup()
  const before = await t.query(api.details.savings, { memberId: 'DEMO-001' })
  expect(
    await t.mutation(api.details.closeAccount, { memberId: 'DEMO-001' }),
  ).toEqual({ status: 'denied' })
  expect(await t.query(api.details.savings, { memberId: 'DEMO-001' })).toEqual(
    before,
  )
})

test('explicit fixture reset restores demo balances and scenario', async () => {
  const t = await setup()
  await t.run(async (ctx) => {
    const account = await ctx.db
      .query('savings')
      .withIndex('by_memberId', (q) => q.eq('memberId', 'DEMO-001'))
      .unique()
    if (account) await ctx.db.patch('savings', account._id, { balance: '1.00' })
  })
  await t.mutation(internal.fixtures.seed, {})
  expect(
    await t.query(api.details.savings, { memberId: 'DEMO-001' }),
  ).toMatchObject({ balance: '1.00' })
  await t.mutation(internal.fixtures.setScenario, { scenario: 'denied' })
  await t.mutation(internal.fixtures.seed, { reset: true })
  expect(
    await t.query(api.details.savings, { memberId: 'DEMO-001' }),
  ).toMatchObject({ status: 'success', balance: '12450.75' })
})
