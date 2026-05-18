import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireProjectMember } from '@/lib/authz'
import { calcScheduledPct } from '@/lib/progress'
import { ProgressClient } from './progress-client'

export default async function ProgressInputPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>
}) {
  const { id: projectId, taskId } = await params
  await requireProjectMember(projectId)

  // IDOR 防止: 該当 Task が当該 Project に属することを scoped クエリで確認
  const task = await prisma.task.findFirst({
    where: { id: taskId, milestone: { projectId } },
    include: {
      todos: { orderBy: { order: 'asc' } },
    },
  })
  if (!task) notFound()

  // today は UTC midnight で正規化 (Prisma の DateTime は UTC 保存のため整合)
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const scheduledPct = calcScheduledPct(task.startDate, task.endDate, today)

  return (
    <ProgressClient
      projectId={projectId}
      taskName={task.name}
      scheduledPct={scheduledPct}
      todos={task.todos.map((t) => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        actualStartDate: t.actualStartDate,
        actualEndDate: t.actualEndDate,
      }))}
    />
  )
}
