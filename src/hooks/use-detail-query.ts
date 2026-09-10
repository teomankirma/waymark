import { useMemo } from 'react'
import { useQueries, useConvexConnectionState } from 'convex/react'
import type { FunctionReference, FunctionReturnType } from 'convex/server'
import { getFunctionName, makeFunctionReference } from 'convex/server'
import { useNetworkOnline } from './use-network-online'

export function useDetailQuery<
  Q extends FunctionReference<'query', 'public', { memberId: string }>,
>(query: Q, memberId: string) {
  // Convex's multi-query subscription requires a stable request object.
  const name = getFunctionName(query)
  const requests = useMemo(
    () => ({
      detail: {
        query: makeFunctionReference<'query'>(name),
        args: { memberId },
      },
    }),
    [name, memberId],
  )
  const responses = useQueries(requests)
  const result = responses.detail as FunctionReturnType<Q> | Error | undefined
  const online = useNetworkOnline()
  const connection = useConvexConnectionState()

  if (!online || !connection.isWebSocketConnected) {
    return { status: 'unavailable' as const }
  }

  if (result instanceof Error) {
    return { status: 'unavailable' as const }
  }

  return result
}
