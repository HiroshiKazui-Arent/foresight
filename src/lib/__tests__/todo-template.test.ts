/**
 * TC-TPL-001〜006: TodoTemplate 関連テスト (M-02)
 *
 * - Task 作成時の自動展開
 * - 重み均等割りの整合性
 * - 自動展開後の個別削除と重み再分配
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redistributeWeights } from '@/lib/weight'

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

describe('createTask (M-02: TodoTemplate 自動展開)', () => {
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
  })

  // TC-TPL-002: Task 作成時に 6 件の ToDo が order 順に展開される
  it('TodoTemplate が 6 件あれば、Task 作成時に 6 件の ToDo を order 順に展開する', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([
      { id: 't1', name: '画面設計', order: 1 },
      { id: 't2', name: 'データベース設計', order: 2 },
      { id: 't3', name: 'バックエンド開発', order: 3 },
      { id: 't4', name: 'フロントエンド開発', order: 4 },
      { id: 't5', name: 'テストコードの実装', order: 5 },
      { id: 't6', name: 'テスト・レビュー', order: 6 },
    ])

    await createTask(milestoneId, projectId, name, startDate, endDate)

    expect(mockPrisma.todoTemplate.findMany).toHaveBeenCalledWith({
      orderBy: { order: 'asc' },
    })
    expect(mockPrisma.todo.createMany).toHaveBeenCalledTimes(1)

    const createManyArg = mockPrisma.todo.createMany.mock.calls[0][0]
    expect(createManyArg.data).toHaveLength(6)
    const names = createManyArg.data.map((d: { name: string }) => d.name)
    expect(names).toEqual([
      '画面設計',
      'データベース設計',
      'バックエンド開発',
      'フロントエンド開発',
      'テストコードの実装',
      'テスト・レビュー',
    ])
    // order が 0〜5 であること
    const orders = createManyArg.data.map((d: { order: number }) => d.order)
    expect(orders).toEqual([0, 1, 2, 3, 4, 5])
  })

  // TC-TPL-003: 展開後の weight 合計 = 100 (6件のとき [16,16,16,16,16,20])
  it('展開時の重みは redistributeWeights(6) と一致し、合計 100', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, name: `name-${i}`, order: i + 1 })),
    )

    await createTask(milestoneId, projectId, name, startDate, endDate)

    const createManyArg = mockPrisma.todo.createMany.mock.calls[0][0]
    const weights = createManyArg.data.map((d: { weight: number }) => d.weight)
    expect(weights).toEqual(redistributeWeights(6)) // [16,16,16,16,16,20]
    expect(weights.reduce((a: number, b: number) => a + b, 0)).toBe(100)
  })

  // TC-TPL-004: テンプレ 0 件のとき ToDo は作られない
  it('TodoTemplate が 0 件のとき ToDo は作成されない', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([])

    await createTask(milestoneId, projectId, name, startDate, endDate)

    expect(mockPrisma.todo.createMany).not.toHaveBeenCalled()
  })

  // TC-TPL-006: 7 件のテンプレ構成で端数 2 が最後に寄る
  it('TodoTemplate が 7 件のとき 重みは [14,14,14,14,14,14,16] (端数 2 が最後に寄る)', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, name: `name-${i}`, order: i + 1 })),
    )

    await createTask(milestoneId, projectId, name, startDate, endDate)

    const createManyArg = mockPrisma.todo.createMany.mock.calls[0][0]
    const weights = createManyArg.data.map((d: { weight: number }) => d.weight)
    expect(weights).toEqual([14, 14, 14, 14, 14, 14, 16])
  })

  // 期間とフラグの初期化検証
  it('自動展開された ToDo は親 Task の期間と同一で初期化され completed=false', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([{ id: 't1', name: '画面設計', order: 1 }])

    await createTask(milestoneId, projectId, name, startDate, endDate)

    const createManyArg = mockPrisma.todo.createMany.mock.calls[0][0]
    const todo = createManyArg.data[0]
    expect(todo.startDate).toEqual(startDate)
    expect(todo.endDate).toEqual(endDate)
    expect(todo.completed).toBe(false)
  })

  // 単一トランザクション
  it('Task 作成と ToDo 一括生成は $transaction 内で実行される', async () => {
    mockPrisma.todoTemplate.findMany.mockResolvedValue([{ id: 't1', name: '画面設計', order: 1 }])

    await createTask(milestoneId, projectId, name, startDate, endDate)

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })
})

describe('redistributeWeights — TC-TPL-005 関連: 削除後の再分配整合性', () => {
  it('5 件への再分配は [20,20,20,20,20]', () => {
    expect(redistributeWeights(5)).toEqual([20, 20, 20, 20, 20])
  })
  it('4 件への再分配は [25,25,25,25]', () => {
    expect(redistributeWeights(4)).toEqual([25, 25, 25, 25])
  })
  it('再分配後も合計 100 を維持する (n=1..10)', () => {
    for (let n = 1; n <= 10; n++) {
      const weights = redistributeWeights(n)
      expect(weights.reduce((a, b) => a + b, 0)).toBe(100)
    }
  })
})
