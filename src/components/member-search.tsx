import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { useQueries, useConvexConnectionState } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../convex/_generated/api'
import { Search, X, UsersRound } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useNetworkOnline } from '@/hooks/use-network-online'
import { MemberResults } from '@/components/member-results'

type SearchSuccess = Extract<
  FunctionReturnType<typeof api.members.search>,
  { status: 'success' }
>

export function MemberSearch() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const normalized = query.trim()
  const [settledQuery, setSettledQuery] = useState(normalized)
  const input = useRef<HTMLInputElement>(null)
  const valid = normalized.length <= 64

  useEffect(() => {
    const timer = setTimeout(() => setSettledQuery(normalized), 250)

    return () => clearTimeout(timer)
  }, [normalized])

  const ready = valid && normalized === settledQuery
  const responses = useQueries(
    valid
      ? { search: { query: api.members.search, args: { query: settledQuery } } }
      : {},
  )
  const result:
    FunctionReturnType<typeof api.members.search> | Error | undefined =
    responses.search
  const [snapshot, setSnapshot] = useState<{
    result: SearchSuccess
    query: string
  }>()

  // Retain the last completed result while the next query loads; its links are disabled.
  if (
    ready &&
    result &&
    !(result instanceof Error) &&
    result.status === 'success' &&
    (snapshot?.result !== result || snapshot.query !== settledQuery)
  ) {
    setSnapshot({ result, query: settledQuery })
  }

  const connection = useConvexConnectionState()
  const online = useNetworkOnline()
  const disconnected = !online || !connection.isWebSocketConnected
  const error = result instanceof Error || result?.status === 'unavailable'
  const invalid =
    !valid ||
    (ready && !(result instanceof Error) && result?.status === 'invalid')
  const success =
    !(result instanceof Error) && result?.status === 'success'
      ? result
      : undefined
  const loading =
    !disconnected &&
    !error &&
    !invalid &&
    (!ready ||
      !result ||
      (!(result instanceof Error) && result.status === 'loading'))
  const displayed = success ?? snapshot?.result
  const statusText = disconnected
    ? 'Reconnecting to member records…'
    : error
      ? 'Search unavailable'
      : invalid
        ? 'Check your search'
        : loading
          ? 'Searching member records…'
          : success
            ? `${success.members.length}${success.hasMore ? '+' : ''} ${success.members.length === 1 ? 'member' : 'members'} found`
            : 'Member directory'

  function updateQuery(value: string) {
    setParams(value ? { q: value } : {}, { replace: true })
  }

  return (
    <div className="space-y-6">
      <title>Member directory · Waymark</title>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Member directory
        </h1>
        <p className="mt-2 text-muted-foreground">
          Find a member, open their profile, and review their accounts.
        </p>
      </div>
      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <form
          role="search"
          className="space-y-3 p-4 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault()
            setSettledQuery(normalized)
          }}
        >
          <Label htmlFor="member-query">Member ID or name</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-muted-foreground"
            />
            <Input
              ref={input}
              id="member-query"
              name="query"
              value={query}
              maxLength={64}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Search by name or any part of a member ID…"
              className="h-12 pr-14 pl-11 text-base md:text-base"
              aria-invalid={invalid}
              aria-describedby={invalid ? 'query-error' : 'query-hint'}
              onChange={(event) => updateQuery(event.target.value)}
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0.5 right-1 size-11"
                aria-label="Clear search"
                onClick={() => {
                  updateQuery('')
                  input.current?.focus()
                }}
              >
                <X aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          {invalid ? (
            <p
              id="query-error"
              role="alert"
              className="text-sm text-destructive"
            >
              Use a name or member ID, up to 64 characters.
            </p>
          ) : (
            <p id="query-hint" className="text-sm text-muted-foreground">
              Try “demo”, “001”, or “morgan”. Partial matches work, in any
              letter case.
            </p>
          )}
        </form>
        <div className="flex items-center justify-between border-t px-4 py-3 sm:px-6">
          <h2 className="text-sm font-medium">
            {normalized ? 'Search results' : 'All members'}
          </h2>
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground"
          >
            {statusText}
          </p>
        </div>
        <div aria-busy={loading} className="min-h-60">
          {loading && !snapshot?.result.members.length ? (
            <div aria-hidden="true" className="space-y-5 px-6 py-5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex justify-between gap-6">
                  <Skeleton className="h-10 w-44" />
                  <Skeleton className="h-10 w-28" />
                </div>
              ))}
            </div>
          ) : error || disconnected ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTitle>Search unavailable</AlertTitle>
                <AlertDescription>
                  {disconnected
                    ? 'Connection lost. Results will update automatically when reconnected.'
                    : 'Member search is temporarily unavailable. Results will return automatically when service recovers.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : !invalid && displayed?.members.length ? (
            <MemberResults
              members={displayed.members}
              query={loading ? (snapshot?.query ?? settledQuery) : query}
              updating={loading}
            />
          ) : (
            <div className="px-6 py-10 text-center">
              <UsersRound
                aria-hidden="true"
                className="mx-auto mb-3 size-7 text-muted-foreground"
              />
              <h2 className="font-medium">
                {invalid ? 'Adjust your search' : 'No members found'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a shorter name or ID, or clear the search to browse members.
              </p>
              <Button
                variant="outline"
                className="mt-4 min-h-11"
                onClick={() => {
                  updateQuery('')
                  input.current?.focus()
                }}
              >
                Show all members
              </Button>
            </div>
          )}
        </div>
        {success?.hasMore ? (
          <p className="border-t px-6 py-4 text-sm text-muted-foreground">
            Showing 20 matches. Keep typing to narrow your search.
          </p>
        ) : null}
      </Card>
    </div>
  )
}
