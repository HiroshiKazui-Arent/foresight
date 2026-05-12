import { describe, it, expect } from 'vitest'
import {
  calcCompletionDate,
  calcSlipDays,
  buildRecommendation,
  buildDashboardData,
} from '@/lib/forecast'

// ===========================
// calcCompletionDate
// ===========================
describe('calcCompletionDate', () => {
  const startDate = new Date('2026-01-01')
  const endDate = new Date('2026-02-01')

  it('actualPct=0 は null を返す', () => {
    const today = new Date('2026-01-10')
    expect(calcCompletionDate(0, startDate, endDate, today)).toBeNull()
  })

  it('actualPct=100 は today を返す', () => {
    const today = new Date('2026-01-15')
    const result = calcCompletionDate(100, startDate, endDate, today)
    expect(result).toEqual(today)
  })

  it('today が startDate より前(未着手)は null を返す', () => {
    const today = new Date('2025-12-25')
    expect(calcCompletionDate(50, startDate, endDate, today)).toBeNull()
  })

  it('actualPct=50, 経過5日 → today + 5日後に完了予測', () => {
    const today = new Date('2026-01-06')
    const result = calcCompletionDate(50, startDate, endDate, today)
    const expected = new Date('2026-01-11')
    expect(result).not.toBeNull()
    expect(result!.toDateString()).toBe(expected.toDateString())
  })

  it('actualPct=20, 経過5日 → today + 20日後に完了予測', () => {
    const today = new Date('2026-01-06')
    const result = calcCompletionDate(20, startDate, endDate, today)
    const expected = new Date('2026-01-26')
    expect(result).not.toBeNull()
    expect(result!.toDateString()).toBe(expected.toDateString())
  })

  it('actualPct=-5 はクランプされ 0 扱いとなり null を返す', () => {
    const today = new Date('2026-01-10')
    expect(calcCompletionDate(-5, startDate, endDate, today)).toBeNull()
  })
})

// ===========================
// calcSlipDays
// ===========================
describe('calcSlipDays', () => {
  const endDate = new Date('2026-02-01')

  it('completionDate が null は 0 を返す', () => {
    expect(calcSlipDays(null, endDate)).toBe(0)
  })

  it('completionDate が endDate より前または同じは 0 を返す', () => {
    const completionBeforeEnd = new Date('2026-01-28')
    expect(calcSlipDays(completionBeforeEnd, endDate)).toBe(0)
    const completionOnEnd = new Date('2026-02-01')
    expect(calcSlipDays(completionOnEnd, endDate)).toBe(0)
  })

  it('completionDate が endDate + 3日は約3を返す', () => {
    const completionDate = new Date('2026-02-04')
    const result = calcSlipDays(completionDate, endDate)
    expect(result).toBeCloseTo(3, 1)
  })
})

// ===========================
// buildRecommendation
// ===========================
describe('buildRecommendation', () => {
  it('status=warning, slipDays=5 → スリップ日数を含む大幅遅延メッセージ', () => {
    expect(buildRecommendation('warning', 5)).toBe(
      '大幅遅延: 5日のスリップ予測 — 即時対応が必要です',
    )
  })

  it('status=delayed, slipDays=0 → 遅延傾向の確認推奨メッセージ', () => {
    expect(buildRecommendation('delayed', 0)).toBe('遅延傾向 — 進捗確認を推奨')
  })

  it('status=warning, slipDays=0 → スリップ予測なしの大幅遅延メッセージ', () => {
    expect(buildRecommendation('warning', 0)).toBe('大幅遅延(-20%以上) — 即時対応が必要です')
  })

  it('status=delayed, slipDays=3 → スリップ日数付き遅延傾向メッセージ', () => {
    expect(buildRecommendation('delayed', 3)).toBe(
      '遅延傾向: 3日のスリップ予測 — 担当者への確認を推奨',
    )
  })

  it('status=on-track → 空文字を返す', () => {
    expect(buildRecommendation('on-track', 0)).toBe('')
  })
})

