import { randomUUID } from 'node:crypto'
import type { Browser, BrowserContext, Page } from 'playwright'
import { BrowserSurface } from '../browser/surface.ts'
import { BrowserSurfaceError, deadline } from '../browser/errors.ts'
import { stepSchema } from '../contracts/actions.ts'
import type {
  BoundCheckpoint,
  BoundStep,
  BoundTarget,
} from '../contracts/surface.ts'
import { executorPolicySchema, routeIndex, sameTarget } from './policy.ts'
import type { ExecutorPolicy } from './policy.ts'
import { NavigationBoundary } from './boundary.ts'
import { persistEvent } from './events.ts'
import type { ExecutionEvent, Outcome } from './events.ts'

class ExecutionFault extends Error {
  constructor(readonly outcome: Outcome) {
    super(outcome)
  }
}

type Success = {
  status: 'success'
  value?: string
  observation?: {
    controls: { label: string; visible: boolean; restricted: boolean }[]
  }
}

export type ExecutionResult = Success | { status: 'failure'; code: Outcome }

function containsInput(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false
  }

  return (
    ('kind' in value && value.kind === 'input') ||
    Object.values(value).some(containsInput)
  )
}

/** Shared, single-owner entry point for future discovery and replay. */
export class PolicyExecutor {
  readonly runId = `run-${randomUUID()}`

  private owner: 'automation' | 'pausing' | 'human' | 'closed' = 'automation'

  private active?: Promise<ExecutionResult>

  private cancellation?: AbortController

  private authorization?: () => void

  private readonly started = performance.now()

  private operations = 0

  private stopped = false

  private readonly journal: ExecutionEvent[] = []

  private readonly surface: BrowserSurface

  private constructor(
    private readonly context: BrowserContext,
    private readonly page: Page,
    private readonly policy: ExecutorPolicy,
    private readonly boundary: NavigationBoundary,
    private readonly evidenceDirectory?: string,
  ) {
    this.surface = new BrowserSurface(page, (operation) => {
      this.checkAccess(operation === 'navigate')
      this.authorization?.()
    })
  }

  static async create(
    browser: Browser,
    configuration: unknown,
    options: {
      evidenceDirectory?: string
      viewport?: { width: number; height: number }
    } = {},
  ) {
    const parsed = executorPolicySchema.safeParse(configuration)

    if (!parsed.success) {
      throw new ExecutionFault('invalid_input')
    }

    const context = await browser.newContext({
      viewport: options.viewport,
      serviceWorkers: 'block',
      acceptDownloads: false,
    })

    try {
      const page = await context.newPage()

      for (const origin of parsed.data.localNetworkOrigins) {
        await context.grantPermissions(['local-network-access'], { origin })
      }

      const boundary = new NavigationBoundary(context, page, parsed.data)

      await boundary.install()

      return new PolicyExecutor(
        context,
        page,
        parsed.data,
        boundary,
        options.evidenceDirectory,
      )
    } catch {
      await context.close()

      throw new ExecutionFault('unexpected_state')
    }
  }

  get state() {
    return this.owner
  }

  get events(): readonly ExecutionEvent[] {
    return structuredClone(this.journal)
  }

  private checkAccess(allowBlank = false) {
    if (this.owner !== 'automation') {
      throw new ExecutionFault('ownership_denied')
    }

    if (this.page.isClosed()) {
      throw new ExecutionFault('session_closed')
    }

    if (!this.boundary.check(allowBlank)) {
      throw new ExecutionFault('boundary_violation')
    }

    if (performance.now() - this.started >= this.policy.maxRunMs) {
      throw new ExecutionFault('limit_reached')
    }
  }

  private authorize(
    target: BoundTarget,
    action: 'click' | 'fill' | 'select' | 'read' | 'assert',
  ) {
    const route = routeIndex(this.policy, this.page.url())
    const matches = this.policy.grants.filter(
      (grant) =>
        grant.route === route &&
        sameTarget(grant.target, target) &&
        grant.actions.includes(action),
    )

    if (matches.some((grant) => grant.risk === 'restricted')) {
      throw new ExecutionFault('restricted_action')
    }

    if (matches.length !== 1) {
      throw new ExecutionFault('policy_denied')
    }
  }

  private async checkpoint(
    checkpoint: BoundCheckpoint,
    remaining: () => number,
  ) {
    this.checkAccess()

    if (checkpoint.kind === 'url_equals') {
      if (routeIndex(this.policy, checkpoint.url) < 0) {
        throw new ExecutionFault('policy_denied')
      }
    } else {
      this.authorize(checkpoint.target, 'assert')
    }

    const result = await this.surface.check(checkpoint, {
      timeoutMs: remaining(),
      signal: this.cancellation?.signal,
    })

    this.checkAccess()

    if (!result.passed) {
      throw new ExecutionFault('checkpoint_mismatch')
    }
  }

