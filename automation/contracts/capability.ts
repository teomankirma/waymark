import { z } from 'zod'
import { checkpointSchema, stepSchema } from './actions.ts'
import { fieldsSchema, nameSchema, parseFields, textSchema } from './values.ts'

export const capabilitySchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: nameSchema,
    revision: z.int().positive(),
    description: textSchema,
    provenance: z.enum(['handwritten-development', 'model-discovery']),
    inputs: fieldsSchema,
    outputs: fieldsSchema.refine(
      (fields) => Object.keys(fields).length > 0,
      'Declare at least one output',
    ),
    preconditions: z.array(checkpointSchema).min(1).max(20),
    steps: z.array(stepSchema).min(1).max(100),
    success: z.array(checkpointSchema).min(1).max(20),
    businessOutcomes: z
      .array(
        z.strictObject({
          code: nameSchema,
          when: z.array(checkpointSchema).min(1).max(20),
        }),
      )
      .max(20),
  })
  .superRefine((artifact, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path })
    const seenSteps = new Set<string>()
    const writtenOutputs = new Set<string>()
    artifact.steps.forEach((step, index) => {
      if (seenSteps.has(step.id))
        issue('Duplicate step id', ['steps', index, 'id'])
      seenSteps.add(step.id)
      if (step.action.kind === 'read') {
        const output = step.action.output
        if (!Object.hasOwn(artifact.outputs, output))
          issue('Undeclared output', ['steps', index, 'action', 'output'])
        if (writtenOutputs.has(output))
          issue('Output may only be written once', [
            'steps',
            index,
            'action',
            'output',
          ])
        writtenOutputs.add(output)
      }
    })
    for (const output of Object.keys(artifact.outputs)) {
      if (!writtenOutputs.has(output))
        issue('Output has no read action', ['outputs', output])
    }
    const seenOutcomes = new Set<string>()
    artifact.businessOutcomes.forEach((outcome, index) => {
      if (seenOutcomes.has(outcome.code))
        issue('Duplicate business outcome', ['businessOutcomes', index, 'code'])
      seenOutcomes.add(outcome.code)
    })
    // Walk only schema-parsed data, including targets inside frames/checkpoints.
    function checkReferences(value: unknown, path: (string | number)[]) {
      if (Array.isArray(value)) {
        value.forEach((item, index) => checkReferences(item, [...path, index]))
      } else if (value !== null && typeof value === 'object') {
        const record = value as Record<string, unknown>
        if (
          record.kind === 'input' &&
          typeof record.name === 'string' &&
          !Object.hasOwn(artifact.inputs, record.name)
        ) {
          issue('Undeclared input reference', [...path, 'name'])
        }
        for (const [key, item] of Object.entries(record))
          checkReferences(item, [...path, key])
      }
    }
    checkReferences(artifact, [])
  })
export type Capability = z.infer<typeof capabilitySchema>

export function parseInvocation(artifact: Capability, inputs: unknown) {
  return parseFields(artifact.inputs, inputs)
}

export function parseOutputs(artifact: Capability, outputs: unknown) {
  return parseFields(artifact.outputs, outputs)
}
