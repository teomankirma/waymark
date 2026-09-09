import { z } from 'zod'
import { actionKindSchema, checkpointSchema } from './actions.ts'
import { nameSchema, textSchema, webUrlSchema } from './values.ts'
import { type Capability, parseOutputs } from './capability.ts'

const originSchema = webUrlSchema.refine(
  (value) => URL.canParse(value) && new URL(value).origin === value,
  'Use a canonical origin without a path',
)
export const policySchema = z.strictObject({
  // Exact origin/path pairs, not independent lists that permit cross-products.
  allowedRoutes: z
    .array(
      z.strictObject({
        origin: originSchema,
        pathname: z
          .string()
          .startsWith('/')
          .max(2048)
          .refine((path) => {
            const url = new URL(path, 'https://policy.invalid')
            return (
              url.origin === 'https://policy.invalid' &&
              url.pathname === path &&
              !url.search &&
              !url.hash
            )
          }, 'Use an exact canonical pathname'),
      }),
    )
    .min(1)
    .max(100),
  allowedActions: z.array(actionKindSchema).min(1),
  restrictedActions: z.literal('require-human'),
  maxSteps: z.int().min(1).max(100),
  maxRunMs: z.int().min(1).max(600_000),
})

// Evidence references only; a schema cannot prove that captured content is safe.
export const evidenceSchema = z.strictObject({
  id: nameSchema,
  kind: z.enum(['event', 'masked-screenshot']),
})
export const failureSchema = z.strictObject({
  status: z.literal('failure'),
  stepId: nameSchema.nullable(),
  code: z.enum([
    'invalid_input',
    'policy_denied',
    'ambiguous_target',
    'target_missing',
    'timeout',
    'checkpoint_mismatch',
    'invalid_output',
    'session_closed',
    'cancelled',
    'unexpected_state',
  ]),
  expected: textSchema,
  observed: textSchema,
  evidence: z.array(evidenceSchema).max(20),
})
export const resultSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('success'),
    outputs: z.record(nameSchema, textSchema),
  }),
  z.strictObject({
    status: z.literal('business_outcome'),
    code: nameSchema,
    stepId: nameSchema,
  }),
  failureSchema,
])

export function parseResult(artifact: Capability, data: unknown) {
  const result = resultSchema.parse(data)
  if (result.status === 'success')
    return { ...result, outputs: parseOutputs(artifact, result.outputs) }
  if (
    result.stepId !== null &&
    !artifact.steps.some((step) => step.id === result.stepId)
  ) {
    throw new Error('Result references an unknown step')
  }
  if (
    result.status === 'business_outcome' &&
    !artifact.businessOutcomes.some((outcome) => outcome.code === result.code)
  ) {
    throw new Error('Undeclared business outcome')
  }
  return result
}

export const interventionSchema = z.strictObject({
  stepId: nameSchema,
  reason: z.enum([
    'session_expired',
    'recovery_exhausted',
    'restricted_action',
    'discovery_stuck',
  ]),
  summary: textSchema,
  resumeCheckpoint: checkpointSchema,
})
export const sessionSchema = z.discriminatedUnion('state', [
  z.strictObject({
    state: z.literal('automating'),
    sessionId: nameSchema,
    owner: z.literal('automation'),
  }),
  z.strictObject({
    state: z.literal('awaiting_human'),
    sessionId: nameSchema,
    owner: z.literal('none'),
    intervention: interventionSchema,
  }),
  z.strictObject({
    state: z.literal('human_control'),
    sessionId: nameSchema,
    owner: z.literal('human'),
    intervention: interventionSchema,
  }),
  z.strictObject({
    state: z.literal('verifying_resume'),
    sessionId: nameSchema,
    owner: z.literal('none'),
    intervention: interventionSchema,
  }),
  z.strictObject({
    state: z.literal('closed'),
    sessionId: nameSchema,
    owner: z.literal('none'),
  }),
])
export type Policy = z.infer<typeof policySchema>
export type Evidence = z.infer<typeof evidenceSchema>
export type RunResult = z.infer<typeof resultSchema>
export type Session = z.infer<typeof sessionSchema>
