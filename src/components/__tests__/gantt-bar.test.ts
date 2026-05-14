import { describe, it, expect } from 'vitest'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ProgressStatus } from '@/types/progress'
import { STATUS_COLORS, clampPct, GanttBar } from '@/components/gantt/gantt-bar'

// ---------------------------------------------------------------------------
// STATUS_COLORS (旧 fillColors から置き換え)
// ---------------------------------------------------------------------------
describe('STATUS_COLORS マッピング', () => {
  const allStatuses: ProgressStatus[] = ['completed', 'on-track', 'delayed', 'warning', 'scheduled']

  it('全5ステータスに Tailwind クラスが定義されている', () => {
    for (const status of allStatuses) {
      expect(STATUS_COLORS[status]).toBeDefined()
    }
  })

  it('各ステータスの色クラスがユニーク', () => {
    const colors = allStatuses.map((s) => STATUS_COLORS[s])
    const uniqueColors = new Set(colors)
    expect(uniqueColors.size).toBe(allStatuses.length)
  })

  it('completed は bg-green-500', () => {
    expect(STATUS_COLORS['completed']).toBe('bg-green-500')
  })

  it('on-track は bg-blue-500', () => {
    expect(STATUS_COLORS['on-track']).toBe('bg-blue-500')
  })

  it('delayed は bg-red-500', () => {
    expect(STATUS_COLORS['delayed']).toBe('bg-red-500')
  })

  it('warning は bg-amber-400', () => {
    expect(STATUS_COLORS['warning']).toBe('bg-amber-400')
  })

  it('scheduled は bg-gray-300', () => {
    expect(STATUS_COLORS['scheduled']).toBe('bg-gray-300')
  })

  it('全色が bg- プレフィックスを持つ Tailwind クラス形式', () => {
    for (const status of allStatuses) {
      expect(STATUS_COLORS[status]).toMatch(/^bg-/)
    }
  })
})

// ---------------------------------------------------------------------------
// clampPct (維持)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// バー幅計算 (clampPct 経由、維持)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// GanttBar コンポーネント (新シグネチャ)
// ---------------------------------------------------------------------------

const projectStart = new Date('2024-01-01')
const projectEnd = new Date('2024-12-31')
// rowStart/rowEnd: プロジェクト期間の前半
const rowStart = new Date('2024-01-01')
const rowEnd = new Date('2024-06-30')

function makeBar(overrides: Partial<ComponentProps<typeof GanttBar>> = {}) {
  return createElement(GanttBar, {
    projectStart,
    projectEnd,
    rowStart,
    rowEnd,
    actualPct: 50,
    scheduledPct: 70,
    status: 'on-track' as ProgressStatus,
    ...overrides,
  } as ComponentProps<typeof GanttBar>)
}

