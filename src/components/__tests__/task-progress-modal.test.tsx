/**
 * TaskProgressModal の単体テスト (TDD — RED → GREEN)
 *
 * 環境: vitest / node (jsdom なし)
 * 手法:
 *   - 静的構造は renderToStaticMarkup で検証
 *   - router.refresh 呼び出しは makeOpenChangeHandler (エクスポート済み純関数) を
 *     直接呼び出して検証 (node 環境で DOM/イベント不要)
 */

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

// Server action と Next.js サーバー依存をモック (node 環境で import エラー回避)
vi.mock('@/server/actions/progress', () => ({
  updateTodoActualDates: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// next/navigation のモック — renderToStaticMarkup 経由で useRouter が呼ばれる前に登録。
// refresh は安定参照にして、将来テストで呼出回数を検証する際の偽陰性を防ぐ。
const mockRouterRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
  notFound: vi.fn(),
}))

import {
  TaskProgressModal,
  TaskProgressContent,
  makeOpenChangeHandler,
} from '@/components/gantt/task-progress-modal'
import type { GanttRow } from '@/lib/gantt-rows'

// ---- テスト用ヘルパー ----

function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day))
}

function makeTodoItem(id: string, name: string) {
  return {
    id,
    name,
    startDate: d(2025, 3, 1),
    endDate: d(2025, 5, 31),
    actualStartDate: null as Date | null,
    actualEndDate: null as Date | null,
  }
}

function makeTodoRow(id: string, name: string): GanttRow {
  return {
    id,
    type: 'todo',
    level: 2,
    wbs: '1.1.1',
    name,
    startDate: d(2025, 3, 1),
    endDate: d(2025, 5, 31),
    actualStartDate: null,
    actualEndDate: null,
    scheduledPct: 50,
    actualPct: 0,
    status: 'not-started',
    hasAnyActualStart: false,
    children: [],
  }
}

function makeTaskRow(overrides?: { children?: GanttRow[]; name?: string }): GanttRow {
  return {
    id: 't-1',
    type: 'task',
    level: 1,
    wbs: '1.1',
    name: overrides?.name ?? 'サンプルタスク',
    startDate: d(2025, 3, 1),
    endDate: d(2025, 7, 31),
    actualStartDate: null,
    actualEndDate: null,
    scheduledPct: 50,
    actualPct: 0,
    status: 'not-started',
    hasAnyActualStart: false,
    taskId: 't-1',
    children: overrides?.children ?? [makeTodoRow('td-1', 'ToDo A')],
  }
}

const noopSave = async () => {}

// ---- テスト本体 ----

// showCloseButton={false} で DialogClose コンテキストエラーを回避 (node/SSR 環境)
const contentProps = (
  taskName: string,
  todos: ReturnType<typeof makeTodoItem>[],
  overrides?: { taskStartDate?: Date; taskEndDate?: Date; taskScheduledPct?: number },
) => ({
  taskName,
  taskStartDate: overrides?.taskStartDate ?? d(2025, 3, 1),
  taskEndDate: overrides?.taskEndDate ?? d(2025, 7, 31),
  taskScheduledPct: overrides?.taskScheduledPct ?? 50,
  todos,
  onSave: noopSave,
  showCloseButton: false as const,
})

describe('TaskProgressContent — ToDo 一覧表示', () => {
  it('task.children に渡した ToDo の name がすべて描画される (3 件)', () => {
    const todos = [
      makeTodoItem('td-1', 'ToDo アルファ'),
      makeTodoItem('td-2', 'ToDo ベータ'),
      makeTodoItem('td-3', 'ToDo ガンマ'),
    ]
    const html = renderToStaticMarkup(
      React.createElement(TaskProgressContent, contentProps('テストタスク', todos)),
    )
    expect(html).toContain('ToDo アルファ')
    expect(html).toContain('ToDo ベータ')
    expect(html).toContain('ToDo ガンマ')
  })

  it('task.name がタイトルエリアに表示される', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        TaskProgressContent,
        contentProps('重要タスク Z', [makeTodoItem('td-1', 'なんか ToDo')]),
      ),
    )
    expect(html).toContain('重要タスク Z')
  })

  it('task.children が空の場合「ToDo が登録されていません」プレースホルダーが表示される', () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskProgressContent, contentProps('タスク', [])),
    )
    expect(html).toContain('ToDo が登録されていません')
  })

  it('Task の予定期間 (M/D → M/D（N日）) が見出し直下に表示される', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        TaskProgressContent,
        contentProps('予定確認タスク', [makeTodoItem('td-1', 'なんか')], {
          taskStartDate: d(2025, 5, 1),
          taskEndDate: d(2025, 5, 5),
          taskScheduledPct: 50,
        }),
      ),
    )
    // daysBetween(5/1, 5/5) = 4 → "予定：5/1 → 5/5（4日）"
    expect(html).toContain('予定：5/1 → 5/5（4日）')
  })

  it('Task の予定進捗 % が見出し直下に表示される', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        TaskProgressContent,
        contentProps('進捗確認タスク', [makeTodoItem('td-1', 'なんか')], {
          taskScheduledPct: 73.4,
        }),
      ),
    )
    // Math.round(73.4) = 73 — サマリーの「実績 / 予定」欄に表示される
    expect(html).toContain('73%')
  })
})

describe('TaskProgressModal — Trigger ボタン', () => {
  it('ラベル「入力」の Trigger ボタンが存在する', () => {
    const task = makeTaskRow()
    const html = renderToStaticMarkup(
      React.createElement(TaskProgressModal, { task, projectId: 'p-1' }),
    )
    expect(html).toContain('入力')
  })
})

describe('makeOpenChangeHandler — onOpenChange(false) で router.refresh が呼ばれる', () => {
  it('open=false のとき router.refresh を 1 回呼ぶ', () => {
    const refresh = vi.fn()
    const mockRouter = { refresh }
    const setOpen = vi.fn()

    const handler = makeOpenChangeHandler(mockRouter, setOpen)

    handler(false)

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(setOpen).toHaveBeenCalledWith(false)
  })

  it('open=true のとき router.refresh を呼ばない', () => {
    const refresh = vi.fn()
    const mockRouter = { refresh }
    const setOpen = vi.fn()

    const handler = makeOpenChangeHandler(mockRouter, setOpen)

    handler(true)

    expect(refresh).not.toHaveBeenCalled()
    expect(setOpen).toHaveBeenCalledWith(true)
  })
})
