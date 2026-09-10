import { v } from 'convex/values'
import { query } from './_generated/server'
import { memberFields } from './schema'

export const search = query({
  args: { query: v.string() },
  returns: v.union(
    v.object({
      status: v.literal('success'),
      members: v.array(v.object(memberFields)),
      hasMore: v.boolean(),
    }),
    v.object({ status: v.literal('invalid') }),
    v.object({ status: v.literal('loading') }),
    v.object({ status: v.literal('unavailable') }),
  ),
  handler: async (ctx, args) => {
    const term = args.query.trim()
    if (!term || term.length > 64) return { status: 'invalid' as const }
    const settings = await ctx.db
      .query('settings')
      .withIndex('by_key', (q) => q.eq('key', 'demo'))
      .unique()
    if (settings?.scenario === 'unavailable')
      return { status: 'unavailable' as const }
    if (settings?.scenario === 'slow') return { status: 'loading' as const }
    const rows = /^DEMO-/i.test(term)
      ? await ctx.db
          .query('members')
          .withIndex('by_member_id', (q) =>
            q
              .gte('id', term.toUpperCase())
              .lt('id', `${term.toUpperCase()}\uffff`),
          )
          .take(21)
      : await ctx.db
          .query('members')
          .withSearchIndex('search_name', (q) => q.search('name', term))
          .take(21)
    return {
      status: 'success' as const,
      hasMore: rows.length > 20,
      members: rows.slice(0, 20).map(({ id, name, branch, memberSince }) => ({
        id,
        name,
        branch,
        memberSince,
      })),
    }
  },
})
