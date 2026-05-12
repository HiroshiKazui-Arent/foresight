import { describe, it, expect } from 'vitest'

// ProgressPill の表示ロジックをテスト
function formatProgressText(actualPct: number, scheduledPct: number): string {
  return `${Math.round(actualPct)}% / ${Math.round(scheduledPct)}%`
}

describe('ProgressPill 表示ロジック', () => {
  it('整数値をフォーマット', () => {
    expect(formatProgressText(44, 83)).toBe('44% / 83%')
  })

  it('0% / 0%', () => {
    expect(formatProgressText(0, 0)).toBe('0% / 0%')
  })

  it('100% / 100%', () => {
    expect(formatProgressText(100, 100)).toBe('100% / 100%')
  })

  it('小数点は四捨五入', () => {
    expect(formatProgressText(44.4, 83.6)).toBe('44% / 84%')
    expect(formatProgressText(44.5, 83.5)).toBe('45% / 84%')
  })

  it('actualPct > scheduledPct', () => {
    expect(formatProgressText(90, 70)).toBe('90% / 70%')
  })

  it('actualPct < scheduledPct', () => {
    expect(formatProgressText(20, 80)).toBe('20% / 80%')
  })

  it('フォーマットが "X% / Y%" の形式', () => {
    const result = formatProgressText(50, 75)
    expect(result).toMatch(/^\d+% \/ \d+%$/)
  })
})
