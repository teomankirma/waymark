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

export function MemberProfile({
  memberId,
  showSavings,
}: {
  memberId: string
  showSavings: boolean
}) {
  const result = useDetailQuery(api.details.profile, memberId)
  return (
    <div className="space-y-6">
      <Button asChild variant="outline">
        <a href="/">Back to member search</a>
      </Button>
      {!result || result.status !== 'success' ? (
        <DetailStatus status={result?.status} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{result.member.name}</CardTitle>
              <CardDescription>Member profile</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Member ID</dt>
                  <dd className="mt-1 font-mono">{result.member.id}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Branch</dt>
                  <dd className="mt-1">{result.member.branch}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    Member since
                  </dt>
                  <dd className="mt-1">{result.member.memberSince}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          {showSavings ? (
            <>
              <Button asChild variant="outline">
                <a href={`/members/${encodeURIComponent(memberId)}`}>
                  Back to profile
                </a>
              </Button>
              <iframe
                title="Savings account details"
                src={`/account-panel/${encodeURIComponent(memberId)}`}
                className="h-[38rem] w-full rounded-xl border bg-background"
              />
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Accounts</CardTitle>
                <CardDescription>
                  Choose an account to view its details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.hasSavings ? (
                  <Button asChild variant="outline">
                    <a
                      href={`/members/${encodeURIComponent(memberId)}/savings`}
                    >
                      View savings account
                    </a>
                  </Button>
                ) : (
                  <p>No savings account is available.</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
