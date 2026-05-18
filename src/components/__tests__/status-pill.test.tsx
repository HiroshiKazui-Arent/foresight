import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusPill } from '@/components/status-pill'
import type { Status } from '@/lib/status'

describe('StatusPill — 4状態 v4.0', () => {
  it('completed → 緑 (bg-emerald-100 text-emerald-700)', () => {
    const html = renderToStaticMarkup(StatusPill({ status: 'completed' as Status }))
    expect(html).toContain('bg-emerald-100')
    expect(html).toContain('text-emerald-700')
    expect(html).toContain('完了')
  })

  it('in-progress → 青 (bg-blue-100 text-blue-700)', () => {
    const html = renderToStaticMarkup(StatusPill({ status: 'in-progress' as Status }))
    expect(html).toContain('bg-blue-100')
    expect(html).toContain('text-blue-700')
    expect(html).toContain('進行中')
  })

  it('delayed → 赤 (bg-red-100 text-red-700)', () => {
    const html = renderToStaticMarkup(StatusPill({ status: 'delayed' as Status }))
    expect(html).toContain('bg-red-100')
    expect(html).toContain('text-red-700')
    expect(html).toContain('遅延')
  })

  it('not-started → 灰 (bg-slate-100 text-slate-600)', () => {
    const html = renderToStaticMarkup(StatusPill({ status: 'not-started' as Status }))
    expect(html).toContain('bg-slate-100')
    expect(html).toContain('text-slate-600')
    expect(html).toContain('未着手')
  })

  it('各ステータスでレンダリングが空でない', () => {
    const statuses: Status[] = ['completed', 'in-progress', 'delayed', 'not-started']
    for (const status of statuses) {
      const html = renderToStaticMarkup(StatusPill({ status }))
      expect(html.length).toBeGreaterThan(0)
    }
  })
})
