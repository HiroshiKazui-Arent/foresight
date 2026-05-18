/**
 * TodoTemplate 関連テスト (v4.0)
 *
 * v3.x の重み再配分テストは廃止 (Plan S3)。
 * 残存するのは TodoTemplate からの自動展開ロジック (順序 / 期間継承 / トランザクション)。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    task: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    todo: {
      createMany: vi.fn(),
      createManyAndReturn: vi.fn(),
      findMany: vi.fn(),
    },
    todoTemplate: {
      findMany: vi.fn(),
    },
    milestone: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  return { mockPrisma }
})

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/authz', () => ({
  requireProjectMember: vi.fn().mockResolvedValue('user-1'),
}))

import { createTask } from '@/server/actions/task'

describe('createTask (v4.0: TodoTemplate 自動展開、重み概念なし)', () => {
  const milestoneId = 'ms-1'
  const projectId = 'proj-1'
  const name = '新しいタスク'
  const startDate = new Date('2026-01-01')
  const endDate = new Date('2026-02-01')

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
    mockPrisma.milestone.findFirst.mockResolvedValue({ id: milestoneId, projectId })
    mockPrisma.task.count.mockResolvedValue(0)
    mockPrisma.task.create.mockImplementation(async ({ data }) => ({
      id: 'task-new',
      ...data,
    }))
    mockPrisma.todo.createMany.mockResolvedValue({ count: 0 })
    // createTask は createManyAndReturn で自動展開された ToDo を 1 ラウンドトリップで返す (v4 G2 対応)
    mockPrisma.todo.createManyAndReturn.mockResolvedValue([])
    mockPrisma.todo.findMany.mockResolvedValue([])
  })

  it('TodoTemplate が 5 件あれば、Task 作成時に 5 件の ToDo を order 順に展開する', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([
      { id: 't1', name: '画面設計', order: 1 },
      { id: 't2', name: 'DB設計', order: 2 },
      { id: 't3', name: 'BE開発', order: 3 },
      { id: 't4', name: 'FE開発', order: 4 },
      { id: 't5', name: 'レビュー', order: 5 },
    ])

    await createTask(milestoneId, projectId, name, startDate, endDate)

    expect(mockPrisma.todoTemplate.findMany).toHaveBeenCalledWith({
      orderBy: { order: 'asc' },
    })
    expect(mockPrisma.todo.createManyAndReturn).toHaveBeenCalledTimes(1)

    const createManyArg = mockPrisma.todo.createManyAndReturn.mock.calls[0][0]
    expect(createManyArg.data).toHaveLength(5)
    const names = createManyArg.data.map((d: { name: string }) => d.name)
    expect(names).toEqual(['画面設計', 'DB設計', 'BE開発', 'FE開発', 'レビュー'])
    const orders = createManyArg.data.map((d: { order: number }) => d.order)
    expect(orders).toEqual([0, 1, 2, 3, 4])
  })

  it('展開される ToDo に weight / completed / started 等の v3.x フィールドは含まれない', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([{ id: 't1', name: '画面設計', order: 1 }])

    await createTask(milestoneId, projectId, name, startDate, endDate)

    const createManyArg = mockPrisma.todo.createManyAndReturn.mock.calls[0][0]
    const todo = createManyArg.data[0]
    expect(todo).not.toHaveProperty('weight')
    expect(todo).not.toHaveProperty('completed')
    expect(todo).not.toHaveProperty('started')
    expect(todo).not.toHaveProperty('actualStartDate')
    expect(todo).not.toHaveProperty('actualEndDate')
  })

  it('TodoTemplate が 0 件のとき ToDo は作成されない', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([])

    await createTask(milestoneId, projectId, name, startDate, endDate)

    expect(mockPrisma.todo.createManyAndReturn).not.toHaveBeenCalled()
  })

  it('自動展開された ToDo は親 Task の期間と同一で初期化される', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([{ id: 't1', name: '画面設計', order: 1 }])

    await createTask(milestoneId, projectId, name, startDate, endDate)

    const createManyArg = mockPrisma.todo.createManyAndReturn.mock.calls[0][0]
    const todo = createManyArg.data[0]
    expect(todo.startDate).toEqual(startDate)
    expect(todo.endDate).toEqual(endDate)
  })

  it('Task 作成と ToDo 一括生成は $transaction 内で実行される', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([{ id: 't1', name: '画面設計', order: 1 }])

    await createTask(milestoneId, projectId, name, startDate, endDate)

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('返り値: 自動展開された ToDo を todos プロパティで返す (G2 で local state 即時反映)', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([
      { id: 't1', name: '画面設計', order: 1 },
      { id: 't2', name: 'テスト', order: 2 },
    ])
    // createManyAndReturn は order を保証しないため、わざと逆順で返してソート確認
    mockPrisma.todo.createManyAndReturn.mockResolvedValue([
      { id: 'td-2', taskId: 'task-new', name: 'テスト', order: 1 },
      { id: 'td-1', taskId: 'task-new', name: '画面設計', order: 0 },
    ])

    const result = await createTask(milestoneId, projectId, name, startDate, endDate)

    expect(result.todos).toHaveLength(2)
    // order 順にソートされていること
    expect(result.todos[0].name).toBe('画面設計')
    expect(result.todos[1].name).toBe('テスト')
  })

  it('TodoTemplate が 0 件のときは todos: [] を返す', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([])

    const result = await createTask(milestoneId, projectId, name, startDate, endDate)

    expect(result.todos).toEqual([])
    expect(mockPrisma.todo.createManyAndReturn).not.toHaveBeenCalled()
  })
})

describe('updateTask (v4.0: mass-assignment 防止)', () => {
  const projectId = 'proj-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('許可されたフィールド以外 (例: milestoneId / order) は Prisma に渡されない', async () => {
    const { updateTask } = await import('@/server/actions/task')

    mockPrisma.task.findFirst = vi.fn().mockResolvedValue({
      id: 'task-1',
      milestoneId: 'ms-original',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
    })
    const updateMock = vi.fn().mockResolvedValue({ id: 'task-1', name: 'Updated' })
    ;(mockPrisma as unknown as { task: { update: typeof updateMock } }).task.update = updateMock

    // TypeScript 型の境界を runtime で破る (悪意ある呼び出し or バグ)
    await updateTask('task-1', projectId, {
      name: 'Updated',
      milestoneId: 'ms-hijacked',
      order: 999,
    } as unknown as Parameters<typeof updateTask>[2])

    expect(updateMock).toHaveBeenCalledOnce()
    const callData = updateMock.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(callData.data).not.toHaveProperty('milestoneId')
    expect(callData.data).not.toHaveProperty('order')
    expect(callData.data).toHaveProperty('name', 'Updated')
  })

  it('日付バリデーション: 開始日 >= 終了日 は updateTask でも拒否される', async () => {
    const { updateTask } = await import('@/server/actions/task')

    mockPrisma.task.findFirst = vi.fn().mockResolvedValue({
      id: 'task-1',
      milestoneId: 'ms-1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
    })

    await expect(
      updateTask('task-1', projectId, {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-01-01'),
      }),
    ).rejects.toThrow('開始日は終了日より前にしてください')
  })
})
