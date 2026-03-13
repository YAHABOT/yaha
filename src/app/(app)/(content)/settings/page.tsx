import { getUser } from '@/lib/db/users'
import { SettingsForm } from '@/components/settings/SettingsForm'

export default async function SettingsPage(): Promise<React.ReactElement> {
  let user = null

  try {
    user = await getUser()
  } catch {
    // Unauthenticated or DB error — render form with empty defaults
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-textPrimary">Settings</h1>
        <p className="mt-1 text-sm text-textMuted">
          Manage your account and preferences
        </p>
      </div>

      <SettingsForm initialValues={user} />
    </div>
  )
}
