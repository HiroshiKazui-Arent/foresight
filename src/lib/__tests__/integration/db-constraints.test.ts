import { describe, it, expect } from 'vitest'
import { prisma } from './setup'
import { calcTaskActualPct } from '@/lib/progress'

async function createTestUser(suffix: string) {
  return prisma.user.create({
    data: { email: `testuser${suffix}@example.com`, name: `Test ${suffix}` },
  })
}

async function createTestProject(userId: string, suffix = '') {
  const project = await prisma.project.create({
    data: {
      name: `Test Project${suffix}`,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
    },
  })
  await prisma.projectMember.create({ data: { projectId: project.id, userId } })
  return project
}

async function createTestMilestone(projectId: string) {
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

async function createTestTask(milestoneId: string) {
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

async function createTestTodo(taskId: string, name = 'Test Todo', completed = false) {
  return prisma.todo.create({
    data: {
      taskId,
      name,
      weight: 100,
      completed,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      order: 0,
    },
  })
}

// TC-DATA-001: Milestone は有効な projectId がないと作成不可
describe('TC-DATA-001: Milestone FK 制約', () => {
  it('存在しない projectId での Milestone 作成は拒否される', async () => {
    await expect(
      prisma.milestone.create({
        data: {
          projectId: 'nonexistent-project-id',
          name: 'Should Fail',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          order: 0,
        },
      }),
    ).rejects.toThrow()
  })
})

// TC-DATA-002: Project 削除で Milestone/Task/Todo がカスケード削除
describe('TC-DATA-002: Project カスケード削除', () => {
  it('Project 削除で Milestone/Task/Todo が全件削除される', async () => {
    const user = await createTestUser('cascade1')
    const project = await createTestProject(user.id)
    const milestone = await createTestMilestone(project.id)
    const task = await createTestTask(milestone.id)
    const todo = await createTestTodo(task.id)

    await prisma.project.delete({ where: { id: project.id } })

    await expect(prisma.milestone.findUnique({ where: { id: milestone.id } })).resolves.toBeNull()
    await expect(prisma.task.findUnique({ where: { id: task.id } })).resolves.toBeNull()
    await expect(prisma.todo.findUnique({ where: { id: todo.id } })).resolves.toBeNull()
  })
})

// TC-DATA-003: Milestone 削除で Task が全件削除
describe('TC-DATA-003: Milestone カスケード削除', () => {
  it('Milestone 削除で配下 Task が全件削除される', async () => {
    const user = await createTestUser('cascade2')
    const project = await createTestProject(user.id)
    const milestone = await createTestMilestone(project.id)
    const task = await createTestTask(milestone.id)

    await prisma.milestone.delete({ where: { id: milestone.id } })

    await expect(prisma.task.findUnique({ where: { id: task.id } })).resolves.toBeNull()
  })
})

// TC-DATA-004: Task 削除で Todo が全件削除
describe('TC-DATA-004: Task カスケード削除', () => {
  it('Task 削除で配下 Todo が全件削除される', async () => {
    const user = await createTestUser('cascade3')
    const project = await createTestProject(user.id)
    const milestone = await createTestMilestone(project.id)
    const task = await createTestTask(milestone.id)
    const todo = await createTestTodo(task.id)

    await prisma.task.delete({ where: { id: task.id } })

    await expect(prisma.todo.findUnique({ where: { id: todo.id } })).resolves.toBeNull()
  })
})

// TC-DATA-005: User 削除で ProjectMember がカスケード削除
describe('TC-DATA-005: User カスケード削除', () => {
  it('User 削除で ProjectMember が削除される', async () => {
    const user = await createTestUser('cascade4')
    const project = await createTestProject(user.id)
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    })
    expect(member).not.toBeNull()

    await prisma.user.delete({ where: { id: user.id } })

    await expect(
      prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
      }),
    ).resolves.toBeNull()
  })
})

// TC-DATA-006: (projectId, userId) の ProjectMember 重複は不可
describe('TC-DATA-006: ProjectMember 複合ユニーク制約', () => {
  it('同じ (projectId, userId) の ProjectMember を二重作成すると拒否される', async () => {
    const user = await createTestUser('dup1')
    const project = await createTestProject(user.id)

    await expect(
      prisma.projectMember.create({ data: { projectId: project.id, userId: user.id } }),
    ).rejects.toThrow()
  })
})

// TC-DATA-010: Task/Milestone/Project に actualPct 相当のフィールドがない
describe('TC-DATA-010: actualPct はアプリ層で計算される (DB 列として存在しない)', () => {
  it('Task に actualPct 列が存在せず、todos から計算される', async () => {
    const user = await createTestUser('data010')
    const project = await createTestProject(user.id)
    const milestone = await createTestMilestone(project.id)
    const task = await createTestTask(milestone.id)
    await prisma.todo.createMany({
      data: [
        {
          taskId: task.id,
          name: 'T1',
          weight: 50,
          started: true, // M-03 CHECK 制約 (completed=true → started=true)
          completed: true,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-15'),
          order: 0,
        },
        {
          taskId: task.id,
          name: 'T2',
          weight: 50,
          completed: false,
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-31'),
          order: 1,
        },
      ],
    })

    const dbTask = await prisma.task.findUnique({ where: { id: task.id } })
    expect(dbTask).not.toBeNull()
    // actualPct は DB に保存されない (フィールドが存在しない)
    expect((dbTask as Record<string, unknown>)['actualPct']).toBeUndefined()
  })
})

