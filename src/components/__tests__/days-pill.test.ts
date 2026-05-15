import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DaysPill } from '@/components/days-pill'

// ─── 新インタフェース: today/rowEnd/actualPct/scheduledPct/durationDays ────────

describe('DaysPill: 実日数表示 (新インタフェース)', () => {
  const overdueToday = new Date('2026-06-16')
  const rowEnd = new Date('2026-05-31')

  it('today > rowEnd: 16日超過 → -16日', () => {
    const html = renderToStaticMarkup(
      createElement(DaysPill, {
        today: overdueToday,
        rowEnd,
        actualPct: 0,
        scheduledPct: 100,
        durationDays: 30,
      }),
    )
    expect(html).toContain('-16日')
  })

  it('today > rowEnd: クランプなし (超過日数 > durationDays でも正しく表示)', () => {
    const longOverdue = new Date('2026-12-31')
    const earlyEnd = new Date('2026-01-01')
    const html = renderToStaticMarkup(
      createElement(DaysPill, {
        today: longOverdue,
        rowEnd: earlyEnd,
        actualPct: 0,
        scheduledPct: 100,
        durationDays: 30,
      }),
    )
    // 超過日数は durationDays(30)を超えるはず
    const match = html.match(/-(\d+)日/)
    expect(Number(match?.[1] ?? 0)).toBeGreaterThan(30)
  })

  it('today = rowEnd, actualPct=scheduledPct=50: 0日 (偏差ゼロ, 超過ではない)', () => {
    // today <= rowEnd なので実日数経路ではなく calcDaysDeviation 経路
    // actual=scheduled のため偏差 0
    const exact = new Date('2026-05-31')
    const html = renderToStaticMarkup(
      createElement(DaysPill, {
        today: exact,
        rowEnd: exact,
        actualPct: 50,
        scheduledPct: 50,
        durationDays: 30,
      }),
    )
    expect(html).toContain('0日')
  })

  it('today = rowEnd, actualPct=0, scheduledPct=100: -30日 (期日当日・未進捗 → deviation経路)', () => {
    // today <= rowEnd: 超過扱いにならず calcDaysDeviation が適用される
    // (0 - 100) / 100 * 30 = -30
    const exact = new Date('2026-05-31')
    const html = renderToStaticMarkup(
      createElement(DaysPill, {
        today: exact,
        rowEnd: exact,
        actualPct: 0,
        scheduledPct: 100,
        durationDays: 30,
      }),
    )
    expect(html).toContain('-30日')
  })

  it('today <= rowEnd, actualPct > scheduledPct: +表示 (前倒し)', () => {
    const before = new Date('2026-05-15')
    const end = new Date('2026-06-30')
    const html = renderToStaticMarkup(
      createElement(DaysPill, {
        today: before,
        rowEnd: end,
        actualPct: 70,
        scheduledPct: 50,
        durationDays: 30,
      }),
    )
    expect(html).toContain('+')
  })

  it('today <= rowEnd, actualPct < scheduledPct: 負表示 (遅延)', () => {
    const before = new Date('2026-05-15')
    const end = new Date('2026-06-30')
    const html = renderToStaticMarkup(
      createElement(DaysPill, {
        today: before,
        rowEnd: end,
        actualPct: 20,
        scheduledPct: 60,
        durationDays: 30,
      }),
    )
    expect(html).toMatch(/-\d+日/)
  })

  it('overdue 時: 赤テキストクラス', () => {
    const html = renderToStaticMarkup(
      createElement(DaysPill, {
        today: overdueToday,
        rowEnd,
        actualPct: 0,
        scheduledPct: 100,
        durationDays: 30,
      }),
    )
    expect(html).toContain('text-red-600')
  })

  it('前倒し時: 緑テキストクラス', () => {
    const before = new Date('2026-05-15')
    const end = new Date('2026-06-30')
    const html = renderToStaticMarkup(
      createElement(DaysPill, {
        today: before,
        rowEnd: end,
        actualPct: 70,
        scheduledPct: 50,
        durationDays: 30,
      }),
    )
    expect(html).toContain('text-green-600')
  })
})

// ─── 後方互換: days prop (数値を直接渡す) ────────────────────────────────────

describe('DaysPill: 後方互換 (days prop)', () => {
  it('days=-9 → -9日 赤', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(createElement(DaysPill, { days: -9 } as any))
    expect(html).toContain('-9日')
    expect(html).toContain('text-red-600')
  })

  it('days=1 → +1日 緑', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(createElement(DaysPill, { days: 1 } as any))
    expect(html).toContain('+1日')
    expect(html).toContain('text-green-600')
  })

  it('days=0 → 0日 緑', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(createElement(DaysPill, { days: 0 } as any))
    expect(html).toContain('0日')
    expect(html).toContain('text-green-600')
  })

  it('小数は四捨五入: days=1.5 → +2日', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(createElement(DaysPill, { days: 1.5 } as any))
    expect(html).toContain('+2日')
  })
})
