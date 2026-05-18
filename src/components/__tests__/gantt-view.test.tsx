import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { GanttView } from '@/components/gantt/gantt-view'
import type { GanttRow as GanttRowData } from '@/lib/gantt-rows'

// TaskProgressModal は 'use client' + useRouter を含むため SSR 不可。
// GanttView レベルでは「入力ボタンが Task 行に描画される」ことだけ確認する。
vi.mock('@/components/gantt/task-progress-modal', () => ({
  TaskProgressModal: () => '<button type="button">入力</button>',
}))

function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day))
}

const today = d(2025, 6, 1)
const projectStart = d(2025, 1, 1)
const projectEnd = d(2025, 12, 31)

const rows: GanttRowData[] = [
  {
    id: 'ms-1',
    type: 'milestone',
    level: 0,
    wbs: '1',
    name: 'マイルストーン A',
    startDate: d(2025, 3, 1),
    endDate: d(2025, 8, 31),
    actualStartDate: null,
    actualEndDate: null,
    scheduledPct: 50,
    actualPct: 50,
    status: 'in-progress',
    hasAnyActualStart: true,
    children: [
      {
        id: 't-1',
        type: 'task',
        level: 1,
        wbs: '1.1',
        name: 'タスク 1',
        startDate: d(2025, 3, 1),
        endDate: d(2025, 5, 31),
        actualStartDate: null,
        actualEndDate: null,
        scheduledPct: 100,
        actualPct: 100,
        status: 'completed',
        hasAnyActualStart: true,
        taskId: 't-1',
        children: [],
      },
    ],
  },
]

const baseProps = {
  projectId: 'p-1',
  projectStart,
  projectEnd,
  today,
  rows,
  projectSummary: { scheduledPct: 50, actualPct: 50 },
  delaySummary: { delayedCount: 0, maxDelayDays: 0, notStartedRiskCount: 0 },
}

describe('GanttView — ヘッダ / 列', () => {
  it('6 列のヘッダ (WBS / 工程名 / ステータス / 進捗 / 進捗入力 / ガント) を描画する', () => {
    const html = renderToStaticMarkup(React.createElement(GanttView, baseProps))
    expect(html).toContain('WBS')
    expect(html).toContain('工程名')
    expect(html).toContain('ステータス')
    expect(html).toContain('進捗')
    expect(html).toContain('進捗入力')
    expect(html).toContain('ガント')
  })

  it('SummaryCards と FilterPills を表示する', () => {
    const html = renderToStaticMarkup(
      React.createElement(GanttView, {
        ...baseProps,
        delaySummary: { delayedCount: 3, maxDelayDays: 7, notStartedRiskCount: 1 },
      }),
    )
    expect(html).toContain('全体進捗')
    expect(html).toContain('遅延状況')
    expect(html).toContain('すべて')
    expect(html).toContain('遅延')
    expect(html).toContain('未着手リスク')
    expect(html).toContain('進行中')
    expect(html).toContain('完了')
  })

  it('「すべて展開 / すべて折りたたみ」ボタンを表示する', () => {
    const html = renderToStaticMarkup(React.createElement(GanttView, baseProps))
    expect(html).toContain('すべて展開')
    expect(html).toContain('すべて折りたたみ')
  })
})

describe('GanttView — 行描画', () => {
  it('milestones / tasks の name を表示する (初期は全展開)', () => {
    const html = renderToStaticMarkup(React.createElement(GanttView, baseProps))
    expect(html).toContain('マイルストーン A')
    expect(html).toContain('タスク 1')
  })

  it('rows が空でも該当なしメッセージで描画できる', () => {
    const html = renderToStaticMarkup(
      React.createElement(GanttView, {
        ...baseProps,
        rows: [],
        projectSummary: { scheduledPct: 0, actualPct: 0 },
      }),
    )
    expect(html).toContain('該当する行がありません')
  })

  it('Task 行の進捗入力セルに「入力」ボタンが含まれる', () => {
    const html = renderToStaticMarkup(React.createElement(GanttView, baseProps))
    expect(html).toContain('入力')
  })

  it('Task 行に /progress リンクが含まれない (旧バッジ削除)', () => {
    const html = renderToStaticMarkup(React.createElement(GanttView, baseProps))
    expect(html).not.toContain('/projects/p-1/tasks/t-1/progress')
  })
})
