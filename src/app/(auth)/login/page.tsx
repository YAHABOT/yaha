import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-3xl font-bold text-textPrimary">
          YAHA
        </h1>
        <p className="mb-6 text-center text-sm text-textMuted">
          AI-powered health tracking
        </p>
        <LoginForm />
      </div>
    </main>
  )
}
