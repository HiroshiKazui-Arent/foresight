import { describe, it, expect } from 'vitest'
import { redistributeWeights } from '@/lib/weight'
import {
  calcScheduledPct,
  calcDaysDeviation,
  calcStatus,
  calcTodoStatus,
  calcTaskActualPct,
  calcMilestoneActualPct,
  calcProjectActualPct,
  calcRenderStatus,
  calcAggregateRenderStatus,
  calcRealDaysDeviation,
} from '@/lib/progress'

describe('redistributeWeights', () => {
  it('均等割り - 3件', () => {
    expect(redistributeWeights(3)).toEqual([33, 33, 34])
  })
  it('均等割り - 4件', () => {
    expect(redistributeWeights(4)).toEqual([25, 25, 25, 25])
  })
  it('均等割り - 6件 (TodoTemplate デフォルト件数)', () => {
    expect(redistributeWeights(6)).toEqual([16, 16, 16, 16, 16, 20])
  })
  it('均等割り - 7件 (端数 2 が最後に寄る)', () => {
    expect(redistributeWeights(7)).toEqual([14, 14, 14, 14, 14, 14, 16])
  })
  it('空配列', () => {
    expect(redistributeWeights(0)).toEqual([])
  })
  it('合計が100になる', () => {
    for (let n = 1; n <= 10; n++) {
      const weights = redistributeWeights(n)
      expect(weights.reduce((a, b) => a + b, 0)).toBe(100)
    }
  })
})

describe('calcScheduledPct', () => {
  it('期間の50%経過', () => {
    const start = new Date('2026-01-01')
    const end = new Date('2026-01-11')
    const today = new Date('2026-01-06')
    expect(calcScheduledPct(start, end, today)).toBe(50)
  })
  // TC-PROG-001: 仕様書 4.1 の exact value 検証
  it('TC-PROG-001: 2026-04-01〜2026-04-30 の 2026-04-15 時点は ~48.3%', () => {
    const start = new Date('2026-04-01')
    const end = new Date('2026-04-30')
    const today = new Date('2026-04-15')
    expect(calcScheduledPct(start, end, today)).toBeCloseTo(48.3, 0)
  })
  // TC-PROG-007: 年跨ぎシナリオ (M-1 確認済み: 正しい期待値は 50%)
  it('TC-PROG-007: 年跨ぎ (start=12/31, end=01/02, today=01/01) → 50%', () => {
    const start = new Date('2025-12-31')
    const end = new Date('2026-01-02')
    const today = new Date('2026-01-01')
    expect(calcScheduledPct(start, end, today)).toBe(50)
  })
  it('開始前は0%', () => {
    const start = new Date('2026-06-01')
    const end = new Date('2026-06-30')
    const today = new Date('2026-05-01')
    expect(calcScheduledPct(start, end, today)).toBe(0)
  })
  it('期日超過は100%', () => {
    const start = new Date('2026-01-01')
    const end = new Date('2026-01-10')
    const today = new Date('2026-02-01')
    expect(calcScheduledPct(start, end, today)).toBe(100)
  })
  it('開始日と終了日が同じ場合は100%', () => {
    const same = new Date('2026-03-01')
    expect(calcScheduledPct(same, same, same)).toBe(100)
  })
  it('開始日当日は0%', () => {
    const start = new Date('2026-01-01')
    const end = new Date('2026-01-11')
    expect(calcScheduledPct(start, end, start)).toBe(0)
  })
})

describe('calcDaysDeviation', () => {
  it('actualPct === scheduledPct は 0 日', () => {
    expect(calcDaysDeviation(50, 50, 10)).toBe(0)
  })
  it('actualPct > scheduledPct は正の値（進み）', () => {
    expect(calcDaysDeviation(60, 50, 10)).toBe(1)
  })
  it('actualPct < scheduledPct は負の値（遅れ）', () => {
    expect(calcDaysDeviation(40, 50, 10)).toBe(-1)
  })
  it('durationDays=0 は 0 日', () => {
    expect(calcDaysDeviation(50, 70, 0)).toBe(0)
  })
  it('大きな乖離', () => {
    expect(calcDaysDeviation(0, 100, 100)).toBe(-100)
  })
  // TC-DIFF-001〜003: 仕様書 4.2 の exact value 検証
  it('TC-DIFF-001: calcDaysDeviation(44, 83, 30) → -11.7', () => {
    expect(calcDaysDeviation(44, 83, 30)).toBeCloseTo(-11.7, 1)
  })
  it('TC-DIFF-002: calcDaysDeviation(50, 50, 30) → 0', () => {
    expect(calcDaysDeviation(50, 50, 30)).toBe(0)
  })
  it('TC-DIFF-003: calcDaysDeviation(50, 30, 30) → +6', () => {
    expect(calcDaysDeviation(50, 30, 30)).toBe(6)
  })
})

