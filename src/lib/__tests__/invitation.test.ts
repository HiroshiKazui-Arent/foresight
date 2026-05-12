import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    invitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    projectMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  return { mockPrisma }
})

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

vi.mock('crypto', () => ({
  randomBytes: vi.fn(() => ({
    toString: vi.fn().mockReturnValue('mock_token_base64url'),
  })),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'admin@example.com', name: 'Admin' },
  }),
}))

import {
  acceptInvitation,
  createInvitation,
  getInvitation,
  revokeInvitation,
} from '@/server/actions/invitation'

describe('createInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
  })

  it('招待トークンを発行し既存 PENDING 招待を REVOKED にする', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue({ projectId: 'proj-1', userId: 'user-1' })
    mockPrisma.invitation.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.invitation.create.mockResolvedValue({
      id: 'inv-new',
      email: 'invite@example.com',
      token: 'mock_token_base64url',
      projectId: 'proj-1',
      invitedById: 'user-1',
    })

    const result = await createInvitation('invite@example.com', 'proj-1')

    expect(result).toHaveProperty('token')
    expect(mockPrisma.invitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REVOKED' } }),
    )
    expect(mockPrisma.invitation.create).toHaveBeenCalledOnce()
  })

  it('invitedById にセッションユーザー ID を使う', async () => {
    mockPrisma.invitation.updateMany.mockResolvedValue({ count: 0 })
    mockPrisma.invitation.create.mockResolvedValue({
      id: 'inv-new',
      email: 'invite@example.com',
      token: 'mock_token_base64url',
      projectId: null,
      invitedById: 'user-1',
    })

    await createInvitation('invite@example.com')

    expect(mockPrisma.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ invitedById: 'user-1' }) }),
    )
  })

  it('プロジェクト非メンバーが招待を作成しようとすると Forbidden になる', async () => {
    mockPrisma.projectMember.findUnique.mockResolvedValue(null) // メンバーでない

    await expect(createInvitation('invite@example.com', 'proj-forbidden')).rejects.toThrow(
      'Forbidden',
    )
    expect(mockPrisma.invitation.create).not.toHaveBeenCalled()
  })
})

describe('revokeInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('発行者が招待を REVOKED に更新する', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      invitedById: 'user-1', // 呼び出し者と同じ
      projectId: 'proj-1',
      status: 'PENDING',
    })
    mockPrisma.invitation.update.mockResolvedValue({ id: 'inv-1', status: 'REVOKED' })

    await revokeInvitation('inv-1')

    expect(mockPrisma.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REVOKED' } }),
    )
  })

  it('存在しない招待 ID を冪等に扱う', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue(null) // 招待が存在しない

    await expect(revokeInvitation('nonexistent-id')).resolves.toBeUndefined()
    expect(mockPrisma.invitation.update).not.toHaveBeenCalled()
  })

  it('発行者でもプロジェクトメンバーでもない場合は Forbidden になる', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-2',
      invitedById: 'other-user', // 発行者は別人
      projectId: 'proj-1',
      status: 'PENDING',
    })
    mockPrisma.projectMember.findUnique.mockResolvedValue(null) // プロジェクトメンバーでもない

    await expect(revokeInvitation('inv-2')).rejects.toThrow('Forbidden')
    expect(mockPrisma.invitation.update).not.toHaveBeenCalled()
  })
})

describe('getInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('期限切れのトークンに対して null を返す', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      email: 'user@example.com',
      token: 'expired_token',
      projectId: 'proj-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
      project: { id: 'proj-1', name: 'Test Project' },
    })

    const result = await getInvitation('expired_token')

    expect(result).toBeNull()
  })

  it('有効なトークンに対して招待情報を返す', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      email: 'user@example.com',
      token: 'valid_token',
      projectId: 'proj-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      project: { id: 'proj-1', name: 'Test Project' },
    })

    const result = await getInvitation('valid_token')

    expect(result).not.toBeNull()
    expect(result?.email).toBe('user@example.com')
  })

  it('REVOKED 状態のトークンに対して null を返す', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      email: 'user@example.com',
      token: 'revoked_token',
      projectId: 'proj-1',
      status: 'REVOKED',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      project: { id: 'proj-1', name: 'Test Project' },
    })

    const result = await getInvitation('revoked_token')

    expect(result).toBeNull()
  })

  it('存在しないトークンに対して null を返す', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue(null)

    const result = await getInvitation('nonexistent_token')

    expect(result).toBeNull()
  })
})

