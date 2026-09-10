import { expect, test } from '@playwright/test'
import { BrowserSurface } from '../../automation/browser/surface.ts'
import type { BoundTarget } from '../../automation/contracts/surface.ts'

const role = (
  role: 'button' | 'link' | 'heading',
  name: string,
  frames: string[] = [],
): BoundTarget => ({
  description: name,
  frames,
  locator: { by: 'role', role, name: { kind: 'literal', value: name } },
})
const text = (value: string, frames: string[] = []): BoundTarget => ({
  description: 'Visible text',
  frames,
  locator: { by: 'text', text: { kind: 'literal', value } },
})
const options = { timeoutMs: 3000 }

async function handle(surface: BrowserSurface, target: BoundTarget) {
  const resolution = await surface.resolve(target, options)

  if (resolution.status !== 'unique') {
    throw new Error(`Unexpected resolution: ${resolution.status}`)
  }

  return resolution.handle
}

for (const [memberId, name, balance] of [
  ['DEMO-001', 'Avery Morgan', '12,450.75'],
  ['DEMO-002', 'Jordan Ellis', '8,320.10'],
]) {
  test(`browser surface traverses the real UI for ${memberId}`, async ({
    page,
    baseURL,
  }) => {
    const surface = new BrowserSurface(page)

    await surface.navigate(baseURL!, options)

    const search: BoundTarget = {
      description: 'Member search',
      frames: [],
      locator: {
        by: 'label',
        text: { kind: 'literal', value: 'Member ID or name' },
      },
    }

    await surface.interact(
      await handle(surface, search),
      {
        kind: 'fill',
        target: search,
        value: { kind: 'literal', value: memberId! },
      },
      options,
    )

    for (const target of [
      role('link', `View profile for ${name}`),
      role('link', 'View savings account'),
    ]) {
      await surface.interact(
        await handle(surface, target),
        { kind: 'click', target },
        options,
      )
    }

    const frames = ['iframe[title="Savings account details"]']

    expect(
      await surface.check(
        {
          kind: 'text_equals',
          target: text(memberId!, frames),
          expected: { kind: 'literal', value: memberId! },
        },
        options,
      ),
    ).toMatchObject({ passed: true })
    expect(
      await surface.read(
        await handle(surface, text(balance!, frames)),
        options,
      ),
    ).toBe(balance)
    expect(
      await surface.check(
        { kind: 'visible', target: text(name!, frames) },
        options,
      ),
    ).toMatchObject({ passed: true })
    expect(
      await surface.check(
        {
          kind: 'url_equals',
          url: `${baseURL}/members/${memberId}/savings?q=${memberId}`,
        },
        options,
      ),
    ).toMatchObject({ passed: true })

    const observation = await surface.observe(options)

    expect(observation.url).toBe(baseURL)
    expect(JSON.parse(observation.summary).frames).toBe(1)
    expect(JSON.stringify(observation)).not.toContain(memberId)
    expect(await surface.captureEvidence(options)).toEqual({
      status: 'unavailable',
    })
  })
}

test('strict targets reject duplicates, including after resolution', async ({
  page,
}) => {
  await page.setContent('<button>Save</button><button>Save copy</button>')

  const surface = new BrowserSurface(page)
  const target = role('button', 'Save')
  const saved = await handle(surface, target)

  await page.setContent('<button>Save</button><button>Save</button>')
  expect(await surface.resolve(target, options)).toEqual({
    status: 'ambiguous',
    count: 2,
  })
  await expect(
    surface.interact(saved, { kind: 'click', target }, options),
  ).rejects.toMatchObject({ code: 'ambiguous_target' })
  expect(
    await surface.resolve(role('button', 'Missing'), { timeoutMs: 75 }),
  ).toEqual({ status: 'missing' })
})

test('frame resolution is strict and bounded when absent', async ({ page }) => {
  await page.setContent(
    '<iframe title="Panel" srcdoc="<button>Save</button>"></iframe><iframe title="Panel" srcdoc="<button>Save</button>"></iframe>',
  )

  const surface = new BrowserSurface(page)

  expect(
    await surface.resolve(role('button', 'Save', ['iframe']), options),
  ).toEqual({ status: 'ambiguous', count: 2 })
  await page.setContent('<p>No frames</p>')

  const start = performance.now()

  expect(
    await surface.resolve(role('button', 'Save', ['iframe']), {
      timeoutMs: 100,
    }),
  ).toEqual({ status: 'missing' })
  expect(performance.now() - start).toBeLessThan(1000)
})

