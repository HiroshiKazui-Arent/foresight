import type { ProgressStatus } from './progress'

// ToDo 単独の予測は二値(completed)ベースに簡素化。
// status は date-based: completed=true → 'completed', 期日超過かつ未完了 → 'delayed', その他は warningTodos に含めない
export type TodoForecast = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  completed: boolean
  status: ProgressStatus
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
