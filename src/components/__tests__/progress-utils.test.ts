import { describe, it, expect } from 'vitest'
import {
  buildTodoProgressData,
  buildTaskProgressData,
  buildMilestoneProgressData,
} from '@/components/tree-view/progress-utils'

// ─── fixtures ───────────────────────────────────────────────────────────────

// 10日間の期間: 2026-05-01 〜 2026-05-10
const startDate = new Date('2026-05-01')
const endDate = new Date('2026-05-10')

describe('buildTodoProgressData', () => {
  describe('completed=true のとき', () => {
    it('actualPct が 100 になる', () => {
      const today = new Date('2026-05-05')
      const result = buildTodoProgressData({ completed: true, startDate, endDate }, today)
      expect(result.actualPct).toBe(100)
    })

    it('status が completed になる', () => {
      const today = new Date('2026-05-05')
      const result = buildTodoProgressData({ completed: true, startDate, endDate }, today)
      expect(result.status).toBe('completed')
    })

    it('startDate/endDate が返り値に含まれる', () => {
      const today = new Date('2026-05-05')
      const result = buildTodoProgressData({ completed: true, startDate, endDate }, today)
      expect(result.startDate).toEqual(startDate)
      expect(result.endDate).toEqual(endDate)
    })

    it('daysDeviation が算出されている (完了なので 0 より大きい)', () => {
      // today=2026-05-05: scheduledPct=40%, actualPct=100% → 正の deviation
      const today = new Date('2026-05-05')
      const result = buildTodoProgressData({ completed: true, startDate, endDate }, today)
      expect(result.daysDeviation).toBeGreaterThan(0)
    })
  })

  describe('completed=false, 未着手 (today < startDate)', () => {
    it('actualPct が 0 になる', () => {
      const today = new Date('2026-04-30') // 開始前
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.actualPct).toBe(0)
    })

    it('status が scheduled になる (M-01: 開始前は scheduled)', () => {
      const today = new Date('2026-04-30')
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.status).toBe('scheduled')
    })

    it('scheduledPct が 0 になる', () => {
      const today = new Date('2026-04-30')
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.scheduledPct).toBe(0)
    })

    it('daysDeviation が 0 になる', () => {
      const today = new Date('2026-04-30')
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.daysDeviation).toBe(0)
    })
  })

  describe('completed=false, 進行中 (daysToDeadline >= 3: on-track)', () => {
    // today=2026-05-05: 期日まで 5 日 → on-track (M-01 では warning なし)
    const today = new Date('2026-05-05')

    it('actualPct が 0 になる', () => {
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.actualPct).toBe(0)
    })

    it('status が on-track になる (M-01: warning は存在しない)', () => {
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.status).toBe('on-track')
      // M-01: ToDo ステータスに 'warning' は存在しない
      expect(result.status).not.toBe('warning')
    })

    it('startDate/endDate が返り値に含まれる', () => {
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.startDate).toEqual(startDate)
      expect(result.endDate).toEqual(endDate)
    })
  })

  describe('completed=false, 期日間近 (daysToDeadline < 3: delayed)', () => {
    // today=2026-05-09: 期日まで 1 日 → delayed (M-01: TODO_WARNING_THRESHOLD_DAYS=3 未満)
    const today = new Date('2026-05-09')

    it('status が delayed になる (M-01: 期日 3 日未満は delayed)', () => {
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.status).toBe('delayed')
      // M-01: 'warning' は返らない
      expect(result.status).not.toBe('warning')
    })

    it('daysDeviation が負になる (遅れているため)', () => {
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.daysDeviation).toBeLessThan(0)
    })

    it('startDate/endDate が返り値に含まれる', () => {
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.startDate).toEqual(startDate)
      expect(result.endDate).toEqual(endDate)
    })
  })

  describe('scheduledPct の精度', () => {
    it('期間の中間日付近で scheduledPct が算出される', () => {
      // 2026-05-01〜05-10: elapsed=4日 (05-05 時点), total=9日
      const today = new Date('2026-05-05')
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      // (4/9)*100 ≈ 44.4%
      expect(result.scheduledPct).toBeCloseTo((4 / 9) * 100, 1)
    })

    it('期間終了後は scheduledPct が 100 になる', () => {
      const today = new Date('2026-05-11') // endDate 翌日
      const result = buildTodoProgressData({ completed: false, startDate, endDate }, today)
      expect(result.scheduledPct).toBe(100)
    })
  })

  describe('境界値', () => {
    it('startDate と endDate が同じ場合に例外が起きない', () => {
      const sameDate = new Date('2026-05-05')
      const today = new Date('2026-05-05')
      expect(() =>
        buildTodoProgressData({ completed: false, startDate: sameDate, endDate: sameDate }, today),
      ).not.toThrow()
    })

    it('startDate と endDate が同じ場合、scheduledPct が 100 になる', () => {
      const sameDate = new Date('2026-05-05')
      const today = new Date('2026-05-05')
      const result = buildTodoProgressData(
        { completed: false, startDate: sameDate, endDate: sameDate },
        today,
      )
      expect(result.scheduledPct).toBe(100)
    })
  })
})

// ─── buildTodoProgressData: renderStatus フィールド ─────────────────────────

