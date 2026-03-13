import { getRoutines } from '@/lib/db/routines'
import type { Routine } from '@/types/routine'

export async function detectRoutineTrigger(message: string): Promise<Routine | null> {
  const routines = await getRoutines()
  const normalized = message.toLowerCase().trim()
  return routines.find((r) => normalized.includes(r.trigger_phrase.toLowerCase())) ?? null
}
