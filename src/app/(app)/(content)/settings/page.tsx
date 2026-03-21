import { getUser } from '@/lib/db/users'
import { getSafeUser } from '@/lib/supabase/auth'
import { SettingsForm } from '@/components/settings/SettingsForm'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function SettingsPage(): Promise<React.ReactElement> {
  const userAuth = await getSafeUser()
  if (!userAuth) redirect('/login')

  const supabase = await createServerClient()
  let profile = null

  try {
    profile = await getUser(userAuth.id, supabase)
  } catch {
    // DB error — render form with empty defaults
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-2">
        <h1 className="text-5xl font-black tracking-tighter text-textPrimary">Settings</h1>
        <div className="border-t border-white/5 pt-3">
          <p className="text-sm font-medium text-textMuted opacity-60">
            Manage your account, targets, and system preferences.
          </p>
        </div>
      </div>

      <SettingsForm initialValues={profile} />
    </div>
  )
}
