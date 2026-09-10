import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { policySchema } from '../contracts/execution.ts'
import { targetSchema } from '../contracts/actions.ts'
import type { Target } from '../contracts/actions.ts'

const boundTarget = targetSchema.refine((target) => {
  const locator = target.locator

  return (
    locator.by === 'css' ||
    (locator.by === 'role'
      ? locator.name.kind === 'literal'
      : locator.text.kind === 'literal')
  )
}, 'Policy targets must be bound')

/** Trusted operator configuration, never supplied by a model or page. */
export const executorPolicySchema = policySchema
  .extend({
    localNetworkOrigins: z.array(z.string()).max(10).default([]),
    grants: z
      .array(
        z.strictObject({
          route: z.int().min(0),
          target: boundTarget,
          actions: z
            .array(z.enum(['click', 'fill', 'select', 'read', 'assert']))
            .min(1),
          risk: z.enum(['safe', 'restricted']),
          // Public label for observations. Actual DOM text/values are not copied.
          publicLabel: z.string().min(1).max(100),
        }),
      )
      .max(100),
  })
  .superRefine((policy, ctx) => {
    for (const origin of policy.localNetworkOrigins) {
      if (
        !URL.canParse(origin) ||
        !policy.allowedRoutes.some((route) => route.origin === origin) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Local network permission requires an approved loopback origin',
        })
      }
    }

    for (const grant of policy.grants) {
      if (grant.route >= policy.allowedRoutes.length) {
        ctx.addIssue({ code: 'custom', message: 'Unknown grant route' })
      }

      if (
        grant.target.locator.by === 'css' &&
        grant.actions.some((action) =>
          ['click', 'fill', 'select'].includes(action),
        )
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Interactions require a semantic target',
        })
      }
    }
  })

export type ExecutorPolicy = z.infer<typeof executorPolicySchema>

export function routeIndex(policy: ExecutorPolicy, value: string) {
  try {
    const url = new URL(value)

    if (
      url.username ||
      url.password ||
      !['http:', 'https:'].includes(url.protocol)
    ) {
      return -1
    }

    // Query/fragment may carry invocation state, but never enter evidence.
    return policy.allowedRoutes.findIndex(
      (route) => route.origin === url.origin && route.pathname === url.pathname,
    )
  } catch {
    return -1
  }
}

export function sameTarget(left: Target, right: Target) {
  // Descriptions and CSS reasons are explanatory, never authorization.
  const locatorKey = (target: Target) =>
    target.locator.by === 'css'
      ? { by: 'css', selector: target.locator.selector }
      : target.locator

  return (
    isDeepStrictEqual(left.frames, right.frames) &&
    isDeepStrictEqual(locatorKey(left), locatorKey(right))
  )
}
