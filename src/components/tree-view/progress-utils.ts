import {
  calcScheduledPct,
  calcDaysDeviation,
  calcStatus,
  calcTaskActualPct,
  calcMilestoneActualPct,
  calcProjectActualPct,
} from '@/lib/progress'
import type { ProgressBarData } from '@/types/progress'

type TodoForCalc = {
  actualPct: number
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
}

export type MilestoneProgressData = ProgressBarData & {
  startDate: Date
  endDate: Date
  actualPct: number
}

export function buildTaskProgressData(task: TaskForCalc, today: Date): TaskProgressData {
  const actualPct = calcTaskActualPct(task.todos)
  const scheduledPct = calcScheduledPct(task.startDate, task.endDate, today)
  const status = calcStatus(actualPct, scheduledPct)
  const durationDays = (task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)
  const daysDeviation = calcDaysDeviation(actualPct, scheduledPct, durationDays)
  return {
    actualPct,
    scheduledPct,
    status,
    daysDeviation,
    startDate: task.startDate,
    endDate: task.endDate,
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
  return {
    actualPct,
    scheduledPct,
    status,
    daysDeviation,
    startDate: milestone.startDate,
    endDate: milestone.endDate,
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

  const startDate = milestones.reduce(
    (min, ms) => (ms.startDate < min ? ms.startDate : min),
    milestones[0].startDate,
  )
  const endDate = milestones.reduce(
    (max, ms) => (ms.endDate > max ? ms.endDate : max),
    milestones[0].endDate,
  )

  const scheduledPct = calcScheduledPct(startDate, endDate, today)
  const status = calcStatus(actualPct, scheduledPct)
  const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  const daysDeviation = calcDaysDeviation(actualPct, scheduledPct, durationDays)

  return { actualPct, scheduledPct, status, daysDeviation, startDate, endDate }
}