describe('calcStatus (Task/Milestone/Project レベル)', () => {
  it('actualPct=100 → completed', () => {
    expect(calcStatus(100, 80)).toBe('completed')
  })
  it('actualPct=0, scheduledPct=0 → scheduled', () => {
    expect(calcStatus(0, 0)).toBe('scheduled')
  })
  it('actualPct >= scheduledPct → on-track', () => {
    expect(calcStatus(60, 50)).toBe('on-track')
    expect(calcStatus(50, 50)).toBe('on-track')
  })
  it('gap > -20 かつ < 0 → delayed', () => {
    expect(calcStatus(40, 50)).toBe('delayed')
    expect(calcStatus(31, 50)).toBe('delayed')
  })
  it('gap <= -20 → warning', () => {
    expect(calcStatus(30, 50)).toBe('warning')
    expect(calcStatus(0, 50)).toBe('warning')
  })
  it('actualPct=100 は scheduledPct に関わらず completed', () => {
    expect(calcStatus(100, 100)).toBe('completed')
    expect(calcStatus(100, 0)).toBe('completed')
  })
  it('gap がちょうど -20 → warning（境界値）', () => {
    expect(calcStatus(30, 50)).toBe('warning')
  })
})

describe('calcTodoStatus (M-01: ToDo 4 段階)', () => {
  const start = new Date('2026-01-01')
  const end = new Date('2026-01-31')

  it('completed=true → completed (期日や日付に関わらず)', () => {
    const past = new Date('2026-03-01')
    expect(calcTodoStatus(true, start, end, past)).toBe('completed')
    expect(calcTodoStatus(true, start, end, start)).toBe('completed')
  })

  it('未完了 + 期日超過 → delayed', () => {
    const past = new Date('2026-02-15')
    expect(calcTodoStatus(false, start, end, past)).toBe('delayed')
  })

  it('未完了 + 期日3日以内 → delayed', () => {
    const nearDeadline = new Date('2026-01-29') // 期日 01-31 まで 2 日
    expect(calcTodoStatus(false, start, end, nearDeadline)).toBe('delayed')
  })

  it('未完了 + 開始前 → scheduled', () => {
    const before = new Date('2025-12-15')
    expect(calcTodoStatus(false, start, end, before)).toBe('scheduled')
  })

  it('未完了 + 進行中(余裕あり) → on-track', () => {
    const inProgress = new Date('2026-01-15') // 期日まで 16 日
    expect(calcTodoStatus(false, start, end, inProgress)).toBe('on-track')
  })

  it('警告 (warning) ステータスは ToDo レベルでは持たない', () => {
    // どの入力組み合わせでも 'warning' は返さない
    const cases: [boolean, Date][] = [
      [false, new Date('2026-01-15')],
      [false, new Date('2026-01-30')],
      [false, new Date('2026-02-15')],
      [true, new Date('2026-01-15')],
    ]
    for (const [completed, today] of cases) {
      expect(calcTodoStatus(completed, start, end, today)).not.toBe('warning')
    }
  })
})

describe('calcTaskActualPct (M-01: completed ベース)', () => {
  it('空配列は0', () => {
    expect(calcTaskActualPct([])).toBe(0)
  })
  it('全 ToDo の weight が 0 のとき 0 を返す', () => {
    expect(calcTaskActualPct([{ completed: true, weight: 0 }])).toBe(0)
  })
  it('単一 ToDo - completed=true で 100', () => {
    expect(calcTaskActualPct([{ completed: true, weight: 100 }])).toBe(100)
  })
  it('単一 ToDo - completed=false で 0', () => {
    expect(calcTaskActualPct([{ completed: false, weight: 100 }])).toBe(0)
  })
  it('均等重み: 1/2 完了で 50%', () => {
    const todos = [
      { completed: true, weight: 50 },
      { completed: false, weight: 50 },
    ]
    expect(calcTaskActualPct(todos)).toBe(50)
  })
  it('不均等重み: 重い側完了で 75%', () => {
    const todos = [
      { completed: true, weight: 75 },
      { completed: false, weight: 25 },
    ]
    expect(calcTaskActualPct(todos)).toBe(75)
  })
  it('全 ToDo 完了は 100', () => {
    const todos = [
      { completed: true, weight: 33 },
      { completed: true, weight: 33 },
      { completed: true, weight: 34 },
    ]
    expect(calcTaskActualPct(todos)).toBe(100)
  })
  it('totalWeight が 100 でないフィクスチャでも正規化される', () => {
    // weight 合計 = 150。50 完了 → 50/150 × 100 = 33.33...
    const todos = [
      { completed: true, weight: 50 },
      { completed: false, weight: 100 },
    ]
    expect(calcTaskActualPct(todos)).toBeCloseTo(33.333, 2)
  })
})

