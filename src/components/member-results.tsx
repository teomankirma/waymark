import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../convex/_generated/api'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
type Member = Extract<
  FunctionReturnType<typeof api.members.search>,
  { status: 'success' }
>['members'][number]

export function MemberResults({
  members,
  query,
  updating = false,
}: {
  members: Member[]
  query: string
  updating?: boolean
}) {
  const search = query ? `?${new URLSearchParams({ q: query })}` : ''
  return (
    <Table>
      <TableCaption className="sr-only">
        {query ? `Matches for “${query}”` : 'Member directory'}. Open a profile
        to view accounts.
      </TableCaption>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead scope="col" className="pl-4 sm:pl-6">
            Member
          </TableHead>
          <TableHead scope="col" className="hidden sm:table-cell">
            Branch
          </TableHead>
          <TableHead scope="col" className="hidden md:table-cell">
            Member since
          </TableHead>
          <TableHead scope="col" className="pr-4 text-right sm:pr-6">
            <span className="sr-only">Profile</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow
            key={member.id}
            className={updating ? 'opacity-50' : undefined}
          >
            <TableCell className="py-4 pl-4 sm:pl-6">
              <span className="block font-medium">{member.name}</span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                {member.id}
              </span>
            </TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">
              {member.branch}
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {member.memberSince}
            </TableCell>
            <TableCell className="pr-4 text-right sm:pr-6">
              <Button asChild variant="outline" className="min-h-11 gap-2 px-3">
                <Link
                  to={`/members/${encodeURIComponent(member.id)}${search}`}
                  aria-label={`View profile for ${member.name}`}
                  aria-disabled={updating || undefined}
                  tabIndex={updating ? -1 : undefined}
                  onClick={(event) => {
                    if (updating) event.preventDefault()
                  }}
                >
                  View profile
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
