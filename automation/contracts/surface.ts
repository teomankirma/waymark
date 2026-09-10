import type { Action, Checkpoint, Step, Target } from './actions.ts'
import type { Evidence } from './execution.ts'

export interface Observation {
  url: string
  /** Bounded, sanitized UI content; exclude credentials before model access. */
  summary: string
}

export type Resolution<Handle> =
  | { status: 'unique'; handle: Handle }
  | { status: 'missing' }
  | { status: 'ambiguous'; count: number }

export interface CheckpointResult {
  passed: boolean
  /** Sanitized descriptions, never raw field values or credentials. */
  expected: string
  observed: string
}

// Bind all input references before calling an adapter. Browser locator/page
// types remain private to the implementation through its opaque Handle.
type Bound<T> = T extends { kind: 'input'; name: string }
  ? never
  : T extends readonly (infer Item)[]
    ? Bound<Item>[]
    : T extends object
      ? { [Key in keyof T]: Bound<T[Key]> }
      : T

export type BoundStep = Bound<Step>
export type BoundTarget = Bound<Target>
export type BoundCheckpoint = Bound<Checkpoint>
export type Interaction = Extract<
  Bound<Action>,
  { kind: 'click' | 'fill' | 'select' }
>

/** Internal executor dependency. Discovery/replay must use the policy-checking
 * executor, never call this interface directly. Every operation is bounded. */
export interface SurfaceAdapter<Handle> {
  observe(options: { timeoutMs: number }): Promise<Observation>
  resolve(
    target: BoundTarget,
    options: { timeoutMs: number },
  ): Promise<Resolution<Handle>>
  navigate(url: string, options: { timeoutMs: number }): Promise<void>
  interact(
    handle: Handle,
    action: Interaction,
    options: { timeoutMs: number },
  ): Promise<void>
  read(handle: Handle, options: { timeoutMs: number }): Promise<string>
  check(
    checkpoint: BoundCheckpoint,
    options: { timeoutMs: number },
  ): Promise<CheckpointResult>
  /** Fail closed if masking cannot be assured; never return an unmasked image. */
  captureEvidence(options: {
    timeoutMs: number
  }): Promise<
    { status: 'captured'; evidence: Evidence } | { status: 'unavailable' }
  >
}
