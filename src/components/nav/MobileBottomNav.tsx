'use client' // needed for usePathname() to detect active tab

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  MessageCircle,
  Boxes,
  Settings,
} from 'lucide-react'

type TabItem = {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  primary?: boolean
}

const TABS: TabItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/journal', icon: BookOpen, label: 'Journal' },
  { href: '/chat', icon: MessageCircle, label: 'Chat', primary: true },
  { href: '/trackers', icon: Boxes, label: 'Trackers' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export function MobileBottomNav(): React.ReactElement {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-white/5"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center pt-3 pb-2 gap-1 transition-all duration-300 group ${
                isActive ? 'text-nutrition' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative flex items-center justify-center">
                {/* Active glow pill behind icon */}
                {isActive && (
                  <span className="absolute inset-0 -mx-3 -my-1 rounded-full bg-nutrition/15 shadow-[0_0_14px_rgba(16,185,129,0.25)]" />
                )}
                <Icon
                  className={`relative z-10 transition-all duration-300 ${
                    tab.primary ? 'w-6 h-6' : 'w-5 h-5'
                  } ${
                    isActive
                      ? 'drop-shadow-[0_0_6px_rgba(16,185,129,0.6)] scale-110'
                      : 'opacity-50 group-hover:opacity-80 group-hover:scale-105'
                  }`}
                />
              </div>
              <span
                className={`text-[9px] font-black uppercase tracking-[0.15em] leading-none transition-all duration-300 ${
                  isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
