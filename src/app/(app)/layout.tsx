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
    <div className="min-h-screen bg-background">
      <DesktopSidebar user={{ email: user.email ?? null }} />
      <MobileBottomNav />
      <main className="md:pl-56 pb-16 md:pb-0 p-4 md:p-6 min-h-screen">
        {children}
      </main>
    </div>
  )
}
