'use client'

import { useEffect } from 'react'

type Props = {
  confirmOnRefresh: boolean
}

export function RefreshGuard({ confirmOnRefresh }: Props): null {
  useEffect(() => {
    if (!confirmOnRefresh) return

    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [confirmOnRefresh])

  return null
}
