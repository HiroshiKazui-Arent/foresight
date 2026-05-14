import { describe, it, expect } from 'vitest'
import { formatTodayLabel } from '../timeline-header'

// ローカル日付ヘルパー
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

describe('formatTodayLabel', () => {
  it('1月1日 → "今日 1/1"', () => {
    expect(formatTodayLabel(d(2025, 1, 1))).toBe('今日 1/1')
  })

  it('12月31日 → "今日 12/31"', () => {
    expect(formatTodayLabel(d(2025, 12, 31))).toBe('今日 12/31')
  })

  it('月の1桁 3月5日 → "今日 3/5"', () => {
    expect(formatTodayLabel(d(2025, 3, 5))).toBe('今日 3/5')
  })

  it('月が2桁 10月15日 → "今日 10/15"', () => {
    expect(formatTodayLabel(d(2025, 10, 15))).toBe('今日 10/15')
  })

  it('2月28日 → "今日 2/28"', () => {
    expect(formatTodayLabel(d(2025, 2, 28))).toBe('今日 2/28')
  })

  it('日が1桁 6月1日 → "今日 6/1"', () => {
    expect(formatTodayLabel(d(2025, 6, 1))).toBe('今日 6/1')
  })

  it('うるう年 2月29日 → "今日 2/29"', () => {
    expect(formatTodayLabel(d(2024, 2, 29))).toBe('今日 2/29')
  })
})
