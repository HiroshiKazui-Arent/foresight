import type { ProgressStatus } from '@/types/progress'

export function calcTodoBarPosition(
  taskStartMs: number,
  taskEndMs: number,
  todoStartMs: number,
  todoEndMs: number,
): { offsetPct: number; widthPct: number } {
  const scopeRangeMs = taskEndMs - taskStartMs
  if (scopeRangeMs <= 0) {
    return { offsetPct: 0, widthPct: 100 }
  }

  const rawOffset = ((todoStartMs - taskStartMs) / scopeRangeMs) * 100
  const rawWidth = ((todoEndMs - todoStartMs) / scopeRangeMs) * 100

  const offsetPct = Math.max(0, Math.min(100, rawOffset))
  const widthPct = Math.max(1, Math.min(100 - offsetPct, rawWidth))

  return { offsetPct, widthPct }
}

export function getBottleneckClass(status: ProgressStatus): string {
  if (status === 'warning') {
    return 'bg-red-50 border-l-2 border-red-400'
  }
  return ''
}
