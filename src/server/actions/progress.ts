'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireProjectMember } from '@/lib/authz'
import type { Todo } from '@prisma/client'

interface ActualDates {
  actualStartDate: Date | null
  actualEndDate: Date | null
}

function validateActualDates(data: ActualDates) {
  // 完了日があるなら着手日も必須 (進捗ロジック: 完了=100% は着手済み前提)
  if (data.actualEndDate !== null && data.actualStartDate === null) {
    throw new Error('完了日を入力する場合は着手日も入力してください')
  }
  if (data.actualStartDate !== null && isNaN(data.actualStartDate.getTime())) {
    throw new Error('有効な日付を入力してください (着手日)')
  }
  if (data.actualEndDate !== null && isNaN(data.actualEndDate.getTime())) {
    throw new Error('有効な日付を入力してください (完了日)')
  }
  // 着手日 <= 完了日 (同日は許容: 当日着手・当日完了)
  if (
    data.actualStartDate !== null &&
    data.actualEndDate !== null &&
    data.actualStartDate.getTime() > data.actualEndDate.getTime()
  ) {
    throw new Error('着手日は完了日より前 (または同日) にしてください')
  }
}

function isNextNavigationError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('digest' in e)) return false
  const digest = (e as { digest?: unknown }).digest
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')
  )
}

/**
 * G3 進捗入力画面から ToDo の着手日 / 完了日を更新する。
 *
 * - 認可: requireProjectMember (project member のみ)
 * - IDOR 防止 + TOCTOU 防止: updateMany を projectId スコープ付きで実行 → 単一 atomic 更新
 * - mass-assignment 防止: actualStartDate / actualEndDate のみ書き換え可能
 * - 情報漏洩防止: Prisma 内部エラーは generic メッセージにサニタイズしてクライアントに返す
 */
export async function updateTodoActualDates(
  todoId: string,
  projectId: string,
  data: ActualDates,
): Promise<Todo> {
  await requireProjectMember(projectId)
  validateActualDates(data)

  let todo: Todo
  try {
    // updateMany は relation 条件をサポート: { id: todoId, task: { milestone: { projectId } } }
    // → 別プロジェクトの ToDo は更新されない (TOCTOU 窓も無い)
    const result = await prisma.todo.updateMany({
      where: { id: todoId, task: { milestone: { projectId } } },
      data: {
        actualStartDate: data.actualStartDate,
        actualEndDate: data.actualEndDate,
      },
    })
    if (result.count === 0) notFound()

    todo = await prisma.todo.findUniqueOrThrow({ where: { id: todoId } })
  } catch (e) {
    // Next.js の特殊 throw (notFound/redirect) はそのまま伝播させる
    if (isNextNavigationError(e)) throw e
    // Prisma の内部詳細はクライアントに漏らさない
    if (
      e instanceof Prisma.PrismaClientKnownRequestError ||
      e instanceof Prisma.PrismaClientUnknownRequestError ||
      e instanceof Prisma.PrismaClientValidationError
    ) {
      console.error('[updateTodoActualDates] DB error:', e)
      throw new Error('データベースエラーが発生しました')
    }
    throw e
  }

  revalidatePath('/projects/' + projectId, 'layout')
  return todo
}
