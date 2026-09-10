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
    page.getByRole('heading', { name: 'Member directory', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Member ID or name').fill('Mor')
  await expect(page.getByRole('status')).toHaveText('2 members found')
  await expect(page.getByText('Avery Morgan', { exact: true })).toBeVisible()
  await expect(page.getByText('Sam Morgan', { exact: true })).toBeVisible()
  expect(
    await page.evaluate<boolean>(
      'document.documentElement.scrollWidth <= window.innerWidth',
    ),
  ).toBe(true)
})

test('rapid edits and clearing cannot show stale results', async ({ page }) => {
  const input = page.getByLabel('Member ID or name')
  await input.fill('Mor')
  await expect(page.getByText('Sam Morgan', { exact: true })).toBeVisible()
  await input.fill('DEMO-001')
  await input.fill('DEMO-002')
  await expect(page.getByText('Jordan Ellis', { exact: true })).toBeVisible()
  await expect(page.getByText('Avery Morgan', { exact: true })).toHaveCount(0)
  await input.fill('DEMO-999')
  await expect(
    page.getByText('No members found', { exact: true }),
  ).toBeVisible()
  await input.clear()
  await expect(page.getByRole('status')).toHaveText('3 members found')
  await expect(page.getByRole('table')).toBeVisible()
})

test('blank and whitespace browse members; invalid punctuation has recovery', async ({
  page,
}) => {
  await expect(page.getByRole('status')).toHaveText('3 members found')
  await page.getByLabel('Member ID or name').fill('   ')
  await expect(page.getByRole('status')).toHaveText('3 members found')
  await page.getByLabel('Member ID or name').fill('---')
  await expect(page.getByRole('alert')).toContainText('Use a name or member ID')
  await page.getByRole('button', { name: 'Show all members' }).click()
  await expect(page.getByRole('status')).toHaveText('3 members found')
})

test('Enter still submits immediately', async ({ page }) => {
  const input = page.getByLabel('Member ID or name')
  await input.fill('DEMO-001')
  await input.press('Enter')
  await expect(page.getByText('Avery Morgan', { exact: true })).toBeVisible()
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
  await expect(
    page.getByRole('link', { name: 'View profile for Avery Morgan' }),
  ).toHaveAttribute('aria-disabled', 'true')
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

test('partial IDs and names are forgiving, and search survives navigation', async ({
  page,
}) => {
  const input = page.getByLabel('Member ID or name')
  for (const [query, count] of [
    ['demo', '3'],
    ['demo001', '1'],
    ['001', '1'],
    ['DEMO 001', '1'],
    ['org', '2'],
  ] as const) {
    await input.fill(query)
    await expect(page.getByRole('status')).toHaveText(
      `${count} ${count === '1' ? 'member' : 'members'} found`,
    )
  }
  await page
    .getByRole('link', { name: 'View profile for Avery Morgan' })
    .click()
  await page.getByRole('link', { name: 'Savings', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'breadcrumb' })
    .getByRole('link', { name: 'Member directory' })
    .click()
  await expect(input).toHaveValue('org')
  await expect(page.getByRole('status')).toHaveText('2 members found')
  await page.reload()
  await expect(input).toHaveValue('org')
  await expect(page.getByRole('status')).toHaveText('2 members found')
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(input).toBeFocused()
  await expect(page.getByRole('status')).toHaveText('3 members found')
})

test('profile actions are keyboard accessible with visible focus', async ({
  page,
}) => {
  await page.getByLabel('Member ID or name').fill('001')
  await expect(page.getByRole('status')).toHaveText('1 member found')
  const link = page.getByRole('link', { name: 'View profile for Avery Morgan' })
  await link.focus()
  await expect(link).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { name: 'Avery Morgan' }),
  ).toBeVisible()
  const savings = page.getByRole('link', { name: 'Savings', exact: true })
  await savings.focus()
  await page.keyboard.press('Enter')
  await expect(savings).toBeFocused()
  await page.goBack()
  await page.goBack()
  await expect(page.getByLabel('Member ID or name')).toHaveValue('001')
})
