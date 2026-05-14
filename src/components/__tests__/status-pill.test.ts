import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusPill } from '@/components/status-pill'
import type { RenderStatus } from '@/types/progress'

const allRenderStatuses: RenderStatus[] = [
  'scheduled',
  'completed',
  'ahead-of-schedule',
  'delayed-pre-deadline',
  'overdue-past-deadline',
  'not-started-overdue',
]

// ─── RenderStatus 5状態 ──────────────────────────────────────────────────────

describe('StatusPill: RenderStatus 5状態', () => {
  it('scheduled → 「予定」灰', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, { renderStatus: 'scheduled' as RenderStatus }),
    )
    expect(html).toContain('予定')
    expect(html).toMatch(/bg-gray/)
  })

  it('completed → 「完了」緑', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, { renderStatus: 'completed' as RenderStatus }),
    )
    expect(html).toContain('完了')
    expect(html).toMatch(/bg-green/)
  })

  it('delayed-pre-deadline → 「遅延」オレンジ(amber)', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, { renderStatus: 'delayed-pre-deadline' as RenderStatus }),
    )
    expect(html).toContain('遅延')
    expect(html).toMatch(/amber|orange/)
  })

  it('overdue-past-deadline → 「超過」赤', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, { renderStatus: 'overdue-past-deadline' as RenderStatus }),
    )
    expect(html).toContain('超過')
    expect(html).toMatch(/red/)
  })

  it('not-started-overdue → 「未着」赤', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, { renderStatus: 'not-started-overdue' as RenderStatus }),
    )
    expect(html).toContain('未着')
    expect(html).toMatch(/red/)
  })

  it('「未着」ラベルは 3 文字以内 (60px カラム制約)', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, { renderStatus: 'not-started-overdue' as RenderStatus }),
    )
    const match = html.match(/>([^<]+)<\/span>/)
    const label = match?.[1] ?? ''
    expect(label.length).toBeLessThanOrEqual(3)
  })

  it('ahead-of-schedule → 「先行」緑淡色 (bg-green-100)', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, { renderStatus: 'ahead-of-schedule' as RenderStatus }),
    )
    expect(html).toContain('先行')
    expect(html).toContain('bg-green-100')
  })

  it('ahead-of-schedule → text-green-800 クラスを含む', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, { renderStatus: 'ahead-of-schedule' as RenderStatus }),
    )
    expect(html).toContain('text-green-800')
  })

  it('「先行」ラベルは 3 文字以内 (60px カラム制約)', () => {
    const html = renderToStaticMarkup(
      createElement(StatusPill, { renderStatus: 'ahead-of-schedule' as RenderStatus }),
    )
    const match = html.match(/>([^<]+)<\/span>/)
    const label = match?.[1] ?? ''
    expect(label.length).toBeLessThanOrEqual(3)
  })

  it('全 6 状態がエラーなくレンダリングできる', () => {
    for (const rs of allRenderStatuses) {
      expect(() =>
        renderToStaticMarkup(createElement(StatusPill, { renderStatus: rs })),
      ).not.toThrow()
    }
  })
})

// ─── 後方互換: ProgressStatus (旧 status prop) ───────────────────────────────

describe('StatusPill: 後方互換 (status prop)', () => {
  it('completed → 「完了」緑', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(createElement(StatusPill, { status: 'completed' } as any))
    expect(html).toContain('完了')
    expect(html).toMatch(/bg-green/)
  })

  it('scheduled → 「予定」灰', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(createElement(StatusPill, { status: 'scheduled' } as any))
    expect(html).toContain('予定')
    expect(html).toMatch(/bg-gray/)
  })

  it('on-track → 「進行中」薄緑', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(createElement(StatusPill, { status: 'on-track' } as any))
    expect(html).toContain('進行中')
  })

  it('delayed → 「遅延」', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(createElement(StatusPill, { status: 'delayed' } as any))
    expect(html).toContain('遅延')
  })

  it('warning → 「警告」', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html = renderToStaticMarkup(createElement(StatusPill, { status: 'warning' } as any))
    expect(html).toContain('警告')
  })
})
