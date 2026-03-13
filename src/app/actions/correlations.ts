'use server'

import { revalidatePath } from 'next/cache'
import { createCorrelation, deleteCorrelation } from '@/lib/db/correlations'
import type { FormulaNode, CreateCorrelationInput } from '@/types/correlator'

const MAX_NAME_LENGTH = 50
const MAX_UNIT_LENGTH = 20

function isValidFormulaNode(node: unknown): node is FormulaNode {
  if (!node || typeof node !== 'object') return false
  const n = node as Record<string, unknown>

  if (n.type === 'constant') {
    return typeof n.value === 'number'
  }

  if (n.type === 'field') {
    return typeof n.trackerId === 'string' && typeof n.fieldId === 'string'
  }

  if (n.type === 'op') {
    const validOperators = ['+', '-', '*', '/']
    return (
      typeof n.operator === 'string' &&
      validOperators.includes(n.operator) &&
      isValidFormulaNode(n.left) &&
      isValidFormulaNode(n.right)
    )
  }

  return false
}

export async function createCorrelationAction(
  input: CreateCorrelationInput
): Promise<{ success?: true; error?: string }> {
  try {
    const name = input.name?.trim()
    if (!name) return { error: 'Name is required.' }
    if (name.length > MAX_NAME_LENGTH) {
      return { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` }
    }

    const unit = input.unit?.trim() ?? ''
    if (unit.length > MAX_UNIT_LENGTH) {
      return { error: `Unit must be ${MAX_UNIT_LENGTH} characters or fewer.` }
    }

    if (!isValidFormulaNode(input.formula)) {
      return { error: 'Invalid formula structure.' }
    }

    await createCorrelation({ name, formula: input.formula, unit })
    revalidatePath('/journal/correlations')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create correlation' }
  }
}

export async function deleteCorrelationAction(
  id: string
): Promise<{ success?: true; error?: string }> {
  try {
    await deleteCorrelation(id)
    revalidatePath('/journal/correlations')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to delete correlation' }
  }
}
