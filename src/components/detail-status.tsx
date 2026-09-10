import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const messages = {
  denied: [
    'Access denied',
    'You do not have permission to view these records. Contact a supervisor.',
  ],
  expired: [
    'Session expired',
    'Restore the training session to continue from this page.',
  ],
  unavailable: [
    'Records unavailable',
    'Results will return automatically when the connection or service recovers.',
  ],
  not_found: [
    'Record not found',
    'This member or savings account could not be found. Return to member search.',
  ],
} as const

export function DetailStatus({
  status,
}: {
  status?: keyof typeof messages | 'loading'
}) {
  const restore = useMutation(api.details.restoreSession)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!status || status === 'loading') {
    return (
      <div role="status" className="space-y-4">
        <p>Loading records…</p>
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  const [title, description] = messages[status]

  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{description}</p>
        {status === 'expired' ? (
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true)
              setFailed(false)

              try {
                await restore({})
              } catch {
                setFailed(true)
              } finally {
                setPending(false)
              }
            }}
          >
            {pending ? 'Restoring…' : 'Restore demo session'}
          </Button>
        ) : null}
        {failed ? (
          <p role="alert">Could not restore the session. Try again.</p>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
