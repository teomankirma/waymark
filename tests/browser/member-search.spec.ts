import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'
const exec = promisify(execFile)
async function scenario(value: 'normal' | 'slow' | 'unavailable') {
  await exec(process.execPath, [
    'scripts/convex-local.mjs',
    'run',
    'fixtures:setScenario',
    JSON.stringify({ scenario: value }),
  ])
}

test.beforeEach(async ({ page }) => {
  await scenario('normal')
  await page.goto('/')
})
test.afterEach(async () => {
  await scenario('normal')
})

test('typing a name prefix filters without submission', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: 'Member search', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Member ID or name').fill('Mor')
  await expect(page.getByRole('status')).toHaveText('2 members found')
  await expect(
    page.getByRole('cell', { name: 'Avery Morgan', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'Sam Morgan', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate<boolean>(
      'document.documentElement.scrollWidth <= window.innerWidth',
    ),
  ).toBe(true)
})

test('rapid edits and clearing cannot show stale results', async ({ page }) => {
  const input = page.getByLabel('Member ID or name')
  await input.fill('Mor')
  await expect(page.getByRole('cell', { name: 'Sam Morgan' })).toBeVisible()
  await input.fill('DEMO-001')
  await input.fill('DEMO-002')
  await expect(page.getByRole('cell', { name: 'Jordan Ellis' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Avery Morgan' })).toHaveCount(0)
  await input.fill('DEMO-999')
  await expect(
    page.getByText('No members found', { exact: true }),
  ).toBeVisible()
  await input.clear()
  await expect(page.getByText('Ready to find a member')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('blank input stays idle and whitespace is validated', async ({ page }) => {
  await expect(page.getByText('Ready to find a member')).toBeVisible()
  await page.getByLabel('Member ID or name').fill('   ')
  await expect(page.getByRole('alert')).toContainText(
    'Enter a member ID or name',
  )
})

test('Enter still submits immediately', async ({ page }) => {
  const input = page.getByLabel('Member ID or name')
  await input.fill('DEMO-001')
  await input.press('Enter')
  await expect(page.getByRole('cell', { name: 'Avery Morgan' })).toBeVisible()
})

test('real Convex scenario updates subscribers and recovers automatically', async ({
  page,
}) => {
  await page.getByLabel('Member ID or name').fill('Mor')
  await expect(page.getByRole('status')).toHaveText('2 members found')
  await scenario('unavailable')
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable')
  await expect(page.getByRole('table')).toHaveCount(0)
  await scenario('normal')
  await expect(page.getByRole('status')).toHaveText('2 members found')
  await scenario('slow')
  await expect(page.getByRole('status')).toHaveText('Searching member records…')
  await expect(page.getByLabel('Member ID or name')).toBeEnabled()
  await expect(page.getByRole('status')).toHaveText('2 members found')
})

test('offline connection clears results and reconnects automatically', async ({
  page,
  context,
}) => {
  await page.getByLabel('Member ID or name').fill('Mor')
  await expect(page.getByRole('status')).toHaveText('2 members found')
  await context.setOffline(true)
  await expect(page.getByRole('alert')).toContainText('Connection lost')
  await expect(page.getByRole('table')).toHaveCount(0)
  await context.setOffline(false)
  await expect(page.getByRole('status')).toHaveText('2 members found', {
    timeout: 20_000,
  })
})
