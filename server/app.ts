import express from 'express'
import { setTimeout } from 'node:timers/promises'
import { z } from 'zod'
import { searchQuerySchema } from '../shared/members.ts'
import { members } from './fixtures.ts'

export const scenarioSchema = z.enum(['normal', 'slow', 'unavailable'])
export type Scenario = z.infer<typeof scenarioSchema>

// Fixture scenarios are configured by the operator, outside the target UI.
export function createApp(scenario: Scenario = 'normal') {
  const app = express()
  app.disable('x-powered-by')
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })
  app.get('/api/members', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const parsed = searchQuerySchema.safeParse(req.query.q)
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'Enter a member ID or name (1–64 characters).' })
      return
    }
    if (scenario === 'slow') await setTimeout(1500)
    if (scenario === 'unavailable') {
      res
        .status(503)
        .json({ error: 'Member search is temporarily unavailable.' })
      return
    }
    const query = parsed.data.toLowerCase()
    res.json({
      members: members.filter(
        (member) =>
          member.id.toLowerCase() === query ||
          member.name.toLowerCase().includes(query),
      ),
    })
  })
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })
  return app
}
