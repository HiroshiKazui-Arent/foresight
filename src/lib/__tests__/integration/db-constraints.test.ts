import { describe, it, expect } from 'vitest'
import { prisma } from './setup'

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

async function createTestTodo(taskId: string, name = 'Test Todo') {
  return prisma.todo.create({
    data: {
      taskId,
      name,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      order: 0,
    },
  })
}

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

describe('TC-DATA-006: ProjectMember 複合ユニーク制約', () => {
  it('同じ (projectId, userId) の ProjectMember を二重作成すると拒否される', async () => {
    const user = await createTestUser('dup1')
    const project = await createTestProject(user.id)

    await expect(
      prisma.projectMember.create({ data: { projectId: project.id, userId: user.id } }),
    ).rejects.toThrow()
  })
})

describe('TC-MODEL-001: User.email ユニーク制約', () => {
  it('同じ email の User を二重作成すると拒否される', async () => {
    await prisma.user.create({ data: { email: 'unique@example.com', name: 'User1' } })
    await expect(
      prisma.user.create({ data: { email: 'unique@example.com', name: 'User2' } }),
    ).rejects.toThrow()
  })
})

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

describe('TC-MODEL-004: ProjectMember 複合ユニーク', () => {
  it('重複 ProjectMember 作成が拒否される', async () => {
    const user = await createTestUser('model004')
    const project = await createTestProject(user.id)
    await expect(
      prisma.projectMember.create({ data: { projectId: project.id, userId: user.id } }),
    ).rejects.toThrow()
  })
})

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

describe('TC-MODEL-007: Task 日付バリデーションはアプリ層', () => {
  it('DB 直接書き込みでは startDate > endDate を許容する', async () => {
    const user = await createTestUser('model007')
    const project = await createTestProject(user.id)
    const milestone = await createTestMilestone(project.id)
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
