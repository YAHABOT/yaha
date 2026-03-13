import type { FormulaNode, FieldValueMap } from '@/types/correlator'
import type { TrackerLog } from '@/types/log'

const MAX_DEPTH = 20

function evaluateNode(node: FormulaNode, values: FieldValueMap, depth: number): number | null {
  if (depth > MAX_DEPTH) return null

  if (node.type === 'constant') {
    return node.value
  }

  if (node.type === 'field') {
    const key = `${node.trackerId}:${node.fieldId}`
    const value = values.get(key)
    if (value === undefined) return null
    return value
  }

  // node.type === 'op'
  const left = evaluateNode(node.left, values, depth + 1)
  const right = evaluateNode(node.right, values, depth + 1)

  if (left === null || right === null) return null

  if (node.operator === '+') return left + right
  if (node.operator === '-') return left - right
  if (node.operator === '*') return left * right
  if (node.operator === '/') {
    if (right === 0) return null
    return left / right
  }

  return null
}

export function evaluateFormula(node: FormulaNode, values: FieldValueMap): number | null {
  return evaluateNode(node, values, 0)
}

export function buildFieldValueMap(logs: TrackerLog[]): FieldValueMap {
  const map: FieldValueMap = new Map()

  for (const log of logs) {
    for (const [fieldId, value] of Object.entries(log.fields)) {
      if (typeof value !== 'number') continue

      const key = `${log.tracker_id}:${fieldId}`
      const existing = map.get(key)

      if (existing === undefined || existing === null) {
        map.set(key, value)
      } else {
        map.set(key, existing + value)
      }
    }
  }

  return map
}

export function formatResult(value: number | null, unit: string): string {
  if (value === null) return '---'

  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10
  return `${rounded} ${unit}`
}
