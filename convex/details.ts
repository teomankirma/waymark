import { v } from 'convex/values'
import { query, mutation, type QueryCtx } from './_generated/server'
import { memberFields } from './schema'

const blocked = v.union(
  v.object({ status: v.literal('denied') }),
  v.object({ status: v.literal('expired') }),
  v.object({ status: v.literal('loading') }),
  v.object({ status: v.literal('unavailable') }),
  v.object({ status: v.literal('not_found') }),
)

// These are shared fictional training scenarios, not production authorization.
async function access(ctx: QueryCtx) {
  const settings = await ctx.db
    .query('settings')
    .withIndex('by_key', (q) => q.eq('key', 'demo'))
    .unique()

  if (!settings) {
    return 'unavailable' as const
  }

  if (settings.scenario === 'slow') {
    return 'loading' as const
  }

  return settings.scenario === 'normal' ? null : settings.scenario
}

async function memberById(ctx: QueryCtx, id: string) {
  return ctx.db
    .query('members')
    .withIndex('by_member_id', (q) => q.eq('id', id))
    .unique()
}

export const profile = query({
  args: { memberId: v.string() },
  returns: v.union(
    blocked,
    v.object({
      status: v.literal('success'),
      member: v.object(memberFields),
      hasSavings: v.boolean(),
    }),
  ),
  handler: async (ctx, { memberId }) => {
    const status = await access(ctx)

    if (status) {
      return { status }
    }

    const member = await memberById(ctx, memberId)

    if (!member) {
      return { status: 'not_found' as const }
    }

    const savings = await ctx.db
      .query('savings')
      .withIndex('by_memberId', (q) => q.eq('memberId', memberId))
      .unique()
    const { id, name, branch, memberSince } = member

    return {
      status: 'success' as const,
      member: { id, name, branch, memberSince },
      hasSavings: savings !== null,
    }
  },
})
export const savings = query({
  args: { memberId: v.string() },
  returns: v.union(
    blocked,
    v.object({
      status: v.literal('success'),
      member: v.object(memberFields),
      accountNumber: v.string(),
      balance: v.string(),
      currency: v.literal('USD'),
    }),
  ),
  handler: async (ctx, { memberId }) => {
    const status = await access(ctx)

    if (status) {
      return { status }
    }

    const member = await memberById(ctx, memberId)
    const account = await ctx.db
      .query('savings')
      .withIndex('by_memberId', (q) => q.eq('memberId', memberId))
      .unique()

    if (!member || !account) {
      return { status: 'not_found' as const }
    }

    const { id, name, branch, memberSince } = member

    return {
      status: 'success' as const,
      member: { id, name, branch, memberSince },
      accountNumber: account.accountNumber,
      balance: account.balance,
      currency: account.currency,
    }
  },
})

export const restoreSession = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const settings = await ctx.db
      .query('settings')
      .withIndex('by_key', (q) => q.eq('key', 'demo'))
      .unique()

    if (settings?.scenario === 'expired') {
      await ctx.db.patch('settings', settings._id, {
        scenario: 'normal',
        revision: settings.revision + 1,
      })
    }

    return null
  },
})

// Deliberately has no write path: later policy tests must stop before this action.
export const closeAccount = mutation({
  args: { memberId: v.string() },
  returns: v.object({ status: v.literal('denied') }),
  handler: async () => ({ status: 'denied' as const }),
})
