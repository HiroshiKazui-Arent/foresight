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
    todo: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  return { mockPrisma }
})

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/authz', () => ({
  requireProjectMember: vi.fn().mockResolvedValue('user-1'),
}))

import { createTodo, deleteTodo, updateTodo } from '@/server/actions/todo'
import { revalidatePath } from 'next/cache'
import { requireProjectMember } from '@/lib/authz'

describe('createTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
  })

  it('正常系: createTodo 後、同 Task 配下の全 ToDo の weight 合計が 100 になる', async () => {
    const now = new Date()
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    mockPrisma.task.findFirst.mockResolvedValue({ id: 'task-1', milestoneId: 'ms-1' })
    mockPrisma.todo.count.mockResolvedValue(2)
    mockPrisma.todo.create.mockResolvedValue({
      id: 'todo-3',
      taskId: 'task-1',
      name: 'New Todo',
      weight: 0,
      order: 2,
      startDate: now,
      endDate: end,
    })

    mockPrisma.todo.findMany.mockResolvedValue([
      { id: 'todo-1', taskId: 'task-1', weight: 50, order: 0 },
      { id: 'todo-2', taskId: 'task-1', weight: 50, order: 1 },
      { id: 'todo-3', taskId: 'task-1', weight: 0, order: 2 },
    ])

    mockPrisma.todo.update.mockResolvedValue({})

    await createTodo('task-1', 'proj-1', 'New Todo', now, end)

    expect(requireProjectMember).toHaveBeenCalledWith('proj-1')
    expect(mockPrisma.todo.create).toHaveBeenCalledOnce()
    expect(mockPrisma.todo.update).toHaveBeenCalledTimes(3)

    const updateCalls = vi.mocked(mockPrisma.todo.update).mock.calls
    const totalWeight = updateCalls.reduce((sum, call) => {
      const data = (call[0] as { data: { weight: number } }).data
      return sum + data.weight
    }, 0)
    expect(totalWeight).toBe(100)

    expect(revalidatePath).toHaveBeenCalled()
  })

  it('ToDo が 1 件の場合は weight が 100 になる', async () => {
    const now = new Date()
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    mockPrisma.task.findFirst.mockResolvedValue({ id: 'task-1', milestoneId: 'ms-1' })
    mockPrisma.todo.count.mockResolvedValue(0)
    mockPrisma.todo.create.mockResolvedValue({
      id: 'todo-1',
      taskId: 'task-1',
      name: 'First Todo',
      weight: 0,
      order: 0,
      startDate: now,
      endDate: end,
    })

    mockPrisma.todo.findMany.mockResolvedValue([
      { id: 'todo-1', taskId: 'task-1', weight: 0, order: 0 },
    ])

    mockPrisma.todo.update.mockResolvedValue({})

    await createTodo('task-1', 'proj-1', 'First Todo', now, end)

    const updateCalls = vi.mocked(mockPrisma.todo.update).mock.calls
    const totalWeight = updateCalls.reduce((sum, call) => {
      const data = (call[0] as { data: { weight: number } }).data
      return sum + data.weight
    }, 0)
    expect(totalWeight).toBe(100)
  })
})

describe('deleteTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
  })

  it('正常系: deleteTodo 後、残 ToDo の weight 合計が 100 になる', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue({
      id: 'todo-1',
      taskId: 'task-1',
    })

    mockPrisma.todo.delete.mockResolvedValue({ id: 'todo-1' })

    mockPrisma.todo.findMany.mockResolvedValue([
      { id: 'todo-2', taskId: 'task-1', weight: 50, order: 0 },
      { id: 'todo-3', taskId: 'task-1', weight: 50, order: 1 },
    ])

    mockPrisma.todo.update.mockResolvedValue({})

    await deleteTodo('todo-1', 'proj-1')

    expect(requireProjectMember).toHaveBeenCalledWith('proj-1')
    expect(mockPrisma.todo.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'todo-1' } }),
    )

    expect(mockPrisma.todo.update).toHaveBeenCalledTimes(2)

    const updateCalls = vi.mocked(mockPrisma.todo.update).mock.calls
    const totalWeight = updateCalls.reduce((sum, call) => {
      const data = (call[0] as { data: { weight: number } }).data
      return sum + data.weight
    }, 0)
    expect(totalWeight).toBe(100)

    expect(revalidatePath).toHaveBeenCalled()
  })

  it('最後の 1 件を削除した後は weight 再計算が不要（update 呼び出しなし）', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue({
      id: 'todo-1',
      taskId: 'task-1',
    })

    mockPrisma.todo.delete.mockResolvedValue({ id: 'todo-1' })
    mockPrisma.todo.findMany.mockResolvedValue([])
    mockPrisma.todo.update.mockResolvedValue({})

    await deleteTodo('todo-1', 'proj-1')

    expect(mockPrisma.todo.update).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('非メンバーが呼ぶと Forbidden (requireProjectMember が throw)', async () => {
    vi.mocked(requireProjectMember).mockRejectedValueOnce(new Error('NOT_FOUND'))

    await expect(deleteTodo('todo-1', 'proj-forbidden')).rejects.toThrow('NOT_FOUND')
    expect(mockPrisma.todo.delete).not.toHaveBeenCalled()
  })

  it('別プロジェクトの Todo は削除できない (IDOR 防止)', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue(null) // 所有権チェック失敗

    await expect(deleteTodo('todo-other-project', 'proj-1')).rejects.toThrow('NOT_FOUND')
    expect(mockPrisma.todo.delete).not.toHaveBeenCalled()
  })
})

describe('updateTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常系: 名前を更新する（weight は変更しない）', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue({ id: 'todo-1', taskId: 'task-1' })
    mockPrisma.todo.update.mockResolvedValue({ id: 'todo-1', name: 'Updated' })

    await updateTodo('todo-1', 'proj-1', { name: 'Updated' })

    expect(requireProjectMember).toHaveBeenCalledWith('proj-1')
    expect(mockPrisma.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'todo-1' },
        data: expect.objectContaining({ name: 'Updated' }),
      }),
    )
    const callData = vi.mocked(mockPrisma.todo.update).mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(callData.data).not.toHaveProperty('weight')
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('別プロジェクトの Todo は更新できない (IDOR 防止)', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue(null)

    await expect(updateTodo('todo-other', 'proj-1', { name: 'Hack' })).rejects.toThrow('NOT_FOUND')
    expect(mockPrisma.todo.update).not.toHaveBeenCalled()
  })
})
