import { z } from 'zod'
import { nameSchema, textSchema, valueSchema, webUrlSchema } from './values.ts'

const locatorSchema = z.discriminatedUnion('by', [
  z.strictObject({
    by: z.literal('role'),
    role: z.enum([
      'button',
      'link',
      'textbox',
      'combobox',
      'heading',
      'cell',
      'row',
      'table',
      'region',
    ]),
    name: valueSchema,
  }),
  z.strictObject({ by: z.literal('label'), text: valueSchema }),
  z.strictObject({ by: z.literal('text'), text: valueSchema }),
  // Structural fallback is explicit and reviewable; never executable JavaScript.
  z.strictObject({
    by: z.literal('css'),
    selector: textSchema,
    reason: textSchema,
  }),
])

export const targetSchema = z.strictObject({
  description: textSchema,
  // Outer to inner frame selectors; [] means the top-level document.
  frames: z.array(textSchema).max(8),
  locator: locatorSchema,
})

export const checkpointSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('visible'), target: targetSchema }),
  z.strictObject({
    kind: z.literal('text_equals'),
    target: targetSchema,
    expected: valueSchema,
  }),
  z.strictObject({ kind: z.literal('url_equals'), url: webUrlSchema }),
])
export const actionKindSchema = z.enum([
  'navigate',
  'click',
  'fill',
  'select',
  'read',
  'assert',
])
export const actionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('navigate'), url: webUrlSchema }),
  z.strictObject({ kind: z.literal('click'), target: targetSchema }),
  z.strictObject({
    kind: z.literal('fill'),
    target: targetSchema,
    value: valueSchema,
  }),
  z.strictObject({
    kind: z.literal('select'),
    target: targetSchema,
    value: valueSchema,
  }),
  z.strictObject({
    kind: z.literal('read'),
    target: targetSchema,
    output: nameSchema,
  }),
  z.strictObject({ kind: z.literal('assert'), checkpoint: checkpointSchema }),
])
export const stepSchema = z.strictObject({
  id: nameSchema,
  // Advisory only: the executor must independently enforce policy.
  risk: z.enum(['read', 'interaction', 'restricted']),
  action: actionSchema,
  before: z.array(checkpointSchema).max(20),
  after: z.array(checkpointSchema).max(20),
  timeoutMs: z.int().min(1).max(60_000),
})
export type Action = z.infer<typeof actionSchema>
export type Target = z.infer<typeof targetSchema>
export type Checkpoint = z.infer<typeof checkpointSchema>
