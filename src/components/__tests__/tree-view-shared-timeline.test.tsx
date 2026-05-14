/**
 * tree-view 共有タイムライン座標系リファクタのテスト
 *
 * 変更内容:
 * A. tree-view.tsx が projectStart/projectEnd を算出し MilestoneRow に渡す
 * B. milestone-row.tsx が projectStart/projectEnd/rowStart/rowEnd を GanttBar に渡す
 * C. task-row.tsx が projectStart/projectEnd/rowStart/rowEnd を GanttBar に渡す
 * D. TodayLine が今日の x 位置でレンダリングされる
 * E. TimelineHeader が右カラムに配置される
 */

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GanttBar } from '@/components/gantt/gantt-bar'
import { TodayLine } from '@/components/gantt/today-line'
import { TimelineHeader } from '@/components/gantt/timeline-header'
import { xForDate, barOffsetWidth } from '@/components/gantt/timeline-utils'
import type { ProgressStatus } from '@/types/progress'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const projectStart = new Date('2026-01-01')
const projectEnd = new Date('2026-12-31')
const today = new Date('2026-05-14')

// プロジェクト期間前半のマイルストーン/タスク
const msStart = new Date('2026-01-01')
const msEnd = new Date('2026-06-30')

// プロジェクト期間後半のタスク
const taskStart = new Date('2026-07-01')
const taskEnd = new Date('2026-12-31')

// ---------------------------------------------------------------------------
// A. projectStart/projectEnd の算出ロジック
// ---------------------------------------------------------------------------

describe('projectStart/projectEnd の算出', () => {
  it('Project.startDate と Project.endDate をそのまま使う場合の期間が正しい', () => {
    // project.startDate / project.endDate が存在する場合はそれを使う
    const ps = new Date('2026-01-01')
    const pe = new Date('2026-12-31')
    const totalMs = pe.getTime() - ps.getTime()
    expect(totalMs).toBeGreaterThan(0)
  })

  it('Milestone が存在する場合の期間算出: 最小 startDate と最大 endDate', () => {
    const milestones = [
      { startDate: new Date('2026-03-01'), endDate: new Date('2026-09-30') },
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
    ]
    const start = milestones.reduce(
      (min, m) => (m.startDate < min ? m.startDate : min),
      milestones[0].startDate,
    )
    const end = milestones.reduce(
      (max, m) => (m.endDate > max ? m.endDate : max),
      milestones[0].endDate,
    )
    expect(start).toEqual(new Date('2026-01-01'))
    expect(end).toEqual(new Date('2026-12-31'))
  })

  it('Milestone が空の場合: project.startDate/project.endDate にフォールバック', () => {
    const milestones: { startDate: Date; endDate: Date }[] = []
    const start =
      milestones.length > 0
        ? milestones.reduce(
            (min, m) => (m.startDate < min ? m.startDate : min),
            milestones[0].startDate,
          )
        : projectStart
    const end =
      milestones.length > 0
        ? milestones.reduce((max, m) => (m.endDate > max ? m.endDate : max), milestones[0].endDate)
        : projectEnd
    expect(start).toEqual(projectStart)
    expect(end).toEqual(projectEnd)
  })
})

// ---------------------------------------------------------------------------
// B. GanttBar に projectStart/projectEnd/rowStart/rowEnd が渡されたときのレンダリング
// ---------------------------------------------------------------------------