describe('calcMilestoneActualPct', () => {
  it('空配列は0', () => {
    expect(calcMilestoneActualPct([])).toBe(0)
  })
  it('単一タスクはそのpct', () => {
    const start = new Date('2026-01-01')
    const end = new Date('2026-01-11')
    expect(calcMilestoneActualPct([{ actualPct: 60, startDate: start, endDate: end }])).toBe(60)
  })
  it('同期間2タスクの平均', () => {
    const start = new Date('2026-01-01')
    const end = new Date('2026-01-11')
    const tasks = [
      { actualPct: 100, startDate: start, endDate: end },
      { actualPct: 0, startDate: start, endDate: end },
    ]
    expect(calcMilestoneActualPct(tasks)).toBe(50)
  })
  it('全アイテムの期間が 0 のとき 0 を返す', () => {
    const same = new Date('2026-01-01')
    expect(calcMilestoneActualPct([{ actualPct: 80, startDate: same, endDate: same }])).toBe(0)
  })

  // TC-AGG-005: ゼロ除算ガード — startDate === endDate のとき 0 を返す
  it('TC-AGG-005: startDate === endDate の単一アイテムはゼロ除算を回避し 0 を返す', () => {
    const same = new Date('2026-03-15')
    expect(calcMilestoneActualPct([{ actualPct: 80, startDate: same, endDate: same }])).toBe(0)
  })
  it('期間が長いタスクが重みが大きい', () => {
    const s1 = new Date('2026-01-01')
    const e1 = new Date('2026-01-21')
    const s2 = new Date('2026-01-01')
    const e2 = new Date('2026-01-11')
    const tasks = [
      { actualPct: 100, startDate: s1, endDate: e1 },
      { actualPct: 0, startDate: s2, endDate: e2 },
    ]
    const result = calcMilestoneActualPct(tasks)
    expect(result).toBeGreaterThan(50)
  })
})

describe('calcProjectActualPct', () => {
  it('空配列は0', () => {
    expect(calcProjectActualPct([])).toBe(0)
  })
  it('単一マイルストーンはそのpct', () => {
    const start = new Date('2026-01-01')
    const end = new Date('2026-03-01')
    expect(calcProjectActualPct([{ actualPct: 40, startDate: start, endDate: end }])).toBe(40)
  })
  it('同期間2マイルストーンの平均', () => {
    const start = new Date('2026-01-01')
    const end = new Date('2026-03-01')
    const milestones = [
      { actualPct: 80, startDate: start, endDate: end },
      { actualPct: 20, startDate: start, endDate: end },
    ]
    expect(calcProjectActualPct(milestones)).toBe(50)
  })
})

// ─── calcRenderStatus ────────────────────────────────────────────────────────

