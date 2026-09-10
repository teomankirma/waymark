import { useEffect, useRef } from 'react'
import {
  Link,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router'
import { Landmark } from 'lucide-react'
import { MemberProfile } from '@/components/member-profile'
import { SavingsAccount } from '@/components/savings-account'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MemberSearch } from '@/components/member-search'

function Workspace() {
  const { pathname, search } = useLocation()
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)
  useEffect(() => {
    const previous = previousPath.current
    previousPath.current = pathname
    if (previous === pathname) return
    const previousMember = /^\/members\/([^/]+)/.exec(previous)?.[1]
    const currentMember = /^\/members\/([^/]+)/.exec(pathname)?.[1]
    if (previousMember && previousMember === currentMember) return
    main.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen bg-muted/40">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4"
      >
        Skip to content
      </a>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Link
            to={`/${search}`}
            className="flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Waymark member directory"
          >
            <span className="rounded-xl bg-primary p-2.5 text-primary-foreground">
              <Landmark className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold tracking-tight">
                Waymark
              </span>
              <span className="block text-xs text-muted-foreground">
                Member services
              </span>
            </span>
          </Link>
          <Badge variant="secondary">Fictional banking demo</Badge>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        ref={main}
        className="mx-auto max-w-6xl px-4 py-7 outline-none sm:px-8 sm:py-10"
      >
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground sm:px-8">
        Training environment · All member records are fictional.
      </footer>
    </div>
  )
}
function ProfileRoute({ showSavings = false }: { showSavings?: boolean }) {
  const { memberId = '' } = useParams()
  return (
    <MemberProfile
      key={memberId}
      memberId={memberId}
      showSavings={showSavings}
    />
  )
}
function AccountRoute() {
  const { memberId = '' } = useParams()
  return <SavingsAccount key={memberId} memberId={memberId} />
}
export default function App() {
  return (
    <Routes>
      <Route path="/account-panel/:memberId" element={<AccountRoute />} />
      <Route element={<Workspace />}>
        <Route index element={<MemberSearch />} />
        <Route path="/members/:memberId" element={<ProfileRoute />} />
        <Route
          path="/members/:memberId/savings"
          element={<ProfileRoute showSavings />}
        />
        <Route
          path="*"
          element={
            <div className="space-y-5">
              <title>Page not found · Waymark</title>
              <h1 className="text-3xl font-semibold">Page not found</h1>
              <p className="text-muted-foreground">
                Return to the directory to find a member.
              </p>
              <Button asChild>
                <Link to="/">Back to member search</Link>
              </Button>
            </div>
          }
        />
      </Route>
    </Routes>
  )
}