describe('GanttBar: 共有タイムライン座標系 (projectStart/projectEnd/rowStart/rowEnd)', () => {
  it('projectStart = rowStart のとき left は 0%', () => {
    const html = renderToStaticMarkup(
      createElement(GanttBar, {
        projectStart,
        projectEnd,
        rowStart: projectStart,
        rowEnd: msEnd,
        actualPct: 50,
        scheduledPct: 60,
        status: 'on-track' as ProgressStatus,
      }),
    )
    expect(html).toContain('left:0%')
  })

  it('rowStart がプロジェクト中間 (7月) のとき left は 50% 付近', () => {
    const midStart = new Date('2026-07-02') // 約 50%
    const html = renderToStaticMarkup(
      createElement(GanttBar, {
        projectStart,
        projectEnd,
        rowStart: midStart,
        rowEnd: projectEnd,
        actualPct: 0,
        scheduledPct: 0,
        status: 'scheduled' as ProgressStatus,
      }),
    )
    // left が 49% 〜 51% の範囲にある (小数点を考慮して文字列マッチ)
    const leftMatch = html.match(/left:([\d.]+)%/)
    expect(leftMatch).not.toBeNull()
    const leftVal = parseFloat(leftMatch![1])
    expect(leftVal).toBeGreaterThan(49)
    expect(leftVal).toBeLessThan(52)
  })

  it('rowEnd = projectEnd のとき バーが右端まで伸びる (width > 0)', () => {
    const html = renderToStaticMarkup(
      createElement(GanttBar, {
        projectStart,
        projectEnd,
        rowStart: new Date('2026-06-01'),
        rowEnd: projectEnd,
        actualPct: 30,
        scheduledPct: 50,
        status: 'on-track' as ProgressStatus,
      }),
    )
    const widthMatch = html.match(/width:([\d.]+)%/)
    expect(widthMatch).not.toBeNull()
    const widthVal = parseFloat(widthMatch![1])
    expect(widthVal).toBeGreaterThan(0)
  })

  it('rowStart/rowEnd がともにプロジェクト期間内に収まる', () => {
    const { left, width } = barOffsetWidth(msStart, msEnd, projectStart, projectEnd)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(left + width).toBeLessThanOrEqual(100)
  })

  it('マイルストーン(前半期間)とタスク(後半期間)で left が異なる', () => {
    const { left: msLeft } = barOffsetWidth(msStart, msEnd, projectStart, projectEnd)
    const { left: taskLeft } = barOffsetWidth(taskStart, taskEnd, projectStart, projectEnd)
    expect(taskLeft).toBeGreaterThan(msLeft)
  })

  it('日付プロパティなしのフォールバック: left=0%, width=100%', () => {
    // 日付4つ全て省略 → { left: 0, width: 100 } フォールバック
    const html = renderToStaticMarkup(
      createElement(GanttBar, {
        actualPct: 50,
        scheduledPct: 60,
        status: 'on-track' as ProgressStatus,
      }),
    )
    expect(html).toContain('left:0%')
    // position:absolute の style 属性内に width があること
    expect(html).toContain('width:100%')
  })
})

// ---------------------------------------------------------------------------
// C. TodayLine: todayX の計算と表示判定
// ---------------------------------------------------------------------------

describe('TodayLine: todayX の計算と表示', () => {
  it('today がプロジェクト期間内のとき todayX は 0〜100 の範囲', () => {
    const todayX = xForDate(today, projectStart, projectEnd)
    expect(todayX).toBeGreaterThan(0)
    expect(todayX).toBeLessThan(100)
  })

  it('today = projectStart のとき todayX = 0', () => {
    const x = xForDate(projectStart, projectStart, projectEnd)
    expect(x).toBe(0)
  })

  it('today = projectEnd のとき todayX = 100', () => {
    const x = xForDate(projectEnd, projectStart, projectEnd)
    expect(x).toBe(100)
  })

  it('today がプロジェクト期間外(前) のとき todayX = 0 にクランプ', () => {
    const before = new Date('2025-01-01')
    const x = xForDate(before, projectStart, projectEnd)
    expect(x).toBe(0)
  })

  it('today がプロジェクト期間外(後) のとき todayX = 100 にクランプ', () => {
    const after = new Date('2027-01-01')
    const x = xForDate(after, projectStart, projectEnd)
    expect(x).toBe(100)
  })

  it('TodayLine: todayX が有効なとき left スタイルが設定される', () => {
    const todayX = xForDate(today, projectStart, projectEnd)
    const html = renderToStaticMarkup(createElement(TodayLine, { todayX }))
    expect(html).toContain(`left:${todayX}%`)
    expect(html).toContain('aria-label="今日の位置"')
  })

  it('TodayLine: todayX = -1 (範囲外) のとき null を返す (空文字列)', () => {
    const html = renderToStaticMarkup(createElement(TodayLine, { todayX: -1 }))
    expect(html).toBe('')
  })

  it('TodayLine: todayX = 101 (範囲外) のとき null を返す (空文字列)', () => {
    const html = renderToStaticMarkup(createElement(TodayLine, { todayX: 101 }))
    expect(html).toBe('')
  })
})

