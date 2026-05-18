import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    todoTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  return { mockPrisma }
})

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: mockAuth }))

import {
  getAllTodoTemplates,
  createTodoTemplate,
  updateTodoTemplate,
  deleteTodoTemplate,
  moveTodoTemplate,
} from '@/server/actions/todo-template'
import { revalidatePath } from 'next/cache'

function mockSession(userId = 'user-1') {
  mockAuth.mockResolvedValue({ user: { id: userId } })
}

function mockNoSession() {
  mockAuth.mockResolvedValue(null)
}

const tpl = (overrides: Partial<{ id: string; name: string; order: number }> = {}) => ({
  id: 'tpl-1',
  name: '画面設計',
  order: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getAllTodoTemplates', () => {
  it('order 昇順で全件返す', async () => {
    mockSession()
    const templates = [tpl({ id: '1', order: 1 }), tpl({ id: '2', name: 'DB設計', order: 2 })]
    mockPrisma.todoTemplate.findMany.mockResolvedValue(templates)

    const result = await getAllTodoTemplates()

    expect(mockPrisma.todoTemplate.findMany).toHaveBeenCalledWith({ orderBy: { order: 'asc' } })
    expect(result).toEqual(templates)
  })

  it('未ログインで Unauthorized を投げる', async () => {
    mockNoSession()
    await expect(getAllTodoTemplates()).rejects.toThrow('認証が必要')
  })
})

describe('createTodoTemplate', () => {
  it('末尾 order + 1 で作成し revalidatePath を呼ぶ', async () => {
    mockSession()
    const last = tpl({ order: 3 })
    const created = tpl({ id: 'new', name: '新規', order: 4 })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma),
    )
    mockPrisma.todoTemplate.findFirst.mockResolvedValue(last)
    mockPrisma.todoTemplate.create.mockResolvedValue(created)

    const result = await createTodoTemplate('新規')

    expect(mockPrisma.todoTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: '新規', order: 4 }) }),
    )
    expect(revalidatePath).toHaveBeenCalledWith('/todo-templates')
    expect(result).toEqual(created)
  })

  it('テンプレートが 0 件のとき order = 1 で作成する', async () => {
    mockSession()
    const created = tpl({ id: 'new', name: '初回', order: 1 })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma),
    )
    mockPrisma.todoTemplate.findFirst.mockResolvedValue(null)
    mockPrisma.todoTemplate.create.mockResolvedValue(created)

    await createTodoTemplate('初回')

    expect(mockPrisma.todoTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 1 }) }),
    )
  })

  it('空文字で throw する', async () => {
    mockSession()
    await expect(createTodoTemplate('')).rejects.toThrow('1〜100')
  })

  it('101文字で throw する', async () => {
    mockSession()
    await expect(createTodoTemplate('a'.repeat(101))).rejects.toThrow('1〜100')
  })

  it('名前を trim する', async () => {
    mockSession()
    const created = tpl({ id: 'new', name: 'trimmed', order: 1 })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma),
    )
    mockPrisma.todoTemplate.findFirst.mockResolvedValue(null)
    mockPrisma.todoTemplate.create.mockResolvedValue(created)

    await createTodoTemplate('  trimmed  ')

    expect(mockPrisma.todoTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'trimmed' }) }),
    )
  })

  it('未ログインで Unauthorized を投げる', async () => {
    mockNoSession()
    await expect(createTodoTemplate('test')).rejects.toThrow('認証が必要')
  })
})

describe('updateTodoTemplate', () => {
  it('name のみ更新し revalidatePath を呼ぶ', async () => {
    mockSession()
    const updated = tpl({ name: '新名前' })
    mockPrisma.todoTemplate.update.mockResolvedValue(updated)

    const result = await updateTodoTemplate('tpl-1', '新名前')

    expect(mockPrisma.todoTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { name: '新名前' },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/todo-templates')
    expect(result).toEqual(updated)
  })

  it('空文字で throw する', async () => {
    mockSession()
    await expect(updateTodoTemplate('tpl-1', '')).rejects.toThrow('1〜100')
  })

  it('未ログインで Unauthorized を投げる', async () => {
    mockNoSession()
    await expect(updateTodoTemplate('tpl-1', '名前')).rejects.toThrow('認証が必要')
  })
})

describe('deleteTodoTemplate', () => {
  it('指定 id を削除し revalidatePath を呼ぶ', async () => {
    mockSession()
    mockPrisma.todoTemplate.delete.mockResolvedValue(tpl())

    await deleteTodoTemplate('tpl-1')

    expect(mockPrisma.todoTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/todo-templates')
  })

  it('未ログインで Unauthorized を投げる', async () => {
    mockNoSession()
    await expect(deleteTodoTemplate('tpl-1')).rejects.toThrow('認証が必要')
  })
})

describe('moveTodoTemplate', () => {
  it('up: 対象と上隣の order を swap する', async () => {
    mockSession()
    const current = tpl({ id: 'tpl-2', order: 2 })
    const neighbor = tpl({ id: 'tpl-1', order: 1 })

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma),
    )
    mockPrisma.todoTemplate.findFirst.mockResolvedValueOnce(current).mockResolvedValueOnce(neighbor)
    mockPrisma.todoTemplate.update.mockResolvedValue(tpl())

    await moveTodoTemplate('tpl-2', 'up')

    expect(mockPrisma.todoTemplate.update).toHaveBeenCalledTimes(2)
    expect(mockPrisma.todoTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-2' },
      data: { order: 1 },
    })
    expect(mockPrisma.todoTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { order: 2 },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/todo-templates')
  })

  it('down: 対象と下隣の order を swap する', async () => {
    mockSession()
    const current = tpl({ id: 'tpl-1', order: 1 })
    const neighbor = tpl({ id: 'tpl-2', order: 2 })

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma),
    )
    mockPrisma.todoTemplate.findFirst.mockResolvedValueOnce(current).mockResolvedValueOnce(neighbor)
    mockPrisma.todoTemplate.update.mockResolvedValue(tpl())

    await moveTodoTemplate('tpl-1', 'down')

    expect(mockPrisma.todoTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { order: 2 },
    })
    expect(mockPrisma.todoTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-2' },
      data: { order: 1 },
    })
  })

  it('端(up で一番上) では no-op', async () => {
    mockSession()
    const current = tpl({ id: 'tpl-1', order: 1 })

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) =>
      fn(mockPrisma),
    )
    mockPrisma.todoTemplate.findFirst.mockResolvedValueOnce(current).mockResolvedValueOnce(null)

    await moveTodoTemplate('tpl-1', 'up')

    expect(mockPrisma.todoTemplate.update).not.toHaveBeenCalled()
  })

  it('未ログインで Unauthorized を投げる', async () => {
    mockNoSession()
    await expect(moveTodoTemplate('tpl-1', 'up')).rejects.toThrow('認証が必要')
  })
})
