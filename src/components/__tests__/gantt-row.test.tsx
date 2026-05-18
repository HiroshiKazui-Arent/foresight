import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GanttRow } from '@/components/gantt/gantt-row'
import type { GanttRow as GanttRowData } from '@/lib/gantt-rows'

// TaskProgressModal は 'use client' + useRouter を含むため SSR では動作しない。
// gantt-row.test.tsx では「入力ボタンのマークアップが含まれる」ことを確認するが、
// モーダル内部の動作は task-progress-modal.test.tsx で担保する。
vi.mock('@/components/gantt/task-progress-modal', () => ({
  TaskProgressModal: ({ task }: { task: { name: string } }) =>
    `<button type="button">入力</button><!-- modal:${task.name} -->`,
}))

function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day))
}

const today = d(2025, 6, 1)
const projectStart = d(2025, 1, 1)
const projectEnd = d(2025, 12, 31)

function makeRow(overrides?: Partial<GanttRowData>): GanttRowData {
  return {
    id: 't-1',
    type: 'task',
    level: 1,
    wbs: '1.1',
    name: 'サンプルタスク',
    startDate: d(2025, 3, 1),
    endDate: d(2025, 7, 31),
    actualStartDate: d(2025, 3, 5),
    actualEndDate: null,
    scheduledPct: 50,
    actualPct: 30,
    status: 'delayed',
    hasAnyActualStart: true,
    taskId: 't-1',
    children: [
      {
        id: 'td-1',
        type: 'todo',
        level: 2,
        wbs: '1.1.1',
        name: 'TD',
        startDate: d(2025, 3, 1),
        endDate: d(2025, 4, 30),
        actualStartDate: null,
        actualEndDate: null,
        scheduledPct: 100,
        actualPct: 0,
        status: 'delayed',
        hasAnyActualStart: false,
        children: [],
      },
    ],
    ...overrides,
  }
}

const grid = '64px 248px 90px 112px 80px 1fr'

describe('GanttRow', () => {
  it('WBS / 工程名 / StatusPill / 進捗 / PeriodBar を描画する', () => {
    const html = renderToStaticMarkup(
      GanttRow({
        row: makeRow(),
        expanded: true,
        onToggle: vi.fn(),
        today,
        projectStart,
        projectEnd,
        projectId: 'p-1',
        gridTemplateColumns: grid,
      }),
    )
    expect(html).toContain('1.1') // WBS
    expect(html).toContain('サンプルタスク') // 工程名
    expect(html).toContain('遅延') // StatusPill
    expect(html).toContain('予定') // 進捗ラベル
    expect(html).toContain('50%') // scheduled
    expect(html).toContain('30%') // actual
    expect(html).toContain('bg-blue-200') // PeriodBar 予定
  })

  it('Task 行の進捗入力セルに「入力」ボタンが存在する', () => {
    const html = renderToStaticMarkup(
      GanttRow({
        row: makeRow({ type: 'task', taskId: 't-1' }),
        expanded: true,
        onToggle: vi.fn(),
        today,
        projectStart,
        projectEnd,
        projectId: 'p-1',
        gridTemplateColumns: grid,
      }),
    )
    // TaskProgressModal がモック経由で「入力」ボタンとして描画される
    expect(html).toContain('入力')
  })

  it('Task 行の工程名セルに /progress リンクが存在しない (旧バッジ削除)', () => {
    const html = renderToStaticMarkup(
      GanttRow({
        row: makeRow({ type: 'task', taskId: 't-1' }),
        expanded: true,
        onToggle: vi.fn(),
        today,
        projectStart,
        projectEnd,
        projectId: 'p-1',
        gridTemplateColumns: grid,
      }),
    )
    expect(html).not.toContain('/projects/p-1/tasks/t-1/progress')
  })

  it('Milestone 行の進捗入力セルは空 (「入力」ボタンなし)', () => {
    const html = renderToStaticMarkup(
      GanttRow({
        row: makeRow({ type: 'milestone', level: 0, taskId: undefined }),
        expanded: true,
        onToggle: vi.fn(),
        today,
        projectStart,
        projectEnd,
        projectId: 'p-1',
        gridTemplateColumns: grid,
      }),
    )
    // TaskProgressModal はモックしてあるが、Milestone 行には渡さない
    expect(html).not.toContain('入力')
  })

  it('ToDo 行の進捗入力セルは空 (「入力」ボタンなし)', () => {
    const html = renderToStaticMarkup(
      GanttRow({
        row: makeRow({ type: 'todo', level: 2, taskId: undefined }),
        expanded: true,
        onToggle: vi.fn(),
        today,
        projectStart,
        projectEnd,
        projectId: 'p-1',
        gridTemplateColumns: grid,
      }),
    )
    expect(html).not.toContain('入力')
  })

  it('children あり → ExpandToggle を描画する', () => {
    const html = renderToStaticMarkup(
      GanttRow({
        row: makeRow(),
        expanded: true,
        onToggle: vi.fn(),
        today,
        projectStart,
        projectEnd,
        projectId: 'p-1',
        gridTemplateColumns: grid,
      }),
    )
    expect(html).toContain('▼')
  })

  it('children なし → ExpandToggle を描画しない', () => {
    const html = renderToStaticMarkup(
      GanttRow({
        row: makeRow({ children: [] }),
        expanded: true,
        onToggle: vi.fn(),
        today,
        projectStart,
        projectEnd,
        projectId: 'p-1',
        gridTemplateColumns: grid,
      }),
    )
    expect(html).not.toContain('▼')
    expect(html).not.toContain('▶')
  })

  it('level=0 milestone は太字、level=2 todo は通常', () => {
    const msHtml = renderToStaticMarkup(
      GanttRow({
        row: makeRow({ level: 0, type: 'milestone', taskId: undefined }),
        expanded: true,
        onToggle: vi.fn(),
        today,
        projectStart,
        projectEnd,
        projectId: 'p-1',
        gridTemplateColumns: grid,
      }),
    )
    expect(msHtml).toContain('font-semibold')
  })
})
