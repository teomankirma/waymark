import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp, type Scenario } from '../server/app.ts'
import { memberSearchSchema } from '../shared/members.ts'

async function withApi(
  scenario: Scenario,
  run: (url: string) => Promise<void>,
) {
  const server = createApp(scenario).listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

test('real API searches exact IDs and partial names without exposing all fixtures', async () => {
  await withApi('normal', async (url) => {
    for (const [query, expected] of [
      ['demo-001', ['DEMO-001']],
      [' Morgan ', ['DEMO-001', 'DEMO-003']],
      ['DEMO-999', []],
      ['DEMO', []],
    ] as const) {
      const response = await fetch(
        `${url}/api/members?q=${encodeURIComponent(query)}`,
      )
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const body = memberSearchSchema.parse(await response.json())
      assert.deepEqual(
        body.members.map((member) => member.id),
        expected,
      )
    }
  })
})

test('API rejects missing, blank, overlong and repeated queries', async () => {
  await withApi('normal', async (url) => {
    for (const query of ['', '?q=%20', `?q=${'a'.repeat(65)}`, '?q=A&q=B']) {
      assert.equal((await fetch(`${url}/api/members${query}`)).status, 400)
    }
    assert.equal((await fetch(`${url}/api/unknown`)).status, 404)
  })
})

test('unavailable fixture returns a recoverable service response', async () => {
  await withApi('unavailable', async (url) => {
    assert.equal((await fetch(`${url}/api/members?q=DEMO-001`)).status, 503)
    assert.equal((await fetch(`${url}/api/health`)).status, 200)
  })
})

test('slow fixture preserves successful lookup data', async () => {
  await withApi('slow', async (url) => {
    const start = performance.now()
    const response = await fetch(`${url}/api/members?q=DEMO-002`)
    assert.ok(performance.now() - start >= 1400)
    const body = memberSearchSchema.parse(await response.json())
    assert.equal(body.members[0]?.id, 'DEMO-002')
  })
})
