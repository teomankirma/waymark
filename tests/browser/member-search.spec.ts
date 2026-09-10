import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('keyboard search reaches the real backend and renders multiple matches', async ({
  page,
}) => {
  await expect(
    page.getByRole('heading', { name: 'Member search', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Ready to find a member')).toBeVisible()
  await page.getByLabel('Member ID or name').fill('Morgan')
  await page.getByLabel('Member ID or name').press('Enter')
  await expect(page.getByRole('status')).toHaveText('2 members found')
  await expect(
    page.getByRole('cell', { name: 'Avery Morgan', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'Sam Morgan', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'Jordan Ellis', exact: true }),
  ).toHaveCount(0)
  const fits = await page.evaluate<boolean>(
    'document.documentElement.scrollWidth <= window.innerWidth',
  )
  expect(fits).toBe(true)
})

test('exact member ID and empty search result replace previous results', async ({
  page,
}) => {
  const input = page.getByLabel('Member ID or name')
  await input.fill('DEMO-002')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Jordan Ellis' })).toBeVisible()
  await input.fill('DEMO-999')
  await expect(page.getByRole('cell', { name: 'Jordan Ellis' })).toHaveCount(0)
  await input.press('Enter')
  await expect(
    page.getByText('No members found', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('0 members found')
})

test('whitespace input shows an accessible validation error', async ({
  page,
}) => {
  await page.getByLabel('Member ID or name').fill('   ')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Enter a member ID or name',
  )
  await expect(page.getByLabel('Member ID or name')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
})

test('delayed response exposes loading and prevents duplicate submission (UI fixture)', async ({
  page,
}) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/members?*', async (route) => {
    await gate
    await route.continue()
  })
  try {
    await page.getByLabel('Member ID or name').fill('DEMO-001')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Searching…' }),
    ).toBeDisabled()
    await expect(page.getByRole('status')).toHaveText(
      'Searching member records…',
    )
  } finally {
    release()
  }
  await expect(page.getByRole('cell', { name: 'Avery Morgan' })).toBeVisible()
})

for (const failure of ['service', 'network', 'malformed'] as const) {
  test(`search recovers from ${failure} failure (UI fixture)`, async ({
    page,
  }) => {
    await page.route(
      '**/api/members?*',
      async (route) => {
        if (failure === 'network') await route.abort()
        else
          await route.fulfill({
            status: failure === 'service' ? 503 : 200,
            contentType: 'application/json',
            body: '{}',
          })
      },
      { times: 1 },
    )
    await page.getByLabel('Member ID or name').fill('DEMO-001')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Search unavailable')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByRole('cell', { name: 'Avery Morgan' })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}
