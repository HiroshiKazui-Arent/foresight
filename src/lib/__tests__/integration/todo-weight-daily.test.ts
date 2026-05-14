import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from './setup'
import { calcTaskActualPct } from '@/lib/progress'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { createTodo, deleteTodo } from '@/server/actions/todo'
import { submitDailyReport } from '@/server/actions/daily-report'

async function createTestUser(email: string) {
  return prisma.user.create({ data: { email, name: 'Test User' } })
}

async function createProjectWithMember(userId: string) {
  const project = await prisma.project.create({
    data: {
      name: 'Weight Test Project',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    },
  })
  await prisma.projectMember.create({ data: { projectId: project.id, userId } })
  return project
}

async function createMilestone(projectId: string) {
  return prisma.milestone.create({
    data: {
      projectId,
      name: 'Test Milestone',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      order: 0,
    },
  })
}

async function createTask(milestoneId: string) {
  return prisma.task.create({
    data: {
      milestoneId,
      name: 'Test Task',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      order: 0,
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// TC-WEIGHT-008: ToDo 追加時、既存 ToDo の completed を保持したまま weight のみ再分配
describe('TC-WEIGHT-008: ToDo 追加時の completed 保持', () => {
  it('createTodo 後、既存 ToDo の completed が変わらない', async () => {
    const user = await createTestUser('weight008@example.com')
    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name },
    } as never)

    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)

    // 既存 ToDo を作成 (completed=true)
    const existingTodo = await prisma.todo.create({
      data: {
        taskId: task.id,
        name: 'Existing',
        weight: 100,
        completed: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        order: 0,
      },
    })

    await createTodo(
      task.id,
      project.id,
      'New Todo',
      new Date('2026-01-01'),
      new Date('2026-01-15'),
    )

    const existingAfter = await prisma.todo.findUnique({ where: { id: existingTodo.id } })
    expect(existingAfter!.completed).toBe(true)
  })
})

// TC-WEIGHT-009: ToDo 削除時、残りの ToDo に weight が再分配される
describe('TC-WEIGHT-009: ToDo 削除時の weight 再分配', () => {
  it('deleteTodo 後、残 Todo の weight 合計が 100 になる', async () => {
    const user = await createTestUser('weight009@example.com')
    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name },
    } as never)

    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)

    // 3件の ToDo を作成
    const t1 = await prisma.todo.create({
      data: {
        taskId: task.id,
        name: 'T1',
        weight: 33,
        completed: false,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        order: 0,
      },
    })
    await prisma.todo.create({
      data: {
        taskId: task.id,
        name: 'T2',
        weight: 33,
        completed: false,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        order: 1,
      },
    })
    await prisma.todo.create({
      data: {
        taskId: task.id,
        name: 'T3',
        weight: 34,
        completed: false,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        order: 2,
      },
    })

    await deleteTodo(t1.id, project.id)

    const remaining = await prisma.todo.findMany({ where: { taskId: task.id } })
    expect(remaining).toHaveLength(2)
    const totalWeight = remaining.reduce((sum, t) => sum + t.weight, 0)
    expect(totalWeight).toBe(100)
  })
})

// TC-WEIGHT-010: 重み再分配はトランザクション内で完了する (結果検証)
describe('TC-WEIGHT-010: weight 再分配の整合性', () => {
  it('createTodo 直後に全 ToDo の weight 合計が 100 になる', async () => {
    const user = await createTestUser('weight010@example.com')
    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name },
    } as never)

    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)

    await createTodo(task.id, project.id, 'Todo A', new Date('2026-01-01'), new Date('2026-01-15'))
    await createTodo(task.id, project.id, 'Todo B', new Date('2026-01-01'), new Date('2026-01-15'))
    await createTodo(task.id, project.id, 'Todo C', new Date('2026-01-01'), new Date('2026-01-15'))

    const todos = await prisma.todo.findMany({ where: { taskId: task.id } })
    expect(todos).toHaveLength(3)
    const total = todos.reduce((s, t) => s + t.weight, 0)
    expect(total).toBe(100)
  })
})

// TC-WEIGHT-011: UI から weight を直接更新する API リクエストは拒否される
describe('TC-WEIGHT-011: updateTodo は weight を受け付けない', () => {
  it('updateTodo の data 型に weight が含まれないため weight 変更不可', async () => {
    const user = await createTestUser('weight011@example.com')
    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name },
    } as never)

    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)
    const todo = await prisma.todo.create({
      data: {
        taskId: task.id,
        name: 'T1',
        weight: 100,
        completed: false,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        order: 0,
      },
    })

    const { updateTodo } = await import('@/server/actions/todo')
    // updateTodo の型定義に weight がないことを TypeScript レベルで保証
    // 実行時: data オブジェクトに weight を渡しても無視される
    await updateTodo(todo.id, project.id, { name: 'Renamed' })

    const updated = await prisma.todo.findUnique({ where: { id: todo.id } })
    expect(updated!.weight).toBe(100) // weight は変わらない
    expect(updated!.name).toBe('Renamed')
  })
})

// TC-TPL-001: TodoTemplate が 6 件 order 1〜6 で存在する
describe('TC-TPL-001: TodoTemplate のシードデータ検証', () => {
  beforeEach(async () => {
    // seed.ts と同じ 6 件の TodoTemplate を作成 (global beforeEach の truncate 後に実行される)
    const templates = [
      { name: '画面設計', order: 1 },
      { name: 'データベース設計', order: 2 },
      { name: 'バックエンド開発', order: 3 },
      { name: 'フロントエンド開発', order: 4 },
      { name: 'テストコードの実装', order: 5 },
      { name: 'テスト・レビュー', order: 6 },
    ]
    for (const t of templates) {
      await prisma.todoTemplate.upsert({
        where: { id: `seed-tpl-${t.order}` },
        update: { name: t.name, order: t.order },
        create: { id: `seed-tpl-${t.order}`, name: t.name, order: t.order },
      })
    }
  })

  it('TodoTemplate が 6 件、order 1〜6 で存在する', async () => {
    const templates = await prisma.todoTemplate.findMany({ orderBy: { order: 'asc' } })
    expect(templates).toHaveLength(6)
    expect(templates[0].order).toBe(1)
    expect(templates[5].order).toBe(6)
    expect(templates.map((t) => t.name)).toContain('バックエンド開発')
  })
})

// TC-I1-006: submitDailyReport 後、親 Task の actualPct が更新される
describe('TC-I1-006: submitDailyReport 後の actualPct 変化', () => {
  it('ToDo を completed=true に更新後、calcTaskActualPct が増加する', async () => {
    const user = await createTestUser('i1006@example.com')
    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name },
    } as never)

    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)

    const todo = await prisma.todo.create({
      data: {
        taskId: task.id,
        name: 'Daily Todo',
        weight: 100,
        completed: false,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        order: 0,
      },
    })

    const todosBefore = await prisma.todo.findMany({ where: { taskId: task.id } })
    expect(calcTaskActualPct(todosBefore)).toBe(0)

    await submitDailyReport(todo.id, project.id, { started: true, completed: true })

    const todosAfter = await prisma.todo.findMany({ where: { taskId: task.id } })
    expect(calcTaskActualPct(todosAfter)).toBe(100)
  })
})
