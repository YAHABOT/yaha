'use client'

import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Boxes,
  MessageCircle,
  Settings,
  LogOut,
  Flame,
  Zap,
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
  { href: '/chat', icon: MessageCircle, label: 'Chat' },
  { href: '/settings', icon: Settings, label: 'Settings' },
] as const

const XP_CURRENT = 1565
const XP_TO_NEXT = 35
const XP_TOTAL = XP_CURRENT + XP_TO_NEXT
const XP_PROGRESS_PCT = Math.round((XP_CURRENT / XP_TOTAL) * 100)
const USER_LEVEL = 16
const STREAK_DAYS = 8

function getDisplayName(email: string | null): string {
  if (!email) return 'User'
  const local = email.split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function getInitials(email: string | null): string {
  if (!email) return 'U'
  const local = email.split('@')[0]
  return local.slice(0, 2).toUpperCase()
}

export function DesktopSidebar({ user }: Props): React.ReactElement {
  const displayName = getDisplayName(user.email)
  const initials = getInitials(user.email)

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col bg-[#050505] z-40 border-r border-white/[0.04]">
      {/* Profile Section */}
      <div className="px-5 pt-8 pb-6">
        <div className="flex items-start gap-4">
          {/* Avatar with gradient ring glow */}
          <div className="relative shrink-0 group cursor-pointer">
            {/* Outer glow ring */}
            <div className="absolute -inset-[2px] rounded-full bg-gradient-to-br from-purple-500 via-nutrition to-sleep opacity-60 blur-[3px] group-hover:opacity-90 transition-opacity duration-500" />
            {/* Ring border */}
            <div className="absolute -inset-[1.5px] rounded-full bg-gradient-to-br from-purple-500 via-nutrition to-sleep" />
            {/* Avatar body */}
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center text-white font-black text-sm border-2 border-[#050505] z-10 group-hover:scale-105 transition-transform duration-300">
              {initials}
            </div>
            {/* Level badge */}
            <div className="absolute -bottom-1 -right-1 z-20 min-w-[20px] h-5 px-1 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 border-2 border-[#050505] flex items-center justify-center shadow-[0_0_8px_rgba(249,115,22,0.5)]">
              <span className="text-[8px] font-black text-white leading-none">{USER_LEVEL}</span>
            </div>
          </div>

          {/* User info + XP bar */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground truncate">
                {displayName}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <Zap size={8} className="text-nutrition" />
                <span className="text-[10px] font-black text-nutrition">{XP_CURRENT.toLocaleString()}</span>
              </div>
            </div>

            {/* XP Progress bar */}
            <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-nutrition/80 to-nutrition rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)] transition-all duration-700"
                style={{ width: `${XP_PROGRESS_PCT}%` }}
              />
            </div>

            {/* Streak + XP to next level */}
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1">
                <Flame size={9} className="text-orange-400 drop-shadow-[0_0_4px_rgba(249,115,22,0.7)]" />
                <span className="text-[9px] font-black text-orange-400/80 uppercase tracking-wider">
                  {STREAK_DAYS}d streak
                </span>
              </div>
              <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-wider">
                {XP_TO_NEXT} xp to lv {USER_LEVEL + 1}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle separator */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={`${item.href}-${item.label}`}
            href={item.href}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="px-4 pb-8 pt-4 space-y-1 border-t border-white/[0.04]">
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-red-500/30 hover:text-red-500/80 hover:bg-red-500/[0.06] border border-transparent hover:border-red-500/10 transition-all duration-300 group"
          >
            <LogOut className="w-4 h-4 opacity-40 group-hover:opacity-80 transition-opacity duration-300" />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </aside>
  )
}
