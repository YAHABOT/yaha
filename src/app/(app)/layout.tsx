import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DesktopSidebar } from '@/components/nav/DesktopSidebar'
import { MobileBottomNav } from '@/components/nav/MobileBottomNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="h-dvh overflow-hidden bg-background">
      <DesktopSidebar user={{ email: user.email ?? null }} />
      <MobileBottomNav />
      {/* No padding here — (content)/layout.tsx adds padding for regular pages.
          Chat pages use flex h-full and manage their own scroll internally. */}
      <main className="md:pl-56 pb-16 md:pb-0 h-full overflow-hidden">
        {children}
      </main>
    </div>
  )
}
