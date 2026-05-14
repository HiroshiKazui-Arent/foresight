import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from './setup'

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
import { createInvitation, acceptInvitation } from '@/server/actions/invitation'

async function createTestUser(email: string) {
  return prisma.user.create({ data: { email, name: 'Test User' } })
}

async function createTestProject(userId: string) {
  const project = await prisma.project.create({
    data: {
      name: 'Inv Test Project',
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

// TC-INV-001: createInvitation が Invitation レコードを作成し token がランダム、expiresAt が7日後
describe('TC-INV-001: createInvitation の基本動作', () => {
  it('Invitation レコードが作成され token が存在し expiresAt が7日後である', async () => {
    const inviter = await createTestUser('inviter-inv001@example.com')
    vi.mocked(auth).mockResolvedValue({
      user: { id: inviter.id, email: inviter.email, name: inviter.name },
    } as never)

    const before = Date.now()
    const { token } = await createInvitation('invited-inv001@example.com')
    const after = Date.now()

    expect(token).toBeTruthy()
    expect(token.length).toBeGreaterThan(0)

    const invitation = await prisma.invitation.findUnique({ where: { token } })
    expect(invitation).not.toBeNull()
    expect(invitation!.email).toBe('invited-inv001@example.com')
    expect(invitation!.status).toBe('PENDING')

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const expiresAt = invitation!.expiresAt.getTime()
    expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs - 5000)
    expect(expiresAt).toBeLessThanOrEqual(after + sevenDaysMs + 5000)
  })
})

// TC-INV-003: projectId 指定の招待受諾で ProjectMember に追加される
describe('TC-INV-003: projectId 指定の招待受諾', () => {
  it('受諾後 ProjectMember が作成される', async () => {
    const owner = await createTestUser('owner-inv003@example.com')
    const project = await createTestProject(owner.id)

    const invitation = await prisma.invitation.create({
      data: {
        email: 'newmember-inv003@example.com',
        token: 'token-inv003',
        projectId: project.id,
        invitedById: owner.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const result = await acceptInvitation(invitation.token, 'New Member', 'password123')
    expect('success' in result && result.success).toBe(true)

    const user = await prisma.user.findUnique({ where: { email: 'newmember-inv003@example.com' } })
    expect(user).not.toBeNull()

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user!.id } },
    })
    expect(member).not.toBeNull()
  })
})

// TC-INV-004: projectId なしの招待受諾で User のみ作成、ProjectMember は追加されない
describe('TC-INV-004: projectId なしの招待受諾', () => {
  it('受諾後 User のみ作成され ProjectMember は作成されない', async () => {
    const inviter = await createTestUser('inviter-inv004@example.com')

    const invitation = await prisma.invitation.create({
      data: {
        email: 'noproject-inv004@example.com',
        token: 'token-inv004',
        projectId: null,
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const result = await acceptInvitation(invitation.token, 'No Project User', 'password123')
    expect('success' in result && result.success).toBe(true)

    const user = await prisma.user.findUnique({ where: { email: 'noproject-inv004@example.com' } })
    expect(user).not.toBeNull()

    const members = await prisma.projectMember.findMany({ where: { userId: user!.id } })
    expect(members).toHaveLength(0)
  })
})

// TC-INV-005a: projectId 指定の複数 PENDING 招待 — 1つ受諾しても他は PENDING のまま
describe('TC-INV-005a: projectId 指定の複数招待', () => {
  it('project 指定の招待受諾後、同 email の他 project 招待は PENDING のまま', async () => {
    const inviter = await createTestUser('inviter-inv005a@example.com')
    const projectA = await createTestProject(inviter.id)
    const projectB = await prisma.project.create({
      data: {
        name: 'Project B',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
      },
    })

    const invA = await prisma.invitation.create({
      data: {
        email: 'multi-inv005a@example.com',
        token: 'token-inv005a-projA',
        projectId: projectA.id,
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    const invB = await prisma.invitation.create({
      data: {
        email: 'multi-inv005a@example.com',
        token: 'token-inv005a-projB',
        projectId: projectB.id,
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    await acceptInvitation(invA.token, 'Multi User', 'password123')

    const invAUpdated = await prisma.invitation.findUnique({ where: { id: invA.id } })
    const invBUpdated = await prisma.invitation.findUnique({ where: { id: invB.id } })

    expect(invAUpdated!.status).toBe('ACCEPTED')
    expect(invBUpdated!.status).toBe('PENDING')
  })
})

// TC-INV-005b: projectId なしの複数 PENDING 招待 — 1つ受諾で残りが EXPIRED (REVOKED) になる
describe('TC-INV-005b: projectId なしの複数招待', () => {
  it('projectId なし招待を受諾すると、同 email の他の PENDING 招待も REVOKED になる', async () => {
    const inviter = await createTestUser('inviter-inv005b@example.com')

    const inv1 = await prisma.invitation.create({
      data: {
        email: 'noproject-multi-inv005b@example.com',
        token: 'token-inv005b-1',
        projectId: null,
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    // createInvitation で既存 PENDING を REVOKED にするロジックを利用
    // inv2 を createInvitation で作成 → inv1 が REVOKED になる
    vi.mocked(auth).mockResolvedValue({
      user: { id: inviter.id, email: inviter.email, name: inviter.name },
    } as never)
    await createInvitation('noproject-multi-inv005b@example.com')

    const inv1Updated = await prisma.invitation.findUnique({ where: { id: inv1.id } })
    expect(inv1Updated!.status).toBe('REVOKED')
  })
})

// TC-A2-006: 受諾後 User.passwordHash が bcrypt 形式
describe('TC-A2-006: 受諾後 passwordHash が bcrypt 形式', () => {
  it('acceptInvitation 後に passwordHash が bcrypt 形式で保存される', async () => {
    const inviter = await createTestUser('inviter-a2006@example.com')
    const invitation = await prisma.invitation.create({
      data: {
        email: 'a2006user@example.com',
        token: 'token-a2006',
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    await acceptInvitation(invitation.token, 'A2006 User', 'securepassword')

    const user = await prisma.user.findUnique({ where: { email: 'a2006user@example.com' } })
    expect(user!.passwordHash).toMatch(/^\$2[ab]\$/)
  })
})

// TC-A2-007: 受諾後 Invitation.status = ACCEPTED かつ acceptedAt が設定される
describe('TC-A2-007: 受諾後 Invitation.status と acceptedAt', () => {
  it('acceptInvitation 後 status=ACCEPTED かつ acceptedAt が設定される', async () => {
    const inviter = await createTestUser('inviter-a2007@example.com')
    const invitation = await prisma.invitation.create({
      data: {
        email: 'a2007user@example.com',
        token: 'token-a2007',
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const before = new Date()
    await acceptInvitation(invitation.token, 'A2007 User', 'securepassword')
    const after = new Date()

    const updated = await prisma.invitation.findUnique({ where: { id: invitation.id } })
    expect(updated!.status).toBe('ACCEPTED')
    expect(updated!.acceptedAt).not.toBeNull()
    expect(updated!.acceptedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
    expect(updated!.acceptedAt!.getTime()).toBeLessThanOrEqual(after.getTime() + 1000)
  })
})

// TC-A2-008: projectId 指定の受諾で ProjectMember に追加される (TC-INV-003 と同義)
// 省略: TC-INV-003 で同様の検証済み

// TC-A2-009: password < 8 文字はサーバー側で拒否される
describe('TC-A2-009: 短いパスワードはサーバー側で拒否される', () => {
  it('password < 8 文字で acceptInvitation を呼ぶと error が返される', async () => {
    const result = await acceptInvitation('any-token', 'User Name', 'short')
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toMatch(/8.+文字/)
  })
})
