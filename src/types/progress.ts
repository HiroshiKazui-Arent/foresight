export type ProgressStatus = 'completed' | 'on-track' | 'delayed' | 'warning' | 'scheduled'

export type RenderStatus =
  | 'scheduled'
  | 'completed'
  | 'ahead-of-schedule'
  | 'delayed-pre-deadline'
  | 'overdue-past-deadline'
  | 'not-started-overdue'

export type ProgressBarData = {
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  daysDeviation: number
}
