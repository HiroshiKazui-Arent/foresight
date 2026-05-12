/**
 * Phase 1 Step 4 — screens (A2/A3) に関するユニットテスト
 *
 * テスト対象:
 *   1. getUserProjects — include オプションで Milestone/Task/Todo ツリーを取得する
 *   2. ProgressBarData 計算ロジック — プロジェクト一覧ページで使うユーティリティ関数
 */

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
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    projectMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  return { mockPrisma }
})

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'admin@example.com', name: 'Admin' },
  }),
}))

vi.mock('@/lib/authz', () => ({
  requireProjectMember: vi.fn().mockResolvedValue('user-1'),
}))

import { getUserProjects } from '@/server/actions/project'

// ---------------------------------------------------------------------------
// getUserProjects — include ツリー確認
// ---------------------------------------------------------------------------

describe('getUserProjects (include ツリー)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('milestones.tasks.todos を include したクエリを発行する', async () => {
    mockPrisma.project.findMany.mockResolvedValue([])

    await getUserProjects()

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          milestones: expect.objectContaining({
            include: expect.objectContaining({
              tasks: expect.objectContaining({
                include: expect.objectContaining({
                  todos: true,
                }),
              }),
            }),
          }),
        }),
      }),
    )
  })

  it('Milestone/Task/Todo を含むプロジェクト一覧を返す', async () => {
    const todo = {
      id: 'todo-1',
      actualPct: 50,
      weight: 100,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-01'),
    }
    const task = {
      id: 'task-1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-01'),
      todos: [todo],
    }
    const milestone = {
      id: 'ms-1',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-01'),
      tasks: [task],
    }
    const project = {
      id: 'proj-1',
      name: 'Test Project',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-01'),
      milestones: [milestone],
    }
    mockPrisma.project.findMany.mockResolvedValue([project])

    const result = await getUserProjects()

    expect(result).toHaveLength(1)
    expect(result[0].milestones).toHaveLength(1)
    expect(result[0].milestones[0].tasks).toHaveLength(1)
    expect(result[0].milestones[0].tasks[0].todos).toHaveLength(1)
  })

  it('マイルストーンがないプロジェクトは milestones: [] を返す', async () => {
    const project = {
      id: 'proj-empty',
      name: 'Empty Project',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-01'),
      milestones: [],
    }
    mockPrisma.project.findMany.mockResolvedValue([project])

    const result = await getUserProjects()

    expect(result[0].milestones).toEqual([])
  })

  it('未認証の場合は redirect される', async () => {
    const { auth } = await import('@/lib/auth')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth as any).mockResolvedValueOnce(null)

    await expect(getUserProjects()).rejects.toThrow('REDIRECT:/login')
  })

  it('プロジェクトが存在しない場合は空配列を返す', async () => {
    mockPrisma.project.findMany.mockResolvedValue([])

    const result = await getUserProjects()

    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// ProgressBarData 計算 — プロジェクト一覧ページで実行する計算
// ---------------------------------------------------------------------------

import {
  calcProjectActualPct,
  calcMilestoneActualPct,
  calcTaskActualPct,
  calcScheduledPct,
  calcStatus,
  calcDaysDeviation,
} from '@/lib/progress'

describe('プロジェクト一覧ページ: ProgressBarData 計算', () => {
  const today = new Date('2026-05-12')

  it('単純なツリーで ProgressBarData が正しく計算される', () => {
    // Todo: actualPct=60, weight=100
    // Task: startDate〜endDate (期間あり)
    // Milestone: 1 Task
    // Project: 1 Milestone
    const todos = [{ actualPct: 60, weight: 100 }]
    const taskActual = calcTaskActualPct(todos)
    expect(taskActual).toBe(60)

    const taskStartDate = new Date('2026-01-01')
    const taskEndDate = new Date('2026-12-31')
    const milestoneActual = calcMilestoneActualPct([
      { actualPct: taskActual, startDate: taskStartDate, endDate: taskEndDate },
    ])
    expect(milestoneActual).toBe(60)

    const projectStartDate = new Date('2026-01-01')
    const projectEndDate = new Date('2026-12-31')
    const projectActual = calcProjectActualPct([
      { actualPct: milestoneActual, startDate: projectStartDate, endDate: projectEndDate },
    ])
    expect(projectActual).toBe(60)

    const scheduled = calcScheduledPct(projectStartDate, projectEndDate, today)
    const status = calcStatus(projectActual, scheduled)
    const durationDays =
      (projectEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)
    const daysDeviation = calcDaysDeviation(projectActual, scheduled, durationDays)

    expect(scheduled).toBeGreaterThan(0)
    expect(scheduled).toBeLessThan(100)
    expect(['completed', 'on-track', 'delayed', 'warning', 'scheduled']).toContain(status)
    expect(typeof daysDeviation).toBe('number')
  })

  it('空のマイルストーンツリーは actualPct=0 になる', () => {
    const projectActual = calcProjectActualPct([])
    expect(projectActual).toBe(0)
  })

  it('全 Todo が完了なら projectActual=100 かつ status=completed', () => {
    const todos = [
      { actualPct: 100, weight: 50 },
      { actualPct: 100, weight: 50 },
    ]
    const taskActual = calcTaskActualPct(todos)
    const start = new Date('2026-01-01')
    const end = new Date('2026-12-31')
    const milestoneActual = calcMilestoneActualPct([
      { actualPct: taskActual, startDate: start, endDate: end },
    ])
    const projectActual = calcProjectActualPct([
      { actualPct: milestoneActual, startDate: start, endDate: end },
    ])

    expect(projectActual).toBe(100)
    expect(calcStatus(projectActual, 50)).toBe('completed')
  })

  it('進捗が大幅に遅れている場合 status=warning になる', () => {
    // actualPct=10, scheduledPct=50 → gap=-40 → warning
    expect(calcStatus(10, 50)).toBe('warning')
  })

  it('期間日数0の場合 daysDeviation は 0 になる', () => {
    expect(calcDaysDeviation(50, 70, 0)).toBe(0)
  })
})
