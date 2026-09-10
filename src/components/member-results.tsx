import { Button } from '@/components/ui/button'
import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../convex/_generated/api'
type Member = Extract<
  FunctionReturnType<typeof api.members.search>,
  { status: 'success' }
>['members'][number]
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function MemberResults({
  members,
  query,
}: {
  members: Member[]
  query: string
}) {
  return (
    <Table>
      <TableCaption>
        Matches for “{query}”. Confirm the member ID before continuing.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Member ID</TableHead>
          <TableHead scope="col">Name</TableHead>
          <TableHead scope="col">Branch</TableHead>
          <TableHead scope="col" className="text-right">
            Member since
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-mono text-xs">{member.id}</TableCell>
            <TableCell className="font-medium">
              <Button asChild variant="link" className="h-auto p-0">
                <a href={`/members/${encodeURIComponent(member.id)}`}>
                  {member.name}
                </a>
              </Button>
            </TableCell>
            <TableCell>{member.branch}</TableCell>
            <TableCell className="text-right tabular-nums">
              {member.memberSince}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