  private run(
    action: ExecutionEvent['action'],
    timeoutMs: number,
    operation: (remaining: () => number) => Promise<Success>,
    allowBlank = false,
  ): Promise<ExecutionResult> {
    // Reject overlap instead of queuing actions that might become stale.
    if (this.active) {
      return Promise.resolve({ status: 'failure', code: 'busy' })
    }

    if (this.owner !== 'automation') {
      return Promise.resolve({ status: 'failure', code: 'ownership_denied' })
    }

    if (this.stopped) {
      return Promise.resolve({ status: 'failure', code: 'run_stopped' })
    }

    if (this.operations >= this.policy.maxSteps) {
      return Promise.resolve({ status: 'failure', code: 'limit_reached' })
    }

    this.cancellation = new AbortController()

    const step = ++this.operations
    const active = Promise.resolve()
      .then(async (): Promise<ExecutionResult> => {
        let outcome: Outcome = 'completed'
        let result: ExecutionResult

        try {
          this.checkAccess(allowBlank)

          const remaining = deadline(
            Math.min(
              timeoutMs,
              Math.max(
                1,
                Math.floor(
                  this.policy.maxRunMs - (performance.now() - this.started),
                ),
              ),
            ),
          )

          result = await operation(remaining)
          this.checkAccess()
        } catch (error) {
          outcome =
            this.owner !== 'automation'
              ? 'ownership_denied'
              : !this.boundary.check(allowBlank)
                ? 'boundary_violation'
                : error instanceof ExecutionFault
                  ? error.outcome
                  : error instanceof BrowserSurfaceError
                    ? error.code
                    : 'unexpected_state'
          this.stopped = true
          result = { status: 'failure', code: outcome }
        }

        const event: ExecutionEvent = {
          runId: this.runId,
          step,
          action,
          outcome,
        }

        this.journal.push(event)

        if (this.evidenceDirectory) {
          try {
            await persistEvent(this.evidenceDirectory, event)
          } catch {
            this.stopped = true
            result = { status: 'failure', code: 'unexpected_state' }
          }
        }

        return result
      })
      .finally(() => {
        this.active = undefined
        this.authorization = undefined
      })

    this.active = active

    return active
  }

  execute(data: unknown): Promise<ExecutionResult> {
    const parsed = stepSchema.safeParse(data)

    if (!parsed.success || containsInput(parsed.data)) {
      return this.run(
        'invalid',
        1000,
        async () => {
          throw new ExecutionFault('invalid_input')
        },
        true,
      )
    }

    const step = parsed.data as BoundStep
    const action = step.action

    return this.run(
      action.kind,
      step.timeoutMs,
      async (remaining) => {
        if (!this.policy.allowedActions.includes(action.kind)) {
          throw new ExecutionFault('policy_denied')
        }

        if (step.risk === 'restricted') {
          throw new ExecutionFault('restricted_action')
        }

        for (const checkpoint of step.before) {
          await this.checkpoint(checkpoint, remaining)
        }

        let value: string | undefined

        if (action.kind === 'navigate') {
          if (routeIndex(this.policy, action.url) < 0) {
            throw new ExecutionFault('policy_denied')
          }

          // Initial blank page is allowed solely for this explicit navigation.
          await this.surface.navigate(action.url, {
            timeoutMs: remaining(),
            signal: this.cancellation?.signal,
          })
        } else if (action.kind === 'assert') {
          await this.checkpoint(action.checkpoint, remaining)
        } else {
          this.authorize(action.target, action.kind)
          this.authorization = () => this.authorize(action.target, action.kind)

          const resolved = await this.surface.resolve(action.target, {
            timeoutMs: remaining(),
            signal: this.cancellation?.signal,
          })

          this.checkAccess()
          this.authorize(action.target, action.kind)

          if (resolved.status !== 'unique') {
            throw new ExecutionFault(
              resolved.status === 'missing'
                ? 'target_missing'
                : 'ambiguous_target',
            )
          }

          if (action.kind === 'read') {
            value = await this.surface.read(resolved.handle, {
              timeoutMs: remaining(),
              signal: this.cancellation?.signal,
            })
          } else {
            await this.surface.interact(resolved.handle, action, {
              timeoutMs: remaining(),
              signal: this.cancellation?.signal,
            })
          }
        }

        this.authorization = undefined

        for (const checkpoint of step.after) {
          await this.checkpoint(checkpoint, remaining)
        }

        return { status: 'success', ...(value === undefined ? {} : { value }) }
      },
      action.kind === 'navigate',
    )
  }

  observe(timeoutMs = 3000): Promise<ExecutionResult> {
    return this.run('observe', timeoutMs, async (remaining) => {
      const controls: NonNullable<Success['observation']>['controls'] = []
      const route = routeIndex(this.policy, this.page.url())

      for (const grant of this.policy.grants.filter(
        (grant) => grant.route === route,
      )) {
        this.checkAccess()

        const result = await this.surface.check(
          { kind: 'visible', target: grant.target as BoundTarget },
          { timeoutMs: Math.min(100, remaining()) },
        )

        controls.push({
          label: grant.publicLabel,
          visible: result.passed,
          restricted: grant.risk === 'restricted',
        })
      }

      return { status: 'success', observation: { controls } }
    })
  }

  async giveToHuman(): Promise<Page> {
    if (this.owner === 'closed') {
      throw new ExecutionFault('session_closed')
    }

    this.owner = 'pausing'
    this.cancellation?.abort()
    await this.active

    if (this.page.isClosed()) {
      this.owner = 'closed'

      throw new ExecutionFault('session_closed')
    }

    this.owner = 'human'

    return this.page
  }

  async close() {
    this.owner = 'closed'
    this.cancellation?.abort()
    await this.context.close()
    await this.active
  }
}
