'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

export function NavLink({ href, icon: Icon, label }: Props): React.ReactElement {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={`relative flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group overflow-hidden ${
        isActive
          ? 'bg-nutrition/10 text-nutrition border border-nutrition/20 shadow-[0_0_20px_rgba(16,185,129,0.08),inset_0_0_20px_rgba(16,185,129,0.04)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent hover:border-white/5'
      }`}
    >
      {/* Active left accent bar */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-nutrition rounded-r-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
      )}

      <Icon
        className={`w-5 h-5 shrink-0 transition-all duration-300 group-hover:scale-110 ${
          isActive
            ? 'text-nutrition drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]'
            : 'opacity-40 group-hover:opacity-80'
        }`}
      />

      <span
        className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${
          isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'
        }`}
      >
        {label}
      </span>

      {isActive && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-nutrition shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      )}
    </Link>
  )
}
