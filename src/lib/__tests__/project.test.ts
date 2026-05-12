import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'admin@example.com', name: 'Admin' },
  }),
}))

vi.mock('@/lib/authz', () => ({
  requireProjectMember: vi.fn().mockResolvedValue('user-1'),
}))

import {
  createProject,
  deleteProject,
  getUserProjects,
  getProject,
  updateProject,
} from '@/server/actions/project'
import { revalidatePath } from 'next/cache'
import { requireProjectMember } from '@/lib/authz'

describe('createProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
  })

  it('正常系: Project と ProjectMember が作成される', async () => {
    const now = new Date()
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    mockPrisma.project.create.mockResolvedValue({
      id: 'proj-1',
      name: 'Test Project',
      startDate: now,
      endDate: end,
    })
    mockPrisma.projectMember.create.mockResolvedValue({
      id: 'member-1',
      projectId: 'proj-1',
      userId: 'user-1',
    })

    const result = await createProject('Test Project', now, end)

    expect(mockPrisma.project.create).toHaveBeenCalledOnce()
    expect(mockPrisma.projectMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: 'proj-1', userId: 'user-1' }),
      }),
    )
    expect(result).toMatchObject({ id: 'proj-1', name: 'Test Project' })
    expect(revalidatePath).toHaveBeenCalledWith('/projects')
  })

  it('未認証の場合は redirect される', async () => {
    const { auth } = await import('@/lib/auth')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth as any).mockResolvedValueOnce(null)

    const now = new Date()
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    await expect(createProject('Test Project', now, end)).rejects.toThrow('REDIRECT:/login')
  })
})

describe('deleteProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常系: requireProjectMember 確認後に削除する', async () => {
    mockPrisma.project.delete.mockResolvedValue({ id: 'proj-1' })

    await deleteProject('proj-1')

    expect(requireProjectMember).toHaveBeenCalledWith('proj-1')
    expect(mockPrisma.project.delete).toHaveBeenCalledWith({ where: { id: 'proj-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/projects')
  })

  it('非メンバーが呼ぶと Forbidden (requireProjectMember が throw)', async () => {
    vi.mocked(requireProjectMember).mockRejectedValueOnce(new Error('NOT_FOUND'))

    await expect(deleteProject('proj-forbidden')).rejects.toThrow('NOT_FOUND')
    expect(mockPrisma.project.delete).not.toHaveBeenCalled()
  })
})

describe('getUserProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('セッションユーザーが参加しているプロジェクト一覧を返す', async () => {
    const projects = [
      { id: 'proj-1', name: 'Project 1', startDate: new Date(), endDate: new Date() },
      { id: 'proj-2', name: 'Project 2', startDate: new Date(), endDate: new Date() },
    ]
    mockPrisma.project.findMany.mockResolvedValue(projects)

    const result = await getUserProjects()

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          members: expect.objectContaining({ some: expect.objectContaining({ userId: 'user-1' }) }),
        }),
      }),
    )
    expect(result).toHaveLength(2)
  })

  it('未認証の場合は redirect される', async () => {
    const { auth } = await import('@/lib/auth')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth as any).mockResolvedValueOnce(null)

    await expect(getUserProjects()).rejects.toThrow('REDIRECT:/login')
  })
})

describe('getProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('メンバーはプロジェクトをフル取得できる', async () => {
    const project = {
      id: 'proj-1',
      name: 'Test Project',
      startDate: new Date(),
      endDate: new Date(),
      milestones: [],
    }
    mockPrisma.project.findUnique.mockResolvedValue(project)

    const result = await getProject('proj-1')

    expect(requireProjectMember).toHaveBeenCalledWith('proj-1')
    expect(result).toMatchObject({ id: 'proj-1' })
  })

  it('プロジェクトが存在しない場合は notFound が呼ばれる', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null)

    const { notFound } = await import('next/navigation')
    await expect(getProject('nonexistent')).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })
})

describe('updateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常系: requireProjectMember 確認後に更新する', async () => {
    mockPrisma.project.update.mockResolvedValue({ id: 'proj-1', name: 'Updated' })

    await updateProject('proj-1', { name: 'Updated' })

    expect(requireProjectMember).toHaveBeenCalledWith('proj-1')
    expect(mockPrisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proj-1' },
        data: expect.objectContaining({ name: 'Updated' }),
      }),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/projects')
    expect(revalidatePath).toHaveBeenCalledWith('/projects/proj-1')
  })
})
