import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { scenarioValidator } from './schema'

const members = [
  {
    id: 'DEMO-001',
    name: 'Avery Morgan',
    branch: 'Northside',
    memberSince: '2018',
  },
  {
    id: 'DEMO-002',
    name: 'Jordan Ellis',
    branch: 'Downtown',
    memberSince: '2021',
  },
  {
    id: 'DEMO-003',
    name: 'Sam Morgan',
    branch: 'Northside',
    memberSince: '2023',
  },
]

// Operator-only fixtures; these mutations are not callable from the public client.
export const seed = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const member of members) {
      const existing = await ctx.db
        .query('members')
        .withIndex('by_member_id', (q) => q.eq('id', member.id))
        .unique()
      if (!existing) await ctx.db.insert('members', member)
    }
    const settings = await ctx.db
      .query('settings')
      .withIndex('by_key', (q) => q.eq('key', 'demo'))
      .unique()
    if (!settings)
      await ctx.db.insert('settings', {
        key: 'demo',
        scenario: 'normal',
        revision: 0,
      })
    return null
  },
})

export const setScenario = internalMutation({
  args: { scenario: scenarioValidator },
  returns: v.null(),
  handler: async (ctx, { scenario }) => {
    const settings = await ctx.db
      .query('settings')
      .withIndex('by_key', (q) => q.eq('key', 'demo'))
      .unique()
    if (!settings) throw new Error('Seed demo fixtures first')
    const revision = settings.revision + 1
    await ctx.db.patch('settings', settings._id, { scenario, revision })
    if (scenario === 'slow')
      await ctx.scheduler.runAfter(1500, internal.fixtures.finishSlow, {
        revision,
      })
    return null
  },
})
export const finishSlow = internalMutation({
  args: { revision: v.number() },
  returns: v.null(),
  handler: async (ctx, { revision }) => {
    const settings = await ctx.db
      .query('settings')
      .withIndex('by_key', (q) => q.eq('key', 'demo'))
      .unique()
    if (settings?.revision === revision && settings.scenario === 'slow') {
      await ctx.db.patch('settings', settings._id, { scenario: 'normal' })
    }
    return null
  },
})
