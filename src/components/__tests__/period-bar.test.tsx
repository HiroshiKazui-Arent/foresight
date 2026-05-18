import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { PeriodBar } from '@/components/gantt/period-bar'

// UTC 日付ヘルパー
function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

const projectStart = d(2025, 1, 1)
const projectEnd = d(2025, 12, 31)

/**
 * style 文字列から `left: X%` の数値を取り出す。
 * 上下分離仕様では予定 / 実績バーがそれぞれ独立の style を持つ。
 */
function extractLeftPct(html: string, marker: string): number {
  // marker (bg-blue-200 や bg-emerald-500) を含む div の style 内 left を抽出
  const re = new RegExp(`${marker}[^>]*style="([^"]+)"`, 'g')
  let match: RegExpExecArray | null
  let result: number = NaN
  while ((match = re.exec(html)) !== null) {
    const styleStr = match[1]
    const m2 = /left:\s*([\d.]+)%/.exec(styleStr)
    if (m2) {
      result = parseFloat(m2[1])
      return result
    }
  }
  return result
}

function extractWidthPct(html: string, marker: string): number {
  const re = new RegExp(`${marker}[^>]*style="([^"]+)"`, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const styleStr = match[1]
    const m2 = /width:\s*([\d.]+)%/.exec(styleStr)
    if (m2) return parseFloat(m2[1])
  }
  return NaN
}

describe('PeriodBar — 予定バー (上下分離仕様)', () => {
  it('予定バーは常に描画される (bg-blue-200)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        today: d(2025, 5, 15),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('bg-blue-200')
  })

  it('予定バーは上段配置 (top: 0)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        today: d(2025, 5, 15),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toMatch(/bg-blue-200[^>]*style="[^"]*top:\s*0/)
  })

  it('予定バーの left/width は projectStart/projectEnd 基準で % 算出される', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        today: d(2025, 5, 15),
        projectStart,
        projectEnd,
      }),
    )
    const left = extractLeftPct(html, 'bg-blue-200')
    const width = extractWidthPct(html, 'bg-blue-200')
    expect(left).toBeGreaterThan(15) // 3/1 は約 16%
    expect(left).toBeLessThan(20)
    expect(width).toBeGreaterThan(55) // 3/1〜9/30 約 59%
    expect(width).toBeLessThan(62)
  })
})

describe('PeriodBar — 実績バー (上下分離仕様)', () => {
  it('actualEndDate != null → completed: 実績バーを描画 (bg-emerald-500, bottom:0)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
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
    expect(html).toMatch(/bg-emerald-500[^>]*style="[^"]*bottom:\s*0/)
  })

  it('actualStartDate == null → 実績バーを描画しない', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        today: d(2025, 5, 15),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).not.toContain('bg-emerald-500')
  })

  it('in-progress: 実績バーの終端は today (today < endDate)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
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
})

describe('PeriodBar — 2 本同時描画 (バグ再現)', () => {
  it('completed で plan と actual がほぼ同じ範囲でも、予定バーと実績バーの両方が同時に存在する', () => {
    // 旧実装ではこのケースで実績が予定を完全に覆っていた
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 1),
        actualEndDate: d(2025, 9, 30),
        today: d(2025, 10, 5),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('bg-blue-200')
    expect(html).toContain('bg-emerald-500')
  })
})

describe('PeriodBar — 実績バーが endDate を超過するケース (バグ再現)', () => {
  it('in-progress で today > endDate: 実績バー width が予定バー width より大きい', () => {
    // 旧実装では wrapper の overflow-hidden で実績が endDate で頭打ち
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 6, 30), // 約 4 ヶ月
        actualStartDate: d(2025, 3, 1),
        today: d(2025, 9, 1), // endDate より 2 ヶ月超過、約 6 ヶ月
        projectStart,
        projectEnd,
      }),
    )
    const planWidth = extractWidthPct(html, 'bg-blue-200')
    const actualWidth = extractWidthPct(html, 'bg-emerald-500')
    expect(planWidth).toBeGreaterThan(0)
    expect(actualWidth).toBeGreaterThan(planWidth) // 実績の方が長い
  })

  it('in-progress で today > projectEnd: 実績バーは projectEnd で頭打ち (両端クランプ)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 10),
        today: d(2026, 2, 1), // > projectEnd
        projectStart,
        projectEnd,
      }),
    )
    const actualWidth = extractWidthPct(html, 'bg-emerald-500')
    expect(actualWidth).toBeGreaterThan(0)
    expect(actualWidth).toBeLessThanOrEqual(100)
  })
})

describe('PeriodBar — 先行着手 (actualStartDate < startDate) (バグ再現)', () => {
  it('実績バーの left が予定バーの left より小さい', () => {
    // 旧実装では wrapper の overflow-hidden で実績左側が見えなかった
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 4, 1),
        endDate: d(2025, 8, 31),
        actualStartDate: d(2025, 3, 1), // 1 ヶ月先行
        actualEndDate: d(2025, 8, 20),
        today: d(2025, 9, 1),
        projectStart,
        projectEnd,
      }),
    )
    const planLeft = extractLeftPct(html, 'bg-blue-200')
    const actualLeft = extractLeftPct(html, 'bg-emerald-500')
    expect(planLeft).toBeGreaterThan(0)
    expect(actualLeft).toBeLessThan(planLeft)
  })
})

describe('PeriodBar — 進捗塗りつぶしなし (v4.0 仕様)', () => {
  it('進捗% に関連するスタイルを持たない', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 10),
        today: d(2025, 6, 1),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).not.toContain('bg-blue-500')
  })
})

describe('PeriodBar — ツールチップ', () => {
  it('予定バーに title 属性 (spec 4.4 フォーマット: 予定：MM/DD → MM/DD（N日）)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        today: d(2025, 5, 15),
        projectStart,
        projectEnd,
      }),
    )
    // 全角コロン + 全角括弧
    expect(html).toContain('予定：')
    expect(html).toMatch(/\d+\/\d+/)
    expect(html).toMatch(/（\d+日）/)
  })

  it('実績バー (completed) に title 属性 (実績：MM/DD → MM/DD（N日）)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 10),
        actualEndDate: d(2025, 8, 20),
        today: d(2025, 9, 1),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('実績：')
    expect(html).toMatch(/実績：\d+\/\d+\s*→\s*\d+\/\d+（\d+日）/)
  })

  it('実績バー (in-progress) に title 属性 (実績：MM/DD →（N日経過）)', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 3, 1),
        endDate: d(2025, 9, 30),
        actualStartDate: d(2025, 3, 10),
        today: d(2025, 6, 1),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('実績：')
    expect(html).toMatch(/→（\d+日経過）/)
  })
})

describe('PeriodBar — degenerate inputs', () => {
  it('同日タスク (startDate === endDate): 予定バーは描画され minWidth 確保', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: d(2025, 6, 15),
        endDate: d(2025, 6, 15),
        today: d(2025, 6, 1),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('bg-blue-200')
    expect(html).toMatch(/min-width:\s*3px/)
  })

  it('invalid Date は fmtDate で "?/?" にフォールバックして crash しない', () => {
    const html = renderToStaticMarkup(
      React.createElement(PeriodBar, {
        startDate: new Date('invalid'),
        endDate: d(2025, 9, 30),
        today: d(2025, 5, 15),
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('?/?')
  })
})
