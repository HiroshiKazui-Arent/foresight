import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProject } from '@/server/actions/project'
import {
  buildTaskProgressData,
  buildMilestoneProgressData,
} from '@/components/tree-view/progress-utils'
import { calcScheduledPct, calcTodoStatus, calcDaysDeviation } from '@/lib/progress'
import { TimelineView } from '@/components/timeline-view/timeline-view'
import type { TimelineTask, TimelineTodo, TimelineMilestone } from '@/types/timeline'

export default async function MilestonePage({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>
}) {
  const { id, milestoneId } = await params
  const project = await getProject(id)

  const milestone = project.milestones.find((m) => m.id === milestoneId)
  if (!milestone) notFound()

  const today = new Date()

  // Milestone の進捗データ
  const milestoneProgressData = buildMilestoneProgressData(milestone, today)

  const timelineMilestone: TimelineMilestone = {
    id: milestone.id,
    name: milestone.name,
    startDate: milestone.startDate,
    endDate: milestone.endDate,
    progressData: milestoneProgressData,
  }

  // Task ごとの進捗データ
  const tasks: TimelineTask[] = milestone.tasks.map((task) => {
    const taskProgressData = buildTaskProgressData(task, today)

    const todos: TimelineTodo[] = task.todos.map((todo) => {
      const todoActualPct = todo.completed ? 100 : 0
      const scheduledPct = calcScheduledPct(todo.startDate, todo.endDate, today)
      const status = calcTodoStatus(todo.completed, todo.startDate, todo.endDate, today)
      const todoDurationDays =
        (todo.endDate.getTime() - todo.startDate.getTime()) / (1000 * 60 * 60 * 24)
      const daysDeviation = calcDaysDeviation(todoActualPct, scheduledPct, todoDurationDays)
      return {
        id: todo.id,
        name: todo.name,
        startDate: todo.startDate,
        endDate: todo.endDate,
        completed: todo.completed,
        progressData: {
          actualPct: todoActualPct,
          scheduledPct,
          status,
          daysDeviation,
        },
      }
    })

    return {
      id: task.id,
      name: task.name,
      todos,
      ...taskProgressData,
    }
  })

  return (
    <div>
      {/* パンくずリスト */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/projects/${id}`} className="hover:text-gray-700">
          ← {project.name}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-800">{milestone.name}</span>
      </div>

      <TimelineView milestone={timelineMilestone} tasks={tasks} projectId={id} today={today} />
    </div>
  )
}