// TC-DATA-011: Todo.completed 更新後に calcTaskActualPct が正しく計算される
describe('TC-DATA-011: Todo.completed 更新で Task actualPct が変化する', () => {
  it('completed を true にすると calcTaskActualPct が 100% になる', async () => {
    const user = await createTestUser('data011')
    const project = await createTestProject(user.id)
    const milestone = await createTestMilestone(project.id)
    const task = await createTestTask(milestone.id)
    const todo = await createTestTodo(task.id, 'Single Todo', false)

    const todosBefore = await prisma.todo.findMany({ where: { taskId: task.id } })
    expect(calcTaskActualPct(todosBefore)).toBe(0)

    // M-03 CHECK 制約 (completed=true → started=true) に従い started も同時に true へ
    await prisma.todo.update({
      where: { id: todo.id },
      data: { started: true, completed: true },
    })

    const todosAfter = await prisma.todo.findMany({ where: { taskId: task.id } })
    expect(calcTaskActualPct(todosAfter)).toBe(100)
  })
})

// TC-MODEL-001: User.email は一意
describe('TC-MODEL-001: User.email ユニーク制約', () => {
  it('同じ email の User を二重作成すると拒否される', async () => {
    await prisma.user.create({ data: { email: 'unique@example.com', name: 'User1' } })
    await expect(
      prisma.user.create({ data: { email: 'unique@example.com', name: 'User2' } }),
    ).rejects.toThrow()
  })
})

// TC-MODEL-002: Invitation.token は一意
describe('TC-MODEL-002: Invitation.token ユニーク制約', () => {
  it('同じ token の Invitation を二重作成すると拒否される', async () => {
    const user = await createTestUser('inv-token1')
    const data = {
      email: 'inv1@example.com',
      token: 'duplicate-token-abc123',
      invitedById: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }
    await prisma.invitation.create({ data })
    await expect(
      prisma.invitation.create({ data: { ...data, email: 'inv2@example.com' } }),
    ).rejects.toThrow()
  })
})

// TC-MODEL-003: Session.sessionToken は一意
describe('TC-MODEL-003: Session.sessionToken ユニーク制約', () => {
  it('同じ sessionToken の Session を二重作成すると拒否される', async () => {
    const user = await createTestUser('session-tok')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await prisma.session.create({
      data: { sessionToken: 'dup-sess-token', userId: user.id, expires: expiresAt },
    })
    await expect(
      prisma.session.create({
        data: { sessionToken: 'dup-sess-token', userId: user.id, expires: expiresAt },
      }),
    ).rejects.toThrow()
  })
})

// TC-MODEL-004: ProjectMember(projectId, userId) 複合ユニーク (DATA-006 と同義)
describe('TC-MODEL-004: ProjectMember 複合ユニーク', () => {
  it('重複 ProjectMember 作成が拒否される', async () => {
    const user = await createTestUser('model004')
    const project = await createTestProject(user.id)
    await expect(
      prisma.projectMember.create({ data: { projectId: project.id, userId: user.id } }),
    ).rejects.toThrow()
  })
})

// TC-MODEL-005: VerificationToken(identifier, token) 複合ユニーク
describe('TC-MODEL-005: VerificationToken 複合ユニーク', () => {
  it('同じ (identifier, token) の VerificationToken を二重作成すると拒否される', async () => {
    const data = {
      identifier: 'test@example.com',
      token: 'verify-token-xyz',
      expires: new Date(Date.now() + 60 * 60 * 1000),
    }
    await prisma.verificationToken.create({ data })
    await expect(prisma.verificationToken.create({ data })).rejects.toThrow()
  })
})

// TC-MODEL-006: Todo.weight の合計が 100 であることをアプリ層で保証 (createTodo経由で検証はStep5)
// ここでは DB レベルで weight 制約がない(アプリ層のみ)ことを確認
describe('TC-MODEL-006: Todo.weight 合計はアプリ層で管理される', () => {
  it('DB 直接書き込みでは weight 制約がなく任意の値を設定できる', async () => {
    const user = await createTestUser('model006')
    const project = await createTestProject(user.id)
    const milestone = await createTestMilestone(project.id)
    const task = await createTestTask(milestone.id)
    // DB 直接書き込みでは weight の合計チェックが存在しない
    await expect(
      prisma.todo.create({
        data: {
          taskId: task.id,
          name: 'Unbalanced',
          weight: 999,
          completed: false,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          order: 0,
        },
      }),
    ).resolves.not.toBeNull()
  })
})

// TC-MODEL-007: Task.startDate <= Task.endDate の制約(アプリ層バリデーション)
// DB レベルでは制約がなく、アプリ層のみで制約することを確認
describe('TC-MODEL-007: Task 日付バリデーションはアプリ層', () => {
  it('DB 直接書き込みでは startDate > endDate を許容する', async () => {
    const user = await createTestUser('model007')
    const project = await createTestProject(user.id)
    const milestone = await createTestMilestone(project.id)
    // DB 直接書き込みでは startDate > endDate がエラーにならない
    await expect(
      prisma.task.create({
        data: {
          milestoneId: milestone.id,
          name: 'Invalid Date Range',
          startDate: new Date('2026-01-31'),
          endDate: new Date('2026-01-01'),
          order: 0,
        },
      }),
    ).resolves.not.toBeNull()
  })
})