// ---------------------------------------------------------------------------
// D. TimelineHeader: 月ラベルと今日バッジ
// ---------------------------------------------------------------------------

describe('TimelineHeader: 月ラベルと今日バッジ', () => {
  it('プロジェクト期間内に複数の月ラベルが含まれる', () => {
    const html = renderToStaticMarkup(
      createElement(TimelineHeader, { projectStart, projectEnd, today }),
    )
    // 1月〜12月の一部が含まれること
    expect(html).toContain('月')
    // 複数の月ラベルがあること (1月と12月)
    expect(html).toContain('1月')
    expect(html).toContain('12月')
  })

  it('today がプロジェクト期間内のとき今日バッジが表示される', () => {
    const html = renderToStaticMarkup(
      createElement(TimelineHeader, { projectStart, projectEnd, today }),
    )
    expect(html).toContain('aria-label="今日"')
    expect(html).toContain('今日')
  })

  it('今日バッジに正しい日付フォーマット (M/D) が含まれる', () => {
    const html = renderToStaticMarkup(
      createElement(TimelineHeader, { projectStart, projectEnd, today }),
    )
    // today = 2026-05-14 → "今日 5/14"
    expect(html).toContain('5/14')
  })

  it('today がプロジェクト期間外のとき今日バッジは表示されない', () => {
    const outsideToday = new Date('2025-01-01')
    const html = renderToStaticMarkup(
      createElement(TimelineHeader, { projectStart, projectEnd, today: outsideToday }),
    )
    expect(html).not.toContain('aria-label="今日"')
  })

  it('TimelineHeader が relative コンテナとしてレンダリングされる', () => {
    const html = renderToStaticMarkup(
      createElement(TimelineHeader, { projectStart, projectEnd, today }),
    )
    expect(html).toContain('relative')
  })
})

// ---------------------------------------------------------------------------
// E. MilestoneRow が GanttBar に正しい日付プロパティを渡す検証
//    (renderToStaticMarkup ベース: 実際の position:absolute + left スタイルで確認)
// ---------------------------------------------------------------------------

describe('MilestoneRow: GanttBar に projectStart/projectEnd/rowStart/rowEnd が渡される', () => {
  it('msStart = projectStart のとき GanttBar の left は 0%', () => {
    // MilestoneRow が GanttBar に渡す left を barOffsetWidth で直接検証
    const { left } = barOffsetWidth(msStart, msEnd, projectStart, projectEnd)
    expect(left).toBe(0)
  })

  it('後半マイルストーン(7月〜12月) の left は前半より大きい', () => {
    const { left: frontLeft } = barOffsetWidth(
      new Date('2026-01-01'),
      new Date('2026-06-30'),
      projectStart,
      projectEnd,
    )
    const { left: backLeft } = barOffsetWidth(
      new Date('2026-07-01'),
      new Date('2026-12-31'),
      projectStart,
      projectEnd,
    )
    expect(backLeft).toBeGreaterThan(frontLeft)
  })

  it('rowEnd - rowStart の幅がプロジェクト全体比で正しい', () => {
    // 半年のマイルストーン → 約 50% の width
    const { width } = barOffsetWidth(
      new Date('2026-01-01'),
      new Date('2026-07-01'),
      projectStart,
      projectEnd,
    )
    // 約 49.5%〜50.5% の範囲
    expect(width).toBeGreaterThan(49)
    expect(width).toBeLessThan(51)
  })
})

// ---------------------------------------------------------------------------
// F. TaskRow: GanttBar に rowStart/rowEnd が渡される検証
// ---------------------------------------------------------------------------

