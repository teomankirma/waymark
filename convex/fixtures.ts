import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { memberSearchText } from './searchText'
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
  args: { reset: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { reset = false }) => {
    for (const member of members) {
      const existing = await ctx.db
        .query('members')
        .withIndex('by_member_id', (q) => q.eq('id', member.id))
        .unique()
      const searchText = memberSearchText(
        existing && !reset ? existing : member,
      )

      if (!existing) {
        await ctx.db.insert('members', { ...member, searchText })
      } else if (reset) {
        await ctx.db.replace('members', existing._id, { ...member, searchText })
      } else if (existing.searchText !== searchText) {
        await ctx.db.patch('members', existing._id, { searchText })
      }
    }

    for (const [index, member] of members.entries()) {
      const existing = await ctx.db
        .query('savings')
        .withIndex('by_memberId', (q) => q.eq('memberId', member.id))
        .unique()
      const account = {
        memberId: member.id,
        accountNumber: `SAV-100${index + 1}`,
        balance: ['12450.75', '8320.10', '560.00'][index],
        currency: 'USD' as const,
      }

      if (!existing) {
        await ctx.db.insert('savings', account)
      } else if (reset) {
        await ctx.db.replace('savings', existing._id, account)
      }
    }

    const settings = await ctx.db
      .query('settings')
      .withIndex('by_key', (q) => q.eq('key', 'demo'))
      .unique()

    if (!settings) {
      await ctx.db.insert('settings', {
        key: 'demo',
        scenario: 'normal',
        revision: 0,
      })
    } else if (reset) {
      await ctx.db.patch('settings', settings._id, {
        scenario: 'normal',
        revision: settings.revision + 1,
      })
    }

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

    if (!settings) {
      throw new Error('Seed demo fixtures first')
    }

    const revision = settings.revision + 1

    await ctx.db.patch('settings', settings._id, { scenario, revision })

    if (scenario === 'slow') {
      await ctx.scheduler.runAfter(1500, internal.fixtures.finishSlow, {
        revision,
      })
    }

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
