import { describe, it, expect } from 'vitest'
import {
  buildMilestoneProgressData,
  buildTaskProgressData,
  buildProjectProgressData,
} from '@/components/tree-view/progress-utils'

// ─── fixtures ───────────────────────────────────────────────────────────────

const today = new Date('2026-05-12')

const makeTodo = (id: string, actualPct: number, weight: number) => ({
  id,
  taskId: 'task-1',
  name: `ToDo ${id}`,
  actualPct,
  weight,
  completed: actualPct === 100,
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-06-01'),
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
})

const makeTask = (
  id: string,
  todos: ReturnType<typeof makeTodo>[],
  startDate = new Date('2026-01-01'),
  endDate = new Date('2026-06-01'),
) => ({
  id,
  milestoneId: 'ms-1',
  name: `Task ${id}`,
  startDate,
  endDate,
  assigneeId: null,
  order: 0,
  todos,
  createdAt: new Date(),
  updatedAt: new Date(),
})

const makeMilestone = (
  id: string,
  tasks: ReturnType<typeof makeTask>[],
  startDate = new Date('2026-01-01'),
  endDate = new Date('2026-12-31'),
) => ({
  id,
  projectId: 'proj-1',
  name: `Milestone ${id}`,
  startDate,
  endDate,
  order: 0,
  tasks,
  createdAt: new Date(),
  updatedAt: new Date(),
})

// ─── buildTaskProgressData ───────────────────────────────────────────────────

describe('buildTaskProgressData', () => {
  it('ToDo が空のタスクは actualPct=0', () => {
    const task = makeTask('t1', [])
    const result = buildTaskProgressData(task, today)
    expect(result.actualPct).toBe(0)
  })

  it('単一 ToDo 100% のタスクは actualPct=100', () => {
    const task = makeTask('t1', [makeTodo('td1', 100, 100)])
    const result = buildTaskProgressData(task, today)
    expect(result.actualPct).toBe(100)
  })

  it('重み付き平均を計算する', () => {
    const todos = [makeTodo('td1', 100, 75), makeTodo('td2', 0, 25)]
    const task = makeTask('t1', todos)
    const result = buildTaskProgressData(task, today)
    expect(result.actualPct).toBe(75)
  })

  it('scheduledPct は開始前は0', () => {
    const futureStart = new Date('2026-06-01')
    const futureEnd = new Date('2026-12-01')
    const task = makeTask('t1', [], futureStart, futureEnd)
    const result = buildTaskProgressData(task, today)
    expect(result.scheduledPct).toBe(0)
  })

  it('scheduledPct は期日超過で100', () => {
    const pastStart = new Date('2025-01-01')
    const pastEnd = new Date('2025-06-01')
    const task = makeTask('t1', [], pastStart, pastEnd)
    const result = buildTaskProgressData(task, today)
    expect(result.scheduledPct).toBe(100)
  })

  it('daysDeviation が正しく計算される', () => {
    // actualPct=0, scheduledPct=0 → deviation=0
    const futureTask = makeTask('t1', [], new Date('2026-06-01'), new Date('2026-12-01'))
    const result = buildTaskProgressData(futureTask, today)
    expect(result.daysDeviation).toBe(0)
  })

  it('status が正しく設定される', () => {
    const task = makeTask('t1', [makeTodo('td1', 100, 100)])
    const result = buildTaskProgressData(task, today)
    expect(result.status).toBe('completed')
  })

  it('scheduled: 未開始かつ予定なし', () => {
    const futureTask = makeTask('t1', [], new Date('2026-06-01'), new Date('2026-12-01'))
    const result = buildTaskProgressData(futureTask, today)
    expect(result.status).toBe('scheduled')
  })

  it('startDate と endDate が保持される', () => {
    const start = new Date('2026-03-01')
    const end = new Date('2026-09-01')
    const task = makeTask('t1', [], start, end)
    const result = buildTaskProgressData(task, today)
    expect(result.startDate).toEqual(start)
    expect(result.endDate).toEqual(end)
  })
})

// ─── buildMilestoneProgressData ─────────────────────────────────────────────

