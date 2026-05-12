import { describe, it, expect } from 'vitest'
import {
  calcCompletionDate,
  calcSlipDays,
  buildRecommendation,
  buildDashboardData,
} from '@/lib/forecast'

// ===========================
// calcCompletionDate (6ケース)
// ===========================
describe('calcCompletionDate', () => {
  const startDate = new Date('2026-01-01')
  const endDate = new Date('2026-02-01')

  // ケース1: actualPct=0 → null
  it('actualPct=0 は null を返す', () => {
    const today = new Date('2026-01-10')
    expect(calcCompletionDate(0, startDate, endDate, today)).toBeNull()
  })

  // ケース2: actualPct=100 → today
  it('actualPct=100 は today を返す', () => {
    const today = new Date('2026-01-15')
    const result = calcCompletionDate(100, startDate, endDate, today)
    expect(result).toEqual(today)
  })

  // ケース3: today < startDate (未着手) → null
  it('today が startDate より前(未着手)は null を返す', () => {
    const today = new Date('2025-12-25')
    expect(calcCompletionDate(50, startDate, endDate, today)).toBeNull()
  })

  // ケース4: 順調: actualPct=50, 経過5日 → today + 5日
  it('actualPct=50, 経過5日 → today + 5日後に完了予測', () => {
    // start=2026-01-01, today=2026-01-06(5日経過), actualPct=50
    // progressPerDay = 50/5 = 10%/日
    // remainingDays = (100-50)/10 = 5日
    // completionDate = today + 5日
    const today = new Date('2026-01-06')
    const result = calcCompletionDate(50, startDate, endDate, today)
    const expected = new Date('2026-01-11')
    expect(result).not.toBeNull()
    // 日付として等しいか確認（時刻は無視して日付のみ比較）
    expect(result!.toDateString()).toBe(expected.toDateString())
  })

  // ケース5: 遅延: actualPct=20, 経過5日 → today + 20日
  it('actualPct=20, 経過5日 → today + 20日後に完了予測', () => {
    // progressPerDay = 20/5 = 4%/日
    // remainingDays = (100-20)/4 = 20日
    // completionDate = today + 20日
    const today = new Date('2026-01-06')
    const result = calcCompletionDate(20, startDate, endDate, today)
    const expected = new Date('2026-01-26')
    expect(result).not.toBeNull()
    expect(result!.toDateString()).toBe(expected.toDateString())
  })

  // ケース6: actualPct=-5 (クランプ確認) → null (0にクランプ)
  it('actualPct=-5 はクランプされ 0 扱いとなり null を返す', () => {
    const today = new Date('2026-01-10')
    expect(calcCompletionDate(-5, startDate, endDate, today)).toBeNull()
  })
})

// ===========================
// calcSlipDays (3ケース)
// ===========================
describe('calcSlipDays', () => {
  const endDate = new Date('2026-02-01')

  // ケース7: completionDate = null → 0
  it('completionDate が null は 0 を返す', () => {
    expect(calcSlipDays(null, endDate)).toBe(0)
  })

  // ケース8: completionDate <= endDate → 0
  it('completionDate が endDate より前または同じは 0 を返す', () => {
    const completionBeforeEnd = new Date('2026-01-28')
    expect(calcSlipDays(completionBeforeEnd, endDate)).toBe(0)
    const completionOnEnd = new Date('2026-02-01')
    expect(calcSlipDays(completionOnEnd, endDate)).toBe(0)
  })

  // ケース9: completionDate = endDate + 3日 → 約3
  it('completionDate が endDate + 3日は約3を返す', () => {
    const completionDate = new Date('2026-02-04') // endDate + 3日
    const result = calcSlipDays(completionDate, endDate)
    expect(result).toBeCloseTo(3, 1)
  })
})

