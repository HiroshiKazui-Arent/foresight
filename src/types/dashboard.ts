import type { ProgressStatus } from './progress'

export type TodoForecast = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  daysDeviation: number
  completionDate: Date | null
  slipDays: number
  recommendation: string
}

export type TaskForecast = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  milestoneId: string
  milestoneName: string
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  daysDeviation: number
  completionDate: Date | null
  slipDays: number
  recommendation: string
  warningTodos: TodoForecast[]
}

export type MilestoneForecast = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  daysDeviation: number
  completionDate: Date | null
  slipDays: number
  warningTasks: TaskForecast[]
}

export type ProjectForecast = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  daysDeviation: number
  completionDate: Date | null
  slipDays: number
  warningMilestones: MilestoneForecast[]
  allClear: boolean
}
