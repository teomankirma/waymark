import { z } from 'zod'
import { createApp, scenarioSchema } from './app.ts'

const port = z.coerce
  .number()
  .int()
  .min(1)
  .max(65535)
  .parse(process.env.PORT ?? 3001)
const scenario = scenarioSchema.parse(process.env.DEMO_SCENARIO ?? 'normal')
const server = createApp(scenario).listen(port, '127.0.0.1', () => {
  console.log(`Fictional banking API: http://127.0.0.1:${port} (${scenario})`)
})
server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(`Unable to start banking API: ${error.code ?? 'unknown error'}`)
  process.exitCode = 1
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close()
  })
}
