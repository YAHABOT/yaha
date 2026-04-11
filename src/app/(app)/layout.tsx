import { getSafeUser } from '@/lib/supabase/auth'
import { redirect } from 'next/navigation'
import { DesktopSidebar } from '@/components/nav/DesktopSidebar'
import { MobileBottomNav } from '@/components/nav/MobileBottomNav'
import { RefreshGuard } from '@/components/nav/RefreshGuard'
import { createServerClient } from '@/lib/supabase/server'

// Fetch only the confirmOnRefresh preference — kept separate so it doesn't block
// the layout shell from rendering. Runs in parallel with the page's own data fetches.
async function getConfirmOnRefresh(userId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from('users')
      .select('stats')
      .eq('id', userId)
      .maybeSingle()
    return (data?.stats as { confirmOnRefresh?: boolean } | null)?.confirmOnRefresh ?? false
  } catch {
    return false
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  // Run auth check — this is cached via React cache() so subsequent calls in the
  // same render tree (e.g. page.tsx) are free.
  const user = await getSafeUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch confirmOnRefresh in parallel with page rendering — fast single-field select.
  const confirmOnRefresh = await getConfirmOnRefresh(user.id)

  return (
    <div className="h-dvh overflow-hidden bg-background">
      <RefreshGuard confirmOnRefresh={confirmOnRefresh} />
      <DesktopSidebar user={{ email: user.email ?? null }} />
      <MobileBottomNav />
      {/* No padding here — (content)/layout.tsx adds padding for regular pages.
          Chat pages use flex h-full and manage their own scroll internally. */}
      <main className="md:pl-64 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0 h-full overflow-hidden">
        {children}
      </main>
    </div>
  )
}
