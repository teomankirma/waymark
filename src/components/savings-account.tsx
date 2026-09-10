import { useState, useRef, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { Wallet, ShieldAlert } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useDetailQuery } from '@/hooks/use-detail-query'
import { DetailStatus } from '@/components/detail-status'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

// Preserve decimal cents even for values beyond JavaScript's safe integer range.
function displayBalance(value: string) {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value)
  if (!match) return value
  return `${match[1]}${new Intl.NumberFormat('en-US').format(BigInt(match[2]))}.${match[3]}`
}

export function SavingsAccount({ memberId }: { memberId: string }) {
  const result = useDetailQuery(api.details.savings, memberId)
  const closeAccount = useMutation(api.details.closeAccount)
  const [action, setAction] = useState<
    'idle' | 'confirming' | 'pending' | 'denied' | 'error'
  >('idle')
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (action === 'denied' || action === 'error') trigger.current?.focus()
  }, [action])
  return (
    <main className="space-y-6 p-5 sm:p-7">
      <title>Savings account · Waymark</title>
      {!result || result.status !== 'success' ? (
        <>
          <h1 className="text-xl font-semibold">Savings account</h1>
          <DetailStatus status={result?.status} />
        </>
      ) : (
        <>
          <header className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Wallet aria-hidden="true" className="size-5 text-primary" />
              <h1 className="text-lg font-semibold">Savings account</h1>
            </div>
            <Badge variant="secondary">{result.accountNumber}</Badge>
          </header>
          <dl>
            <dt className="text-sm text-muted-foreground">Current balance</dt>
            <dd className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {displayBalance(result.balance)}
              </span>
              <span className="text-sm text-muted-foreground">
                <span className="sr-only">Currency: </span>
                {result.currency}
              </span>
            </dd>
          </dl>
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t pt-4 text-sm">
            <div>
              <p className="text-muted-foreground">Account holder</p>
              <p className="mt-1 font-medium">{result.member.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Member ID</p>
              <p className="mt-1 font-mono">{result.member.id}</p>
            </div>
          </div>
          <div className="space-y-4 border-t pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Account closure requires supervisor permission.
              </p>
              <Button
                ref={trigger}
                variant="outline"
                className="min-h-11"
                disabled={action === 'pending'}
                aria-expanded={action === 'confirming' || action === 'pending'}
                onClick={() => setAction('confirming')}
              >
                Close account…
              </Button>
            </div>
            {action === 'confirming' || action === 'pending' ? (
              <Alert>
                <AlertTitle id="closure-title">
                  Request account closure?
                </AlertTitle>
                <AlertDescription>
                  <p>
                    This action requires supervisor permission. No account will
                    be closed in this training environment.
                  </p>
                  <div
                    role="group"
                    aria-labelledby="closure-title"
                    className="mt-2 flex flex-wrap gap-3"
                  >
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={action === 'pending'}
                      onClick={() => {
                        setAction('idle')
                        trigger.current?.focus()
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="min-h-11"
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
                      Check permission
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
            {action === 'pending' ? (
              <p role="status" className="text-sm text-muted-foreground">
                Checking permission…
              </p>
            ) : null}
            {action === 'denied' || action === 'error' ? (
              <Alert variant={action === 'error' ? 'destructive' : 'default'}>
                <ShieldAlert aria-hidden="true" />
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
