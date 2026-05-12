import { describe, it, expect } from 'vitest'
import { redistributeWeights } from '@/lib/weight'
import {
  calcScheduledPct,
  calcDaysDeviation,
  calcStatus,
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

describe('calcStatus', () => {
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

describe('calcTaskActualPct', () => {
  it('空配列は0', () => {
    expect(calcTaskActualPct([])).toBe(0)
  })
  it('全 ToDo の weight が 0 のとき 0 を返す', () => {
    expect(calcTaskActualPct([{ actualPct: 80, weight: 0 }])).toBe(0)
  })

  it('単一ToDoは自身のpctをそのまま返す', () => {
    expect(calcTaskActualPct([{ actualPct: 75, weight: 100 }])).toBe(75)
  })
  it('均等重みの重み付き平均', () => {
    const todos = [
      { actualPct: 100, weight: 50 },
      { actualPct: 0, weight: 50 },
    ]
    expect(calcTaskActualPct(todos)).toBe(50)
  })
  it('不均等重みの重み付き平均', () => {
    const todos = [
      { actualPct: 100, weight: 75 },
      { actualPct: 0, weight: 25 },
    ]
    expect(calcTaskActualPct(todos)).toBe(75)
  })
  it('全ToDo完了は100', () => {
    const todos = [
      { actualPct: 100, weight: 33 },
      { actualPct: 100, weight: 33 },
      { actualPct: 100, weight: 34 },
    ]
    expect(calcTaskActualPct(todos)).toBe(100)
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
