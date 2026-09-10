import { setTimeout as delay } from 'node:timers/promises'
import { isDeepStrictEqual } from 'node:util'
import type { FrameLocator, Locator, Page } from 'playwright'
import type {
  BoundCheckpoint,
  BoundTarget,
  CheckpointResult,
  Interaction,
  Resolution,
  SurfaceAdapter,
} from '../contracts/surface.ts'
import {
  actionSchema,
  checkpointSchema,
  targetSchema,
} from '../contracts/actions.ts'
import { webUrlSchema } from '../contracts/values.ts'
import {
  BrowserSurfaceError,
  boundedRead,
  deadline,
  surfaceError,
} from './errors.ts'

/** Opaque, adapter-owned target reference; contains no browser API. */
export type BrowserHandle = Readonly<{ id: symbol }>
type Options = { timeoutMs: number }

/** Internal browser primitive. It is NOT a policy or session-ownership boundary. */
export class BrowserSurface implements SurfaceAdapter<BrowserHandle> {
  private readonly targets = new WeakMap<BrowserHandle, BoundTarget>()

  constructor(private readonly page: Page) {}

  private async guarded<T>(operation: () => Promise<T>): Promise<T> {
    try {
      if (this.page.isClosed()) throw new BrowserSurfaceError('session_closed')
      return await operation()
    } catch (error) {
      throw surfaceError(error, this.page.isClosed())
    }
  }

  private validateTarget(target: BoundTarget) {
    const parsed = targetSchema.safeParse(target)
    if (
      !parsed.success ||
      (target.locator.by === 'role' &&
        target.locator.name.kind !== 'literal') ||
      ((target.locator.by === 'label' || target.locator.by === 'text') &&
        target.locator.text.kind !== 'literal')
    )
      throw new BrowserSurfaceError('invalid_input')
  }

  private css(selector: string) {
    if (selector.includes('>>')) throw new BrowserSurfaceError('invalid_input')
    return `css=${selector}`
  }

  private locator(scope: Page | FrameLocator, target: BoundTarget): Locator {
    const locator = target.locator
    switch (locator.by) {
      case 'role':
        return scope.getByRole(locator.role, {
          name: locator.name.value,
          exact: true,
        })
      case 'label':
        return scope.getByLabel(locator.text.value, { exact: true })
      case 'text':
        return scope.getByText(locator.text.value, { exact: true })
      case 'css':
        // Force the CSS engine; never accept Playwright's selector DSL or XPath.
        return scope.locator(this.css(locator.selector))
    }
  }

  private async unique(target: BoundTarget, remaining: () => number) {
    this.validateTarget(target)
    while (true) {
      let scope: Page | FrameLocator = this.page
      let missingFrame = false
      for (const selector of target.frames) {
        const frame: Locator = scope.locator(this.css(selector))
        const count = await boundedRead(frame.count(), remaining())
        if (count > 1) return { status: 'ambiguous', count } as const
        if (count === 0) {
          missingFrame = true
          break
        }
        scope = frame.contentFrame()
      }
      const locator = this.locator(scope, target)
      const count = missingFrame
        ? 0
        : await boundedRead(locator.count(), remaining())
      if (count > 1) return { status: 'ambiguous', count } as const
      if (count === 1) return { status: 'unique', locator } as const
      let wait: number
      try {
        wait = remaining()
      } catch {
        return { status: 'missing' } as const
      }
      await delay(Math.min(25, wait))
      try {
        remaining()
      } catch {
        return { status: 'missing' } as const
      }
      if (this.page.isClosed()) throw new BrowserSurfaceError('session_closed')
    }
  }

  async resolve(
    target: BoundTarget,
    options: Options,
  ): Promise<Resolution<BrowserHandle>> {
    return this.guarded(async () => {
      const found = await this.unique(target, deadline(options.timeoutMs))
      if (found.status !== 'unique') return found
      const handle = Object.freeze({ id: Symbol('browser-target') })
      this.targets.set(handle, structuredClone(target))
      return { status: 'unique', handle }
    })
  }

  private async resolveHandle(handle: BrowserHandle, remaining: () => number) {
    const target = this.targets.get(handle)
    if (!target) throw new BrowserSurfaceError('invalid_input')
    const found = await this.unique(target, remaining)
    if (found.status === 'missing')
      throw new BrowserSurfaceError('target_missing')
    if (found.status === 'ambiguous')
      throw new BrowserSurfaceError('ambiguous_target')
    return found.locator
  }

