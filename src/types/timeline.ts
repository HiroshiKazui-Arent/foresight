import type { TaskProgressData } from '@/components/tree-view/progress-utils'
import type { ProgressBarData, RenderStatus } from '@/types/progress'

export type TimelineTodo = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  completed: boolean
  progressData: ProgressBarData & { renderStatus: RenderStatus }
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
  progressData: ProgressBarData & { renderStatus: RenderStatus }
}
