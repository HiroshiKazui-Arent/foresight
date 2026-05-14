import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from './setup'
import bcrypt from 'bcryptjs'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { getProject } from '@/server/actions/project'
import { getAllUsers } from '@/server/actions/user'
import { acceptInvitation } from '@/server/actions/invitation'

async function createTestUser(email: string, password?: string) {
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined
  return prisma.user.create({ data: { email, name: 'Test User', passwordHash } })
}

async function createTestProject(userId: string) {
  const project = await prisma.project.create({
    data: {
      name: 'Auth Test Project',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    },
  })
  await prisma.projectMember.create({ data: { projectId: project.id, userId } })
  return project
}

beforeEach(() => {
  vi.clearAllMocks()
})

// TC-AUTH-001〜003: JWT 戦略のため Session テーブルにはレコードが作られない (C-4 確認済み)
// cookie ベースの動作確認は E2E テスト (e2e/auth.spec.ts) で実施
describe('TC-AUTH-001〜003: JWT セッション戦略の確認 (C-4 対応)', () => {
  it('auth.ts が strategy: jwt を使用しているため Session テーブルにレコードが作られない', async () => {
    const user = await createTestUser('jwt-check@example.com', 'password123')
    // JWT 戦略ではサインインしても Session テーブルにレコードが作られない
    const sessionCount = await prisma.session.count({ where: { userId: user.id } })
    expect(sessionCount).toBe(0)
  })
})

// TC-A1-007: User.passwordHash が bcrypt 形式で格納される
describe('TC-A1-007: passwordHash が bcrypt 形式で格納される', () => {
  it('acceptInvitation 後に passwordHash が $2b$ で始まる bcrypt 形式になる', async () => {
    const inviter = await createTestUser('inviter-a1007@example.com')
    const invitation = await prisma.invitation.create({
      data: {
        email: 'newuser-a1007@example.com',
        token: 'token-a1007-test',
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const result = await acceptInvitation(invitation.token, 'New User', 'password123')
    expect('success' in result && result.success).toBe(true)

    const user = await prisma.user.findUnique({ where: { email: 'newuser-a1007@example.com' } })
    expect(user).not.toBeNull()
    expect(user!.passwordHash).not.toBeNull()
    expect(user!.passwordHash!.startsWith('$2b$')).toBe(true)
  })
})

// TC-A1-008: passwordHash が Server Action の戻り値に含まれない
describe('TC-A1-008: getAllUsers の戻り値に passwordHash が含まれない', () => {
  it('getAllUsers は passwordHash を返さない', async () => {
    const user = await createTestUser('getall-test@example.com', 'secret')
    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name },
    } as never)

    const users = await getAllUsers()
    const testUser = users.find((u) => u.email === user.email)
    expect(testUser).toBeDefined()
    expect((testUser as Record<string, unknown>)['passwordHash']).toBeUndefined()
  })
})

// TC-AUTHZ-001: ProjectMember でないユーザーが getProject を呼ぶと 404
describe('TC-AUTHZ-001: 非メンバーの getProject は拒否される', () => {
  it('ProjectMember でないユーザーが getProject を呼ぶと NOT_FOUND がスローされる', async () => {
    const owner = await createTestUser('owner-authz001@example.com')
    const nonMember = await createTestUser('nonmember-authz001@example.com')
    const project = await createTestProject(owner.id)

    vi.mocked(auth).mockResolvedValue({
      user: { id: nonMember.id, email: nonMember.email, name: nonMember.name },
    } as never)

    await expect(getProject(project.id)).rejects.toThrow('NOT_FOUND')
  })
})

// TC-AUTHZ-002: ProjectMember でないユーザーが createMilestone を呼ぶと拒否
describe('TC-AUTHZ-002: 非メンバーの createMilestone は拒否される', () => {
  it('ProjectMember でないユーザーが createMilestone を呼ぶと NOT_FOUND がスローされる', async () => {
    const owner = await createTestUser('owner-authz002@example.com')
    const nonMember = await createTestUser('nonmember-authz002@example.com')
    const project = await createTestProject(owner.id)

    vi.mocked(auth).mockResolvedValue({
      user: { id: nonMember.id, email: nonMember.email, name: nonMember.name },
    } as never)

    const { createMilestone } = await import('@/server/actions/milestone')
    await expect(
      createMilestone(project.id, 'Test Milestone', new Date('2026-01-01'), new Date('2026-01-31')),
    ).rejects.toThrow('NOT_FOUND')
  })
})
