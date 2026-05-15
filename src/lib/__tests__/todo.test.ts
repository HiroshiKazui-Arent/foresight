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

describe('createTodo (v4.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
  })

  it('正常系: name + startDate + endDate のみで Todo を作成する (weight 概念なし)', async () => {
    const now = new Date()
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    mockPrisma.task.findFirst.mockResolvedValue({ id: 'task-1', milestoneId: 'ms-1' })
    mockPrisma.todo.count.mockResolvedValue(2)
    mockPrisma.todo.create.mockResolvedValue({
      id: 'todo-3',
      taskId: 'task-1',
      name: 'New Todo',
      order: 2,
      startDate: now,
      endDate: end,
      actualStartDate: null,
      actualEndDate: null,
    })

    await createTodo('task-1', 'proj-1', 'New Todo', now, end)

    expect(requireProjectMember).toHaveBeenCalledWith('proj-1')
    expect(mockPrisma.todo.create).toHaveBeenCalledOnce()
    const createCall = vi.mocked(mockPrisma.todo.create).mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    // v4.0: weight / started / completed / actualStart* / actualEnd* は createTodo で受け付けない
    expect(createCall.data).not.toHaveProperty('weight')
    expect(createCall.data).not.toHaveProperty('started')
    expect(createCall.data).not.toHaveProperty('completed')
    expect(createCall.data).not.toHaveProperty('actualStartDate')
    expect(createCall.data).not.toHaveProperty('actualEndDate')
    expect(createCall.data.name).toBe('New Todo')
    expect(createCall.data.order).toBe(2)

    expect(revalidatePath).toHaveBeenCalled()
  })

  it('名前が空文字の場合はバリデーションエラー', async () => {
    const now = new Date()
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    await expect(createTodo('task-1', 'proj-1', '', now, end)).rejects.toThrow(
      '名前は1〜255文字で入力してください',
    )
    expect(mockPrisma.todo.create).not.toHaveBeenCalled()
  })

  it('開始日 >= 終了日はバリデーションエラー', async () => {
    const now = new Date()
    await expect(createTodo('task-1', 'proj-1', '名前', now, now)).rejects.toThrow(
      '開始日は終了日より前にしてください',
    )
    expect(mockPrisma.todo.create).not.toHaveBeenCalled()
  })

  it('無効な日付(Invalid Date)はバリデーションエラー', async () => {
    const invalid = new Date('invalid')
    const valid = new Date('2026-02-01')
    await expect(createTodo('task-1', 'proj-1', '名前', invalid, valid)).rejects.toThrow(
      '有効な日付を入力してください',
    )
    expect(mockPrisma.todo.create).not.toHaveBeenCalled()
  })
})

describe('deleteTodo (v4.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
  })

  it('正常系: deleteTodo は weight 再配分を行わない', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue({
      id: 'todo-1',
      taskId: 'task-1',
    })

    mockPrisma.todo.delete.mockResolvedValue({ id: 'todo-1' })

    await deleteTodo('todo-1', 'proj-1')

    expect(requireProjectMember).toHaveBeenCalledWith('proj-1')
    expect(mockPrisma.todo.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'todo-1' } }),
    )
    // v4.0: 削除後の weight 再配分は不要
    expect(mockPrisma.todo.update).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('非メンバーが呼ぶと Forbidden (requireProjectMember が throw)', async () => {
    vi.mocked(requireProjectMember).mockRejectedValueOnce(new Error('NOT_FOUND'))

    await expect(deleteTodo('todo-1', 'proj-forbidden')).rejects.toThrow('NOT_FOUND')
    expect(mockPrisma.todo.delete).not.toHaveBeenCalled()
  })

  it('別プロジェクトの Todo は削除できない (IDOR 防止)', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue(null)

    await expect(deleteTodo('todo-other-project', 'proj-1')).rejects.toThrow('NOT_FOUND')
    expect(mockPrisma.todo.delete).not.toHaveBeenCalled()
  })
})

describe('updateTodo (v4.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
  })

  it('正常系: 名前を更新する (weight 概念なし)', async () => {
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
    expect(callData.data).not.toHaveProperty('actualStartDate')
    expect(callData.data).not.toHaveProperty('actualEndDate')
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('別プロジェクトの Todo は更新できない (IDOR 防止)', async () => {
    mockPrisma.todo.findFirst.mockResolvedValue(null)

    await expect(updateTodo('todo-other', 'proj-1', { name: 'Hack' })).rejects.toThrow('NOT_FOUND')
    expect(mockPrisma.todo.update).not.toHaveBeenCalled()
  })

  it('日付更新: 有効な endDate で更新できる', async () => {
    const existing = {
      id: 'todo-1',
      taskId: 'task-1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-01'),
    }
    mockPrisma.todo.findFirst.mockResolvedValue(existing)
    mockPrisma.todo.update.mockResolvedValue({ ...existing, endDate: new Date('2026-12-31') })

    await updateTodo('todo-1', 'proj-1', { endDate: new Date('2026-12-31') })

    expect(mockPrisma.todo.update).toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('日付更新: 開始日 >= 終了日はバリデーションエラー', async () => {
    const existing = {
      id: 'todo-1',
      taskId: 'task-1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-01'),
    }
    mockPrisma.todo.findFirst.mockResolvedValue(existing)

    await expect(
      updateTodo('todo-1', 'proj-1', {
        startDate: new Date('2026-12-31'),
        endDate: new Date('2026-01-01'),
      }),
    ).rejects.toThrow('開始日は終了日より前にしてください')
    expect(mockPrisma.todo.update).not.toHaveBeenCalled()
  })
})
