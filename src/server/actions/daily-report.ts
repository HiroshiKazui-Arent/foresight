'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireProjectMember } from '@/lib/authz'

// CUID v1/v2 の簡易パターン — 入力検証用 (path traversal 防止)
const CUID_RE = /^c[a-z0-9]{20,}$/i

export async function submitDailyReport(
  todoId: string,
  projectId: string,
  input: { started: boolean; completed: boolean },
  comment?: string,
): Promise<void> {
  if (!todoId?.trim() || !projectId?.trim()) throw new Error('不正なリクエストです')
  // M-1: CUID パターン検証で path traversal を防止 (requireProjectMember に到達する前に弾く)
  if (!CUID_RE.test(todoId) || !CUID_RE.test(projectId)) throw new Error('不正なリクエストです')
  // H-1: Server Action 境界でランタイム型ガード (TypeScript 型は実行時に消える)
  if (typeof input.started !== 'boolean' || typeof input.completed !== 'boolean')
    throw new Error('不正なリクエストです')
  if (comment !== undefined && comment.length > 1000)
    throw new Error('コメントは1000文字以内にしてください')
  // DB CHECK と二重防御: completed=true は started=true が必須
  if (input.completed && !input.started) throw new Error('完了するには先に開始してください')

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
        completed: input.completed,
        comment,
      },
    })

    await tx.todo.update({
      where: { id: todoId },
      data: {
        started: input.started,
        completed: input.completed,
        // startedAt = COALESCE(startedAt, now()): 初回 start 時のみセット
        // un-start 後も startedAt は保持する (spec M-03: 最初の開始候補として残す)
        ...(input.started && !todo.startedAt ? { startedAt: now } : {}),
        // completedAt = COALESCE(completedAt, now()): 初回完了時刻のみセット
        // un-complete 後も completedAt は保持する (spec M-03: startedAt と対称の設計)
        // 完了の詳細履歴は DailyReport 追記レコードで追跡する
        ...(input.completed && !todo.completedAt ? { completedAt: now } : {}),
      },
    })
  })

  revalidatePath('/projects/' + projectId)
  revalidatePath('/projects/' + projectId + '/daily')
}
