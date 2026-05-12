'use server'

import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import type { Invitation, Project } from '@prisma/client'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function createInvitation(
  email: string,
  projectId?: string,
): Promise<{ token: string }> {
  if (!email || !emailRegex.test(email) || email.length > 254) {
    throw new Error('有効なメールアドレスを入力してください')
  }

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new Error('Unauthorized')

  // projectId 指定時はプロジェクトメンバーのみ招待可能 (IDOR 防止)
  if (projectId) {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    })
    if (!membership) throw new Error('Forbidden')
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { email, projectId: projectId ?? null, status: 'PENDING' },
        data: { status: 'REVOKED' },
      })
      await tx.invitation.create({
        data: { email, token, projectId: projectId ?? null, invitedById: userId, expiresAt },
      })
    })
  } catch (err) {
    console.error('createInvitation error:', err)
    throw new Error('招待の作成に失敗しました')
  }

  revalidatePath('/users')
  if (projectId) revalidatePath('/projects/' + projectId + '/settings')
  return { token }
}

export async function getInvitation(
  token: string,
): Promise<(Invitation & { project: Project | null }) | null> {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { project: true },
    })
    if (!invitation) return null
    if (invitation.status !== 'PENDING') return null
    if (invitation.expiresAt <= new Date()) return null
    return invitation
  } catch (err) {
    console.error('getInvitation error:', err)
    return null
  }
}

export async function acceptInvitation(
  token: string,
  name: string,
  password: string,
): Promise<{ success: true; email: string } | { error: string }> {
  // 入力バリデーション
  if (!name || name.trim().length === 0 || name.length > 100) {
    return { error: '氏名を正しく入力してください (1〜100文字)' }
  }
  if (!password || password.length < 8 || password.length > 72) {
    return { error: 'パスワードは8〜72文字で入力してください' }
  }

  try {
    const email = await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { token } })

      if (!invitation) throw new Error('NOT_FOUND')
      if (invitation.status !== 'PENDING') throw new Error('INVALID_STATUS')
      if (invitation.expiresAt <= new Date()) throw new Error('EXPIRED')

      const existingUser = await tx.user.findUnique({ where: { email: invitation.email } })

      if (existingUser) {
        if (invitation.projectId) {
          const existingMember = await tx.projectMember.findUnique({
            where: {
              projectId_userId: { projectId: invitation.projectId, userId: existingUser.id },
            },
          })
          if (!existingMember) {
            await tx.projectMember.create({
              data: { projectId: invitation.projectId, userId: existingUser.id },
            })
          }
        }
      } else {
        const passwordHash = await bcrypt.hash(password, 12)
        const newUser = await tx.user.create({
          data: { email: invitation.email, name, passwordHash },
        })
        if (invitation.projectId) {
          await tx.projectMember.create({
            data: { projectId: invitation.projectId, userId: newUser.id },
          })
        }
      }

      // アトミックに ACCEPTED へ遷移。count=0 は他リクエストが先に処理したケース
      const updated = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      })
      if (updated.count === 0) throw new Error('CONCURRENT_ACCEPT')

      return invitation.email
    })

    revalidatePath('/projects')
    return { success: true, email }
  } catch (err) {
    if (err instanceof Error) {
      switch (err.message) {
        case 'NOT_FOUND':
          return { error: '招待が見つかりません' }
        case 'INVALID_STATUS':
          return { error: 'この招待は無効です (REVOKED または ACCEPTED)' }
        case 'EXPIRED':
          return { error: '招待の有効期限が切れています' }
        case 'CONCURRENT_ACCEPT':
          return { error: 'この招待はすでに処理されています' }
      }
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { error: 'このユーザーはすでにプロジェクトのメンバーです' }
    }
    console.error('acceptInvitation error:', err)
    return { error: '招待の受諾中にエラーが発生しました' }
  }
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new Error('Unauthorized')

  let projectId: string | null = null

  try {
    // トランザクション内で認可チェックと更新をアトミックに実行 (TOCTOU 防止)
    await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { id: invitationId },
        select: { id: true, invitedById: true, projectId: true, status: true },
      })
      if (!invitation) return

      if (invitation.invitedById !== userId) {
        if (invitation.projectId) {
          const member = await tx.projectMember.findUnique({
            where: { projectId_userId: { projectId: invitation.projectId, userId } },
          })
          if (!member) throw new Error('Forbidden')
        } else {
          throw new Error('Forbidden')
        }
      }

      projectId = invitation.projectId

      await tx.invitation.updateMany({
        where: { id: invitationId, status: 'PENDING' },
        data: { status: 'REVOKED' },
      })
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'Forbidden') throw err
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return // PENDING でない (既に処理済み) — 冪等に扱う
    }
    console.error('revokeInvitation error:', err)
    throw new Error('招待の取り消しに失敗しました')
  }

  revalidatePath('/users')
  if (projectId) revalidatePath('/projects/' + projectId + '/settings')
}