test('fill, select, delayed checkpoints, and sanitized failures', async ({
  page,
}) => {
  await page.setContent(
    '<label>Name<input></label><label for="color">Color</label><select id="color"><option value="red">Red</option><option value="blue">Blue</option></select><p>Loading</p><button disabled>Secret token</button>',
  )

  const surface = new BrowserSurface(page)
  const input: BoundTarget = {
    description: 'Input',
    frames: [],
    locator: { by: 'label', text: { kind: 'literal', value: 'Name' } },
  }

  await surface.interact(
    await handle(surface, input),
    {
      kind: 'fill',
      target: input,
      value: { kind: 'literal', value: 'private-value' },
    },
    options,
  )
  await expect(page.getByLabel('Name')).toHaveValue('private-value')

  const select: BoundTarget = {
    ...input,
    locator: { by: 'label', text: { kind: 'literal', value: 'Color' } },
  }

  await surface.interact(
    await handle(surface, select),
    {
      kind: 'select',
      target: select,
      value: { kind: 'literal', value: 'blue' },
    },
    options,
  )
  await expect(page.getByLabel('Color')).toHaveValue('blue')

  const paragraph: BoundTarget = {
    description: 'Status',
    frames: [],
    locator: { by: 'css', selector: 'p', reason: 'Unlabeled status paragraph' },
  }

  await page.locator('p').evaluate((element) => {
    setTimeout(() => {
      element.textContent = 'Ready'
    }, 100)
  })
  expect(
    await surface.check(
      {
        kind: 'text_equals',
        target: paragraph,
        expected: { kind: 'literal', value: 'Ready' },
      },
      options,
    ),
  ).toMatchObject({ passed: true })
  expect(
    await surface.check(
      {
        kind: 'text_equals',
        target: paragraph,
        expected: { kind: 'literal', value: 'private-value' },
      },
      { timeoutMs: 75 },
    ),
  ).toEqual({
    passed: false,
    expected: 'Exact target text',
    observed: 'Checkpoint did not match before timeout',
  })

  const disabled = role('button', 'Secret token')

  await expect(
    surface.interact(
      await handle(surface, disabled),
      { kind: 'click', target: disabled },
      { timeoutMs: 75 },
    ),
  ).rejects.toMatchObject({ code: 'timeout', message: 'timeout' })

  const foreign = new BrowserSurface(page)

  await expect(
    foreign.read(await handle(surface, input), options),
  ).rejects.toMatchObject({ code: 'invalid_input' })
  await expect(
    surface.navigate('javascript:alert(1)', options),
  ).rejects.toMatchObject({ code: 'invalid_input' })
  await expect(surface.resolve(input, { timeoutMs: 0 })).rejects.toMatchObject({
    code: 'invalid_input',
  })
  await page.close()
  await expect(surface.observe(options)).rejects.toMatchObject({
    code: 'session_closed',
  })
})

test('nested frames and controls that arrive later are resolved without guessing', async ({
  page,
}) => {
  await page.setContent('<iframe title="Outer"></iframe>')

  const outer = page
    .frames()
    .find((frame) => frame.parentFrame() === page.mainFrame())!

  await outer.setContent(
    '<iframe title="Inner" srcdoc="<h1>Nested account</h1>"></iframe>',
  )

  const surface = new BrowserSurface(page)
  const target = role('heading', 'Nested account', [
    'iframe[title="Outer"]',
    'iframe[title="Inner"]',
  ])

  expect(await surface.read(await handle(surface, target), options)).toBe(
    'Nested account',
  )
  await page.setContent('<p>Waiting</p>')

  const waiting = surface.resolve(role('button', 'Continue'), options)

  await page.locator('p').evaluate((element) => {
    setTimeout(() => {
      element.outerHTML = '<button>Continue</button>'
    }, 75)
  })
  expect(await waiting).toMatchObject({ status: 'unique' })
})
