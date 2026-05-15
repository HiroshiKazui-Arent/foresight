'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireProjectMember } from '@/lib/authz'
import type { Task } from '@prisma/client'

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

export async function createTask(
  milestoneId: string,
  projectId: string,
  name: string,
  startDate: Date,
  endDate: Date,
): Promise<Task> {
  await requireProjectMember(projectId)
  validateName(name)
  validateDates(startDate, endDate)

  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } })
  if (!milestone) notFound()

  // Task 作成と TodoTemplate からの ToDo 一括展開を単一トランザクションで実行(M-02)
  const task = await prisma.$transaction(async (tx) => {
    const count = await tx.task.count({ where: { milestoneId } })
    const created = await tx.task.create({
      data: { milestoneId, name: name.trim(), startDate, endDate, order: count },
    })

    const templates = await tx.todoTemplate.findMany({ orderBy: { order: 'asc' } })
    if (templates.length > 0) {
      await tx.todo.createMany({
        data: templates.map((tpl, i) => ({
          taskId: created.id,
          name: tpl.name,
          startDate: created.startDate,
          endDate: created.endDate,
          order: i,
        })),
      })
    }

    return created
  })

  revalidatePath('/projects/' + projectId, 'layout')
  return task
}

export async function updateTask(
  id: string,
  projectId: string,
  data: { name?: string; startDate?: Date; endDate?: Date; assigneeId?: string | null },
): Promise<Task> {
  await requireProjectMember(projectId)
  if (data.name !== undefined) validateName(data.name)

  const existing = await prisma.task.findFirst({ where: { id, milestone: { projectId } } })
  if (!existing) notFound()

  if (data.assigneeId) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: data.assigneeId } },
    })
    if (!member) throw new Error('Forbidden')
  }

  const task = await prisma.task.update({
    where: { id },
    data: { ...data, name: data.name?.trim() },
  })

  revalidatePath('/projects/' + projectId, 'layout')
  return task
}

export async function deleteTask(id: string, projectId: string): Promise<void> {
  await requireProjectMember(projectId)

  const existing = await prisma.task.findFirst({ where: { id, milestone: { projectId } } })
  if (!existing) notFound()

  await prisma.task.delete({ where: { id } })

  revalidatePath('/projects/' + projectId, 'layout')
}

export async function reorderTasks(
  milestoneId: string,
  projectId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length > 1000) throw new Error('too many items')
  await requireProjectMember(projectId)

  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } })
  if (!milestone) notFound()

  await prisma.$transaction(
    orderedIds.map((taskId, index) =>
      prisma.task.updateMany({
        where: { id: taskId, milestoneId },
        data: { order: index },
      }),
    ),
  )

  revalidatePath('/projects/' + projectId, 'layout')
}
