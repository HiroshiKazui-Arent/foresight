'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireProjectMember } from '@/lib/authz'

export async function submitDailyReport(
  todoId: string,
  projectId: string,
  actualPct: number,
  completed: boolean,
  comment?: string,
): Promise<void> {
  if (!todoId?.trim() || !projectId?.trim()) throw new Error('不正なリクエストです')
  if (!Number.isFinite(actualPct)) throw new Error('進捗率が不正です')
  if (comment !== undefined && comment.length > 1000)
    throw new Error('コメントは1000文字以内にしてください')

  const resolvedPct = completed ? 100 : Math.max(0, Math.min(100, Math.round(actualPct)))

  const userId = await requireProjectMember(projectId)

  // サーバー側で日付を確定 — クライアント供給値は使わない
  const now = new Date()
  const reportDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // IDOR チェックをトランザクション内で実施 (TOCTOU 防止)
  await prisma.$transaction(async (tx) => {
    const todo = await tx.todo.findFirst({
      where: { id: todoId, task: { milestone: { projectId } } },
    })
    if (!todo) throw new Error('権限がありません')

    await tx.dailyReport.create({
      data: {
        todoId,
        reportedBy: userId,
        date: reportDate,
        actualPct: resolvedPct,
        completed,
        comment,
      },
    })
    await tx.todo.update({
      where: { id: todoId },
      data: { actualPct: resolvedPct, completed },
    })
  })

  revalidatePath('/projects/' + projectId)
  revalidatePath('/projects/' + projectId + '/daily')
}
