import type { ProgressStatus, RenderStatus } from '@/types/progress'

export function calcScheduledPct(startDate: Date, endDate: Date, today: Date): number {
  const total = endDate.getTime() - startDate.getTime()
  if (total <= 0) return 100
  const elapsed = today.getTime() - startDate.getTime()
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

/** @deprecated Step 6 で calcRealDaysDeviation に統一後削除 */
export function calcDaysDeviation(
  actualPct: number,
  scheduledPct: number,
  durationDays: number,
): number {
  if (durationDays === 0) return 0
  return ((actualPct - scheduledPct) / 100) * durationDays
}

/** @deprecated Step 6 で calcAggregateRenderStatus に統一後削除 */
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
// calcTaskActualPct / calcMilestoneActualPct が浮動小数を返すため、
// 「実質 0%」の判定に厳密な === 0 ではなくこの閾値を使用する
const NEAR_ZERO_PCT_THRESHOLD = 0.001

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

/**
 * ToDo 1件の描画ステータスを 5状態で返す。
 * 判定順序（上から優先）:
 * 1. completed=true → 'completed'
 * 2. today < startDate → 'scheduled'
 * 3. !started (かつ today >= startDate) → 'not-started-overdue'
 * 4. today > endDate → 'overdue-past-deadline'
 * 5. それ以外 (started=true, !completed, today in [startDate, endDate]) → 'delayed-pre-deadline'
 */
export function calcRenderStatus(
  todo: { started: boolean; completed: boolean; startDate: Date; endDate: Date },
  today: Date,
): RenderStatus {
  if (todo.completed) return 'completed'
  if (today < todo.startDate) return 'scheduled'
  if (!todo.started) return 'not-started-overdue'
  if (today > todo.endDate) return 'overdue-past-deadline'
  return 'delayed-pre-deadline'
}

/**
 * Task/Milestone の集約描画ステータスを 5状態で返す。
 * 判定順序（上から優先）:
 * 1. today < startDate → 'scheduled'
 * 2. actualPct=0, !anyChildStarted, today >= startDate → 'not-started-overdue'
 * 3. actualPct=100 → 'completed'
 * 4. today > endDate → 'overdue-past-deadline'
 * 5. actualPct >= scheduledPct → 'completed' (緑: 予定通り or 前倒し)
 * 6. それ以外 → 'delayed-pre-deadline'
 */
export function calcAggregateRenderStatus(
  parent: { startDate: Date; endDate: Date; actualPct: number },
  today: Date,
  anyChildStarted: boolean,
): RenderStatus {
  if (today < parent.startDate) return 'scheduled'
  if (parent.actualPct < NEAR_ZERO_PCT_THRESHOLD && !anyChildStarted) return 'not-started-overdue'
  if (parent.actualPct === 100) return 'completed'
  if (today > parent.endDate) return 'overdue-past-deadline'
  const scheduledPct = calcScheduledPct(parent.startDate, parent.endDate, today)
  // actualPct >= scheduledPct = 予定通り or 前倒し → GanttBar では緑 ('completed' を緑の意味で使用)
  if (parent.actualPct >= scheduledPct) return 'completed'
  return 'delayed-pre-deadline'
}

/**
 * 実日数ベースの偏差を返す。
 * - today > rowEnd のとき: (rowEnd - today) の実日数（負の値）
 * - それ以外: calcDaysDeviation と同じ計算
 * クランプなし。
 */
export function calcRealDaysDeviation(
  today: Date,
  rowEnd: Date,
  actualPct: number,
  scheduledPct: number,
  durationDays: number,
): number {
  if (today > rowEnd) {
    return (rowEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  }
  if (durationDays === 0) return 0
  return ((actualPct - scheduledPct) / 100) * durationDays
}