describe('GanttBar コンポーネント (新シグネチャ)', () => {
  it('div 要素をレンダリングする (SVG ではなく div ベース)', () => {
    const html = renderToStaticMarkup(makeBar())
    expect(html).toContain('<div')
  })

  it('aria-label に日本語ステータス名と実績%が含まれる', () => {
    const html = renderToStaticMarkup(makeBar({ status: 'on-track', actualPct: 50 }))
    expect(html).toContain('aria-label="進捗バー: 進行中 実績50%"')
  })

  it('aria-label は各ステータスで日本語名が含まれる', () => {
    const cases: [ProgressStatus, string][] = [
      ['completed', '完了'],
      ['on-track', '進行中'],
      ['delayed', '遅延'],
      ['warning', '警告'],
      ['scheduled', '予定'],
    ]
    for (const [status, label] of cases) {
      const html = renderToStaticMarkup(makeBar({ status }))
      expect(html).toContain(label)
    }
  })

  it('role="img" が付与される', () => {
    const html = renderToStaticMarkup(makeBar())
    expect(html).toContain('role="img"')
  })

  it('position:absolute スタイルが付与される', () => {
    const html = renderToStaticMarkup(makeBar())
    expect(html).toContain('position:absolute')
  })

  // --- 3層塗り: 実績エリア ---
  it('実績エリア (actualPct > 0) が存在する', () => {
    const html = renderToStaticMarkup(
      makeBar({ actualPct: 50, scheduledPct: 70, status: 'on-track' }),
    )
    // 実績エリアは width 0% より大きい div として存在する
    expect(html).toContain('width:50%')
  })

  // --- 3層塗り: 遅延ギャップ (ハッチング) ---
  it('遅延: actualPct < scheduledPct のときハッチングエリアが存在する (SVG fill)', () => {
    const html = renderToStaticMarkup(
      makeBar({ actualPct: 30, scheduledPct: 60, status: 'delayed' }),
    )
    // SVG <rect fill="url(#hatch-...-delayed)"> として描画される (useId で一意な id)
    expect(html).toMatch(/url\(#hatch-[^)]*delayed[^)]*\)/)
  })

  it('遅延ギャップ幅は scheduledPct - actualPct に等しい', () => {
    const html = renderToStaticMarkup(
      makeBar({ actualPct: 20, scheduledPct: 50, status: 'warning' }),
    )
    // width: 30% (= 50 - 20)
    expect(html).toContain('width:30%')
  })

  // --- 3層塗り: 前倒し (actualPct >= scheduledPct) → ハッチング幅 0 ---
  it('前倒し: actualPct > scheduledPct のときハッチングは存在しない', () => {
    const html = renderToStaticMarkup(
      makeBar({ actualPct: 80, scheduledPct: 60, status: 'on-track' }),
    )
    expect(html).not.toContain('url(#hatch')
  })

  it('ちょうど: actualPct === scheduledPct のときハッチングは存在しない', () => {
    const html = renderToStaticMarkup(
      makeBar({ actualPct: 50, scheduledPct: 50, status: 'on-track' }),
    )
    expect(html).not.toContain('url(#hatch')
  })

  // --- 完了ステータス ---
  it('完了 (status=completed): ハッチングなし', () => {
    const html = renderToStaticMarkup(
      makeBar({ actualPct: 60, scheduledPct: 80, status: 'completed' }),
    )
    expect(html).not.toContain('url(#hatch')
  })

  it('完了 (status=completed): 実績が 100% 幅で塗りつぶされ、未来予定エリアなし', () => {
    const html = renderToStaticMarkup(
      makeBar({ actualPct: 60, scheduledPct: 80, status: 'completed' }),
    )
    // 完了色が付いていて未来予定 (bg-gray-100) は存在しない
    expect(html).toContain('bg-green-500')
    expect(html).not.toContain('bg-gray-100')
    expect(html).toContain('width:100%')
  })

  // --- 未来予定エリア (薄い灰色) ---
  it('scheduledPct < 100 のとき未来予定エリアが存在する (bg-gray-100)', () => {
    const html = renderToStaticMarkup(
      makeBar({ actualPct: 30, scheduledPct: 60, status: 'on-track' }),
    )
    expect(html).toContain('bg-gray-100')
  })

  // --- barOffsetWidth によるバー位置 ---
  it('rowStart = projectStart のとき left は 0%', () => {
    const html = renderToStaticMarkup(
      makeBar({
        projectStart: new Date('2024-01-01'),
        projectEnd: new Date('2024-12-31'),
        rowStart: new Date('2024-01-01'),
        rowEnd: new Date('2024-06-30'),
      }),
    )
    expect(html).toContain('left:0%')
  })

  it('rowStart がプロジェクト開始前の場合 left は 0% にクランプされる', () => {
    const html = renderToStaticMarkup(
      makeBar({
        projectStart: new Date('2024-03-01'),
        projectEnd: new Date('2024-12-31'),
        rowStart: new Date('2024-01-01'), // プロジェクト開始前
        rowEnd: new Date('2024-06-30'),
      }),
    )
    expect(html).toContain('left:0%')
  })

  it('rowEnd がプロジェクト終了後の場合 width はクランプされる', () => {
    const html = renderToStaticMarkup(
      makeBar({
        projectStart: new Date('2024-01-01'),
        projectEnd: new Date('2024-06-30'),
        rowStart: new Date('2024-01-01'),
        rowEnd: new Date('2024-12-31'), // プロジェクト終了後
      }),
    )
    // width は 100% (クランプ後)
    // left=0%, right=100%, width=100%
    // 外側 wrapper の width が 100% になる
    expect(html).toMatch(/width:100%/)
  })
})
