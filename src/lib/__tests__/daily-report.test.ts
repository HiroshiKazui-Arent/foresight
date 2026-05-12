import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}))

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    todo: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    dailyReport: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  return { mockPrisma }
})

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/authz', () => ({
  requireProjectMember: vi.fn().mockResolvedValue('user-1'),
}))

import { submitDailyReport } from '@/server/actions/daily-report'

describe('submitDailyReport (M-01: チェックボックスのみ)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
    mockPrisma.todo.findFirst.mockResolvedValue({
      id: 'todo-1',
      taskId: 'task-1',
      completed: false,
    })
    mockPrisma.dailyReport.create.mockResolvedValue({ id: 'report-1' })
  })

  it('completed=true で DailyReport を追記し Todo.completed を更新する', async () => {
    await submitDailyReport('todo-1', 'proj-1', true)

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          todoId: 'todo-1',
          completed: true,
          reportedBy: 'user-1',
        }),
      }),
    )
    expect(mockPrisma.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'todo-1' },
        data: { completed: true },
      }),
    )
  })

  it('completed=false で取り消し操作を監査ログに残せる', async () => {
    await submitDailyReport('todo-1', 'proj-1', false)

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ completed: false }),
      }),
    )
    expect(mockPrisma.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { completed: false } }),
    )
  })

  it('同日に複数回提出すると DailyReport が追記される(Q-03 監査ログ)', async () => {
    await submitDailyReport('todo-1', 'proj-1', true)
    await submitDailyReport('todo-1', 'proj-1', false)
    await submitDailyReport('todo-1', 'proj-1', true)

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledTimes(3)
  })

  it('todoId がプロジェクトに属さない場合はエラー', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue(null)

    await expect(submitDailyReport('bad-todo', 'proj-1', true)).rejects.toThrow('権限がありません')
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('コメントが1000文字を超える場合はエラー', async () => {
    await expect(submitDailyReport('todo-1', 'proj-1', true, 'a'.repeat(1001))).rejects.toThrow(
      'コメントは1000文字以内にしてください',
    )
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('todoId が空文字の場合はエラー', async () => {
    await expect(submitDailyReport('', 'proj-1', true)).rejects.toThrow('不正なリクエストです')
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('revalidatePath がプロジェクトのパスで呼ばれる', async () => {
    const { revalidatePath } = await import('next/cache')

    await submitDailyReport('todo-1', 'proj-1', true)

    expect(revalidatePath).toHaveBeenCalledWith('/projects/proj-1')
  })
})