  async navigate(url: string, options: Options) {
    return this.guarded(async () => {
      const remaining = deadline(options.timeoutMs)
      if (!webUrlSchema.safeParse(url).success)
        throw new BrowserSurfaceError('invalid_input')
      await this.page.goto(url, {
        timeout: remaining(),
        waitUntil: 'domcontentloaded',
      })
    })
  }

  async interact(handle: BrowserHandle, action: Interaction, options: Options) {
    return this.guarded(async () => {
      const remaining = deadline(options.timeoutMs)
      if (
        !actionSchema.safeParse(action).success ||
        !['click', 'fill', 'select'].includes(action.kind) ||
        (action.kind !== 'click' && action.value.kind !== 'literal')
      )
        throw new BrowserSurfaceError('invalid_input')
      const target = this.targets.get(handle)
      // A caller must not resolve one control and describe a different action target.
      if (!target || !isDeepStrictEqual(target, action.target))
        throw new BrowserSurfaceError('invalid_input')
      const locator = await this.resolveHandle(handle, remaining)
      if (action.kind === 'click') await locator.click({ timeout: remaining() })
      else if (action.kind === 'fill')
        await locator.fill(action.value.value, { timeout: remaining() })
      else
        await locator.selectOption(
          { value: action.value.value },
          { timeout: remaining() },
        )
    })
  }

  async read(handle: BrowserHandle, options: Options) {
    return this.guarded(async () => {
      const remaining = deadline(options.timeoutMs)
      const locator = await this.resolveHandle(handle, remaining)
      await locator.waitFor({ state: 'visible', timeout: remaining() })
      const text = await locator.innerText({ timeout: remaining() })
      if (text.length > 4096) throw new BrowserSurfaceError('unexpected_state')
      return text
    })
  }

  async check(
    checkpoint: BoundCheckpoint,
    options: Options,
  ): Promise<CheckpointResult> {
    return this.guarded(async () => {
      const remaining = deadline(options.timeoutMs)
      if (
        !checkpointSchema.safeParse(checkpoint).success ||
        (checkpoint.kind === 'text_equals' &&
          checkpoint.expected.kind !== 'literal')
      )
        throw new BrowserSurfaceError('invalid_input')
      const expected =
        checkpoint.kind === 'visible'
          ? 'One visible target'
          : checkpoint.kind === 'text_equals'
            ? 'Exact target text'
            : 'Exact page URL'
      try {
        if (checkpoint.kind === 'url_equals') {
          await this.page.waitForURL((url) => url.href === checkpoint.url, {
            timeout: remaining(),
            waitUntil: 'domcontentloaded',
          })
        } else {
          const found = await this.unique(checkpoint.target, remaining)
          if (found.status === 'ambiguous')
            throw new BrowserSurfaceError('ambiguous_target')
          if (found.status === 'missing')
            return { passed: false, expected, observed: 'Target missing' }
          await found.locator.waitFor({
            state: 'visible',
            timeout: remaining(),
          })
          if (checkpoint.kind === 'text_equals') {
            while (
              (await found.locator.innerText({ timeout: remaining() })) !==
              checkpoint.expected.value
            )
              await delay(Math.min(25, remaining()))
          }
        }
        return { passed: true, expected, observed: 'Checkpoint matched' }
      } catch (error) {
        if (surfaceError(error, this.page.isClosed()).code === 'timeout')
          return {
            passed: false,
            expected,
            observed: 'Checkpoint did not match before timeout',
          }
        throw error
      }
    })
  }

  async observe(options: Options) {
    return this.guarded(async () => {
      const remaining = deadline(options.timeoutMs)
      // Metadata-only until the next slice supplies a reviewed content-redaction
      // boundary. Do not expose raw snapshots, URLs, titles, or input values.
      const summary: Record<string, number> = {}
      for (const role of ['button', 'link', 'textbox', 'heading'] as const) {
        remaining()
        summary[role] = await boundedRead(
          this.page.getByRole(role).count(),
          remaining(),
        )
      }
      summary.frames = this.page.frames().length - 1
      remaining()
      return {
        url: new URL(this.page.url()).origin,
        summary: JSON.stringify(summary),
      }
    })
  }

  async captureEvidence(options: Options) {
    deadline(options.timeoutMs)
    // No persistence until masking and policy are implemented. Fail closed.
    return { status: 'unavailable' } as const
  }
}
