import type { ProgressStatus } from '@/types/progress'

export function calcScheduledPct(startDate: Date, endDate: Date, today: Date): number {
  const total = endDate.getTime() - startDate.getTime()
  if (total <= 0) return 100
  const elapsed = today.getTime() - startDate.getTime()
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

export function calcDaysDeviation(
  actualPct: number,
  scheduledPct: number,
  durationDays: number,
): number {
  if (durationDays === 0) return 0
  return ((actualPct - scheduledPct) / 100) * durationDays
}

export function calcStatus(actualPct: number, scheduledPct: number): ProgressStatus {
  if (actualPct === 100) return 'completed'
  if (actualPct === 0 && scheduledPct === 0) return 'scheduled'
  const gap = actualPct - scheduledPct
  if (gap >= 0) return 'on-track'
  if (gap > -20) return 'delayed'
  return 'warning'
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
export const TODO_WARNING_THRESHOLD_DAYS = 3

/**
 * ToDo は actualPct を持たないため、completed + 日付で 4 段階に判定する(M-01)。
 * 警告状態は ToDo レベルでは持たない。期日まで TODO_WARNING_THRESHOLD_DAYS 未満は 'delayed' 扱い。
 */
export function calcTodoStatus(
  completed: boolean,
  startDate: Date,
  endDate: Date,
  today: Date,
): ProgressStatus {
  if (completed) return 'completed'
  const daysToDeadline = (endDate.getTime() - today.getTime()) / MS_PER_DAY
  if (daysToDeadline < TODO_WARNING_THRESHOLD_DAYS) return 'delayed'
  if (today.getTime() < startDate.getTime()) return 'scheduled'
  return 'on-track'
}

function calcWeightedAvgByDuration(
  items: { actualPct: number; startDate: Date; endDate: Date }[],
): number {
  if (items.length === 0) return 0
  const totalDuration = items.reduce(
    (sum, item) => sum + (item.endDate.getTime() - item.startDate.getTime()),
    0,
  )
  if (totalDuration === 0) return 0
  const weighted = items.reduce(
    (sum, item) => sum + item.actualPct * (item.endDate.getTime() - item.startDate.getTime()),
    0,
  )
  return weighted / totalDuration
}

export function calcTaskActualPct(todos: { completed: boolean; weight: number }[]): number {
  if (todos.length === 0) return 0
  const totalWeight = todos.reduce((sum, t) => sum + t.weight, 0)
  if (totalWeight === 0) return 0
  const completedWeight = todos.reduce((sum, t) => sum + (t.completed ? t.weight : 0), 0)
  return (completedWeight / totalWeight) * 100
}

export function calcMilestoneActualPct(
  tasks: { actualPct: number; startDate: Date; endDate: Date }[],
): number {
  return calcWeightedAvgByDuration(tasks)
}

export function calcProjectActualPct(
  milestones: { actualPct: number; startDate: Date; endDate: Date }[],
): number {
  return calcWeightedAvgByDuration(milestones)
}
