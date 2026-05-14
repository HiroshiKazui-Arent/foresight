import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from './setup'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))

import { auth } from '@/lib/auth'
import { submitDailyReport } from '@/server/actions/daily-report'

async function createTestUser(email: string) {
  return prisma.user.create({ data: { email, name: 'Test User' } })
}

async function createProjectWithMember(userId: string) {
  const project = await prisma.project.create({
    data: {
      name: 'M03 DB Test Project',
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

async function createTodo(taskId: string, overrides: Record<string, unknown> = {}) {
  return prisma.todo.create({
    data: {
      taskId,
      name: 'Test Todo',
      weight: 100,
      started: false,
      completed: false,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      order: 0,
      ...overrides,
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// TC-M03-DB-001: DB CHECK constraint (completed=true は started=true を必須とする)
describe('TC-M03-DB-001: Todo_completed_implies_started CHECK 制約', () => {
  it('Prisma 直書き: completed=true, started=false は CHECK constraint で拒否される', async () => {
    const user = await createTestUser('m03check001@example.com')
    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)

    await expect(
      prisma.todo.create({
        data: {
          taskId: task.id,
          name: 'CHECK Violation',
          weight: 100,
          completed: true,
          started: false,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          order: 0,
        },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError)
  })

  it('Prisma 直書き: completed=true, started=true は正常に作成できる', async () => {
    const user = await createTestUser('m03valid001@example.com')
    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)

    await expect(
      prisma.todo.create({
        data: {
          taskId: task.id,
          name: 'Valid State',
          weight: 100,
          completed: true,
          started: true,
          startedAt: new Date('2026-01-05'),
          completedAt: new Date('2026-01-20'),
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          order: 0,
        },
      }),
    ).resolves.not.toBeNull()
  })

  it('update で completed=true, started=false に変更しようとすると拒否される', async () => {
    const user = await createTestUser('m03update001@example.com')
    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)
    const todo = await createTodo(task.id)

    await expect(
      prisma.todo.update({
        where: { id: todo.id },
        data: { completed: true, started: false },
      }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError)
  })
})

// TC-M03-DB-002: submitDailyReport の DB 反映 (started / startedAt / completedAt)
describe('TC-M03-DB-002: submitDailyReport の DB 反映', () => {
  it('started=true で呼び出し後、Todo.started=true と startedAt が DB に保存される', async () => {
    const user = await createTestUser('m03dr001@example.com')
    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name },
    } as never)

    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)
    const todo = await createTodo(task.id)

    await submitDailyReport(todo.id, project.id, { started: true, completed: false })

    const updated = await prisma.todo.findUnique({ where: { id: todo.id } })
    expect(updated!.started).toBe(true)
    expect(updated!.startedAt).toBeInstanceOf(Date)
    expect(updated!.completed).toBe(false)
    expect(updated!.completedAt).toBeNull()
  })

  it('completed=true で呼び出し後、Todo.completed=true と completedAt が DB に保存される', async () => {
    const user = await createTestUser('m03dr002@example.com')
    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name },
    } as never)

    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)
    const todo = await createTodo(task.id)

    await submitDailyReport(todo.id, project.id, { started: true, completed: true })

    const updated = await prisma.todo.findUnique({ where: { id: todo.id } })
    expect(updated!.started).toBe(true)
    expect(updated!.completed).toBe(true)
    expect(updated!.startedAt).toBeInstanceOf(Date)
    expect(updated!.completedAt).toBeInstanceOf(Date)
  })

  it('startedAt は最初の started=true のみ記録し、un-start 後の再 start では上書きされない', async () => {
    const user = await createTestUser('m03dr003@example.com')
    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name },
    } as never)

    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)
    const todo = await createTodo(task.id)

    // 1回目 start
    await submitDailyReport(todo.id, project.id, { started: true, completed: false })
    const afterFirst = await prisma.todo.findUnique({ where: { id: todo.id } })
    const firstStartedAt = afterFirst!.startedAt

    // un-start
    await submitDailyReport(todo.id, project.id, { started: false, completed: false })
    const afterUnStart = await prisma.todo.findUnique({ where: { id: todo.id } })
    expect(afterUnStart!.started).toBe(false)

    // 2回目 start → startedAt は DB 上の値を保持 (action は上書きしない)
    await submitDailyReport(todo.id, project.id, { started: true, completed: false })
    const afterSecond = await prisma.todo.findUnique({ where: { id: todo.id } })

    expect(afterSecond!.startedAt).toEqual(firstStartedAt)
  })

  it('started=false (un-start) で Todo.started=false が DB に反映され startedAt は保持される', async () => {
    const user = await createTestUser('m03dr004@example.com')
    vi.mocked(auth).mockResolvedValue({
      user: { id: user.id, email: user.email, name: user.name },
    } as never)

    const project = await createProjectWithMember(user.id)
    const milestone = await createMilestone(project.id)
    const task = await createTask(milestone.id)
    const todo = await createTodo(task.id, { started: true, startedAt: new Date('2026-01-05') })

    await submitDailyReport(todo.id, project.id, { started: false, completed: false })

    const updated = await prisma.todo.findUnique({ where: { id: todo.id } })
    expect(updated!.started).toBe(false)
    // startedAt は action が上書きしないため DB 上の値を保持
    expect(updated!.startedAt).toEqual(new Date('2026-01-05'))
  })
})
