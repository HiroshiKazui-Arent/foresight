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

describe('submitDailyReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
    mockPrisma.todo.findFirst.mockResolvedValue({
      id: 'todo-1',
      taskId: 'task-1',
      actualPct: 30,
      completed: false,
    })
    mockPrisma.dailyReport.create.mockResolvedValue({ id: 'report-1' })
  })

  it('DailyReport を新規 INSERT し Todo.actualPct を更新する', async () => {
    await submitDailyReport('todo-1', 'proj-1', 60, false)

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          todoId: 'todo-1',
          actualPct: 60,
          completed: false,
          reportedBy: 'user-1',
        }),
      }),
    )
  })

  it('completed=true のとき actualPct を 100 に強制する', async () => {
    await submitDailyReport('todo-1', 'proj-1', 40, true)

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actualPct: 100, completed: true }),
      }),
    )
  })

  it('同日に複数回提出できる（upsert しない）', async () => {
    await submitDailyReport('todo-1', 'proj-1', 50, false)
    await submitDailyReport('todo-1', 'proj-1', 70, false)

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledTimes(2)
  })

  it('actualPct は 0〜100 に丸められる', async () => {
    await submitDailyReport('todo-1', 'proj-1', 150, false)

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actualPct: 100 }),
      }),
    )
  })

  it('todoId がプロジェクトに属さない場合はエラー', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue(null)

    await expect(submitDailyReport('bad-todo', 'proj-1', 50, false)).rejects.toThrow(
      '権限がありません',
    )

    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('コメントが1000文字を超える場合はエラー', async () => {
    await expect(
      submitDailyReport('todo-1', 'proj-1', 50, false, 'a'.repeat(1001)),
    ).rejects.toThrow('コメントは1000文字以内にしてください')
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('todoId が空文字の場合はエラー', async () => {
    await expect(submitDailyReport('', 'proj-1', 50, false)).rejects.toThrow('不正なリクエストです')
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('actualPct が有限値でない場合はエラー', async () => {
    await expect(submitDailyReport('todo-1', 'proj-1', NaN, false)).rejects.toThrow(
      '進捗率が不正です',
    )
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('revalidatePath がプロジェクトのパスで呼ばれる', async () => {
    const { revalidatePath } = await import('next/cache')

    await submitDailyReport('todo-1', 'proj-1', 80, false)

    expect(revalidatePath).toHaveBeenCalledWith('/projects/proj-1')
  })
})
