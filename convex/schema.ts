import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const memberFields = {
  id: v.string(),
  name: v.string(),
  branch: v.string(),
  memberSince: v.string(),
}
export const scenarioValidator = v.union(
  v.literal('normal'),
  v.literal('slow'),
  v.literal('unavailable'),
  v.literal('denied'),
  v.literal('expired'),
)

export default defineSchema({
  members: defineTable({ ...memberFields, searchText: v.optional(v.string()) })
    .index('by_member_id', ['id'])
    .searchIndex('search_members', { searchField: 'searchText' }),
  savings: defineTable({
    memberId: v.string(),
    accountNumber: v.string(),
    balance: v.string(),
    currency: v.literal('USD'),
  }).index('by_memberId', ['memberId']),
  settings: defineTable({
    key: v.literal('demo'),
    scenario: scenarioValidator,
    revision: v.number(),
  }).index('by_key', ['key']),
})