describe('buildTodoProgressData: renderStatus フィールド', () => {
  const startDate = new Date('2026-05-01')
  const endDate = new Date('2026-05-31')

  it('completed=true → renderStatus が completed', () => {
    const result = buildTodoProgressData(
      { completed: true, started: true, startDate, endDate },
      new Date('2026-05-15'),
    )
    expect(result.renderStatus).toBe('completed')
  })

  it('today < startDate → renderStatus が scheduled', () => {
    const result = buildTodoProgressData(
      { completed: false, started: false, startDate, endDate },
      new Date('2026-04-30'),
    )
    expect(result.renderStatus).toBe('scheduled')
  })

  it('started=false, today in range → renderStatus が not-started-overdue', () => {
    const result = buildTodoProgressData(
      { completed: false, started: false, startDate, endDate },
      new Date('2026-05-15'),
    )
    expect(result.renderStatus).toBe('not-started-overdue')
  })

  it('started 省略時 (undefined) → not-started-overdue (today in range)', () => {
    // started を省略: 後方互換のため false 扱い
    const result = buildTodoProgressData(
      { completed: false, startDate, endDate },
      new Date('2026-05-15'),
    )
    expect(result.renderStatus).toBe('not-started-overdue')
  })

  it('started=true, today > endDate → renderStatus が overdue-past-deadline', () => {
    const result = buildTodoProgressData(
      { completed: false, started: true, startDate, endDate },
      new Date('2026-06-10'),
    )
    expect(result.renderStatus).toBe('overdue-past-deadline')
  })

  it('started=true, today in range → renderStatus が delayed-pre-deadline', () => {
    const result = buildTodoProgressData(
      { completed: false, started: true, startDate, endDate },
      new Date('2026-05-15'),
    )
    expect(result.renderStatus).toBe('delayed-pre-deadline')
  })
})

// ─── buildTaskProgressData: renderStatus フィールド ─────────────────────────

describe('buildTaskProgressData: renderStatus フィールド', () => {
  const taskStart = new Date('2026-05-01')
  const taskEnd = new Date('2026-05-31')

  it('全 todo 完了 → renderStatus が completed', () => {
    const task = {
      startDate: taskStart,
      endDate: taskEnd,
      todos: [
        { completed: true, started: true, weight: 50 },
        { completed: true, started: true, weight: 50 },
      ],
    }
    const result = buildTaskProgressData(task, new Date('2026-05-15'))
    expect(result.renderStatus).toBe('completed')
  })

  it('today < taskStart → renderStatus が scheduled', () => {
    const task = {
      startDate: taskStart,
      endDate: taskEnd,
      todos: [{ completed: false, started: false, weight: 100 }],
    }
    const result = buildTaskProgressData(task, new Date('2026-04-15'))
    expect(result.renderStatus).toBe('scheduled')
  })

  it('anyChildStarted=false, today in range → renderStatus が not-started-overdue', () => {
    const task = {
      startDate: taskStart,
      endDate: taskEnd,
      todos: [
        { completed: false, started: false, weight: 50 },
        { completed: false, started: false, weight: 50 },
      ],
    }
    const result = buildTaskProgressData(task, new Date('2026-05-15'))
    expect(result.renderStatus).toBe('not-started-overdue')
  })

  it('anyChildStarted=true → renderStatus が not-started-overdue にならない', () => {
    const task = {
      startDate: taskStart,
      endDate: taskEnd,
      todos: [
        { completed: false, started: true, weight: 50 },
        { completed: false, started: false, weight: 50 },
      ],
    }
    const result = buildTaskProgressData(task, new Date('2026-05-15'))
    expect(result.renderStatus).not.toBe('not-started-overdue')
  })

  it('today > taskEnd, actualPct < 100 → renderStatus が overdue-past-deadline', () => {
    const task = {
      startDate: taskStart,
      endDate: taskEnd,
      todos: [
        { completed: true, started: true, weight: 50 },
        { completed: false, started: true, weight: 50 },
      ],
    }
    const result = buildTaskProgressData(task, new Date('2026-06-10'))
    expect(result.renderStatus).toBe('overdue-past-deadline')
  })

  it('actualPct >= scheduledPct → renderStatus が completed', () => {
    // today=05-01 (開始日): scheduledPct=0, actualPct=0 → completed (0>=0)
    const task = {
      startDate: taskStart,
      endDate: taskEnd,
      todos: [{ completed: false, started: true, weight: 100 }],
    }
    const result = buildTaskProgressData(task, taskStart)
    expect(result.renderStatus).toBe('completed')
  })
})

// ─── buildMilestoneProgressData: renderStatus フィールド ────────────────────

describe('buildMilestoneProgressData: renderStatus フィールド', () => {
  it('today < milestone.startDate → renderStatus が scheduled', () => {
    const milestone = {
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      tasks: [
        {
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-05-31'),
          todos: [{ completed: false, started: false, weight: 100 }],
        },
      ],
    }
    const result = buildMilestoneProgressData(milestone, new Date('2026-04-15'))
    expect(result.renderStatus).toBe('scheduled')
  })

  it('全 todo 完了 → renderStatus が completed', () => {
    const milestone = {
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      tasks: [
        {
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-05-31'),
          todos: [
            { completed: true, started: true, weight: 50 },
            { completed: true, started: true, weight: 50 },
          ],
        },
      ],
    }
    const result = buildMilestoneProgressData(milestone, new Date('2026-05-15'))
    expect(result.renderStatus).toBe('completed')
  })

  it('today > endDate, actualPct < 100 → renderStatus が overdue-past-deadline', () => {
    const milestone = {
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
      tasks: [
        {
          startDate: new Date('2026-05-01'),
          endDate: new Date('2026-05-31'),
          todos: [
            { completed: true, started: true, weight: 50 },
            { completed: false, started: true, weight: 50 },
          ],
        },
      ],
    }
    const result = buildMilestoneProgressData(milestone, new Date('2026-06-10'))
    expect(result.renderStatus).toBe('overdue-past-deadline')
  })
})
