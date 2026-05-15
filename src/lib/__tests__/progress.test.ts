import { describe, it, expect } from 'vitest'
import { calcScheduledPct, calcTaskActualPct, calcWeightedActualPct } from '@/lib/progress'
import { daysBetween } from '@/lib/date-utils'

const d = (s: string) => new Date(s + 'T00:00:00Z')

// ────────────────────────────────────────────────────────────────────────────
// daysBetween (date-utils.ts の拡張)
// ────────────────────────────────────────────────────────────────────────────
describe('daysBetween', () => {
  it('同日(startDate === endDate)は 1 を返す', () => {
    expect(daysBetween(d('2026-05-15'), d('2026-05-15'))).toBe(1)
  })

  it('1日差は 1 を返す', () => {
    expect(daysBetween(d('2026-05-15'), d('2026-05-16'))).toBe(1)
  })

  it('2日差は 2 を返す', () => {
    expect(daysBetween(d('2026-05-15'), d('2026-05-17'))).toBe(2)
  })

  it('30日差は 30 を返す', () => {
    expect(daysBetween(d('2026-05-01'), d('2026-05-31'))).toBe(30)
  })

  it('end < start の場合も最低 1 を返す(不整合データのフォールバック)', () => {
    expect(daysBetween(d('2026-05-17'), d('2026-05-15'))).toBe(1)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// calcScheduledPct
// ────────────────────────────────────────────────────────────────────────────
describe('calcScheduledPct', () => {
  it('today === startDate は 0%', () => {
    const pct = calcScheduledPct(d('2026-01-01'), d('2026-12-31'), d('2026-01-01'))
    expect(pct).toBeCloseTo(0, 5)
  })

  it('today === endDate は 100%', () => {
    const pct = calcScheduledPct(d('2026-01-01'), d('2026-12-31'), d('2026-12-31'))
    expect(pct).toBeCloseTo(100, 5)
  })

  it('today が中間点では約 50%', () => {
    // 2026-01-01 ~ 2026-12-31 (364日), 中間は 2026-07-02 (182日経過)
    const pct = calcScheduledPct(d('2026-01-01'), d('2026-12-31'), d('2026-07-02'))
    expect(pct).toBeGreaterThan(49)
    expect(pct).toBeLessThan(51)
  })

  it('today < startDate は 0%', () => {
    const pct = calcScheduledPct(d('2026-06-01'), d('2026-12-31'), d('2026-05-15'))
    expect(pct).toBe(0)
  })

  it('today > endDate は 100%', () => {
    const pct = calcScheduledPct(d('2026-01-01'), d('2026-03-31'), d('2026-05-15'))
    expect(pct).toBe(100)
  })

  it('startDate === endDate (同日タスク) かつ today >= endDate は 100%', () => {
    const pct = calcScheduledPct(d('2026-05-15'), d('2026-05-15'), d('2026-05-15'))
    expect(pct).toBe(100)
  })

  it('startDate === endDate (同日タスク) かつ today < startDate は 0%', () => {
    const pct = calcScheduledPct(d('2026-06-01'), d('2026-06-01'), d('2026-05-15'))
    expect(pct).toBe(0)
  })

  it('1日スパン: today = 開始日の翌日 (=終了日) は 100%', () => {
    const pct = calcScheduledPct(d('2026-05-14'), d('2026-05-15'), d('2026-05-15'))
    expect(pct).toBeCloseTo(100, 5)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// calcTaskActualPct
// ────────────────────────────────────────────────────────────────────────────
describe('calcTaskActualPct', () => {
  it('空配列は 0%', () => {
    expect(calcTaskActualPct([])).toBe(0)
  })

  it('全件完了 (actualEndDate あり) は 100%', () => {
    const todos = [
      { actualEndDate: new Date() },
      { actualEndDate: new Date() },
      { actualEndDate: new Date() },
    ]
    expect(calcTaskActualPct(todos)).toBe(100)
  })

  it('全件未着手 (actualEndDate=null) は 0%', () => {
    const todos = [{ actualEndDate: null }, { actualEndDate: null }, { actualEndDate: null }]
    expect(calcTaskActualPct(todos)).toBe(0)
  })

  it('1/5 完了は 20%', () => {
    const todos = [
      { actualEndDate: new Date() },
      { actualEndDate: null },
      { actualEndDate: null },
      { actualEndDate: null },
      { actualEndDate: null },
    ]
    expect(calcTaskActualPct(todos)).toBeCloseTo(20)
  })

  it('3/5 完了は 60%', () => {
    const todos = [
      { actualEndDate: new Date() },
      { actualEndDate: new Date() },
      { actualEndDate: new Date() },
      { actualEndDate: null },
      { actualEndDate: null },
    ]
    expect(calcTaskActualPct(todos)).toBeCloseTo(60)
  })

  it('1件のみで完了は 100%', () => {
    expect(calcTaskActualPct([{ actualEndDate: new Date() }])).toBe(100)
  })

  it('1件のみで未完了は 0%', () => {
    expect(calcTaskActualPct([{ actualEndDate: null }])).toBe(0)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// calcWeightedActualPct — 6 ケース必須
// ────────────────────────────────────────────────────────────────────────────
describe('calcWeightedActualPct', () => {
  it('ケース1: 子なし は 0%', () => {
    expect(calcWeightedActualPct([])).toBe(0)
  })

  it('ケース2: 均等期間 (全員 30 日) — 単純平均と一致', () => {
    const children = [
      { actualPct: 100, startDate: d('2026-01-01'), endDate: d('2026-01-31') },
      { actualPct: 50, startDate: d('2026-02-01'), endDate: d('2026-03-03') }, // 30日
      { actualPct: 0, startDate: d('2026-03-04'), endDate: d('2026-04-03') }, // 30日
    ]
    // weights = [30, 30, 30], totalWeight = 90
    // result = (100*30 + 50*30 + 0*30) / 90 = 4500/90 = 50
    const result = calcWeightedActualPct(children)
    expect(result).toBeCloseTo(50)
  })

  it('ケース3: 偏った期間 — 長い子が支配的', () => {
    const children = [
      { actualPct: 100, startDate: d('2026-01-01'), endDate: d('2026-01-02') }, // 1日
      { actualPct: 0, startDate: d('2026-01-01'), endDate: d('2026-04-11') }, // 100日
    ]
    // weights = [1, 100], totalWeight = 101
    // result = (100*1 + 0*100) / 101 = 100/101 ≈ 0.99
    const result = calcWeightedActualPct(children)
    expect(result).toBeCloseTo(100 / 101, 5)
  })

  it('ケース4: 子全完了 は 100%', () => {
    const children = [
      { actualPct: 100, startDate: d('2026-01-01'), endDate: d('2026-03-31') },
      { actualPct: 100, startDate: d('2026-04-01'), endDate: d('2026-06-30') },
    ]
    expect(calcWeightedActualPct(children)).toBe(100)
  })

  it('ケース5: 子全未着手 は 0%', () => {
    const children = [
      { actualPct: 0, startDate: d('2026-01-01'), endDate: d('2026-03-31') },
      { actualPct: 0, startDate: d('2026-04-01'), endDate: d('2026-06-30') },
    ]
    expect(calcWeightedActualPct(children)).toBe(0)
  })

  it('ケース6: 子が 0 日タスクのみ (startDate === endDate) — 全員重み 1 で均等平均', () => {
    const children = [
      { actualPct: 100, startDate: d('2026-05-01'), endDate: d('2026-05-01') }, // 同日 → 重み1
      { actualPct: 0, startDate: d('2026-05-02'), endDate: d('2026-05-02') }, // 同日 → 重み1
    ]
    // weights = [1, 1], totalWeight = 2
    // result = (100*1 + 0*1) / 2 = 50
    const result = calcWeightedActualPct(children)
    expect(result).toBeCloseTo(50)
  })

  it('追加: 期間 2:1 の加重平均', () => {
    const children = [
      { actualPct: 100, startDate: d('2026-01-01'), endDate: d('2026-03-02') }, // 60日
      { actualPct: 0, startDate: d('2026-01-01'), endDate: d('2026-01-31') }, // 30日
    ]
    // weights = [60, 30], totalWeight = 90
    // result = (100*60 + 0*30) / 90 = 6000/90 ≈ 66.67
    const result = calcWeightedActualPct(children)
    expect(result).toBeCloseTo(200 / 3, 2)
  })
})
