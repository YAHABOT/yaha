'use client' // needed: passes icon components (functions) to NavLink — must stay in client tree

import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Boxes,
  Workflow,
  MessageCircle,
  Settings,
  LogOut,
} from 'lucide-react'
import { NavLink } from './NavLink'
import { signOut } from '@/app/actions/auth'

type Props = {
  user: { email: string | null }
}

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/journal', icon: BookOpen, label: 'Journals' },
  { href: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { href: '/trackers', icon: Boxes, label: 'Trackers' },
  { href: '/routines', icon: Workflow, label: 'Routines' },
  { href: '/chat', icon: MessageCircle, label: 'Chat' },
  { href: '/settings', icon: Settings, label: 'Settings' },
] as const

function getInitial(email: string | null): string {
  if (!email) return 'U'
  return email.charAt(0).toUpperCase()
}

function getDisplayName(email: string | null): string {
  if (!email) return 'User'
  const local = email.split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

export function DesktopSidebar({ user }: Props): React.ReactElement {
  const initial = getInitial(user.email)
  const displayName = getDisplayName(user.email)

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-56 flex-col bg-sidebar border-r border-sidebar-border z-40">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <span className="text-xl font-bold text-primary tracking-tight">YAHA</span>
      </div>

      {/* Profile card */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sidebar-text truncate">{displayName}</p>
          <p className="text-xs text-sidebar-muted truncate">{user.email ?? ''}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={`${item.href}-${item.label}`}
            href={item.href}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </nav>

      {/* Bottom: sign out */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-border transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
