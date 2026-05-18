import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    // 実際の Next.js notFound() は digest = 'NEXT_NOT_FOUND' を持つ throw を投げる
    const e = new Error('NEXT_NOT_FOUND') as Error & { digest: string }
    e.digest = 'NEXT_NOT_FOUND'
    throw e
  }),
  redirect: vi.fn(),
}))

// Prisma error classes をモック (instanceof チェック用)
const { MockPrismaKnownError } = vi.hoisted(() => {
  class MockPrismaKnownError extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.code = code
      this.name = 'PrismaClientKnownRequestError'
    }
  }
  return { MockPrismaKnownError }
})

vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual<typeof import('@prisma/client')>('@prisma/client')
  return {
    ...actual,
    Prisma: {
      ...actual.Prisma,
      PrismaClientKnownRequestError: MockPrismaKnownError,
      PrismaClientUnknownRequestError: class extends Error {},
      PrismaClientValidationError: class extends Error {},
    },
  }
})

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    todo: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  }
  return { mockPrisma }
})

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/authz', () => ({
  requireProjectMember: vi.fn().mockResolvedValue('user-1'),
}))

import { updateTodoActualDates } from '@/server/actions/progress'
import { revalidatePath } from 'next/cache'
import { requireProjectMember } from '@/lib/authz'

const todoId = 'todo-1'
const projectId = 'proj-1'

function resolveSuccessfulUpdate(currentTodo: Partial<Todo> = {}) {
  mockPrisma.todo.updateMany.mockResolvedValue({ count: 1 })
  mockPrisma.todo.findUniqueOrThrow.mockResolvedValue({
    id: todoId,
    taskId: 'task-1',
    name: 'Sample',
    order: 0,
    startDate: new Date('2026-04-01'),
    endDate: new Date('2026-04-30'),
    actualStartDate: null,
    actualEndDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...currentTodo,
  })
}

// 必要最小限の Todo 型 (mock の戻り値 shape 用)
type Todo = {
  id: string
  taskId: string
  name: string
  order: number
  startDate: Date
  endDate: Date
  actualStartDate: Date | null
  actualEndDate: Date | null
  createdAt: Date
  updatedAt: Date
}

describe('updateTodoActualDates — 正常系', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('着手日のみ入力できる (進捗 0%、未完了)', async () => {
    const start = new Date('2026-04-05')
    resolveSuccessfulUpdate({ actualStartDate: start })
    await updateTodoActualDates(todoId, projectId, {
      actualStartDate: start,
      actualEndDate: null,
    })
    expect(requireProjectMember).toHaveBeenCalledWith(projectId)
    expect(mockPrisma.todo.updateMany).toHaveBeenCalledOnce()
    const callData = mockPrisma.todo.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>
      data: Record<string, unknown>
    }
    expect(callData.data.actualStartDate).toEqual(start)
    expect(callData.data.actualEndDate).toBeNull()
    // 必ず projectId スコープ付きで update する (IDOR 防止)
    expect(callData.where).toEqual({
      id: todoId,
      task: { milestone: { projectId } },
    })
    expect(revalidatePath).toHaveBeenCalled()
  })

  it('着手日+完了日 を入力できる (進捗 100%)', async () => {
    const start = new Date('2026-04-05')
    const end = new Date('2026-04-20')
    resolveSuccessfulUpdate({ actualStartDate: start, actualEndDate: end })
    await updateTodoActualDates(todoId, projectId, {
      actualStartDate: start,
      actualEndDate: end,
    })
    const callData = mockPrisma.todo.updateMany.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(callData.data.actualStartDate).toEqual(start)
    expect(callData.data.actualEndDate).toEqual(end)
  })

  it('着手日も完了日も null にクリアできる (取り消し)', async () => {
    resolveSuccessfulUpdate()
    await updateTodoActualDates(todoId, projectId, {
      actualStartDate: null,
      actualEndDate: null,
    })
    const callData = mockPrisma.todo.updateMany.mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(callData.data.actualStartDate).toBeNull()
    expect(callData.data.actualEndDate).toBeNull()
  })
})

describe('updateTodoActualDates — バリデーション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('完了日があるのに着手日が null は拒否 (完了するなら着手済みのはず)', async () => {
    await expect(
      updateTodoActualDates(todoId, projectId, {
        actualStartDate: null,
        actualEndDate: new Date('2026-04-20'),
      }),
    ).rejects.toThrow(/着手日/)
    expect(mockPrisma.todo.updateMany).not.toHaveBeenCalled()
  })

  it('actualStartDate > actualEndDate は拒否', async () => {
    await expect(
      updateTodoActualDates(todoId, projectId, {
        actualStartDate: new Date('2026-04-20'),
        actualEndDate: new Date('2026-04-10'),
      }),
    ).rejects.toThrow(/着手日は完了日より前/)
    expect(mockPrisma.todo.updateMany).not.toHaveBeenCalled()
  })

  it('actualStartDate === actualEndDate は許容 (同日着手・完了)', async () => {
    const sameDay = new Date('2026-04-15')
    resolveSuccessfulUpdate({ actualStartDate: sameDay, actualEndDate: sameDay })
    await updateTodoActualDates(todoId, projectId, {
      actualStartDate: sameDay,
      actualEndDate: sameDay,
    })
    expect(mockPrisma.todo.updateMany).toHaveBeenCalledOnce()
  })

  it('Invalid Date は拒否', async () => {
    await expect(
      updateTodoActualDates(todoId, projectId, {
        actualStartDate: new Date('invalid'),
        actualEndDate: null,
      }),
    ).rejects.toThrow(/有効な日付/)
    expect(mockPrisma.todo.updateMany).not.toHaveBeenCalled()
  })
})

describe('updateTodoActualDates — 認可 / IDOR / 失敗時の挙動', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('update 失敗時は revalidatePath を呼ばない (DB エラー時にキャッシュ無効化しない)', async () => {
    mockPrisma.todo.updateMany.mockRejectedValueOnce(new Error('plain error'))
    await expect(
      updateTodoActualDates(todoId, projectId, {
        actualStartDate: new Date('2026-04-05'),
        actualEndDate: null,
      }),
    ).rejects.toThrow('plain error')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('Prisma の内部エラーは generic メッセージにサニタイズしてクライアントに返す', async () => {
    const prismaError = new MockPrismaKnownError('Unique constraint failed on field: name', 'P2002')
    mockPrisma.todo.updateMany.mockRejectedValueOnce(prismaError)
    await expect(
      updateTodoActualDates(todoId, projectId, {
        actualStartDate: new Date('2026-04-05'),
        actualEndDate: null,
      }),
    ).rejects.toThrow('データベースエラーが発生しました')
  })

  it('非メンバーは Forbidden (requireProjectMember が throw)', async () => {
    vi.mocked(requireProjectMember).mockRejectedValueOnce(new Error('NOT_FOUND'))
    await expect(
      updateTodoActualDates(todoId, 'proj-forbidden', {
        actualStartDate: new Date('2026-04-05'),
        actualEndDate: null,
      }),
    ).rejects.toThrow('NOT_FOUND')
    expect(mockPrisma.todo.updateMany).not.toHaveBeenCalled()
  })

  it('別プロジェクトの ToDo は更新できない (updateMany が 0 件 → notFound)', async () => {
    mockPrisma.todo.updateMany.mockResolvedValue({ count: 0 })
    await expect(
      updateTodoActualDates('todo-other-project', projectId, {
        actualStartDate: new Date('2026-04-05'),
        actualEndDate: null,
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockPrisma.todo.findUniqueOrThrow).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
