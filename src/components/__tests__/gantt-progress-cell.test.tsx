import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GanttProgressCell } from '@/components/gantt/gantt-progress-cell'

describe('GanttProgressCell — 2 行表示', () => {
  it('予定% と 実績% を表示する', () => {
    const html = renderToStaticMarkup(GanttProgressCell({ scheduledPct: 50, actualPct: 30 }))
    expect(html).toContain('予定')
    expect(html).toContain('50%')
    expect(html).toContain('実績')
    expect(html).toContain('30%')
  })

  it('actualPct < scheduledPct → 赤系クラス', () => {
    const html = renderToStaticMarkup(GanttProgressCell({ scheduledPct: 60, actualPct: 40 }))
    expect(html).toMatch(/text-red/)
  })

  it('actualPct >= scheduledPct → 緑系クラス', () => {
    const html = renderToStaticMarkup(GanttProgressCell({ scheduledPct: 30, actualPct: 50 }))
    expect(html).toMatch(/text-emerald|text-green/)
  })

  it('actualPct === scheduledPct (境界) → 緑系', () => {
    const html = renderToStaticMarkup(GanttProgressCell({ scheduledPct: 50, actualPct: 50 }))
    expect(html).toMatch(/text-emerald|text-green/)
  })

  it('小数点は四捨五入する (33.4 → 33)', () => {
    const html = renderToStaticMarkup(GanttProgressCell({ scheduledPct: 33.4, actualPct: 33.6 }))
    expect(html).toContain('33%')
    expect(html).toContain('34%')
  })

  it('NaN 入力は 0% にフォールバック (NaN% 表示防止)', () => {
    const html = renderToStaticMarkup(GanttProgressCell({ scheduledPct: NaN, actualPct: NaN }))
    expect(html).not.toContain('NaN')
    expect(html).toContain('0%')
  })
})