describe('buildMilestoneProgressData', () => {
  it('Task が空のマイルストーンは actualPct=0', () => {
    const ms = makeMilestone('ms1', [])
    const result = buildMilestoneProgressData(ms, today)
    expect(result.actualPct).toBe(0)
  })

  it('全 Task 完了のマイルストーンは actualPct=100', () => {
    const task = makeTask('t1', [makeTodo('td1', 100, 100)])
    const ms = makeMilestone('ms1', [task])
    const result = buildMilestoneProgressData(ms, today)
    expect(result.actualPct).toBe(100)
  })

  it('期間加重平均を使う（期間長 Task が重みが大きい）', () => {
    const longTask = makeTask(
      't1',
      [makeTodo('td1', 100, 100)],
      new Date('2026-01-01'),
      new Date('2026-07-01'),
    )
    const shortTask = makeTask(
      't2',
      [makeTodo('td2', 0, 100)],
      new Date('2026-01-01'),
      new Date('2026-02-01'),
    )
    const ms = makeMilestone('ms1', [longTask, shortTask])
    const result = buildMilestoneProgressData(ms, today)
    // 長いタスク (100%) が重みが大きいので 50% より大きい
    expect(result.actualPct).toBeGreaterThan(50)
  })

  it('scheduledPct は 0〜100 の範囲', () => {
    const ms = makeMilestone('ms1', [])
    const result = buildMilestoneProgressData(ms, today)
    expect(result.scheduledPct).toBeGreaterThanOrEqual(0)
    expect(result.scheduledPct).toBeLessThanOrEqual(100)
  })

  it('status を含む ProgressBarData を返す', () => {
    const ms = makeMilestone('ms1', [])
    const result = buildMilestoneProgressData(ms, today)
    expect(['completed', 'on-track', 'delayed', 'warning', 'scheduled']).toContain(result.status)
  })

  it('daysDeviation を含む', () => {
    const ms = makeMilestone('ms1', [])
    const result = buildMilestoneProgressData(ms, today)
    expect(typeof result.daysDeviation).toBe('number')
  })
})

// ─── buildProjectProgressData ────────────────────────────────────────────────

describe('buildProjectProgressData', () => {
  it('Milestone が空のプロジェクトは actualPct=0', () => {
    const result = buildProjectProgressData([], today)
    expect(result.actualPct).toBe(0)
  })

  it('全 Milestone 完了は actualPct=100', () => {
    const task = makeTask('t1', [makeTodo('td1', 100, 100)])
    const ms = makeMilestone('ms1', [task])
    const result = buildProjectProgressData([ms], today)
    expect(result.actualPct).toBe(100)
  })

  it('scheduledPct は 0〜100 の範囲', () => {
    const start = new Date('2026-01-01')
    const end = new Date('2026-12-31')
    const ms = makeMilestone('ms1', [], start, end)
    const result = buildProjectProgressData([ms], today)
    expect(result.scheduledPct).toBeGreaterThanOrEqual(0)
    expect(result.scheduledPct).toBeLessThanOrEqual(100)
  })
})

// ─── InlineEdit ロジックテスト ────────────────────────────────────────────────

import { validateInlineEditValue, trimValue } from '@/components/tree-view/inline-edit-utils'

describe('validateInlineEditValue', () => {
  it('通常の文字列はtrue', () => {
    expect(validateInlineEditValue('タスク名')).toBe(true)
  })

  it('空文字はfalse', () => {
    expect(validateInlineEditValue('')).toBe(false)
  })

  it('空白のみはfalse', () => {
    expect(validateInlineEditValue('   ')).toBe(false)
  })

  it('255文字はtrue（境界値）', () => {
    expect(validateInlineEditValue('a'.repeat(255))).toBe(true)
  })

  it('256文字はfalse（境界値）', () => {
    expect(validateInlineEditValue('a'.repeat(256))).toBe(false)
  })

  it('改行のみはfalse', () => {
    expect(validateInlineEditValue('\n')).toBe(false)
  })
})

describe('trimValue', () => {
  it('前後の空白を除去する', () => {
    expect(trimValue('  タスク  ')).toBe('タスク')
  })

  it('空文字はそのまま', () => {
    expect(trimValue('')).toBe('')
  })

  it('trim 後の値を返す', () => {
    expect(trimValue('\tマイルストーン\t')).toBe('マイルストーン')
  })
})

// ─── AddRowButton ロジックテスト ──────────────────────────────────────────────

import { validateAddRowForm } from '@/components/tree-view/add-row-utils'

describe('validateAddRowForm', () => {
  it('有効な入力はnullを返す（エラーなし）', () => {
    const result = validateAddRowForm('タスク名', '2026-06-01', '2026-12-01')
    expect(result).toBeNull()
  })

  it('名前が空ならエラー', () => {
    const result = validateAddRowForm('', '2026-06-01', '2026-12-01')
    expect(result).not.toBeNull()
    expect(result).toContain('名前')
  })

  it('開始日が空ならエラー', () => {
    const result = validateAddRowForm('タスク名', '', '2026-12-01')
    expect(result).not.toBeNull()
  })

  it('終了日が空ならエラー', () => {
    const result = validateAddRowForm('タスク名', '2026-06-01', '')
    expect(result).not.toBeNull()
  })

  it('開始日 >= 終了日ならエラー', () => {
    const result = validateAddRowForm('タスク名', '2026-12-01', '2026-06-01')
    expect(result).not.toBeNull()
    expect(result).toContain('開始日')
  })

  it('開始日 === 終了日ならエラー', () => {
    const result = validateAddRowForm('タスク名', '2026-06-01', '2026-06-01')
    expect(result).not.toBeNull()
  })

  it('無効な日付フォーマットはエラー', () => {
    const result = validateAddRowForm('タスク名', 'not-a-date', '2026-12-01')
    expect(result).not.toBeNull()
  })
})
