import { z } from 'zod'

export const searchQuerySchema = z.string().trim().min(1).max(64)
export const memberSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  branch: z.string(),
  memberSince: z.string(),
})
export const memberSearchSchema = z.strictObject({
  members: z.array(memberSchema),
})
export type Member = z.infer<typeof memberSchema>
