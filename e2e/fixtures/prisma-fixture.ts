import { PrismaClient, InvitationStatus } from '@prisma/client'

const prisma = new PrismaClient()

export async function getAdminUserId(): Promise<string> {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } })
  if (!admin) throw new Error('admin@example.com が見つかりません。db:seed を実行してください。')
  return admin.id
}

export async function createTestInvitation(overrides: {
  email: string
  projectId?: string | null
  status?: InvitationStatus
  expiresAt?: Date
}) {
  const invitedById = await getAdminUserId()
  return prisma.invitation.create({
    data: {
      email: overrides.email,
      token: `e2e-test-token-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      projectId: overrides.projectId ?? null,
      status: overrides.status ?? InvitationStatus.PENDING,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedById,
    },
  })
}

export async function deleteTestInvitation(id: string) {
  try {
    await prisma.invitation.delete({ where: { id } })
  } catch {
    // 既に削除済みの場合は無視
  }
}

export async function deleteTestUser(email: string) {
  try {
    await prisma.user.delete({ where: { email } })
  } catch {
    // 存在しない場合は無視
  }
}

export { prisma }
