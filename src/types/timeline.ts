import type { TaskProgressData } from '@/components/tree-view/progress-utils'
import type { ProgressBarData } from '@/types/progress'

export type TimelineTodo = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  actualPct: number
  completed: boolean
  progressData: ProgressBarData
}

export type TimelineTask = TaskProgressData & {
  id: string
  name: string
  todos: TimelineTodo[]
}

export type TimelineMilestone = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  progressData: ProgressBarData
}
