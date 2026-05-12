import { describe, it, expect } from 'vitest'
import { redistributeWeights } from '@/lib/weight'

describe('redistributeWeights', () => {
  it('n=0 は空配列', () => {
    expect(redistributeWeights(0)).toEqual([])
  })

  it('n=1 は [100]', () => {
    expect(redistributeWeights(1)).toEqual([100])
  })

  it('n=3 は [33, 33, 34]（端数を最後に寄せる）', () => {
    expect(redistributeWeights(3)).toEqual([33, 33, 34])
  })

  it('n=4 は均等割り [25, 25, 25, 25]', () => {
    expect(redistributeWeights(4)).toEqual([25, 25, 25, 25])
  })

  it('n=7 は合計が100', () => {
    const weights = redistributeWeights(7)
    expect(weights.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('n=1〜10 すべてで合計が100', () => {
    for (let n = 1; n <= 10; n++) {
      const weights = redistributeWeights(n)
      expect(weights.reduce((a, b) => a + b, 0)).toBe(100)
    }
  })

  it('すべての要素が整数', () => {
    for (let n = 1; n <= 10; n++) {
      const weights = redistributeWeights(n)
      weights.forEach((w) => expect(Number.isInteger(w)).toBe(true))
    }
  })
})
