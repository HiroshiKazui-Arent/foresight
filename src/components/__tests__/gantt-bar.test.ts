import { describe, it, expect } from 'vitest'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ProgressStatus, RenderStatus } from '@/types/progress'
import { STATUS_COLORS, clampPct, GanttBar } from '@/components/gantt/gantt-bar'
import { barOffsetWidth } from '@/components/gantt/timeline-utils'

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
    today: new Date('2024-04-01'),
    actualPct: 50,
    scheduledPct: 70,
    status: 'on-track' as ProgressStatus,
    ...overrides,
  } as ComponentProps<typeof GanttBar>)
}

function makeBarLegacy(overrides: Partial<ComponentProps<typeof GanttBar>> = {}) {
  return createElement(GanttBar, {
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
    // scheduledPct=40 で todayInBar (≈50.27%) と十分離れドリフト調整を回避する。
    // hatchEnd = min(40, 50.27) = 40、gap = 40 - 10 = 30。
    const html = renderToStaticMarkup(
      makeBar({ actualPct: 10, scheduledPct: 40, status: 'warning' }),
    )
    // width: 30% (= 40 - 10)
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

// ---------------------------------------------------------------------------
// overdue 描画: status 色のハッチで未消化分を表現する (Layer 3 廃止)
// — 「全部が赤いバー」は仕様に反するため、bg-red-700 一律塗りつぶしは廃止。
//   status が warning ならアンバーのハッチ、delayed なら赤のハッチで残部を描画。
// ---------------------------------------------------------------------------
describe('GanttBar overdue 描画 (status 色ハッチ)', () => {
  it('today > rowEnd && actualPct=60 && status=delayed: 赤ハッチ (#ef4444) がバー残部を埋める', () => {
    const html = renderToStaticMarkup(
      makeBar({
        actualPct: 60,
        scheduledPct: 100,
        status: 'delayed',
        rowStart: new Date('2024-01-01'),
        rowEnd: new Date('2024-03-31'),
        today: new Date('2024-04-15'), // rowEnd より後
      }),
    )
    expect(html).not.toContain('bg-red-700')
    expect(html).toMatch(/url\(#hatch[^)]*\)/)
    expect(html).toContain('#ef4444') // delayed の hatch stroke
    expect(html).not.toContain('bg-gray-100')
    expect(html).toContain('(期日超過)')
  })

  it('today > rowEnd && actualPct=60 && status=warning: アンバーハッチ (#f59e0b) で残部を埋める (全赤化しない)', () => {
    const html = renderToStaticMarkup(
      makeBar({
        actualPct: 60,
        scheduledPct: 100,
        status: 'warning',
        rowStart: new Date('2024-01-01'),
        rowEnd: new Date('2024-03-31'),
        today: new Date('2024-04-15'),
      }),
    )
    expect(html).not.toContain('bg-red-700')
    expect(html).toMatch(/url\(#hatch[^)]*\)/)
    expect(html).toContain('#f59e0b') // warning の hatch stroke (赤ではなくアンバー)
    expect(html).not.toContain('bg-gray-100')
    expect(html).toContain('(期日超過)')
  })

  it('today > rowEnd && actualPct=100: cActual=100 で overdue 不成立、ハッチも未来灰もなし', () => {
    const html = renderToStaticMarkup(
      makeBar({
        actualPct: 100,
        scheduledPct: 100,
        status: 'on-track',
        rowStart: new Date('2024-01-01'),
        rowEnd: new Date('2024-03-31'),
        today: new Date('2024-04-15'),
      }),
    )
    expect(html).not.toContain('bg-red-700')
    expect(html).not.toContain('(期日超過)')
  })

  it('today > rowEnd && status=completed: bg-green-500 が全幅 (overdue 評価なし)', () => {
    const html = renderToStaticMarkup(
      makeBar({
        actualPct: 60,
        scheduledPct: 100,
        status: 'completed',
        rowStart: new Date('2024-01-01'),
        rowEnd: new Date('2024-03-31'),
        today: new Date('2024-04-15'),
      }),
    )
    expect(html).not.toContain('bg-red-700')
    expect(html).toContain('bg-green-500')
    expect(html).toContain('width:100%')
    expect(html).not.toContain('(期日超過)')
  })

  it('today === rowEnd && actualPct=80 && status=delayed: 境界値、overdue 不成立で斜線残る', () => {
    const html = renderToStaticMarkup(
      makeBar({
        actualPct: 80,
        scheduledPct: 100,
        status: 'delayed',
        rowStart: new Date('2024-01-01'),
        rowEnd: new Date('2024-03-31'),
        today: new Date('2024-03-31'), // rowEnd と同一
      }),
    )
    expect(html).not.toContain('bg-red-700')
    expect(html).toMatch(/url\(#hatch[^)]*\)/)
    expect(html).not.toContain('(期日超過)')
  })

  it('today === rowStart && actualPct=0: 斜線なし、bg-gray-100 が全幅', () => {
    const html = renderToStaticMarkup(
      makeBar({
        actualPct: 0,
        scheduledPct: 0,
        status: 'scheduled',
        rowStart: new Date('2024-04-01'),
        rowEnd: new Date('2024-06-30'),
        today: new Date('2024-04-01'), // rowStart と同一
      }),
    )
    expect(html).not.toMatch(/url\(#hatch[^)]*\)/)
    expect(html).toContain('bg-gray-100')
    expect(html).not.toContain('bg-red-700')
  })

  it('ドリフトケース: scheduledPct=80, todayInBar≈49%、overdue 不成立 → 斜線存在、Layer 3 なし', () => {
    const html = renderToStaticMarkup(
      makeBar({
        actualPct: 30,
        scheduledPct: 80,
        status: 'delayed',
        rowStart: new Date('2024-01-01'),
        rowEnd: new Date('2024-06-30'),
        today: new Date('2024-04-01'), // 中央付近 (≈49%)
      }),
    )
    expect(html).toMatch(/url\(#hatch[^)]*\)/)
    expect(html).not.toContain('bg-red-700')
  })

  it('Legacy variant (today なし): 既存挙動を維持、bg-red-700 含まない', () => {
    const html = renderToStaticMarkup(
      makeBarLegacy({ actualPct: 30, scheduledPct: 60, status: 'delayed' }),
    )
    expect(html).not.toContain('bg-red-700')
    expect(html).not.toContain('(期日超過)')
    // 既存挙動: 斜線と灰がある
    expect(html).toMatch(/url\(#hatch[^)]*\)/)
    expect(html).toContain('bg-gray-100')
  })
})

// ---------------------------------------------------------------------------
// GanttBar RenderStatus-driven 5状態描画
// ---------------------------------------------------------------------------
describe('GanttBar RenderStatus-driven 5状態描画', () => {
  const pStart = new Date('2024-01-01')
  const pEnd = new Date('2024-12-31')
  const rStart = new Date('2024-01-01')
  const rEnd = new Date('2024-06-30')

  function makeRS(overrides: Partial<ComponentProps<typeof GanttBar>> = {}) {
    return createElement(GanttBar, {
      projectStart: pStart,
      projectEnd: pEnd,
      rowStart: rStart,
      rowEnd: rEnd,
      today: new Date('2024-04-01'),
      actualPct: 50,
      scheduledPct: 70,
      renderStatus: 'delayed-pre-deadline' as RenderStatus,
      ...overrides,
    } as ComponentProps<typeof GanttBar>)
  }

  // State 0: scheduled
  it('scheduled: bg-gray-100 全幅、fill-amber-400 なし', () => {
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'scheduled',
        today: new Date('2023-12-01'), // rowStart より前
      }),
    )
    expect(html).toContain('bg-gray-100')
    expect(html).not.toContain('fill-amber-400')
    expect(html).not.toContain('fill-red-500')
  })

  // State 1: completed
  it('completed: bg-green-500 全幅、hatch なし', () => {
    const html = renderToStaticMarkup(makeRS({ renderStatus: 'completed', actualPct: 100 }))
    expect(html).toContain('bg-green-500')
    expect(html).not.toContain('url(#hatch')
    expect(html).not.toContain('fill-red-500')
  })

  // State 2: delayed-pre-deadline
  it('delayed-pre-deadline: amber solid + orange hatch + gray future', () => {
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'delayed-pre-deadline',
        actualPct: 30,
        scheduledPct: 60,
        today: new Date('2024-04-01'),
      }),
    )
    expect(html).toContain('fill-amber-400')
    expect(html).toContain('#f59e0b')
    expect(html).toContain('fill-gray-100')
    expect(html).not.toContain('fill-red-500')
  })

  it('delayed-pre-deadline: actualPct >= scheduledPct → hatch なし', () => {
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'delayed-pre-deadline',
        actualPct: 70,
        scheduledPct: 50,
      }),
    )
    expect(html).not.toContain('url(#hatch')
  })

  // State 3: overdue-past-deadline
  it('overdue-past-deadline: amber solid + orange hatch + red section + 縦マーカー', () => {
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'overdue-past-deadline',
        actualPct: 60,
        scheduledPct: 100,
        rowStart: new Date('2024-01-01'),
        rowEnd: new Date('2024-03-31'),
        today: new Date('2024-04-15'),
      }),
    )
    expect(html).toContain('fill-amber-400')
    expect(html).toContain('#f59e0b')
    expect(html).toContain('fill-red-500')
    expect(html).toContain('planned-end-marker')
    expect(html).not.toContain('fill-gray-100')
    expect(html).toContain('(期日超過)')
  })

  it('overdue-past-deadline: wrapper が rowEnd より wide (today まで延伸)', () => {
    const pS = new Date('2024-01-01')
    const pE = new Date('2024-12-31')
    const rS = new Date('2024-01-01')
    const rE = new Date('2024-03-31')
    const tod = new Date('2024-04-15')
    const normalWidth = barOffsetWidth(rS, rE, pS, pE).width
    const extendedWidth = barOffsetWidth(rS, tod, pS, pE).width
    const html = renderToStaticMarkup(
      createElement(GanttBar, {
        projectStart: pS,
        projectEnd: pE,
        rowStart: rS,
        rowEnd: rE,
        today: tod,
        actualPct: 60,
        scheduledPct: 100,
        renderStatus: 'overdue-past-deadline' as RenderStatus,
      } as ComponentProps<typeof GanttBar>),
    )
    expect(html).toContain(`width:${extendedWidth}%`)
    expect(extendedWidth).toBeGreaterThan(normalWidth)
  })

  // State 4: not-started-overdue
  it('not-started-overdue: red hatch + red solid + 縦マーカー、amber なし', () => {
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'not-started-overdue',
        actualPct: 0,
        rowStart: new Date('2024-01-01'),
        rowEnd: new Date('2024-03-31'),
        today: new Date('2024-04-15'),
      }),
    )
    expect(html).toContain('#ef4444') // red hatch stroke
    expect(html).toContain('fill-red-500')
    expect(html).toContain('planned-end-marker')
    expect(html).not.toContain('fill-amber-400')
    expect(html).toContain('(期日超過)')
  })

  it('not-started-overdue: wrapper が rowEnd より wide (today まで延伸)', () => {
    const pS = new Date('2024-01-01')
    const pE = new Date('2024-12-31')
    const rS = new Date('2024-01-01')
    const rE = new Date('2024-03-31')
    const tod = new Date('2024-04-15')
    const normalWidth = barOffsetWidth(rS, rE, pS, pE).width
    const extendedWidth = barOffsetWidth(rS, tod, pS, pE).width
    const html = renderToStaticMarkup(
      createElement(GanttBar, {
        projectStart: pS,
        projectEnd: pE,
        rowStart: rS,
        rowEnd: rE,
        today: tod,
        actualPct: 0,
        scheduledPct: 0,
        renderStatus: 'not-started-overdue' as RenderStatus,
      } as ComponentProps<typeof GanttBar>),
    )
    expect(html).toContain(`width:${extendedWidth}%`)
    expect(extendedWidth).toBeGreaterThan(normalWidth)
  })

  // State 4: not-started-overdue かつ today <= rowEnd (期日前だが未着手)
  it('not-started-overdue + today <= rowEnd: バーが today まで短縮、赤 solid なし、(期日超過) なし', () => {
    const pS = new Date('2024-01-01')
    const pE = new Date('2024-12-31')
    const rS = new Date('2024-01-01')
    const rE = new Date('2024-06-30')
    const tod = new Date('2024-02-01') // rowEnd より前
    const barWidthToday = barOffsetWidth(rS, tod, pS, pE).width
    const barWidthRowEnd = barOffsetWidth(rS, rE, pS, pE).width
    const html = renderToStaticMarkup(
      createElement(GanttBar, {
        projectStart: pS,
        projectEnd: pE,
        rowStart: rS,
        rowEnd: rE,
        today: tod,
        actualPct: 0,
        scheduledPct: 0,
        renderStatus: 'not-started-overdue' as RenderStatus,
      } as ComponentProps<typeof GanttBar>),
    )
    // バーは today まで延伸 (rowEnd より短い)
    expect(html).toContain(`width:${barWidthToday}%`)
    expect(barWidthToday).toBeLessThan(barWidthRowEnd)
    // red solid なし (plannedEndX=100 → 100-100=0)
    expect(html).not.toContain('fill-red-500')
    // aria-label に「期日超過」なし (today <= rowEnd)
    expect(html).not.toContain('(期日超過)')
    // 赤ハッチは存在する
    expect(html).toContain('#ef4444')
  })

  // State 5: ahead-of-schedule
  it('ahead-of-schedule, actualPct=80: bg-green-500 含む', () => {
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'ahead-of-schedule' as RenderStatus,
        actualPct: 80,
        scheduledPct: 50,
      }),
    )
    expect(html).toContain('bg-green-500')
  })

  it('ahead-of-schedule, actualPct=80: bg-gray-100 含む (残り 20% 灰)', () => {
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'ahead-of-schedule' as RenderStatus,
        actualPct: 80,
        scheduledPct: 50,
      }),
    )
    expect(html).toContain('bg-gray-100')
  })

  it('ahead-of-schedule: url(#hatch を含まない (SVG ハッチなし)', () => {
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'ahead-of-schedule' as RenderStatus,
        actualPct: 80,
        scheduledPct: 50,
      }),
    )
    expect(html).not.toContain('url(#hatch')
  })

  it('ahead-of-schedule: fill-red-500 を含まない (赤延伸なし)', () => {
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'ahead-of-schedule' as RenderStatus,
        actualPct: 80,
        scheduledPct: 50,
      }),
    )
    expect(html).not.toContain('fill-red-500')
  })

  it('ahead-of-schedule, actualPct=100 のとき gray div は出ない (aheadX=100)', () => {
    // aheadX=100 なので bg-gray-100 の div は条件 (aheadX < 100) により出ない
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'ahead-of-schedule' as RenderStatus,
        actualPct: 100,
        scheduledPct: 50,
      }),
    )
    // bg-green-500 はある
    expect(html).toContain('bg-green-500')
    // bg-gray-100 はない (全幅緑)
    expect(html).not.toContain('bg-gray-100')
  })

  it('ahead-of-schedule: wrapper が rowStart〜rowEnd で配置 (延伸なし)', () => {
    const pS = new Date('2024-01-01')
    const pE = new Date('2024-12-31')
    const rS = new Date('2024-01-01')
    const rE = new Date('2024-06-30')
    const tod = new Date('2024-04-01')
    const { width: normalWidth } = barOffsetWidth(rS, rE, pS, pE)
    const html = renderToStaticMarkup(
      createElement(GanttBar, {
        projectStart: pS,
        projectEnd: pE,
        rowStart: rS,
        rowEnd: rE,
        today: tod,
        actualPct: 80,
        scheduledPct: 50,
        renderStatus: 'ahead-of-schedule' as RenderStatus,
      } as ComponentProps<typeof GanttBar>),
    )
    expect(html).toContain(`width:${normalWidth}%`)
  })

  it('ahead-of-schedule: aria-label に「先行」を含む', () => {
    const html = renderToStaticMarkup(
      makeRS({
        renderStatus: 'ahead-of-schedule' as RenderStatus,
        actualPct: 80,
        scheduledPct: 50,
      }),
    )
    expect(html).toContain('先行')
  })

  // aria-label
  it('aria-label に RenderStatus 対応ラベルが含まれる', () => {
    const cases: [RenderStatus, string][] = [
      ['scheduled', '予定'],
      ['completed', '完了'],
      ['delayed-pre-deadline', '遅延'],
      ['overdue-past-deadline', '超過'],
      ['not-started-overdue', '未着'],
      ['ahead-of-schedule', '先行'],
    ]
    for (const [rs, label] of cases) {
      const html = renderToStaticMarkup(makeRS({ renderStatus: rs }))
      expect(html).toContain(label)
    }
  })

  // Legacy backward compat
  it('legacy (renderStatus なし、status あり) 既存挙動を維持', () => {
    const html = renderToStaticMarkup(
      createElement(GanttBar, {
        actualPct: 50,
        scheduledPct: 70,
        status: 'on-track' as ProgressStatus,
        projectStart: pStart,
        projectEnd: pEnd,
        rowStart: rStart,
        rowEnd: rEnd,
        today: new Date('2024-04-01'),
      } as ComponentProps<typeof GanttBar>),
    )
    expect(html).toContain('進行中')
    expect(html).not.toContain('fill-amber-400') // old rendering uses bg-xxx not fill-xxx
    expect(html).toContain('bg-blue-500') // old on-track color
  })
})
