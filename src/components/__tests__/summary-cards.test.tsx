import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SummaryCards } from '@/components/summary-cards'
import type { ProjectSummary, DelaySummary } from '@/lib/summary'

const baseSummary: ProjectSummary = { scheduledPct: 50, actualPct: 45 }
const baseDelay: DelaySummary = { delayedCount: 3, maxDelayDays: 7, notStartedRiskCount: 1 }

describe('SummaryCards — 全体進捗カード', () => {
  it('予定% を表示する', () => {
    const html = renderToStaticMarkup(
      SummaryCards({ projectSummary: baseSummary, delaySummary: baseDelay }),
    )
    expect(html).toContain('予定')
    expect(html).toContain('50')
  })

  it('実績% を表示する', () => {
    const html = renderToStaticMarkup(
      SummaryCards({ projectSummary: baseSummary, delaySummary: baseDelay }),
    )
    expect(html).toContain('実績')
    expect(html).toContain('45')
  })

  it('actualPct >= scheduledPct → 実績値が緑系クラスを持つ', () => {
    const summary: ProjectSummary = { scheduledPct: 40, actualPct: 50 }
    const html = renderToStaticMarkup(
      SummaryCards({ projectSummary: summary, delaySummary: baseDelay }),
    )
    // 緑系 (emerald または green)
    expect(html).toMatch(/text-emerald|text-green/)
  })

  it('actualPct < scheduledPct → 実績値が赤系クラスを持つ', () => {
    const summary: ProjectSummary = { scheduledPct: 60, actualPct: 40 }
    const html = renderToStaticMarkup(
      SummaryCards({ projectSummary: summary, delaySummary: baseDelay }),
    )
    expect(html).toMatch(/text-red/)
  })

  it('actualPct === scheduledPct (境界) → 緑系', () => {
    const summary: ProjectSummary = { scheduledPct: 50, actualPct: 50 }
    const html = renderToStaticMarkup(
      SummaryCards({ projectSummary: summary, delaySummary: baseDelay }),
    )
    expect(html).toMatch(/text-emerald|text-green/)
  })
})

describe('SummaryCards — 遅延サマリーカード', () => {
  it('遅延中 N件 を表示する', () => {
    const html = renderToStaticMarkup(
      SummaryCards({ projectSummary: baseSummary, delaySummary: baseDelay }),
    )
    expect(html).toContain('遅延中')
    expect(html).toContain('3')
  })

  it('最大遅れ N日 を表示する', () => {
    const html = renderToStaticMarkup(
      SummaryCards({ projectSummary: baseSummary, delaySummary: baseDelay }),
    )
    expect(html).toContain('7')
    expect(html).toContain('日')
  })

  it('未着手リスク N件 を表示する', () => {
    const html = renderToStaticMarkup(
      SummaryCards({ projectSummary: baseSummary, delaySummary: baseDelay }),
    )
    expect(html).toContain('未着手リスク')
    expect(html).toContain('1')
  })

  it('遅延 0件の場合も描画する', () => {
    const zeroDelay: DelaySummary = { delayedCount: 0, maxDelayDays: 0, notStartedRiskCount: 0 }
    const html = renderToStaticMarkup(
      SummaryCards({ projectSummary: baseSummary, delaySummary: zeroDelay }),
    )
    expect(html).toContain('0')
  })
})
