import { describe, it, expect } from 'vitest'
import { isValidTodayX } from '../today-line'

describe('isValidTodayX', () => {
  it('todayX = 50 → 有効な範囲 (true)', () => {
    expect(isValidTodayX(50)).toBe(true)
  })

  it('todayX = 0 → 有効な範囲 (true)', () => {
    expect(isValidTodayX(0)).toBe(true)
  })

  it('todayX = 100 → 有効な範囲 (true)', () => {
    expect(isValidTodayX(100)).toBe(true)
  })

  it('todayX = -1 → 範囲外 (false)', () => {
    expect(isValidTodayX(-1)).toBe(false)
  })

  it('todayX = 101 → 範囲外 (false)', () => {
    expect(isValidTodayX(101)).toBe(false)
  })

  it('todayX = 0.001 → 有効な範囲 (true)', () => {
    expect(isValidTodayX(0.001)).toBe(true)
  })

  it('todayX = 99.999 → 有効な範囲 (true)', () => {
    expect(isValidTodayX(99.999)).toBe(true)
  })

  it('todayX = -0.001 → 範囲外 (false)', () => {
    expect(isValidTodayX(-0.001)).toBe(false)
  })

  it('todayX = 100.001 → 範囲外 (false)', () => {
    expect(isValidTodayX(100.001)).toBe(false)
  })
})
