import { MemberProfile } from '@/components/member-profile'
import { SavingsAccount } from '@/components/savings-account'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MemberSearch } from '@/components/member-search'

export default function App() {
  const path = window.location.pathname
  const profile = /^\/members\/([^/]+)(\/savings)?$/.exec(path)
  const panel = /^\/account-panel\/([^/]+)$/.exec(path)
  if (panel) return <SavingsAccount memberId={panel[1]} />
  const isSearch = path === '/'
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-lg font-semibold tracking-tight">
              Waymark Credit Union
            </p>
            <p className="text-xs text-muted-foreground">
              Member services workspace
            </p>
          </div>
          <Badge variant="outline">Fictional banking demo</Badge>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-7 space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Member services / {isSearch ? 'Directory' : 'Profile'}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isSearch
              ? 'Member search'
              : profile
                ? 'Member details'
                : 'Page not found'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSearch
              ? 'Find a member by their ID or name.'
              : 'Confirm the member identity before reviewing account details.'}
          </p>
        </div>
        {isSearch ? (
          <MemberSearch />
        ) : profile ? (
          <MemberProfile
            memberId={profile[1]}
            showSavings={Boolean(profile[2])}
          />
        ) : (
          <Button asChild variant="outline">
            <a href="/">Back to member search</a>
          </Button>
        )}
        <footer className="mt-8 text-xs text-muted-foreground">
          Training environment · All member records are fictional.
        </footer>
      </main>
    </div>
  )
}
