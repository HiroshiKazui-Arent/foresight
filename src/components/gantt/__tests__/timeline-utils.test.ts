import { describe, it, expect } from 'vitest'
import { xForDate, barOffsetWidth, monthBoundaries } from '../timeline-utils'

// ローカル日付ヘルパー (テスト内でのみ使用)
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

// --------------------------------
// xForDate
// --------------------------------
describe('xForDate', () => {
  const start = d(2025, 1, 1)
  const end = d(2025, 12, 31)

  it('今日 = projectStart → 0', () => {
    expect(xForDate(start, start, end)).toBe(0)
  })

  it('今日 = projectEnd → 100', () => {
    expect(xForDate(end, start, end)).toBe(100)
  })

  it('今日 = 中間点 → 50', () => {
    // 2025-01-01 〜 2025-12-31 の中間は 2025-07-02 (364日 / 2 = 182日後)
    const mid = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2)
    expect(xForDate(mid, start, end)).toBe(50)
  })

  it('今日 < projectStart → 0 にクランプ', () => {
    expect(xForDate(d(2024, 12, 31), start, end)).toBe(0)
  })

  it('今日 > projectEnd → 100 にクランプ', () => {
    expect(xForDate(d(2026, 1, 1), start, end)).toBe(100)
  })

  it('projectStart === projectEnd → 0 (ゼロ除算ガード)', () => {
    const same = d(2025, 6, 15)
    expect(xForDate(same, same, same)).toBe(0)
  })
})

// --------------------------------
// barOffsetWidth
// --------------------------------
describe('barOffsetWidth', () => {
  const projectStart = d(2025, 1, 1)
  const projectEnd = d(2025, 12, 31)

  it('バーがプロジェクト内に収まる通常ケース', () => {
    // 1/4 〜 3/4 の位置にあるバー
    const totalMs = projectEnd.getTime() - projectStart.getTime()
    const rowStart = new Date(projectStart.getTime() + totalMs * 0.25)
    const rowEnd = new Date(projectStart.getTime() + totalMs * 0.75)

    const result = barOffsetWidth(rowStart, rowEnd, projectStart, projectEnd)
    expect(result.left).toBeCloseTo(25, 5)
    expect(result.width).toBeCloseTo(50, 5)
  })

  it('バーが左側にはみ出す → left = 0 にクランプ', () => {
    const rowStart = d(2024, 6, 1) // プロジェクト開始より前
    const rowEnd = d(2025, 6, 30)

    const result = barOffsetWidth(rowStart, rowEnd, projectStart, projectEnd)
    expect(result.left).toBe(0)
    expect(result.width).toBeGreaterThan(0)
    expect(result.width).toBeLessThanOrEqual(100)
  })

  it('バーが右側にはみ出す → right が 100 でクランプ', () => {
    const rowStart = d(2025, 6, 1)
    const rowEnd = d(2026, 6, 1) // プロジェクト終了より後

    const result = barOffsetWidth(rowStart, rowEnd, projectStart, projectEnd)
    expect(result.left).toBeGreaterThan(0)
    expect(result.left + result.width).toBeCloseTo(100, 5)
  })

  it('バーが両側にはみ出す → left = 0, width = 100', () => {
    const rowStart = d(2024, 1, 1)
    const rowEnd = d(2026, 12, 31)

    const result = barOffsetWidth(rowStart, rowEnd, projectStart, projectEnd)
    expect(result.left).toBe(0)
    expect(result.width).toBe(100)
  })

  it('rowStart === rowEnd → width = 0', () => {
    const same = d(2025, 6, 15)
    const result = barOffsetWidth(same, same, projectStart, projectEnd)
    expect(result.width).toBe(0)
  })

  it('rowEnd < rowStart (逆転バー) → width = 0', () => {
    const rowStart = d(2025, 9, 1)
    const rowEnd = d(2025, 3, 1) // end が start より前
    const result = barOffsetWidth(rowStart, rowEnd, projectStart, projectEnd)
    expect(result.width).toBe(0)
  })

  it('projectStart === projectEnd (ゼロ除算ガード) → left = 0, width = 0', () => {
    const same = d(2025, 6, 15)
    const result = barOffsetWidth(d(2025, 6, 1), d(2025, 6, 30), same, same)
    expect(result.left).toBe(0)
    expect(result.width).toBe(0)
  })
})

// --------------------------------
// monthBoundaries
// --------------------------------
describe('monthBoundaries', () => {
  it('同月内の短期間 (同月) → projectStart が月初ならその1件のみ', () => {
    // 2025-03-01 〜 2025-03-15 : 3月1日が月初なので含まれる
    const result = monthBoundaries(d(2025, 3, 1), d(2025, 3, 15))
    expect(result).toHaveLength(1)
    expect(result[0].date.getMonth()).toBe(2) // 3月 (0-indexed)
    expect(result[0].date.getDate()).toBe(1)
  })

  it('同月内で開始日が月初でない → 空配列', () => {
    // 2025-03-05 〜 2025-03-15 : 4月1日はprojectEnd以降なので含まれない
    const result = monthBoundaries(d(2025, 3, 5), d(2025, 3, 15))
    expect(result).toHaveLength(0)
  })

  it('ちょうど3ヶ月の期間 (月初〜月初) → 3エントリ', () => {
    // 2025-01-01 〜 2025-03-31: 1/1, 2/1, 3/1 の3件
    const result = monthBoundaries(d(2025, 1, 1), d(2025, 3, 31))
    expect(result).toHaveLength(3)
    expect(result[0].date.getDate()).toBe(1)
    expect(result[0].date.getMonth()).toBe(0) // 1月
    expect(result[1].date.getMonth()).toBe(1) // 2月
    expect(result[2].date.getMonth()).toBe(2) // 3月
  })

  it('projectStart が月初 → 配列に含まれる', () => {
    const result = monthBoundaries(d(2025, 4, 1), d(2025, 6, 30))
    expect(result[0].date.getTime()).toBe(d(2025, 4, 1).getTime())
  })

  it('projectStart が月初でない → projectStart は含まれない', () => {
    const result = monthBoundaries(d(2025, 4, 15), d(2025, 6, 30))
    // 最初のエントリは 5/1 のはず
    expect(result[0].date.getTime()).toBe(d(2025, 5, 1).getTime())
  })

  it('各エントリの x が昇順かつ 0〜100 の範囲内', () => {
    const result = monthBoundaries(d(2025, 1, 1), d(2025, 12, 31))
    expect(result.length).toBeGreaterThan(0)
    for (const entry of result) {
      expect(entry.x).toBeGreaterThanOrEqual(0)
      expect(entry.x).toBeLessThanOrEqual(100)
    }
    for (let i = 1; i < result.length; i++) {
      expect(result[i].x).toBeGreaterThan(result[i - 1].x)
    }
  })

  it('projectEnd が月初 → x=100 で配列に含まれる', () => {
    // 2025-01-15 〜 2025-04-01: 2/1, 3/1, 4/1 の3件 (4/1 が x=100)
    const result = monthBoundaries(d(2025, 1, 15), d(2025, 4, 1))
    expect(result).toHaveLength(3)
    const last = result[result.length - 1]
    expect(last.date.getTime()).toBe(d(2025, 4, 1).getTime())
    expect(last.x).toBe(100)
  })

  it('projectStart === projectEnd → 空配列 (ゼロ除算ガード)', () => {
    const same = d(2025, 6, 1) // 月初でも空を返す
    const result = monthBoundaries(same, same)
    expect(result).toHaveLength(0)
  })
})
