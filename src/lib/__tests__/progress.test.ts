import { describe, it, expect } from 'vitest'

function redistributeWeights(count: number): number[] {
  if (count === 0) return []
  const base = Math.floor(100 / count)
  const remainder = 100 - base * count
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? base + remainder : base))
}

function calcScheduledPct(startDate: Date, endDate: Date, today: Date): number {
  const total = endDate.getTime() - startDate.getTime()
  if (total <= 0) return 100
  const elapsed = today.getTime() - startDate.getTime()
  return Math.min(100, Math.max(0, (elapsed / total) * 100))
}

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
})
