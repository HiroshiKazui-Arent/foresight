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
