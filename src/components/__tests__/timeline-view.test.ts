import { describe, it, expect } from 'vitest'
import { calcBarPosition, calcTodayLine } from '@/components/timeline-view/timeline-utils'

// ─── calcBarPosition ──────────────────────────────────────────────────────────

describe('calcBarPosition', () => {
  const scopeStart = new Date('2026-01-01')
  const scopeEnd = new Date('2026-12-31')

  it('item がスコープ内に収まる通常ケース', () => {
    const itemStart = new Date('2026-04-01')
    const itemEnd = new Date('2026-07-01')
    const { offsetPct, widthPct } = calcBarPosition(
      { startDate: itemStart, endDate: itemEnd },
      { startDate: scopeStart, endDate: scopeEnd },
    )
    expect(offsetPct).toBeGreaterThan(0)
    expect(widthPct).toBeGreaterThan(0)
    expect(offsetPct + widthPct).toBeLessThanOrEqual(100)
  })

  it('item がスコープ左にはみ出す → offsetPct = 0', () => {
    const itemStart = new Date('2025-06-01') // scope より前
    const itemEnd = new Date('2026-06-01')
    const { offsetPct } = calcBarPosition(
      { startDate: itemStart, endDate: itemEnd },
      { startDate: scopeStart, endDate: scopeEnd },
    )
    expect(offsetPct).toBe(0)
  })

  it('item がスコープ右にはみ出す → widthPct は 100 - offsetPct を超えない', () => {
    const itemStart = new Date('2026-07-01')
    const itemEnd = new Date('2027-06-01') // scope より後
    const { offsetPct, widthPct } = calcBarPosition(
      { startDate: itemStart, endDate: itemEnd },
      { startDate: scopeStart, endDate: scopeEnd },
    )
    expect(offsetPct + widthPct).toBeLessThanOrEqual(100)
    expect(widthPct).toBeGreaterThanOrEqual(1) // 最低 1%
  })

  it('scopeRangeMs = 0（ゼロ除算ガード）→ offsetPct=0, widthPct=100', () => {
    const sameDate = new Date('2026-06-01')
    const { offsetPct, widthPct } = calcBarPosition(
      { startDate: sameDate, endDate: sameDate },
      { startDate: sameDate, endDate: sameDate },
    )
    expect(offsetPct).toBe(0)
    expect(widthPct).toBe(100)
  })

  it('widthPct の最小値は 1', () => {
    // item がほぼゼロ幅（1ミリ秒）
    const itemStart = new Date('2026-06-01T00:00:00.000Z')
    const itemEnd = new Date('2026-06-01T00:00:00.001Z')
    const { widthPct } = calcBarPosition(
      { startDate: itemStart, endDate: itemEnd },
      { startDate: scopeStart, endDate: scopeEnd },
    )
    expect(widthPct).toBeGreaterThanOrEqual(1)
  })

  it('item がスコープ全体と一致 → offsetPct=0, widthPct=100', () => {
    const { offsetPct, widthPct } = calcBarPosition(
      { startDate: scopeStart, endDate: scopeEnd },
      { startDate: scopeStart, endDate: scopeEnd },
    )
    expect(offsetPct).toBe(0)
    expect(widthPct).toBeCloseTo(100, 5)
  })

  it('item 開始が scope 終了と同じ → widthPct は最低 1', () => {
    const { widthPct } = calcBarPosition(
      { startDate: scopeEnd, endDate: scopeEnd },
      { startDate: scopeStart, endDate: scopeEnd },
    )
    expect(widthPct).toBeGreaterThanOrEqual(1)
  })
})

// ─── calcTodayLine ────────────────────────────────────────────────────────────

describe('calcTodayLine', () => {
  const scopeStart = new Date('2026-01-01')
  const scopeEnd = new Date('2026-12-31')

  it('today がスコープ内 → showTodayLine=true かつ正しい offsetPct', () => {
    const today = new Date('2026-07-02') // 約 50% 付近
    const { showTodayLine, todayOffsetPct } = calcTodayLine(today, {
      startDate: scopeStart,
      endDate: scopeEnd,
    })
    expect(showTodayLine).toBe(true)
    expect(todayOffsetPct).toBeGreaterThan(40)
    expect(todayOffsetPct).toBeLessThan(60)
  })

  it('today がスコープより前 → showTodayLine=false', () => {
    const today = new Date('2025-06-01')
    const { showTodayLine } = calcTodayLine(today, {
      startDate: scopeStart,
      endDate: scopeEnd,
    })
    expect(showTodayLine).toBe(false)
  })

  it('today がスコープより後 → showTodayLine=false', () => {
    const today = new Date('2027-06-01')
    const { showTodayLine } = calcTodayLine(today, {
      startDate: scopeStart,
      endDate: scopeEnd,
    })
    expect(showTodayLine).toBe(false)
  })

  it('today がスコープの開始日と同じ → showTodayLine=true, todayOffsetPct=0', () => {
    const { showTodayLine, todayOffsetPct } = calcTodayLine(scopeStart, {
      startDate: scopeStart,
      endDate: scopeEnd,
    })
    expect(showTodayLine).toBe(true)
    expect(todayOffsetPct).toBe(0)
  })

  it('today がスコープの終了日と同じ → showTodayLine=true, todayOffsetPct=100', () => {
    const { showTodayLine, todayOffsetPct } = calcTodayLine(scopeEnd, {
      startDate: scopeStart,
      endDate: scopeEnd,
    })
    expect(showTodayLine).toBe(true)
    expect(todayOffsetPct).toBeCloseTo(100, 5)
  })

  it('scopeRangeMs = 0 → showTodayLine=false', () => {
    const sameDate = new Date('2026-06-01')
    const { showTodayLine } = calcTodayLine(sameDate, {
      startDate: sameDate,
      endDate: sameDate,
    })
    expect(showTodayLine).toBe(false)
  })
})
