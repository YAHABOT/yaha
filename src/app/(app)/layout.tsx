import { getSafeUser } from '@/lib/supabase/auth'
import { redirect } from 'next/navigation'
import { DesktopSidebar } from '@/components/nav/DesktopSidebar'
import { MobileBottomNav } from '@/components/nav/MobileBottomNav'
import { RefreshGuard } from '@/components/nav/RefreshGuard'
import { getUser } from '@/lib/db/users'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  const user = await getSafeUser()

  if (!user) {
    redirect('/login')
  }

  let profile = null
  try {
    profile = await getUser(user.id)
  } catch {
    // Non-fatal — RefreshGuard defaults to false if profile unavailable
  }
  const confirmOnRefresh = profile?.stats?.confirmOnRefresh ?? false

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
