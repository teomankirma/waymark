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
)

export default defineSchema({
  members: defineTable(memberFields)
    .index('by_member_id', ['id'])
    .searchIndex('search_name', { searchField: 'name' }),
  settings: defineTable({
    key: v.literal('demo'),
    scenario: scenarioValidator,
    revision: v.number(),
  }).index('by_key', ['key']),
})
