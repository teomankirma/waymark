import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

const exec = promisify(execFile)

async function scenario(
  scenario: 'normal' | 'denied' | 'expired' | 'slow' | 'unavailable',
) {
  await exec(process.execPath, [
    'scripts/convex-local.mjs',
    'run',
    'fixtures:setScenario',
    JSON.stringify({ scenario }),
  ])
}

test.beforeEach(async () => {
  await scenario('normal')
})
test.afterEach(async () => {
  await scenario('normal')
})

for (const [id, name, balance] of [
  ['DEMO-001', 'Avery Morgan', '12,450.75'],
  ['DEMO-002', 'Jordan Ellis', '8,320.10'],
] as const) {
  test(`search to savings verifies identity and exact balance for ${id}`, async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByLabel('Member ID or name').fill(id)
    await page
      .getByRole('link', { name: `View profile for ${name}`, exact: true })
      .click()
    await expect(page.getByText(id, { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'View savings account' }).click()

    const frame = page.frameLocator('iframe[title="Savings account details"]')

    await expect(frame.getByText(name, { exact: true })).toBeVisible()
    await expect(frame.getByText(id, { exact: true })).toBeVisible()
    await expect(frame.getByText(balance, { exact: true })).toBeVisible()
    await expect(frame.getByText('USD', { exact: false })).toBeVisible()
    await page.reload()
    await expect(frame.getByText(balance, { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Overview' }).click()
    await expect(
      page.getByRole('link', { name: 'View savings account' }),
    ).toBeVisible()
    await page.goBack()
    await expect(frame.getByText(balance, { exact: true })).toBeVisible()
  })
}

test('session expiry hides details and restores the same page', async ({
  page,
}) => {
  await page.goto('/members/DEMO-001/savings')

  const frame = page.frameLocator('iframe[title="Savings account details"]')

  await expect(frame.getByText('12,450.75', { exact: true })).toBeVisible()
  await scenario('expired')
  await expect(page.getByRole('alert')).toContainText('Session expired')
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.getByRole('button', { name: 'Restore demo session' }).click()
  await expect(page).toHaveURL(/\/members\/DEMO-001\/savings$/)
  await expect(frame.getByText('12,450.75', { exact: true })).toBeVisible()
})

test('direct account URL respects permission and unavailable states', async ({
  page,
}) => {
  await page.goto('/account-panel/DEMO-002')
  await expect(page.getByText('8,320.10', { exact: true })).toBeVisible()

  for (const [value, text] of [
    ['denied', 'Access denied'],
    ['unavailable', 'Records unavailable'],
    ['expired', 'Session expired'],
  ] as const) {
    await scenario(value)
    await expect(page.getByRole('alert')).toContainText(text)
    await expect(page.getByText('8,320.10', { exact: true })).toHaveCount(0)
  }

  await page.getByRole('button', { name: 'Restore demo session' }).click()
  await expect(page.getByText('8,320.10', { exact: true })).toBeVisible()
  await scenario('slow')
  await expect(page.getByRole('status')).toContainText('Loading records')
  await expect(page.getByText('8,320.10', { exact: true })).toBeVisible()
})

test('restricted closure leaves the balance unchanged', async ({ page }) => {
  await page.goto('/members/DEMO-001/savings')

  const frame = page.frameLocator('iframe[title="Savings account details"]')

  await frame
    .getByRole('button', { name: 'Close account', exact: true })
    .click()
  await expect(
    frame.getByRole('group', { name: 'Request account closure?' }),
  ).toBeVisible()
  await expect(
    frame.getByRole('group', { name: 'Request account closure?' }),
  ).toBeFocused()
  await expect
    .poll(async () =>
      frame
        .locator('body')
        .evaluate(
          (body) =>
            body.scrollHeight <= body.ownerDocument.defaultView.innerHeight,
        ),
    )
    .toBe(true)
  await frame.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(
    frame.getByRole('group', { name: 'Request account closure?' }),
  ).toHaveCount(0)
  await expect(
    frame.getByRole('button', { name: 'Close account', exact: true }),
  ).toBeFocused()
  await frame
    .getByRole('button', { name: 'Close account', exact: true })
    .click()
  await frame
    .getByRole('button', { name: 'Check permission', exact: true })
    .click()
  await expect(frame.getByRole('alert')).toContainText('No account was changed')
  await expect(frame.getByText('12,450.75', { exact: true })).toBeVisible()
  await page.reload()
  await expect(frame.getByText('12,450.75', { exact: true })).toBeVisible()
})

test('unknown member and page have usable recovery navigation', async ({
  page,
}) => {
  await page.goto('/members/DEMO-999')
  await expect(page.getByRole('alert')).toContainText('Record not found')
  await page
    .getByRole('navigation', { name: 'breadcrumb' })
    .getByRole('link', { name: 'Member directory' })
    .click()
  await expect(page.getByLabel('Member ID or name')).toBeVisible()
  await page.goto('/unknown')
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Back to member search' }).click()
  await expect(page.getByLabel('Member ID or name')).toBeVisible()
})