// ===========================
// buildDashboardData (M-01: ToDo は completed ベース、warningTodos は date-based)
// ===========================

function makeTodo(overrides: {
  id?: string
  name?: string
  startDate?: Date
  endDate?: Date
  completed?: boolean
  weight?: number
  order?: number
}) {
  return {
    id: overrides.id ?? 'todo-1',
    name: overrides.name ?? 'ToDo 1',
    startDate: overrides.startDate ?? new Date('2026-01-01'),
    endDate: overrides.endDate ?? new Date('2026-02-01'),
    completed: overrides.completed ?? false,
    weight: overrides.weight ?? 100,
    order: overrides.order ?? 1,
    taskId: 'task-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

function makeTask(overrides: {
  id?: string
  name?: string
  startDate?: Date
  endDate?: Date
  todos?: ReturnType<typeof makeTodo>[]
  milestoneId?: string
  order?: number
}) {
  return {
    id: overrides.id ?? 'task-1',
    name: overrides.name ?? 'Task 1',
    startDate: overrides.startDate ?? new Date('2026-01-01'),
    endDate: overrides.endDate ?? new Date('2026-02-01'),
    todos: overrides.todos ?? [],
    milestoneId: overrides.milestoneId ?? 'ms-1',
    order: overrides.order ?? 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

function makeMilestone(overrides: {
  id?: string
  name?: string
  startDate?: Date
  endDate?: Date
  tasks?: ReturnType<typeof makeTask>[]
  projectId?: string
  order?: number
}) {
  return {
    id: overrides.id ?? 'ms-1',
    name: overrides.name ?? 'Milestone 1',
    startDate: overrides.startDate ?? new Date('2026-01-01'),
    endDate: overrides.endDate ?? new Date('2026-02-01'),
    tasks: overrides.tasks ?? [],
    projectId: overrides.projectId ?? 'project-1',
    order: overrides.order ?? 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

function makeProject(overrides: {
  id?: string
  name?: string
  milestones?: ReturnType<typeof makeMilestone>[]
}) {
  return {
    id: overrides.id ?? 'project-1',
    name: overrides.name ?? 'Test Project',
    milestones: overrides.milestones ?? [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

describe('buildDashboardData (M-01)', () => {
  const today = new Date('2026-01-15')

  it('Milestone 0件 → allClear: true, warningMilestones 空, status: scheduled', () => {
    const project = makeProject({ milestones: [] })
    const result = buildDashboardData(project, today)

    expect(result.allClear).toBe(true)
    expect(result.warningMilestones).toHaveLength(0)
    expect(result.status).toBe('scheduled')
  })

  it('全 ToDo 完了 → allClear: true, status: completed', () => {
    const todo1 = makeTodo({ id: 'todo-a', completed: true })
    const todo2 = makeTodo({ id: 'todo-b', completed: true })
    const task = makeTask({ todos: [todo1, todo2] })
    const milestone = makeMilestone({ tasks: [task] })
    const project = makeProject({ milestones: [milestone] })
    const result = buildDashboardData(project, today)

    expect(result.allClear).toBe(true)
    expect(result.status).toBe('completed')
  })

  it('未完了 ToDo の期日が今日から 3 日未満 → warningTodos に含まれる', () => {
    // today = 2026-01-15, ToDo endDate = 2026-01-17 (2 日後) → delayed
    const warningTodo = makeTodo({
      id: 'todo-warning',
      completed: false,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-17'),
    })
    const task = makeTask({
      todos: [warningTodo],
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-17'),
    })
    const milestone = makeMilestone({
      tasks: [task],
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-17'),
    })
    const project = makeProject({ milestones: [milestone] })
    const result = buildDashboardData(project, today)

    expect(result.warningMilestones).toHaveLength(1)
    expect(result.warningMilestones[0].warningTasks.length).toBeGreaterThan(0)
    expect(result.warningMilestones[0].warningTasks[0].warningTodos).toHaveLength(1)
    expect(result.warningMilestones[0].warningTasks[0].warningTodos[0].status).toBe('delayed')
  })

  it('未完了 ToDo の期日が今日から 3 日以上先 → warningTodos に含まれない', () => {
    // today = 2026-01-15, ToDo endDate = 2026-02-01 (17 日後) → on-track
    const todo = makeTodo({
      id: 'todo-safe',
      completed: false,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
    })
    const task = makeTask({ todos: [todo] })
    const milestone = makeMilestone({ tasks: [task] })
    const project = makeProject({ milestones: [milestone] })
    const result = buildDashboardData(project, today)

    // Task 自体が warning なら warningTasks に入るが、warningTodos は空のはず
    if (
      result.warningMilestones.length > 0 &&
      result.warningMilestones[0].warningTasks.length > 0
    ) {
      expect(result.warningMilestones[0].warningTasks[0].warningTodos).toHaveLength(0)
    }
  })

  it('期日超過の未完了 ToDo → warningTodos に含まれる', () => {
    // today = 2026-01-15, ToDo endDate = 2026-01-10 (5 日前) → delayed
    const overdueTodo = makeTodo({
      id: 'todo-overdue',
      completed: false,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
    })
    const task = makeTask({
      todos: [overdueTodo],
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
    })
    const milestone = makeMilestone({
      tasks: [task],
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
    })
    const project = makeProject({ milestones: [milestone] })
    const result = buildDashboardData(project, today)

    expect(result.warningMilestones).toHaveLength(1)
    expect(result.warningMilestones[0].warningTasks[0].warningTodos).toHaveLength(1)
    expect(result.warningMilestones[0].warningTasks[0].warningTodos[0].recommendation).toMatch(
      /期日超過/,
    )
  })

  it('completed=true の ToDo は期日超過でも warningTodos に含まれない', () => {
    const completedTodo = makeTodo({
      id: 'todo-completed',
      completed: true,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
    })
    const task = makeTask({
      todos: [completedTodo],
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
    })
    const milestone = makeMilestone({
      tasks: [task],
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
    })
    const project = makeProject({ milestones: [milestone] })
    const result = buildDashboardData(project, today)

    // Task は完了済み (100%) なので warningTasks も警告なし
    if (
      result.warningMilestones.length > 0 &&
      result.warningMilestones[0].warningTasks.length > 0
    ) {
      expect(result.warningMilestones[0].warningTasks[0].warningTodos).toHaveLength(0)
    }
  })

  it('Milestone 自体が warning でも Tasks が全 on-track/completed/scheduled なら warningTasks は空', () => {
    // today = 2026-02-15
    // Task 1: 完了済み (期間 01-01〜01-10)
    // Task 2,3: 未来 (期間 02-20〜03-31 等)
    // Milestone 全体は actualPct 低 → warning
    const msToday = new Date('2026-02-15')
    const completedTask = makeTask({
      id: 'task-completed',
      name: 'Completed Task',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
      todos: [
        makeTodo({
          id: 'todo-c',
          completed: true,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-10'),
        }),
      ],
    })
    const futureTask1 = makeTask({
      id: 'task-future1',
      startDate: new Date('2026-02-20'),
      endDate: new Date('2026-03-31'),
      todos: [
        makeTodo({
          id: 'todo-f1',
          completed: false,
          startDate: new Date('2026-02-20'),
          endDate: new Date('2026-03-31'),
        }),
      ],
    })
    const futureTask2 = makeTask({
      id: 'task-future2',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      todos: [
        makeTodo({
          id: 'todo-f2',
          completed: false,
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-03-31'),
        }),
      ],
    })
    const warningMilestone = makeMilestone({
      id: 'ms-warning',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      tasks: [completedTask, futureTask1, futureTask2],
    })
    const project = makeProject({ milestones: [warningMilestone] })
    const result = buildDashboardData(project, msToday)

    expect(result.warningMilestones).toHaveLength(1)
    expect(result.warningMilestones[0].status).toBe('warning')
    expect(result.warningMilestones[0].warningTasks).toHaveLength(0)
    expect(result.allClear).toBe(false)
  })
})
