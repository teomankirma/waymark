import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Search, UsersRound } from 'lucide-react'
import {
  memberSearchSchema,
  searchQuerySchema,
  type Member,
} from '../../shared/members'
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
import { MemberResults } from '@/components/member-results'

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'error' }
  | { status: 'success'; query: string; members: Member[] }

export function MemberSearch() {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const activeRequest = useRef<AbortController | null>(null)
  useEffect(() => () => activeRequest.current?.abort(), [])
  const loading = state.status === 'loading'

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (activeRequest.current) return
    const parsed = searchQuerySchema.safeParse(query)
    if (!parsed.success) {
      setState({ status: 'invalid' })
      return
    }
    const controller = new AbortController()
    activeRequest.current = controller
    setState({ status: 'loading' })
    try {
      const response = await fetch(
        `/api/members?q=${encodeURIComponent(parsed.data)}`,
        {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10_000),
          ]),
        },
      )
      if (!response.ok) throw new Error('Search unavailable')
      const result = memberSearchSchema.parse(await response.json())
      if (!controller.signal.aborted)
        setState({
          status: 'success',
          query: parsed.data,
          members: result.members,
        })
    } catch {
      if (!controller.signal.aborted) setState({ status: 'error' })
    } finally {
      activeRequest.current = null
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Find a member</CardTitle>
          <CardDescription>
            Use a complete member ID or any part of a name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={search} className="space-y-3">
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
                disabled={loading}
                aria-invalid={state.status === 'invalid'}
                aria-describedby={
                  state.status === 'invalid' ? 'query-error' : 'query-hint'
                }
                onChange={(event) => {
                  setQuery(event.target.value)
                  setState({ status: 'idle' })
                }}
              />
              <Button type="submit" disabled={loading} className="h-10 px-5">
                <Search aria-hidden="true" />
                {loading ? 'Searching…' : 'Search'}
              </Button>
            </div>
            {state.status === 'invalid' ? (
              <p
                id="query-error"
                role="alert"
                className="text-sm text-destructive"
              >
                Enter a member ID or name (1–64 characters).
              </p>
            ) : (
              <p id="query-hint" className="text-xs text-muted-foreground">
                Try DEMO-001 for one member, or Morgan for multiple matches.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Search results</CardTitle>
          <CardDescription role="status" aria-live="polite">
            {state.status === 'success'
              ? `${state.members.length} ${state.members.length === 1 ? 'member' : 'members'} found`
              : loading
                ? 'Searching member records…'
                : 'Member directory'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6" aria-busy={loading}>
          {loading ? (
            <div aria-hidden="true" className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : state.status === 'error' ? (
            <Alert variant="destructive">
              <AlertTitle>Search unavailable</AlertTitle>
              <AlertDescription>
                We couldn’t load member records. Please try searching again.
              </AlertDescription>
            </Alert>
          ) : state.status === 'success' && state.members.length > 0 ? (
            <MemberResults members={state.members} query={state.query} />
          ) : (
            <div className="py-10 text-center">
              <UsersRound
                aria-hidden="true"
                className="mx-auto mb-3 size-7 text-muted-foreground"
              />
              <h2 className="text-sm font-medium">
                {state.status === 'success'
                  ? 'No members found'
                  : 'Ready to find a member'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.status === 'success'
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
