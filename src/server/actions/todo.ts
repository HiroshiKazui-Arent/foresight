'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireProjectMember } from '@/lib/authz'
import type { Todo } from '@prisma/client'

function validateName(name: string) {
  if (!name.trim() || name.trim().length > 255)
    throw new Error('名前は1〜255文字で入力してください')
}

function validateDates(startDate: Date, endDate: Date) {
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
    throw new Error('有効な日付を入力してください')
  if (startDate.getTime() >= endDate.getTime())
    throw new Error('開始日は終了日より前にしてください')
}

export async function createTodo(
  taskId: string,
  projectId: string,
  name: string,
  startDate: Date,
  endDate: Date,
): Promise<Todo> {
  await requireProjectMember(projectId)
  validateName(name)
  validateDates(startDate, endDate)

  const todo = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id: taskId, milestone: { projectId } } })
    if (!task) notFound()

    const count = await tx.todo.count({ where: { taskId } })

    return tx.todo.create({
      data: {
        taskId,
        name: name.trim(),
        startDate,
        endDate,
        order: count,
      },
    })
  })

  revalidatePath('/projects/' + projectId, 'layout')
  return todo
}

export async function updateTodo(
  id: string,
  projectId: string,
  data: { name?: string; startDate?: Date; endDate?: Date },
): Promise<Todo> {
  await requireProjectMember(projectId)
  if (data.name !== undefined) validateName(data.name)

  const todo = await prisma.$transaction(async (tx) => {
    const existing = await tx.todo.findFirst({
      where: { id, task: { milestone: { projectId } } },
    })
    if (!existing) notFound()

    if (data.startDate !== undefined || data.endDate !== undefined) {
      validateDates(data.startDate ?? existing.startDate, data.endDate ?? existing.endDate)
    }

    // M-2: 許可フィールドのみ更新 (mass assignment 防止)
    return tx.todo.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
      },
    })
  })

  revalidatePath('/projects/' + projectId, 'layout')
  return todo
}

export async function deleteTodo(id: string, projectId: string): Promise<void> {
  await requireProjectMember(projectId)

  await prisma.$transaction(async (tx) => {
    const target = await tx.todo.findFirst({
      where: { id, task: { milestone: { projectId } } },
    })
    if (!target) notFound()

    await tx.todo.delete({ where: { id } })
  })

  revalidatePath('/projects/' + projectId, 'layout')
}