describe('calcRenderStatus (Todo 5状態)', () => {
  const startDate = new Date('2026-05-01')
  const endDate = new Date('2026-05-31')

  // 1. completed=true → 'completed' (最優先)
  it('completed=true, started=true → completed', () => {
    const todo = { started: true, completed: true, startDate, endDate }
    expect(calcRenderStatus(todo, new Date('2026-05-15'))).toBe('completed')
  })

  it('completed=true, started=false → completed (started に関わらず最優先)', () => {
    const todo = { started: false, completed: true, startDate, endDate }
    expect(calcRenderStatus(todo, new Date('2026-05-15'))).toBe('completed')
  })

  it('completed=true, today < startDate でも completed', () => {
    const todo = { started: false, completed: true, startDate, endDate }
    expect(calcRenderStatus(todo, new Date('2026-04-01'))).toBe('completed')
  })

  // 2. today < startDate → 'scheduled'
  it('未完了, today < startDate → scheduled', () => {
    const todo = { started: false, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, new Date('2026-04-30'))).toBe('scheduled')
  })

  it('started=true だが today < startDate → scheduled', () => {
    const todo = { started: true, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, new Date('2026-04-15'))).toBe('scheduled')
  })

  // 3. !started かつ today >= startDate → 'not-started-overdue'
  it('started=false, today === startDate → not-started-overdue (境界値)', () => {
    const todo = { started: false, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, startDate)).toBe('not-started-overdue')
  })

  it('started=false, today in range (startDate < today < endDate) → not-started-overdue', () => {
    const todo = { started: false, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, new Date('2026-05-15'))).toBe('not-started-overdue')
  })

  it('started=false, today > endDate → not-started-overdue (期限超過でも未開始)', () => {
    const todo = { started: false, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, new Date('2026-06-10'))).toBe('not-started-overdue')
  })

  // 4. started=true, today > endDate → 'overdue-past-deadline'
  it('started=true, today > endDate → overdue-past-deadline', () => {
    const todo = { started: true, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, new Date('2026-06-01'))).toBe('overdue-past-deadline')
  })

  // 5. started=true, today in [startDate, endDate] → 'delayed-pre-deadline'
  it('started=true, today in range → delayed-pre-deadline', () => {
    const todo = { started: true, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, new Date('2026-05-15'))).toBe('delayed-pre-deadline')
  })

  it('started=true, today === endDate → delayed-pre-deadline (境界値)', () => {
    const todo = { started: true, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, endDate)).toBe('delayed-pre-deadline')
  })

  it('started=true, today === startDate → delayed-pre-deadline', () => {
    const todo = { started: true, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, startDate)).toBe('delayed-pre-deadline')
  })

  // ±1ms 境界値テスト
  it('today = startDate - 1ms → scheduled (ms 精度)', () => {
    const todo = { started: false, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, new Date(startDate.getTime() - 1))).toBe('scheduled')
  })

  it('today = startDate + 1ms, started=false → not-started-overdue (ms 精度)', () => {
    const todo = { started: false, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, new Date(startDate.getTime() + 1))).toBe('not-started-overdue')
  })

  it('today = endDate - 1ms, started=true → delayed-pre-deadline (ms 精度)', () => {
    const todo = { started: true, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, new Date(endDate.getTime() - 1))).toBe('delayed-pre-deadline')
  })

  it('today = endDate + 1ms, started=true → overdue-past-deadline (ms 精度)', () => {
    const todo = { started: true, completed: false, startDate, endDate }
    expect(calcRenderStatus(todo, new Date(endDate.getTime() + 1))).toBe('overdue-past-deadline')
  })
})

// ─── calcAggregateRenderStatus ───────────────────────────────────────────────

