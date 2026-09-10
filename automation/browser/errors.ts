import { errors } from 'playwright'

export class BrowserSurfaceError extends Error {
  constructor(
    readonly code:
      | 'invalid_input'
      | 'ambiguous_target'
      | 'target_missing'
      | 'timeout'
      | 'session_closed'
      | 'unexpected_state',
  ) {
    // Never forward Playwright errors: they can include DOM text and field values.
    super(code)
    this.name = 'BrowserSurfaceError'
  }
}

export function surfaceError(error: unknown, closed: boolean) {
  if (error instanceof BrowserSurfaceError) {
    return error
  }

  if (closed) {
    return new BrowserSurfaceError('session_closed')
  }

  if (error instanceof errors.TimeoutError) {
    return new BrowserSurfaceError('timeout')
  }

  if (
    error instanceof Error &&
    error.message.includes('strict mode violation')
  ) {
    return new BrowserSurfaceError('ambiguous_target')
  }

  return new BrowserSurfaceError('unexpected_state')
}

export function deadline(timeoutMs: number) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new BrowserSurfaceError('invalid_input')
  }

  const end = performance.now() + timeoutMs

  return () => {
    const remaining = Math.ceil(end - performance.now())

    if (remaining <= 0) {
      throw new BrowserSurfaceError('timeout')
    }

    return remaining
  }
}

/** Bounds read-only Playwright calls that have no timeout option. */
export async function boundedRead<T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new BrowserSurfaceError('timeout')),
          timeoutMs,
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
