import { Link, useLocation } from 'react-router'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Wallet,
  UserRound,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { useDetailQuery } from '@/hooks/use-detail-query'
import { DetailStatus } from '@/components/detail-status'
import { AccountFrame } from '@/components/account-frame'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'

export function MemberProfile({
  memberId,
  showSavings,
}: {
  memberId: string
  showSavings: boolean
}) {
  const result = useDetailQuery(api.details.profile, memberId)
  const { search } = useLocation()
  const profilePath = `/members/${encodeURIComponent(memberId)}`
  const member = result?.status === 'success' ? result.member : undefined
  return (
    <div className="space-y-6">
      <title>
        {member
          ? `${member.name} · ${showSavings ? 'Savings' : 'Profile'}`
          : 'Member profile'}{' '}
        · Waymark
      </title>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="inline-flex min-h-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Link to={`/${search}`}>Member directory</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {showSavings ? 'Savings account' : 'Member profile'}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {!result || result.status !== 'success' ? (
        <>
          <h1 className="text-2xl font-semibold">Member profile</h1>
          <DetailStatus status={result?.status} />
        </>
      ) : (
        <>
          <header className="flex items-start gap-4">
            <div className="hidden rounded-2xl bg-primary/10 p-4 text-primary sm:block">
              <UserRound aria-hidden="true" className="size-7" />
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {result.member.name}
                </h1>
                <Badge variant="outline" className="font-mono">
                  {result.member.id}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Building2 aria-hidden="true" className="size-4" />
                  {result.member.branch} branch
                </span>
                <span className="inline-flex items-center gap-2">
                  <CalendarDays aria-hidden="true" className="size-4" />
                  Member since {result.member.memberSince}
                </span>
              </div>
            </div>
          </header>
          <nav
            aria-label="Member sections"
            className="flex gap-2 border-b pb-3"
          >
            <Button
              asChild
              variant={showSavings ? 'ghost' : 'secondary'}
              className="min-h-11 px-4"
            >
              <Link
                to={`${profilePath}${search}`}
                aria-current={!showSavings ? 'page' : undefined}
              >
                Overview
              </Link>
            </Button>
            {result.hasSavings ? (
              <Button
                asChild
                variant={showSavings ? 'secondary' : 'ghost'}
                className="min-h-11 px-4"
              >
                <Link
                  to={`${profilePath}/savings${search}`}
                  aria-current={showSavings ? 'page' : undefined}
                >
                  <Wallet aria-hidden="true" />
                  Savings
                </Link>
              </Button>
            ) : null}
          </nav>
          {showSavings ? (
            <AccountFrame memberId={memberId} />
          ) : (
            <section aria-labelledby="accounts-heading" className="space-y-4">
              <div>
                <h2 id="accounts-heading" className="text-lg font-semibold">
                  Accounts
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose an account to review its balance and details.
                </p>
              </div>
              <Card className="shadow-sm">
                <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  {result.hasSavings ? (
                    <>
                      <div className="flex items-start gap-4">
                        <div className="rounded-xl bg-primary/10 p-3 text-primary">
                          <Wallet aria-hidden="true" className="size-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold">Savings account</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Balance and account information
                          </p>
                        </div>
                      </div>
                      <Button asChild className="min-h-11 gap-2 px-5">
                        <Link to={`${profilePath}/savings${search}`}>
                          View savings account
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      This member does not have a savings account.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  )
}
