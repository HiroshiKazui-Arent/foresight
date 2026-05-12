import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findMany: vi.fn() },
    invitation: { findMany: vi.fn() },
  }
  return { mockPrisma }
})

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'admin@example.com', name: 'Admin' },
  }),
}))

import { getAllUsers, getAllInvitations } from '@/server/actions/user'

describe('getAllUsers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('select で passwordHash を除いたユーザー一覧を返す', async () => {
    const mockUser = {
      id: 'u1',
      email: 'a@example.com',
      name: 'A',
      emailVerified: null,
      image: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.user.findMany.mockResolvedValue([mockUser])

    const result = await getAllUsers()

    expect(result).toHaveLength(1)
    expect(result[0]).not.toHaveProperty('passwordHash')
    expect(result[0].email).toBe('a@example.com')
  })

  it('createdAt の降順で問い合わせる', async () => {
    mockPrisma.user.findMany.mockResolvedValue([])

    await getAllUsers()

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    )
  })

  it('未認証の場合は /login へ redirect される', async () => {
    const { auth } = await import('@/lib/auth')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth as any).mockResolvedValueOnce(null)

    await expect(getAllUsers()).rejects.toThrow('REDIRECT:/login')
  })
})

describe('getAllInvitations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('project と invitedBy(passwordHash なし)を include した招待一覧を返す', async () => {
    const mockInvitation = {
      id: 'inv-1',
      email: 'b@example.com',
      status: 'PENDING',
      expiresAt: new Date(),
      createdAt: new Date(),
      project: { id: 'p1', name: 'Test Project' },
      invitedBy: { id: 'u1', name: 'Admin', email: 'admin@example.com' },
    }
    mockPrisma.invitation.findMany.mockResolvedValue([mockInvitation])

    const result = await getAllInvitations()

    expect(result).toHaveLength(1)
    expect(result[0].project).toBeTruthy()
    expect(result[0].invitedBy).toBeTruthy()
    expect(result[0].invitedBy).not.toHaveProperty('passwordHash')
  })

  it('createdAt の降順で問い合わせる', async () => {
    mockPrisma.invitation.findMany.mockResolvedValue([])

    await getAllInvitations()

    expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    )
  })

  it('未認証の場合は /login へ redirect される', async () => {
    const { auth } = await import('@/lib/auth')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth as any).mockResolvedValueOnce(null)

    await expect(getAllInvitations()).rejects.toThrow('REDIRECT:/login')
  })
})
