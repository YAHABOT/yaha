'use client' // needed for usePathname() to detect active route

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

export function NavLink({ href, icon: Icon, label }: Props): React.ReactElement {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-sidebar-border border-l-2 border-primary text-sidebar-text pl-[10px]'
          : 'text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-border/60'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </Link>
  )
}
