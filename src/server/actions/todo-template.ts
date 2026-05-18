'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { TodoTemplate } from '@prisma/client'

async function requireLogin(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('認証が必要です')
  return session.user.id
}

function validateName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 100) throw new Error('名前は 1〜100 文字で入力してください')
  return trimmed
}

function handlePrismaError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    throw new Error('指定されたテンプレートが見つかりません')
  }
  throw new Error('操作に失敗しました')
}

export async function getAllTodoTemplates(): Promise<TodoTemplate[]> {
  await requireLogin()
  return prisma.todoTemplate.findMany({ orderBy: { order: 'asc' } })
}

export async function createTodoTemplate(name: string): Promise<TodoTemplate> {
  await requireLogin()
  const validName = validateName(name)
  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.todoTemplate.findFirst({ orderBy: { order: 'desc' } })
    const order = (last?.order ?? 0) + 1
    return tx.todoTemplate.create({ data: { name: validName, order } })
  })
  revalidatePath('/todo-templates')
  return created
}

export async function updateTodoTemplate(id: string, name: string): Promise<TodoTemplate> {
  await requireLogin()
  const validName = validateName(name)
  try {
    const updated = await prisma.todoTemplate.update({ where: { id }, data: { name: validName } })
    revalidatePath('/todo-templates')
    return updated
  } catch (e) {
    handlePrismaError(e)
  }
}

export async function deleteTodoTemplate(id: string): Promise<void> {
  await requireLogin()
  try {
    await prisma.todoTemplate.delete({ where: { id } })
    revalidatePath('/todo-templates')
  } catch (e) {
    handlePrismaError(e)
  }
}

export async function moveTodoTemplate(id: string, direction: 'up' | 'down'): Promise<void> {
  await requireLogin()
  if (direction !== 'up' && direction !== 'down') throw new Error('不正なパラメータです')
  let swapped = false
  await prisma.$transaction(async (tx) => {
    const current = await tx.todoTemplate.findFirst({ where: { id } })
    if (!current) return

    const neighbor = await tx.todoTemplate.findFirst({
      where:
        direction === 'up' ? { order: { lt: current.order } } : { order: { gt: current.order } },
      orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
    })
    if (!neighbor) return

    await tx.todoTemplate.update({ where: { id: current.id }, data: { order: neighbor.order } })
    await tx.todoTemplate.update({ where: { id: neighbor.id }, data: { order: current.order } })
    swapped = true
  })
  if (swapped) revalidatePath('/todo-templates')
}
