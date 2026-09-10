import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export type Outcome =
  | 'run_stopped'
  | 'completed'
  | 'invalid_input'
  | 'policy_denied'
  | 'restricted_action'
  | 'ownership_denied'
  | 'busy'
  | 'limit_reached'
  | 'boundary_violation'
  | 'ambiguous_target'
  | 'target_missing'
  | 'timeout'
  | 'checkpoint_mismatch'
  | 'session_closed'
  | 'unexpected_state'

export interface ExecutionEvent {
  runId: string
  step: number
  action:
    | 'navigate'
    | 'click'
    | 'fill'
    | 'select'
    | 'read'
    | 'assert'
    | 'observe'
    | 'invalid'
  outcome: Outcome
}

/** Writes only our constructed event shape, never raw errors or action payloads. */
export async function persistEvent(directory: string, event: ExecutionEvent) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await appendFile(
    join(directory, `${event.runId}.jsonl`),
    `${JSON.stringify(event)}\n`,
    { mode: 0o600 },
  )
}
