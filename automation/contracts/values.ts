import { z } from 'zod'

export const nameSchema = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/)
  .refine(
    (name) => !['__proto__', 'constructor', 'prototype'].includes(name),
    'Reserved name',
  )

export const textSchema = z.string().min(1).max(4096)
export const webUrlSchema = z.url({ protocol: /^https?$/ }).refine((value) => {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return !url.username && !url.password
}, 'URLs must not contain credentials')

export const valueSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('literal'), value: textSchema }),
  z.strictObject({ kind: z.literal('input'), name: nameSchema }),
])

// All v1 fields are strings. Exact decimals never pass through floating point.
export const fieldSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('text'),
    maxLength: z.int().min(1).max(4096),
  }),
  z.strictObject({ type: z.literal('decimal') }),
  z.strictObject({ type: z.literal('currency') }),
])
export const fieldsSchema = z.record(nameSchema, fieldSchema)
export type Fields = z.infer<typeof fieldsSchema>
export type Value = z.infer<typeof valueSchema>

export function parseFields(
  fields: Fields,
  data: unknown,
): Record<string, string> {
  const shape = Object.fromEntries(
    Object.entries(fields).map(([name, field]) => {
      const schema =
        field.type === 'text'
          ? textSchema.max(field.maxLength)
          : field.type === 'decimal'
            ? z
                .string()
                .max(128)
                .regex(/^-?(0|[1-9]\d*)(\.\d+)?$/)
            : z.string().regex(/^[A-Z]{3}$/)
      return [name, schema]
    }),
  )
  return z.strictObject(shape).parse(data)
}

export function resolveValue(
  value: Value,
  inputs: Record<string, string>,
): string {
  if (value.kind === 'literal') return value.value
  const resolved = inputs[value.name]
  if (!Object.hasOwn(inputs, value.name) || resolved === undefined) {
    throw new Error(`Missing input: ${value.name}`)
  }
  return resolved
}
