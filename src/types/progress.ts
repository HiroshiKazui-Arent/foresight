export type ProgressStatus = 'completed' | 'on-track' | 'delayed' | 'warning' | 'scheduled'

export type ProgressBarData = {
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  daysDeviation: number
}