// ===========================
// buildRecommendation (2ケース)
// ===========================
describe('buildRecommendation', () => {
  // ケース10: status='warning', slipDays=5 → 大幅遅延メッセージ
  it('status=warning, slipDays=5 → スリップ日数を含む大幅遅延メッセージ', () => {
    const result = buildRecommendation('warning', 5)
    expect(result).toBe('大幅遅延: 5日のスリップ予測 — 即時対応が必要です')
  })

  // ケース11: status='delayed', slipDays=0 → 遅延傾向メッセージ
  it('status=delayed, slipDays=0 → 遅延傾向の確認推奨メッセージ', () => {
    const result = buildRecommendation('delayed', 0)
    expect(result).toBe('遅延傾向 — 進捗確認を推奨')
  })

  // ケース12: status='warning', slipDays=0 → スリップなし大幅遅延メッセージ
  it('status=warning, slipDays=0 → スリップ予測なしの大幅遅延メッセージ', () => {
    expect(buildRecommendation('warning', 0)).toBe('大幅遅延(-20%以上) — 即時対応が必要です')
  })

  // ケース13: status='delayed', slipDays>0 → スリップ日数付き遅延傾向メッセージ
  it('status=delayed, slipDays=3 → スリップ日数を含む遅延傾向メッセージ', () => {
    expect(buildRecommendation('delayed', 3)).toBe(
      '遅延傾向: 3日のスリップ予測 — 担当者への確認を推奨',
    )
  })

  // ケース14: その他ステータス → 空文字
  it('status=on-track → 空文字を返す', () => {
    expect(buildRecommendation('on-track', 0)).toBe('')
  })
})

// ===========================
// buildDashboardData (5ケース)
// ===========================