describe('calcAggregateRenderStatus (親集約 5状態)', () => {
  const startDate = new Date('2026-05-01')
  const endDate = new Date('2026-05-31')

  // 1. today < startDate → 'scheduled'
  it('today < startDate → scheduled', () => {
    const parent = { startDate, endDate, actualPct: 0 }
    expect(calcAggregateRenderStatus(parent, new Date('2026-04-30'), false)).toBe('scheduled')
  })

  it('today < startDate, anyChildStarted=true でも scheduled', () => {
    const parent = { startDate, endDate, actualPct: 10 }
    expect(calcAggregateRenderStatus(parent, new Date('2026-04-15'), true)).toBe('scheduled')
  })

  // 2. actualPct=0, !anyChildStarted, today >= startDate → 'not-started-overdue'
  it('actualPct=0, anyChildStarted=false, today >= startDate → not-started-overdue', () => {
    const parent = { startDate, endDate, actualPct: 0 }
    expect(calcAggregateRenderStatus(parent, new Date('2026-05-10'), false)).toBe(
      'not-started-overdue',
    )
  })

  it('actualPct=0, anyChildStarted=true → not-started-overdue にならない', () => {
    const parent = { startDate, endDate, actualPct: 0 }
    // anyChildStarted=true のとき、actualPct=0 でも not-started-overdue ではない
    // (この場合 delayed-pre-deadline になる — scheduledPct > 0 かつ actualPct < scheduledPct)
    const result = calcAggregateRenderStatus(parent, new Date('2026-05-10'), true)
    expect(result).not.toBe('not-started-overdue')
  })

  // 3. actualPct=100 → 'completed'
  it('actualPct=100 → completed (期日前でも)', () => {
    const parent = { startDate, endDate, actualPct: 100 }
    expect(calcAggregateRenderStatus(parent, new Date('2026-05-15'), true)).toBe('completed')
  })

  it('actualPct=100, today > endDate → completed (完了が overdue より優先)', () => {
    const parent = { startDate, endDate, actualPct: 100 }
    expect(calcAggregateRenderStatus(parent, new Date('2026-06-10'), true)).toBe('completed')
  })

  // 4. today > endDate (かつ actualPct < 100) → 'overdue-past-deadline'
  it('today > endDate, actualPct=50 → overdue-past-deadline', () => {
    const parent = { startDate, endDate, actualPct: 50 }
    expect(calcAggregateRenderStatus(parent, new Date('2026-06-10'), true)).toBe(
      'overdue-past-deadline',
    )
  })

  // 5. actualPct >= scheduledPct → 'completed' (緑: 予定通り or 前倒し)
  it('actualPct >= scheduledPct → completed', () => {
    // today = 2026-05-16: scheduledPct ≈ 50%, actualPct=60 → completed
    const parent = { startDate, endDate, actualPct: 60 }
    expect(calcAggregateRenderStatus(parent, new Date('2026-05-16'), true)).toBe('completed')
  })

  it('actualPct === scheduledPct → completed (today=startDate: scheduledPct=0, actualPct=0)', () => {
    // today=05-01 (startDate): elapsed=0, total=30 → scheduledPct=0; actualPct=0 >= 0 → completed
    const parentOnStart = { startDate, endDate, actualPct: 0 }
    expect(calcAggregateRenderStatus(parentOnStart, startDate, true)).toBe('completed')
  })

  it('today > endDate, actualPct=0, anyChildStarted=false → not-started-overdue (overdue より優先)', () => {
    // 期日超過かつ未着手 → not-started-overdue (overdue-past-deadline ではない、仕様通り)
    const parent = { startDate, endDate, actualPct: 0 }
    expect(calcAggregateRenderStatus(parent, new Date('2026-06-10'), false)).toBe(
      'not-started-overdue',
    )
  })

  it('actualPct=0.0009 (< 0.001 threshold), anyChildStarted=false → not-started-overdue', () => {
    // 浮動小数の近似ゼロ: 0.001 未満は未着手扱い
    const parent = { startDate, endDate, actualPct: 0.0009 }
    expect(calcAggregateRenderStatus(parent, new Date('2026-05-15'), false)).toBe(
      'not-started-overdue',
    )
  })

  it('actualPct=0.001 (= threshold), anyChildStarted=false → not-started-overdue にならない', () => {
    // 0.001 は閾値ちょうど: < 0.001 でないので not-started-overdue にならない
    const parent = { startDate, endDate, actualPct: 0.001 }
    const result = calcAggregateRenderStatus(parent, new Date('2026-05-15'), false)
    expect(result).not.toBe('not-started-overdue')
  })

  // 6. actualPct < scheduledPct (かつ今日 <= endDate) → 'delayed-pre-deadline'
  it('actualPct < scheduledPct, today <= endDate → delayed-pre-deadline', () => {
    // today = 2026-05-16: scheduledPct ≈ 50%, actualPct=30 → delayed-pre-deadline
    const parent = { startDate, endDate, actualPct: 30 }
    expect(calcAggregateRenderStatus(parent, new Date('2026-05-16'), true)).toBe(
      'delayed-pre-deadline',
    )
  })
})

// ─── calcRealDaysDeviation ───────────────────────────────────────────────────

describe('calcRealDaysDeviation', () => {
  const rowEnd = new Date('2026-05-31')

  // overdue: today > rowEnd → 実日数 (負の値)
  it('today > rowEnd → 負の実日数を返す', () => {
    const today = new Date('2026-06-10') // 10日オーバー
    // (05-31 - 06-10) / ms_per_day = -10
    expect(calcRealDaysDeviation(today, rowEnd, 50, 100, 30)).toBe(-10)
  })

  it('today が rowEnd の1日後 → -1', () => {
    const today = new Date('2026-06-01')
    expect(calcRealDaysDeviation(today, rowEnd, 0, 100, 30)).toBe(-1)
  })

  // non-overdue: calcDaysDeviation と同値
  it('today <= rowEnd → calcDaysDeviation と同値', () => {
    const today = new Date('2026-05-15')
    // calcDaysDeviation(40, 60, 30) = (40-60)/100*30 = -6
    expect(calcRealDaysDeviation(today, rowEnd, 40, 60, 30)).toBe(-6)
  })

  it('today === rowEnd → calcDaysDeviation と同値 (境界値)', () => {
    // calcDaysDeviation(100, 100, 30) = 0
    expect(calcRealDaysDeviation(rowEnd, rowEnd, 100, 100, 30)).toBe(0)
  })

  it('today < rowEnd, actualPct > scheduledPct → 正の値 (進み)', () => {
    const today = new Date('2026-05-10')
    // calcDaysDeviation(80, 50, 20) = (80-50)/100*20 = 6
    expect(calcRealDaysDeviation(today, rowEnd, 80, 50, 20)).toBe(6)
  })

  it('durationDays=0, today <= rowEnd → 0 (ゼロ除算ガード)', () => {
    const today = new Date('2026-05-10')
    expect(calcRealDaysDeviation(today, rowEnd, 50, 70, 0)).toBe(0)
  })
})
