import { useEffect, useState } from 'react'
import { useQueries, useConvexConnectionState } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../convex/_generated/api'
import { Search, UsersRound } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useNetworkOnline } from '@/hooks/use-network-online'
import { MemberResults } from '@/components/member-results'

export function MemberSearch() {
  const [query, setQuery] = useState('')
  const [settledQuery, setSettledQuery] = useState('')
  const normalized = query.trim()
  const valid = normalized.length > 0 && normalized.length <= 64
  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(normalized), 250)
    return () => clearTimeout(timer)
  }, [normalized])
  const ready = valid && normalized === settledQuery
  // useQueries exposes query errors as values so the form remains usable.
  const responses = useQueries(
    ready
      ? { search: { query: api.members.search, args: { query: settledQuery } } }
      : {},
  )
  const result:
    FunctionReturnType<typeof api.members.search> | Error | undefined =
    responses.search
  const connection = useConvexConnectionState()
  const online = useNetworkOnline()
  const disconnected = valid && (!online || !connection.isWebSocketConnected)
  const error =
    result instanceof Error ||
    (!(result instanceof Error) && result?.status === 'unavailable')
  const success =
    ready && !(result instanceof Error) && result?.status === 'success'
      ? result
      : undefined
  const loading =
    valid &&
    !disconnected &&
    !error &&
    (!ready ||
      result === undefined ||
      (!(result instanceof Error) && result.status === 'loading'))
  const invalid = query.length > 0 && !valid
  const statusText = disconnected
    ? 'Reconnecting to member records…'
    : error
      ? 'Search unavailable'
      : loading
        ? 'Searching member records…'
        : success
          ? `${success.members.length}${success.hasMore ? '+' : ''} ${success.members.length === 1 ? 'member' : 'members'} found`
          : 'Member directory'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Find a member</CardTitle>
          <CardDescription>
            Results update as you type a member ID or the start of a name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setSettledQuery(normalized)
            }}
            className="space-y-3"
          >
            <Label htmlFor="member-query">Member ID or name</Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="member-query"
                name="query"
                value={query}
                required
                maxLength={64}
                autoComplete="off"
                placeholder="e.g. DEMO-001 or Morgan"
                className="h-10 sm:max-w-md"
                aria-invalid={invalid}
                aria-describedby={invalid ? 'query-error' : 'query-hint'}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button type="submit" disabled={!valid} className="h-10 px-5">
                <Search aria-hidden="true" />
                Search now
              </Button>
            </div>
            {invalid ? (
              <p
                id="query-error"
                role="alert"
                className="text-sm text-destructive"
              >
                Enter a member ID or name (1–64 characters).
              </p>
            ) : (
              <p id="query-hint" className="text-xs text-muted-foreground">
                Try DEMO-001 for one member, or Mor for multiple matches.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Search results</CardTitle>
          <CardDescription role="status" aria-live="polite">
            {statusText}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6" aria-busy={loading}>
          {loading ? (
            <div aria-hidden="true" className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error || disconnected ? (
            <Alert variant="destructive">
              <AlertTitle>Search unavailable</AlertTitle>
              <AlertDescription>
                {disconnected
                  ? 'Connection lost. Results will update automatically when reconnected.'
                  : 'Member search is temporarily unavailable. Results will return automatically when service recovers.'}
              </AlertDescription>
            </Alert>
          ) : success && success.members.length > 0 ? (
            <>
              <MemberResults members={success.members} query={settledQuery} />
              {success.hasMore ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Showing the first 20 matches. Keep typing to narrow your
                  search.
                </p>
              ) : null}
            </>
          ) : (
            <div className="py-10 text-center">
              <UsersRound
                aria-hidden="true"
                className="mx-auto mb-3 size-7 text-muted-foreground"
              />
              <h2 className="text-sm font-medium">
                {success ? 'No members found' : 'Ready to find a member'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {success
                  ? 'Check the member ID or try a different name.'
                  : 'Search above to see matching member records here.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