// テスト用のプロジェクトデータ型ヘルパー
function makeTodo(overrides: {
  id?: string
  name?: string
  startDate?: Date
  endDate?: Date
  actualPct?: number
  weight?: number
  order?: number
}) {
  return {
    id: overrides.id ?? 'todo-1',
    name: overrides.name ?? 'ToDo 1',
    startDate: overrides.startDate ?? new Date('2026-01-01'),
    endDate: overrides.endDate ?? new Date('2026-02-01'),
    actualPct: overrides.actualPct ?? 0,
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

describe('buildDashboardData', () => {
  const today = new Date('2026-01-15')

  // ケース12: Milestone 0件 → allClear: true, warningMilestones: [], status: 'scheduled'
  it('Milestone 0件 → allClear: true, warningMilestones 空, status: scheduled', () => {
    const project = makeProject({ milestones: [] })
    const result = buildDashboardData(project, today)

    expect(result.allClear).toBe(true)
    expect(result.warningMilestones).toHaveLength(0)
    expect(result.status).toBe('scheduled')
  })

  // ケース13: 全ToDo順調 → allClear: true, warningMilestones: []
  it('全ToDo が順調(on-track)の場合 → allClear: true, warningMilestones 空', () => {
    // today = 2026-01-15, 期間 2026-01-01〜2026-02-01 (31日間)
    // 経過14日 → scheduledPct ≈ 45.2%
    // actualPct=60 → on-track (gap = +14.8% > 0)
    const todo = makeTodo({ actualPct: 60 })
    const task = makeTask({ todos: [todo] })
    const milestone = makeMilestone({ tasks: [task] })
    const project = makeProject({ milestones: [milestone] })
    const result = buildDashboardData(project, today)

    expect(result.allClear).toBe(true)
    expect(result.warningMilestones).toHaveLength(0)
  })

  // ケース14: 警告ToDo が1件 → warningMilestones[0].warningTasks[0].warningTodos.length === 1
  it('警告ToDo が1件ある → warningTodos に含まれる', () => {
    // today = 2026-01-15, 期間 2026-01-01〜2026-02-01
    // scheduledPct ≈ 45.2%, actualPct=10 → gap=-35.2% → warning
    const warningTodo = makeTodo({ id: 'todo-warning', actualPct: 10 })
    const task = makeTask({ todos: [warningTodo] })
    const milestone = makeMilestone({ tasks: [task] })
    const project = makeProject({ milestones: [milestone] })
    const result = buildDashboardData(project, today)

    expect(result.warningMilestones).toHaveLength(1)
    expect(result.warningMilestones[0].warningTasks).toHaveLength(1)
    expect(result.warningMilestones[0].warningTasks[0].warningTodos).toHaveLength(1)
    expect(result.allClear).toBe(false)
  })

  // ケース15: Milestone自体は順調 + 配下に警告Task → warningMilestonesに含まれる
  it('Milestone 自体は on-track でも配下に警告 Task があれば warningMilestones に含まれる', () => {
    // 警告 Task(actualPct=10) と 順調 Task(actualPct=100) を混在させる
    // Milestone 全体としては on-track になるようにする
    // 期間 2026-01-01〜2026-02-01: scheduledPct ≈ 45.2%
    // warningTask: actualPct=10 (gap=-35.2% → warning)
    // goodTask: actualPct=100 (completed)
    // 加重平均: 各タスク期間が同じ → msActualPct = (10+100)/2 = 55% > 45.2% → on-track
    const warningTodo = makeTodo({ id: 'todo-w', name: 'Warning Todo', actualPct: 10 })
    const warningTask = makeTask({
      id: 'task-w',
      name: 'Warning Task',
      todos: [warningTodo],
    })
    const goodTodo = makeTodo({ id: 'todo-g', name: 'Good Todo', actualPct: 100 })
    const goodTask = makeTask({
      id: 'task-g',
      name: 'Good Task',
      todos: [goodTodo],
    })
    const milestone = makeMilestone({ tasks: [warningTask, goodTask] })
    const project = makeProject({ milestones: [milestone] })
    const result = buildDashboardData(project, today)

    expect(result.warningMilestones).toHaveLength(1)
    // Milestone 自体は warning ではない (on-track)
    expect(result.warningMilestones[0].status).not.toBe('warning')
    expect(result.warningMilestones[0].status).not.toBe('delayed')
    // warningTask が含まれている
    expect(result.warningMilestones[0].warningTasks).toHaveLength(1)
  })

  // ケース16a: Milestone 自体が warning、全 Task は on-track/completed/scheduled
  // → WARNING_STATUSES.includes(msStatus) の分岐をカバー
  it('Milestone 自体が warning でも Tasks が全 on-track なら warningMilestones に含まれ warningTasks は空', () => {
    // Task 1: 2026-01-01〜2026-01-10 (過去、完了済み) → completed
    // Task 2: 2026-02-20〜2026-03-31 (未来、未着手) → scheduled
    // Task 3: 2026-03-01〜2026-03-31 (未来、未着手) → scheduled
    // today = 2026-02-15
    // Milestone: 2026-01-01〜2026-03-31 (89日)
    // msActual = (100*10 + 0*40 + 0*31) / 81 ≈ 12.3%
    // msScheduled = 45/89*100 ≈ 50.6% → gap ≈ -38% → warning
    const msToday = new Date('2026-02-15')
    const completedTask = makeTask({
      id: 'task-completed',
      name: 'Completed Task',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-10'),
      todos: [
        makeTodo({
          id: 'todo-c',
          actualPct: 100,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-10'),
        }),
      ],
    })
    const futureTask1 = makeTask({
      id: 'task-future1',
      name: 'Future Task 1',
      startDate: new Date('2026-02-20'),
      endDate: new Date('2026-03-31'),
      todos: [
        makeTodo({
          id: 'todo-f1',
          actualPct: 0,
          startDate: new Date('2026-02-20'),
          endDate: new Date('2026-03-31'),
        }),
      ],
    })
    const futureTask2 = makeTask({
      id: 'task-future2',
      name: 'Future Task 2',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      todos: [
        makeTodo({
          id: 'todo-f2',
          actualPct: 0,
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
    // Tasks はいずれも warning/delayed でないので warningTasks は空
    expect(result.warningMilestones[0].warningTasks).toHaveLength(0)
    expect(result.allClear).toBe(false)
  })

  // ケース16: 全ToDo actualPct=100 → allClear: true
  it('全ToDo actualPct=100(全完了) → allClear: true', () => {
    const todo1 = makeTodo({ id: 'todo-a', actualPct: 100 })
    const todo2 = makeTodo({ id: 'todo-b', actualPct: 100 })
    const task = makeTask({ todos: [todo1, todo2] })
    const milestone = makeMilestone({ tasks: [task] })
    const project = makeProject({ milestones: [milestone] })
    const result = buildDashboardData(project, today)

    expect(result.allClear).toBe(true)
    expect(result.status).toBe('completed')
  })
})
