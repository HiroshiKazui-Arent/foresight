'use server'

import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireProjectMember } from '@/lib/authz'
import type { Project } from '@prisma/client'

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

export async function getUserProjects() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  return prisma.project.findMany({
    where: {
      members: { some: { userId } },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      milestones: {
        include: {
          tasks: {
            include: { todos: true },
          },
        },
      },
    },
  })
}

export async function getProject(id: string) {
  await requireProjectMember(id)

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      milestones: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            orderBy: { order: 'asc' },
            include: {
              todos: { orderBy: { order: 'asc' } },
            },
          },
        },
      },
    },
  })

  if (!project) notFound()
  return project
}

export async function createProject(
  name: string,
  startDate: Date,
  endDate: Date,
): Promise<Project> {
  validateName(name)
  validateDates(startDate, endDate)
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: { name, startDate, endDate },
    })
    await tx.projectMember.create({
      data: { projectId: created.id, userId },
    })
    return created
  })

  revalidatePath('/projects')
  return project
}

export async function updateProject(
  id: string,
  data: { name?: string; startDate?: Date; endDate?: Date },
): Promise<Project> {
  if (data.name !== undefined) validateName(data.name)
  await requireProjectMember(id)

  if (data.startDate !== undefined || data.endDate !== undefined) {
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { startDate: true, endDate: true },
    })
    if (!existing) notFound()
    validateDates(data.startDate ?? existing.startDate, data.endDate ?? existing.endDate)
  }

  const project = await prisma.project.update({
    where: { id },
    data,
  })

  revalidatePath('/projects')
  revalidatePath('/projects/' + id)
  revalidatePath('/projects/' + id + '/settings')
  return project
}

export async function deleteProject(id: string): Promise<void> {
  await requireProjectMember(id)

  await prisma.project.delete({ where: { id } })

  revalidatePath('/projects')
  revalidatePath('/projects/' + id)
}
