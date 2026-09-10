import { Badge } from '@/components/ui/badge'
import { MemberSearch } from '@/components/member-search'

export default function App() {
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
            Member services / Directory
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Member search
          </h1>
          <p className="text-sm text-muted-foreground">
            Find a member by their ID or name.
          </p>
        </div>
        <MemberSearch />
        <footer className="mt-8 text-xs text-muted-foreground">
          Training environment · All member records are fictional.
        </footer>
      </main>
    </div>
  )
}
