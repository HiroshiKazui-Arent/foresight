import { describe, it, expect } from 'vitest'

// DaysPill の表示ロジックをテスト
function formatDays(days: number): string {
  const rounded = Math.round(days)
  const prefix = rounded > 0 ? '+' : ''
  return `${prefix}${rounded}日`
}

function isLate(days: number): boolean {
  return days < 0
}

describe('DaysPill 表示ロジック', () => {
  describe('formatDays', () => {
    it('正の値はプラス記号付き', () => {
      expect(formatDays(1)).toBe('+1日')
      expect(formatDays(5)).toBe('+5日')
      expect(formatDays(100)).toBe('+100日')
    })

    it('負の値はマイナス記号のみ（プラス記号なし）', () => {
      expect(formatDays(-1)).toBe('-1日')
      expect(formatDays(-9)).toBe('-9日')
      expect(formatDays(-100)).toBe('-100日')
    })

    it('0はプラス記号なし', () => {
      expect(formatDays(0)).toBe('0日')
    })

    it('小数点は四捨五入される', () => {
      expect(formatDays(1.4)).toBe('+1日')
      expect(formatDays(1.5)).toBe('+2日')
      expect(formatDays(-1.4)).toBe('-1日')
      expect(formatDays(-1.5)).toBe('-1日')
    })

    it('0.4 は 0（プラス記号なし）', () => {
      expect(formatDays(0.4)).toBe('0日')
    })
  })

  describe('isLate', () => {
    it('負の値は遅延', () => {
      expect(isLate(-1)).toBe(true)
      expect(isLate(-0.1)).toBe(true)
      expect(isLate(-100)).toBe(true)
    })

    it('0は遅延でない', () => {
      expect(isLate(0)).toBe(false)
    })

    it('正の値は遅延でない', () => {
      expect(isLate(1)).toBe(false)
      expect(isLate(0.1)).toBe(false)
      expect(isLate(100)).toBe(false)
    })
  })

  describe('色クラス選択', () => {
    it('遅延時は赤テキストクラス', () => {
      const textClass = isLate(-9) ? 'text-red-600' : 'text-green-600'
      expect(textClass).toBe('text-red-600')
    })

    it('進行/0日は緑テキストクラス', () => {
      const textClassZero = isLate(0) ? 'text-red-600' : 'text-green-600'
      const textClassPositive = isLate(1) ? 'text-red-600' : 'text-green-600'
      expect(textClassZero).toBe('text-green-600')
      expect(textClassPositive).toBe('text-green-600')
    })
  })
})
