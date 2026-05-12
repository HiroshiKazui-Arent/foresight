import type { TaskProgressData } from '@/components/tree-view/progress-utils'
import type { ProgressBarData } from '@/types/progress'

export type TodoWithProgress = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  weight: number
  completed: boolean
  progressData: ProgressBarData
}

export type TaskWithDetail = TaskProgressData & {
  id: string
  name: string
  milestoneId: string
}
