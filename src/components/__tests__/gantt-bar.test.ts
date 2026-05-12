import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ProgressStatus } from '@/types/progress'
import {
  fillColors,
  clampPct,
  shouldShowScheduledMarker,
  GanttBar,
} from '@/components/gantt/gantt-bar'

describe('GanttBar 描画ロジック', () => {
  describe('fillColors', () => {
    const allStatuses: ProgressStatus[] = [
      'completed',
      'on-track',
      'delayed',
      'warning',
      'scheduled',
    ]

    it('全5ステータスに色が定義されている', () => {
      for (const status of allStatuses) {
        expect(fillColors[status]).toBeDefined()
      }
    })

    it('各ステータスの色がユニーク', () => {
      const colors = allStatuses.map((s) => fillColors[s])
      const uniqueColors = new Set(colors)
      expect(uniqueColors.size).toBe(allStatuses.length)
    })

    it('completed は濃い緑', () => {
      expect(fillColors['completed']).toBe('#15803d')
    })

    it('on-track は明るい緑', () => {
      expect(fillColors['on-track']).toBe('#4ade80')
    })

    it('delayed は黄色', () => {
      expect(fillColors['delayed']).toBe('#facc15')
    })

    it('warning は赤', () => {
      expect(fillColors['warning']).toBe('#f87171')
    })

    it('scheduled は灰色', () => {
      expect(fillColors['scheduled']).toBe('#d1d5db')
    })

    it('全色が16進数カラーコード形式', () => {
      for (const status of allStatuses) {
        expect(fillColors[status]).toMatch(/^#[0-9a-f]{6}$/i)
      }
    })
  })

  describe('shouldShowScheduledMarker', () => {
    it('scheduledPct=0 はマーカー非表示', () => {
      expect(shouldShowScheduledMarker(0)).toBe(false)
    })

    it('scheduledPct=100 はマーカー非表示', () => {
      expect(shouldShowScheduledMarker(100)).toBe(false)
    })

    it('scheduledPct=50 はマーカー表示', () => {
      expect(shouldShowScheduledMarker(50)).toBe(true)
    })

    it('scheduledPct=1 はマーカー表示（境界値）', () => {
      expect(shouldShowScheduledMarker(1)).toBe(true)
    })

    it('scheduledPct=99 はマーカー表示（境界値）', () => {
      expect(shouldShowScheduledMarker(99)).toBe(true)
    })

    it('負の値はマーカー非表示', () => {
      expect(shouldShowScheduledMarker(-1)).toBe(false)
    })
  })

  describe('clampPct', () => {
    it('0〜100 の範囲内はそのまま', () => {
      expect(clampPct(0)).toBe(0)
      expect(clampPct(50)).toBe(50)
      expect(clampPct(100)).toBe(100)
    })

    it('0未満は0', () => {
      expect(clampPct(-1)).toBe(0)
      expect(clampPct(-100)).toBe(0)
    })

    it('100超は100', () => {
      expect(clampPct(101)).toBe(100)
      expect(clampPct(200)).toBe(100)
    })

    it('NaN は 0 にフォールバック', () => {
      expect(clampPct(NaN)).toBe(0)
    })

    it('Infinity は 0 にフォールバック', () => {
      expect(clampPct(Infinity)).toBe(0)
      expect(clampPct(-Infinity)).toBe(0)
    })
  })

  describe('バー幅の計算（clampPct 経由）', () => {
    it('actualPct=0 は 0% 幅（空バー）', () => {
      expect(clampPct(0)).toBe(0)
    })

    it('actualPct=50 は 50% 幅（半塗り）', () => {
      expect(clampPct(50)).toBe(50)
    })

    it('actualPct=100 は 100% 幅（完全塗り）', () => {
      expect(clampPct(100)).toBe(100)
    })

    it('actualPct=101 はクランプされ 100%', () => {
      expect(clampPct(101)).toBe(100)
    })

    it('actualPct=-1 はクランプされ 0%', () => {
      expect(clampPct(-1)).toBe(0)
    })
  })
})

describe('GanttBar コンポーネント', () => {
  it('SVG 要素をレンダリングする', () => {
    const html = renderToStaticMarkup(
      createElement(GanttBar, { actualPct: 50, scheduledPct: 70, status: 'on-track' }),
    )
    expect(html).toContain('<svg')
    expect(html).toContain('進捗バー')
  })

  it('scheduledPct が 0〜100 の中間のとき予定位置マーカーが含まれる', () => {
    const html = renderToStaticMarkup(
      createElement(GanttBar, { actualPct: 30, scheduledPct: 50, status: 'delayed' }),
    )
    expect(html).toContain('<line')
  })

  it('scheduledPct=0 のとき予定位置マーカーが含まれない', () => {
    const html = renderToStaticMarkup(
      createElement(GanttBar, { actualPct: 0, scheduledPct: 0, status: 'scheduled' }),
    )
    expect(html).not.toContain('<line')
  })

  it('scheduledPct=100 のとき予定位置マーカーが含まれない', () => {
    const html = renderToStaticMarkup(
      createElement(GanttBar, { actualPct: 100, scheduledPct: 100, status: 'completed' }),
    )
    expect(html).not.toContain('<line')
  })
})
