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

describe('submitDailyReport (M-03: dual checkbox)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
    mockPrisma.todo.findFirst.mockResolvedValue({
      id: 'cltodo00000000000000test001',
      taskId: 'task-1',
      started: false,
      completed: false,
      startedAt: null,
      completedAt: null,
    })
    mockPrisma.dailyReport.create.mockResolvedValue({ id: 'report-1' })
    mockPrisma.todo.update.mockResolvedValue({ id: 'cltodo00000000000000test001' })
  })

  // === 既存テスト (新 signature { started, completed } 対応) ===

  it('completed=true で DailyReport を追記し Todo.completed を更新する', async () => {
    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: true,
    })

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          todoId: 'cltodo00000000000000test001',
          completed: true,
          reportedBy: 'user-1',
        }),
      }),
    )
    expect(mockPrisma.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cltodo00000000000000test001' },
        data: expect.objectContaining({ completed: true }),
      }),
    )
  })

  it('completed=false で取り消し操作を監査ログに残せる', async () => {
    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: false,
    })

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ completed: false }),
      }),
    )
    expect(mockPrisma.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ completed: false }),
      }),
    )
  })

  it('同日に複数回提出すると DailyReport が追記される(Q-03 監査ログ)', async () => {
    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: true,
    })
    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: false,
    })
    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: true,
    })

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledTimes(3)
  })

  it('todoId がプロジェクトに属さない場合はエラー', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue(null)

    await expect(
      submitDailyReport('cltodo00000000000000badd001', 'clproj000000000000test00001', {
        started: false,
        completed: false,
      }),
    ).rejects.toThrow('権限がありません')
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('コメントが1000文字を超える場合はエラー', async () => {
    await expect(
      submitDailyReport(
        'cltodo00000000000000test001',
        'clproj000000000000test00001',
        { started: true, completed: true },
        'a'.repeat(1001),
      ),
    ).rejects.toThrow('コメントは1000文字以内にしてください')
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('todoId が空文字の場合はエラー', async () => {
    await expect(
      submitDailyReport('', 'clproj000000000000test00001', { started: false, completed: false }),
    ).rejects.toThrow('不正なリクエストです')
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('started が boolean でない場合はエラー（ランタイム型ガード）', async () => {
    await expect(
      submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
        started: 1 as never,
        completed: false,
      }),
    ).rejects.toThrow('不正なリクエストです')
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('completed が boolean でない場合はエラー（ランタイム型ガード）', async () => {
    await expect(
      submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
        started: false,
        completed: 'true' as never,
      }),
    ).rejects.toThrow('不正なリクエストです')
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('revalidatePath がプロジェクトのパスと /daily パスで呼ばれる', async () => {
    const { revalidatePath } = await import('next/cache')

    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: false,
    })

    expect(revalidatePath).toHaveBeenCalledWith('/projects/clproj000000000000test00001')
    expect(revalidatePath).toHaveBeenCalledWith('/projects/clproj000000000000test00001/daily')
  })

  // === M-03 新規テスト ===

  it('started=true のとき Todo.started=true が設定される', async () => {
    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: false,
    })

    expect(mockPrisma.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ started: true }),
      }),
    )
  })

  it('started=true かつ startedAt が null のとき startedAt が設定される', async () => {
    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: false,
    })

    const call = mockPrisma.todo.update.mock.calls[0][0]
    expect(call.data.startedAt).toBeInstanceOf(Date)
  })

  it('started=true かつ startedAt が既に設定済みのとき startedAt は上書きしない', async () => {
    const existingStartedAt = new Date('2026-01-01')
    mockPrisma.todo.findFirst.mockResolvedValue({
      id: 'cltodo00000000000000test001',
      taskId: 'task-1',
      started: true,
      completed: false,
      startedAt: existingStartedAt,
      completedAt: null,
    })

    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: false,
    })

    const call = mockPrisma.todo.update.mock.calls[0][0]
    expect(call.data.startedAt).toBeUndefined()
  })

  it('completed=true のとき completedAt が設定される', async () => {
    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: true,
    })

    const call = mockPrisma.todo.update.mock.calls[0][0]
    expect(call.data.completedAt).toBeInstanceOf(Date)
  })

  it('completed=true かつ completedAt が既に設定済みのとき completedAt は上書きしない', async () => {
    const existingCompletedAt = new Date('2026-01-15')
    mockPrisma.todo.findFirst.mockResolvedValue({
      id: 'cltodo00000000000000test001',
      taskId: 'task-1',
      started: true,
      completed: true,
      startedAt: new Date('2026-01-01'),
      completedAt: existingCompletedAt,
    })

    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: true,
    })

    const call = mockPrisma.todo.update.mock.calls[0][0]
    expect(call.data.completedAt).toBeUndefined()
  })

  it('completed=false のとき completedAt は data に含まれない', async () => {
    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: false,
    })

    const call = mockPrisma.todo.update.mock.calls[0][0]
    expect(call.data.completedAt).toBeUndefined()
  })

  it('completed=true かつ started=false は validation エラー（DB CHECK と二重防御）', async () => {
    await expect(
      submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
        started: false,
        completed: true,
      }),
    ).rejects.toThrow('完了するには先に開始してください')
    expect(mockPrisma.dailyReport.create).not.toHaveBeenCalled()
  })

  it('started=false で un-start できる（Todo.started=false になる）', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue({
      id: 'cltodo00000000000000test001',
      taskId: 'task-1',
      started: true,
      completed: false,
      startedAt: new Date('2026-01-01'),
      completedAt: null,
    })

    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: false,
      completed: false,
    })

    expect(mockPrisma.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ started: false }),
      }),
    )
  })

  it('un-start 後も startedAt は data に含まれない（DB 上の値を保持）', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue({
      id: 'cltodo00000000000000test001',
      taskId: 'task-1',
      started: true,
      completed: false,
      startedAt: new Date('2026-01-01'),
      completedAt: null,
    })

    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: false,
      completed: false,
    })

    const call = mockPrisma.todo.update.mock.calls[0][0]
    expect(call.data.startedAt).toBeUndefined()
  })

  it('DailyReport の completed フィールドに input.completed が記録される（started は別フィールド）', async () => {
    await submitDailyReport('cltodo00000000000000test001', 'clproj000000000000test00001', {
      started: true,
      completed: false,
    })

    expect(mockPrisma.dailyReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ completed: false }),
      }),
    )
  })
})
