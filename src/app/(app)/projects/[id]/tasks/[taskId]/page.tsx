import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProject } from '@/server/actions/project'
import { buildTaskProgressData } from '@/components/tree-view/progress-utils'
import { calcScheduledPct, calcStatus, calcDaysDeviation } from '@/lib/progress'
import { TaskDetailView } from '@/components/task-detail/task-detail-view'
import type { TaskWithDetail, TodoWithProgress } from '@/types/task-detail'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>
}) {
  const { id, taskId } = await params
  // getProject が requireProjectMember を内部で呼ぶため二重呼び出し不要
  const project = await getProject(id)

  const today = new Date()

  // taskId に一致する Task を全マイルストーンから検索
  let foundTask: NonNullable<(typeof project.milestones)[number]['tasks'][number]> | undefined
  let parentMilestone: (typeof project.milestones)[number] | undefined

  for (const ms of project.milestones) {
    const t = ms.tasks.find((task) => task.id === taskId)
    if (t) {
      foundTask = t
      parentMilestone = ms
      break
    }
  }

  if (!foundTask || !parentMilestone) notFound()

  const task = foundTask
  const milestone = parentMilestone

  // Task 進捗計算
  const taskProgress = buildTaskProgressData(task, today)

  const taskWithDetail: TaskWithDetail = {
    ...taskProgress,
    id: task.id,
    name: task.name,
    milestoneId: milestone.id,
  }

  // 各 ToDo の進捗計算
  const todosWithProgress: TodoWithProgress[] = task.todos.map((todo) => {
    const todoDurationDays =
      (todo.endDate.getTime() - todo.startDate.getTime()) / (1000 * 60 * 60 * 24)
    const scheduledPct = calcScheduledPct(todo.startDate, todo.endDate, today)
    const status = calcStatus(todo.actualPct, scheduledPct)
    const daysDeviation = calcDaysDeviation(todo.actualPct, scheduledPct, todoDurationDays)

    return {
      id: todo.id,
      name: todo.name,
      startDate: todo.startDate,
      endDate: todo.endDate,
      weight: todo.weight,
      actualPct: todo.actualPct,
      completed: todo.completed,
      progressData: {
        actualPct: todo.actualPct,
        scheduledPct,
        status,
        daysDeviation,
      },
    }
  })

  return (
    <div>
      {/* パンくずリスト */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/projects/${id}`} className="hover:text-gray-700">
          {project.name}
        </Link>
        <span>/</span>
        <Link href={`/projects/${id}/milestones/${milestone.id}`} className="hover:text-gray-700">
          {milestone.name}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-800">{task.name}</span>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Link href={`/projects/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← プロジェクトに戻る
        </Link>
        <h1 className="text-2xl font-bold">{task.name}</h1>
      </div>

      <TaskDetailView
        task={taskWithDetail}
        todos={todosWithProgress}
        projectId={id}
        today={today}
      />
    </div>
  )
}
