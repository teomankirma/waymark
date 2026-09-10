import { v } from 'convex/values'
import { query } from './_generated/server'
import { normalizeSearch } from './searchText'
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
    const raw = args.query.trim()
    const term = normalizeSearch(raw)
    if (raw.length > 64 || (raw.length > 0 && !term))
      return { status: 'invalid' as const }
    const settings = await ctx.db
      .query('settings')
      .withIndex('by_key', (q) => q.eq('key', 'demo'))
      .unique()
    if (settings?.scenario === 'unavailable')
      return { status: 'unavailable' as const }
    if (settings?.scenario === 'slow') return { status: 'loading' as const }
    const rows = term
      ? await ctx.db
          .query('members')
          .withSearchIndex('search_members', (q) =>
            q.search('searchText', term),
          )
          .take(21)
      : await ctx.db.query('members').withIndex('by_member_id').take(21)
    rows.sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    )
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
