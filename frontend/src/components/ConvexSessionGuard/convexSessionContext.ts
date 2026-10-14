import { createContext, useContext } from 'react'

export type ConvexSessionContextValue = {
  /** Safe to run authenticated Convex queries (main deployment). */
  queryReady: boolean
}

export const ConvexSessionContext = createContext<ConvexSessionContextValue>({
  queryReady: false,
})

export function useConvexQueryReady(): boolean {
  return useContext(ConvexSessionContext).queryReady
}
