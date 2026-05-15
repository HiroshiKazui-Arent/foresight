import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PeriodBar } from '@/components/gantt/period-bar'

// UTC 日付ヘルパー (DB 由来の日付は UTC midnight)
function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

const projectStart = d(2025, 1, 1)
const projectEnd = d(2025, 12, 31)

describe('PeriodBar — 予定バー', () => {
  it('予定バーは常に描画される', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        today: d(2025, 5, 15),
        projectStart,
        projectEnd,
      }),
    )
    // bg-blue-200 クラスが存在すること
    expect(html).toContain('bg-blue-200')
  })

  it('予定バーの left/width が 0〜100% の範囲内', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        today: d(2025, 5, 15),
        projectStart,
        projectEnd,
      }),
    )
    // left: X% / width: X% のスタイルが含まれること (0より大きい値)
    expect(html).toMatch(/left:\s*[\d.]+%/)
    expect(html).toMatch(/width:\s*[\d.]+%/)
  })
})

describe('PeriodBar — 実績バー (completed)', () => {
  it('actualEndDate != null → completed: 実績バーを描画', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 5),
        actualEndDate: d(2025, 9, 25),
        today: d(2025, 10, 1),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('bg-emerald-500')
  })

  it('actualStartDate < startDate (先行着手): 実績バーは actualStartDate から開始', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 4, 1),
        endDate: d(2025, 8, 31),
        actualStartDate: d(2025, 3, 1), // 予定より1ヶ月早い
        actualEndDate: d(2025, 8, 20),
        today: d(2025, 9, 1),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('bg-emerald-500')
    // 実績開始が予定開始より左にあること (left が負 → クランプで 0 に近い値)
    // actualStartDate=3/1, startDate=4/1 なので実績バーの left は wrapper 内で負 (クランプされる)
  })

  it('actualEndDate > endDate (超過完了): 実績バーは actualEndDate まで描画', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 6, 30),
        actualStartDate: d(2025, 3, 5),
        actualEndDate: d(2025, 8, 15), // 予定終了より後
        today: d(2025, 8, 20),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('bg-emerald-500')
  })
})

describe('PeriodBar — 実績バー (in-progress)', () => {
  it('actualStartDate != null && actualEndDate == null → in-progress: 実績バーを描画', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 10),
        today: d(2025, 6, 1),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('bg-emerald-500')
  })

  it('in-progress: 実績バーの終端は today (期日内)', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 10),
        today: d(2025, 6, 1), // today < endDate
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('bg-emerald-500')
  })

  it('in-progress で today > endDate: 実績バー終端は projectEnd で頭打ち (Task endDate ではクランプしない)', () => {
    // today が endDate を超過しているが projectEnd 内 → 実績バーは today まで伸びる
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 6, 30), // タスク期日
        actualStartDate: d(2025, 3, 10),
        today: d(2025, 8, 1), // today > endDate だが < projectEnd
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('bg-emerald-500')
    // 実績バーの右端が endDate ではなく today に基づくこと
    // (endDate=6/30 は x≒49%, today=8/1 は x≒58% → width が大きくなる)
  })

  it('in-progress で today > projectEnd: 実績バー終端は projectEnd で頭打ち', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 10),
        today: d(2026, 2, 1), // today > projectEnd
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('bg-emerald-500')
  })
})

describe('PeriodBar — 実績バー (not-started)', () => {
  it('actualStartDate == null → 実績バーを描画しない', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        today: d(2025, 5, 15),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).not.toContain('bg-emerald-500')
  })
})

describe('PeriodBar — 進捗塗りつぶしなし (v4.0 仕様)', () => {
  it('進捗% に関連するスタイルを持たない', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 10),
        today: d(2025, 6, 1),
        projectStart,
        projectEnd,
      }),
    )
    // 進捗% 塗りつぶしは一切持たない (bg-blue-500 等の進捗色は使わない)
    expect(html).not.toContain('bg-blue-500')
  })
})

describe('PeriodBar — ツールチップ', () => {
  it('予定バーに title 属性 (MM/DD → MM/DD (N日)) が含まれる', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        today: d(2025, 5, 15),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('予定:')
    expect(html).toMatch(/\d+\/\d+/)
    expect(html).toMatch(/\d+日/)
  })

  it('実績バーに title 属性 (実績: ...) が含まれる', () => {
    const html = renderToStaticMarkup(
      PeriodBar({
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 10),
        actualEndDate: d(2025, 8, 20),
        today: d(2025, 9, 1),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('実績:')
  })
})