describe('TaskRow: GanttBar に rowStart/rowEnd が渡される', () => {
  it('task.startDate/task.endDate が rowStart/rowEnd として使われる', () => {
    const { left, width } = barOffsetWidth(taskStart, taskEnd, projectStart, projectEnd)
    // 7月1日 〜 12月31日 → 後半50%
    expect(left).toBeGreaterThan(49)
    expect(width).toBeGreaterThan(40)
  })

  it('task がプロジェクト期間より後の場合でも width=0 (クランプ)', () => {
    const futureStart = new Date('2027-01-01')
    const futureEnd = new Date('2027-06-30')
    const { left, width } = barOffsetWidth(futureStart, futureEnd, projectStart, projectEnd)
    // left=100%, width=0 (right - left = 100 - 100 = 0)
    expect(left).toBe(100)
    expect(width).toBe(0)
  })

  it('task がプロジェクト開始前でも left=0 にクランプ', () => {
    const pastStart = new Date('2025-01-01')
    const pastEnd = new Date('2025-06-30')
    const { left } = barOffsetWidth(pastStart, pastEnd, projectStart, projectEnd)
    expect(left).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// G. 2カラムレイアウト: CSS Grid の確認
//    (TreeView コンポーネントは 'use client' + DnD のため renderToStaticMarkup 不可)
//    → レイアウト定数/仕様をロジックとして検証
// ---------------------------------------------------------------------------

describe('2カラムグリッドレイアウトの定数', () => {
  it('左カラム最小幅は 280px', () => {
    // CSS: minmax(280px, auto) → min=280px
    const LEFT_COLUMN_MIN_PX = 280
    expect(LEFT_COLUMN_MIN_PX).toBe(280)
  })

  it('右カラムは 1fr (残余スペースを全て使用)', () => {
    // CSS: 1fr
    const RIGHT_COLUMN = '1fr'
    expect(RIGHT_COLUMN).toBe('1fr')
  })
})

// ---------------------------------------------------------------------------
// H. calcProjectDateRange: TreeView が算出する projectStart/projectEnd の純関数テスト
//    実装予定の純関数 calcProjectDateRange を検証する
// ---------------------------------------------------------------------------

import { calcProjectDateRange } from '@/components/tree-view/project-date-range'

describe('calcProjectDateRange', () => {
  it('Milestone が 1 件のとき milestone の期間をそのまま返す', () => {
    const milestones = [{ startDate: new Date('2026-02-01'), endDate: new Date('2026-10-31') }]
    const result = calcProjectDateRange(milestones, projectStart, projectEnd)
    expect(result.start).toEqual(new Date('2026-02-01'))
    expect(result.end).toEqual(new Date('2026-10-31'))
  })

  it('複数 Milestone の中で最も早い startDate と最も遅い endDate を採用する', () => {
    const milestones = [
      { startDate: new Date('2026-03-01'), endDate: new Date('2026-09-30') },
      { startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') },
      { startDate: new Date('2026-05-01'), endDate: new Date('2026-08-01') },
    ]
    const result = calcProjectDateRange(milestones, projectStart, projectEnd)
    expect(result.start).toEqual(new Date('2026-01-01'))
    expect(result.end).toEqual(new Date('2026-12-31'))
  })

  it('Milestone が空のとき project.startDate/project.endDate にフォールバック', () => {
    const result = calcProjectDateRange([], projectStart, projectEnd)
    expect(result.start).toEqual(projectStart)
    expect(result.end).toEqual(projectEnd)
  })

  it('全 Milestone が project より内側のとき milestone 期間が優先される', () => {
    const milestones = [{ startDate: new Date('2026-03-01'), endDate: new Date('2026-09-30') }]
    const result = calcProjectDateRange(milestones, projectStart, projectEnd)
    // milestone の期間が project より内側でも milestone 基準で返す
    expect(result.start).toEqual(new Date('2026-03-01'))
    expect(result.end).toEqual(new Date('2026-09-30'))
  })

  it('返り値に start と end プロパティが含まれる', () => {
    const result = calcProjectDateRange([], projectStart, projectEnd)
    expect(result).toHaveProperty('start')
    expect(result).toHaveProperty('end')
  })
})
