'use server'

import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireProjectMember } from '@/lib/authz'
import type { Milestone } from '@prisma/client'

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

export async function createMilestone(
  projectId: string,
  name: string,
  startDate: Date,
  endDate: Date,
): Promise<Milestone> {
  validateName(name)
  validateDates(startDate, endDate)
  await requireProjectMember(projectId)

  const count = await prisma.milestone.count({ where: { projectId } })

  const milestone = await prisma.milestone.create({
    data: { projectId, name: name.trim(), startDate, endDate, order: count },
  })

  revalidatePath('/projects/' + projectId)
  return milestone
}

export async function updateMilestone(
  id: string,
  projectId: string,
  data: { name?: string; startDate?: Date; endDate?: Date },
): Promise<Milestone> {
  if (data.name !== undefined) validateName(data.name)
  await requireProjectMember(projectId)

  const existing = await prisma.milestone.findFirst({ where: { id, projectId } })
  if (!existing) notFound()

  const milestone = await prisma.milestone.update({
    where: { id },
    data: { ...data, name: data.name?.trim() },
  })

  revalidatePath('/projects/' + projectId)
  return milestone
}

export async function deleteMilestone(id: string, projectId: string): Promise<void> {
  await requireProjectMember(projectId)

  const existing = await prisma.milestone.findFirst({ where: { id, projectId } })
  if (!existing) notFound()

  await prisma.milestone.delete({ where: { id } })

  revalidatePath('/projects/' + projectId)
}

export async function reorderMilestones(projectId: string, orderedIds: string[]): Promise<void> {
  if (orderedIds.length > 1000) throw new Error('too many items')
  await requireProjectMember(projectId)

  await prisma.$transaction(
    orderedIds.map((milestoneId, index) =>
      prisma.milestone.updateMany({
        where: { id: milestoneId, projectId },
        data: { order: index },
      }),
    ),
  )

  revalidatePath('/projects/' + projectId)
}
