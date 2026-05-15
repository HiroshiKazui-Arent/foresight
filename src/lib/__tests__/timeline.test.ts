import { describe, it, expect } from 'vitest'
import { xForDate, barOffsetWidth } from '@/lib/timeline'

// ローカル日付ヘルパー
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

describe('xForDate (src/lib/timeline.ts)', () => {
  const start = d(2025, 1, 1)
  const end = d(2025, 12, 31)

  it('d === projectStart → 0', () => {
    expect(xForDate(start, start, end)).toBe(0)
  })

  it('d === projectEnd → 100', () => {
    expect(xForDate(end, start, end)).toBe(100)
  })

  it('d が中間点 → 50', () => {
    const mid = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2)
    expect(xForDate(mid, start, end)).toBe(50)
  })

  it('d < projectStart → 0 にクランプ', () => {
    expect(xForDate(d(2024, 12, 31), start, end)).toBe(0)
  })

  it('d > projectEnd → 100 にクランプ', () => {
    expect(xForDate(d(2026, 1, 1), start, end)).toBe(100)
  })

  it('projectStart === projectEnd → 0 (ゼロ除算ガード)', () => {
    const same = d(2025, 6, 15)
    expect(xForDate(same, same, same)).toBe(0)
  })
})

describe('barOffsetWidth (src/lib/timeline.ts)', () => {
  const projectStart = d(2025, 1, 1)
  const projectEnd = d(2025, 12, 31)

  it('バーがプロジェクト内に収まる通常ケース', () => {
    const totalMs = projectEnd.getTime() - projectStart.getTime()
    const rowStart = new Date(projectStart.getTime() + totalMs * 0.25)
    const rowEnd = new Date(projectStart.getTime() + totalMs * 0.75)
    const result = barOffsetWidth(rowStart, rowEnd, projectStart, projectEnd)
    expect(result.left).toBeCloseTo(25, 5)
    expect(result.width).toBeCloseTo(50, 5)
  })

  it('バーが左側にはみ出す → left = 0 にクランプ', () => {
    const result = barOffsetWidth(d(2024, 6, 1), d(2025, 6, 30), projectStart, projectEnd)
    expect(result.left).toBe(0)
    expect(result.width).toBeGreaterThan(0)
  })

  it('バーが右側にはみ出す → right が 100 でクランプ', () => {
    const result = barOffsetWidth(d(2025, 6, 1), d(2026, 6, 1), projectStart, projectEnd)
    expect(result.left).toBeGreaterThan(0)
    expect(result.left + result.width).toBeCloseTo(100, 5)
  })

  it('rowEnd < rowStart → width = 0', () => {
    const result = barOffsetWidth(d(2025, 9, 1), d(2025, 3, 1), projectStart, projectEnd)
    expect(result.width).toBe(0)
  })

  it('projectStart === projectEnd → left = 0, width = 0', () => {
    const same = d(2025, 6, 15)
    const result = barOffsetWidth(d(2025, 6, 1), d(2025, 6, 30), same, same)
    expect(result.left).toBe(0)
    expect(result.width).toBe(0)
  })
})
