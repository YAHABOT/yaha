import { cache } from 'react'
import { createServerClient } from './server'

/**
 * Cached version of the authenticated user fetch.
 * Use this in layouts and pages to avoid redundant Auth server roundtrips.
 */
export const getSafeUser = cache(async () => {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
})

/**
 * Optimized Supabase query client that reuses the auth state.
 */
export async function getAuthenticatedClient() {
  const supabase = await createServerClient()
  return supabase
}
