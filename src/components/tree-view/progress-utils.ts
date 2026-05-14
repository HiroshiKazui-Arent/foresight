import {
  calcScheduledPct,
  calcDaysDeviation,
  calcStatus,
  calcTodoStatus,
  calcTaskActualPct,
  calcMilestoneActualPct,
  calcProjectActualPct,
  calcRenderStatus,
  calcAggregateRenderStatus,
} from '@/lib/progress'
import type { ProgressBarData, RenderStatus } from '@/types/progress'
import { calcProjectDateRange } from './project-date-range'

type TodoForProgressData = {
  completed: boolean
  started?: boolean // 省略時は false として扱う（後方互換）
  startDate: Date
  endDate: Date
}

export type TodoProgressData = ProgressBarData & {
  startDate: Date
  endDate: Date
  actualPct: number
  renderStatus: RenderStatus
}

/**
 * ToDo 1件の進捗データを算出する。
 * - actualPct: completed ? 100 : 0
 * - scheduledPct: calcScheduledPct(startDate, endDate, today)
 * - status: calcTodoStatus (M-01: ToDo レベルでは warning を持たない)
 * - daysDeviation: calcDaysDeviation(actualPct, scheduledPct, durationDays)
 */
export function buildTodoProgressData(todo: TodoForProgressData, today: Date): TodoProgressData {
  const actualPct = todo.completed ? 100 : 0
  const scheduledPct = calcScheduledPct(todo.startDate, todo.endDate, today)
  const status = calcTodoStatus(todo.completed, todo.startDate, todo.endDate, today)
  const durationDays = (todo.endDate.getTime() - todo.startDate.getTime()) / (1000 * 60 * 60 * 24)
  const daysDeviation = calcDaysDeviation(actualPct, scheduledPct, durationDays)
  const started = todo.started ?? false
  const renderStatus = calcRenderStatus(
    { started, completed: todo.completed, startDate: todo.startDate, endDate: todo.endDate },
    today,
  )
  return {
    actualPct,
    scheduledPct,
    status,
    daysDeviation,
    startDate: todo.startDate,
    endDate: todo.endDate,
    renderStatus,
  }
}

type TodoForCalc = {
  completed: boolean
  started?: boolean // 省略時は false として扱う（後方互換）
  weight: number
}

type TaskForCalc = {
  startDate: Date
  endDate: Date
  todos: TodoForCalc[]
}

type MilestoneForCalc = {
  startDate: Date
  endDate: Date
  tasks: TaskForCalc[]
}

export type TaskProgressData = ProgressBarData & {
  startDate: Date
  endDate: Date
  actualPct: number
  renderStatus: RenderStatus
}

export type MilestoneProgressData = ProgressBarData & {
  startDate: Date
  endDate: Date
  actualPct: number
  renderStatus: RenderStatus
}

export function buildTaskProgressData(task: TaskForCalc, today: Date): TaskProgressData {
  const actualPct = calcTaskActualPct(task.todos)
  const scheduledPct = calcScheduledPct(task.startDate, task.endDate, today)
  const status = calcStatus(actualPct, scheduledPct)
  const durationDays = (task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)
  const daysDeviation = calcDaysDeviation(actualPct, scheduledPct, durationDays)
  const anyChildStarted = task.todos.some((t) => t.started ?? false)
  const renderStatus = calcAggregateRenderStatus(
    { startDate: task.startDate, endDate: task.endDate, actualPct },
    today,
    anyChildStarted,
  )
  return {
    actualPct,
    scheduledPct,
    status,
    daysDeviation,
    startDate: task.startDate,
    endDate: task.endDate,
    renderStatus,
  }
}

export function buildMilestoneProgressData(
  milestone: MilestoneForCalc,
  today: Date,
): MilestoneProgressData {
  const taskData = milestone.tasks.map((task) => {
    const actualPct = calcTaskActualPct(task.todos)
    return { actualPct, startDate: task.startDate, endDate: task.endDate }
  })
  const actualPct = calcMilestoneActualPct(taskData)
  const scheduledPct = calcScheduledPct(milestone.startDate, milestone.endDate, today)
  const status = calcStatus(actualPct, scheduledPct)
  const durationDays =
    (milestone.endDate.getTime() - milestone.startDate.getTime()) / (1000 * 60 * 60 * 24)
  const daysDeviation = calcDaysDeviation(actualPct, scheduledPct, durationDays)
  const anyChildStarted = milestone.tasks.some((t) => t.todos.some((td) => td.started ?? false))
  const renderStatus = calcAggregateRenderStatus(
    { startDate: milestone.startDate, endDate: milestone.endDate, actualPct },
    today,
    anyChildStarted,
  )
  return {
    actualPct,
    scheduledPct,
    status,
    daysDeviation,
    startDate: milestone.startDate,
    endDate: milestone.endDate,
    renderStatus,
  }
}

export function buildProjectProgressData(
  milestones: MilestoneForCalc[],
  today: Date,
): ProgressBarData & { startDate?: Date; endDate?: Date } {
  if (milestones.length === 0) {
    return { actualPct: 0, scheduledPct: 0, status: 'scheduled', daysDeviation: 0 }
  }

  const milestoneData = milestones.map((ms) => {
    const taskData = ms.tasks.map((task) => ({
      actualPct: calcTaskActualPct(task.todos),
      startDate: task.startDate,
      endDate: task.endDate,
    }))
    return {
      actualPct: calcMilestoneActualPct(taskData),
      startDate: ms.startDate,
      endDate: ms.endDate,
    }
  })

  const actualPct = calcProjectActualPct(milestoneData)

  // calcProjectDateRange が単一の情報源: project-date-range.ts と同じロジックを持たない
  const { start: startDate, end: endDate } = calcProjectDateRange(
    milestones,
    milestones[0].startDate,
    milestones[0].endDate,
  )

  const scheduledPct = calcScheduledPct(startDate, endDate, today)
  const status = calcStatus(actualPct, scheduledPct)
  const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  const daysDeviation = calcDaysDeviation(actualPct, scheduledPct, durationDays)

  return { actualPct, scheduledPct, status, daysDeviation, startDate, endDate }
}
