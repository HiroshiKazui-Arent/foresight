import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TodayMarker } from '@/components/gantt/today-marker'

function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

const projectStart = d(2025, 1, 1)
const projectEnd = d(2025, 12, 31)

describe('TodayMarker — 描画条件', () => {
  it('today がプロジェクト期間内 → 描画する', () => {
    const html = renderToStaticMarkup(
      TodayMarker({
        projectStart,
        projectEnd,
        today: d(2025, 6, 15),
      }),
    )
    expect(html).not.toBe('')
    expect(html).not.toBe('null')
    expect(html.length).toBeGreaterThan(0)
  })

  it('today === projectStart → 描画する', () => {
    const result = TodayMarker({ projectStart, projectEnd, today: projectStart })
    expect(result).not.toBeNull()
  })

  it('today === projectEnd → 描画する', () => {
    const result = TodayMarker({ projectStart, projectEnd, today: projectEnd })
    expect(result).not.toBeNull()
  })

  it('today < projectStart → null を返す', () => {
    const result = TodayMarker({ projectStart, projectEnd, today: d(2024, 12, 31) })
    expect(result).toBeNull()
  })

  it('today > projectEnd → null を返す', () => {
    const result = TodayMarker({ projectStart, projectEnd, today: d(2026, 1, 1) })
    expect(result).toBeNull()
  })
})

describe('TodayMarker — 縦線スタイル', () => {
  it('bg-red-500 w-0.5 の縦線を含む', () => {
    const html = renderToStaticMarkup(
      TodayMarker({
        projectStart,
        projectEnd,
        today: d(2025, 6, 15),
      }),
    )
    expect(html).toContain('bg-red-500')
    expect(html).toContain('w-0.5')
  })
})

describe('TodayMarker — ラベル表示', () => {
  it('showLabel=true (デフォルト) → 今日(MM/DD) ラベルを表示', () => {
    const html = renderToStaticMarkup(
      TodayMarker({
        projectStart,
        projectEnd,
        today: d(2025, 6, 15),
      }),
    )
    expect(html).toContain('今日')
    // 6/15 形式
    expect(html).toContain('6/15')
  })

  it('showLabel=false → ラベルを表示しない', () => {
    const html = renderToStaticMarkup(
      TodayMarker({
        projectStart,
        projectEnd,
        today: d(2025, 6, 15),
        showLabel: false,
      }),
    )
    expect(html).not.toContain('今日')
  })

  it('showLabel=true → 1月1日は 1/1 形式', () => {
    const html = renderToStaticMarkup(
      TodayMarker({
        projectStart: d(2025, 1, 1),
        projectEnd: d(2025, 12, 31),
        today: d(2025, 1, 1),
      }),
    )
    expect(html).toContain('1/1')
  })

  it('showLabel=true → 12月31日は 12/31 形式', () => {
    const html = renderToStaticMarkup(
      TodayMarker({
        projectStart: d(2025, 1, 1),
        projectEnd: d(2025, 12, 31),
        today: d(2025, 12, 31),
      }),
    )
    expect(html).toContain('12/31')
  })
})

describe('TodayMarker — 位置', () => {
  it('left スタイルが 0〜100% の範囲内', () => {
    const html = renderToStaticMarkup(
      TodayMarker({
        projectStart,
        projectEnd,
        today: d(2025, 6, 15),
      }),
    )
    const match = html.match(/left:\s*([\d.]+)%/)
    expect(match).not.toBeNull()
    const leftVal = parseFloat(match![1])
    expect(leftVal).toBeGreaterThanOrEqual(0)
    expect(leftVal).toBeLessThanOrEqual(100)
  })
})