describe('acceptInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // $transaction のコールバックを実行するモック (tx = mockPrisma として渡す)
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
  })

  it('正常系(新規ユーザー): User と ProjectMember が作成され { success: true, email } が返る', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      email: 'newuser@example.com',
      token: 'valid_token',
      projectId: 'proj-1',
      invitedById: 'admin-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    })
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user-1',
      email: 'newuser@example.com',
      name: 'New User',
    })
    mockPrisma.projectMember.create.mockResolvedValue({
      id: 'member-1',
      projectId: 'proj-1',
      userId: 'new-user-1',
    })
    mockPrisma.invitation.updateMany.mockResolvedValue({ count: 1 })

    const result = await acceptInvitation('valid_token', 'New User', 'password123')

    expect(result).toEqual({ success: true, email: 'newuser@example.com' })
    expect(mockPrisma.user.create).toHaveBeenCalledOnce()
    expect(mockPrisma.projectMember.create).toHaveBeenCalledOnce()
  })

  it('正常系(既存ユーザー): User は作成されず ProjectMember が追加され { success: true, email } が返る', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-2',
      email: 'existing@example.com',
      token: 'valid_token_2',
      projectId: 'proj-1',
      invitedById: 'admin-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-user-1',
      email: 'existing@example.com',
      name: 'Existing User',
      passwordHash: 'existing_hashed_password',
    })
    mockPrisma.projectMember.findUnique.mockResolvedValue(null) // まだメンバーでない
    mockPrisma.projectMember.create.mockResolvedValue({
      id: 'member-2',
      projectId: 'proj-1',
      userId: 'existing-user-1',
    })
    mockPrisma.invitation.updateMany.mockResolvedValue({ count: 1 })

    const result = await acceptInvitation('valid_token_2', 'Existing User', 'newpassword')

    expect(result).toEqual({ success: true, email: 'existing@example.com' })
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
    expect(mockPrisma.projectMember.create).toHaveBeenCalledOnce()
  })

  it('既存ユーザーのパスワードが変更されない', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-3',
      email: 'existing@example.com',
      token: 'valid_token_3',
      projectId: null,
      invitedById: 'admin-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-user-1',
      email: 'existing@example.com',
      name: 'Existing User',
      passwordHash: 'original_hash',
    })
    mockPrisma.invitation.updateMany.mockResolvedValue({ count: 1 })

    const bcrypt = await import('bcryptjs')
    await acceptInvitation('valid_token_3', 'Existing User', 'newpassword')

    expect(bcrypt.default.hash).not.toHaveBeenCalled()
  })

  it('異常系(期限切れトークン): { error } が返る', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-4',
      email: 'user@example.com',
      token: 'expired_token',
      projectId: 'proj-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000),
    })

    const result = await acceptInvitation('expired_token', 'User', 'password123')

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBeTruthy()
  })

  it('異常系(REVOKED トークン): { error } が返る', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: 'inv-5',
      email: 'user@example.com',
      token: 'revoked_token',
      projectId: 'proj-1',
      status: 'REVOKED',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    })

    const result = await acceptInvitation('revoked_token', 'User', 'password123')

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toBeTruthy()
  })

  it('異常系(存在しないトークン): { error } が返る', async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue(null)

    const result = await acceptInvitation('nonexistent_token', 'User', 'password123')

    expect(result).toHaveProperty('error')
  })

  it('パスワードが8文字未満の場合 { error } が返る', async () => {
    const result = await acceptInvitation('any_token', 'User', 'short')

    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/8文字/)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('空のパスワードの場合 { error } が返る', async () => {
    const result = await acceptInvitation('any_token', 'User', '')

    expect(result).toHaveProperty('error')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('空の名前の場合 { error } が返る', async () => {
    const result = await acceptInvitation('any_token', '', 'password123')

    expect(result).toHaveProperty('error')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
