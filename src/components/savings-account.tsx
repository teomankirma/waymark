import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useDetailQuery } from '@/hooks/use-detail-query'
import { DetailStatus } from '@/components/detail-status'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export function SavingsAccount({ memberId }: { memberId: string }) {
  const result = useDetailQuery(api.details.savings, memberId)
  const closeAccount = useMutation(api.details.closeAccount)
  const [action, setAction] = useState<'idle' | 'pending' | 'denied' | 'error'>(
    'idle',
  )
  return (
    <main className="space-y-5 p-5">
      <h1 className="text-xl font-semibold">Savings account</h1>
      {!result || result.status !== 'success' ? (
        <DetailStatus status={result?.status} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{result.member.name}</CardTitle>
              <CardDescription>
                Member ID: {result.member.id} · {result.accountNumber}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Current balance
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold tabular-nums">
                    {result.balance}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Currency</dt>
                  <dd>{result.currency}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Account closure requires supervisor permission.
            </p>
            <Button
              variant="destructive"
              disabled={action === 'pending'}
              onClick={async () => {
                setAction('pending')
                try {
                  await closeAccount({ memberId })
                  setAction('denied')
                } catch {
                  setAction('error')
                }
              }}
            >
              {action === 'pending' ? 'Checking permission…' : 'Close account'}
            </Button>
            {action === 'denied' || action === 'error' ? (
              <Alert variant="destructive">
                <AlertTitle>
                  {action === 'denied'
                    ? 'Action restricted'
                    : 'Action unavailable'}
                </AlertTitle>
                <AlertDescription>
                  {action === 'denied'
                    ? 'Account closure is not permitted in this training environment. No account was changed.'
                    : 'Could not check permission. Try again.'}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        </>
      )}
    </main>
  )
}
