/** True when a thrown error indicates the Convex session is no longer valid. */
export function isAuthQueryError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  // Convex rejects expired/missing tokens with `Not authenticated`.
  return /not\s+authenticated/i.test(error.message)
}
