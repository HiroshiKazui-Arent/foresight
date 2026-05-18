'use client'

/**
 * GanttView — G1 ガント表示画面のクライアントルート
 *
 * Server Component (page.tsx) から計算済みの rows / summaries を受け取り、
 * 展開状態 + フィルター状態を管理してテーブルを描画する。
 *
 * spec v4.0 / plans/spec-v4-reset.md S8 参照。
 */

import { useMemo, useState } from 'react'
import { SummaryCards } from '@/components/summary-cards'
import { FilterPills } from '@/components/filter-pills'
import { TodayMarker } from '@/components/gantt/today-marker'
import { GanttRow } from '@/components/gantt/gantt-row'
import { hasMatchingDescendant, type GanttRow as GanttRowData } from '@/lib/gantt-rows'
import type { FilterValue, ProjectSummary, DelaySummary } from '@/lib/summary'

// 列幅 (M1 / spec v4.0 / モック HTML 参照)
const COL_WBS = '64px'
const COL_NAME = '248px'
const COL_STATUS = '90px'
const COL_PROGRESS = '112px'
const COL_INPUT = '80px'
export const GRID_TEMPLATE = `${COL_WBS} ${COL_NAME} ${COL_STATUS} ${COL_PROGRESS} ${COL_INPUT} 1fr`

export interface GanttViewProps {
  projectId: string
  projectStart: Date
  projectEnd: Date
  today: Date
  rows: GanttRowData[]
  projectSummary: ProjectSummary
  delaySummary: DelaySummary
}

function collectAllIds(rows: GanttRowData[]): string[] {
  const ids: string[] = []
  const walk = (r: GanttRowData) => {
    ids.push(r.id)
    for (const c of r.children) walk(c)
  }
  for (const r of rows) walk(r)
  return ids
}

export function GanttView({
  projectId,
  projectStart,
  projectEnd,
  today,
  rows,
  projectSummary,
  delaySummary,
}: GanttViewProps) {
  const [filter, setFilter] = useState<FilterValue>('all')

  // 初期は全展開。
  // rows は Server Component から一方向で渡される前提のため、rows が変わっても
  // expandedSet を自動同期しない (将来クライアントサイド再フェッチを導入する場合は useEffect 追加要)。
  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => new Set(collectAllIds(rows)))

  const toggle = (id: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpandedSet(new Set(collectAllIds(rows)))
  const collapseAll = () => setExpandedSet(new Set())

  // フィルター後の表示対象行を計算 (フラット化、parent も含む)
  const visibleFlatRows = useMemo(() => {
    const result: GanttRowData[] = []
    const walk = (r: GanttRowData) => {
      const shouldRender = filter === 'all' || hasMatchingDescendant(r, filter, today)
      if (!shouldRender) return
      result.push(r)
      if (expandedSet.has(r.id)) {
        for (const c of r.children) walk(c)
      }
    }
    for (const r of rows) walk(r)
    return result
  }, [rows, filter, expandedSet, today])

  const todayLabel = `${today.getUTCFullYear()}/${today.getUTCMonth() + 1}/${today.getUTCDate()}`

  return (
    <div>
      {/* サマリーカード */}
      <div className="mb-4">
        <SummaryCards projectSummary={projectSummary} delaySummary={delaySummary} />
      </div>

      {/* フィルターピル + ツールバー */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <FilterPills value={filter} onChange={setFilter} />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">今日: {todayLabel}</span>
          <button
            type="button"
            onClick={expandAll}
            className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
          >
            すべて展開
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
          >
            すべて折りたたみ
          </button>
        </div>
      </div>

      {/* ガント表本体 */}
      <div className="overflow-x-auto rounded-lg border">
        {/* ヘッダー行 */}
        <div
          className="grid border-b bg-gray-50 text-xs font-semibold text-gray-600"
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          <div className="border-r px-2 py-2">WBS</div>
          <div className="border-r px-2 py-2">工程名</div>
          <div className="border-r px-2 py-2">ステータス</div>
          <div className="border-r px-2 py-2">進捗</div>
          <div className="border-r px-2 py-2">進捗入力</div>
          <div className="relative px-2 py-2">
            ガント
            <div className="pointer-events-none absolute inset-0">
              <TodayMarker
                projectStart={projectStart}
                projectEnd={projectEnd}
                today={today}
                showLabel
              />
            </div>
          </div>
        </div>

        {/* データ行 */}
        {visibleFlatRows.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-400">該当する行がありません</div>
        ) : (
          <div className="relative">
            {/* 行全体に重ねる TodayMarker overlay (ガント列のみに見せる) */}
            <div
              className="pointer-events-none absolute inset-0 grid"
              style={{ gridTemplateColumns: GRID_TEMPLATE }}
            >
              <div />
              <div />
              <div />
              <div />
              <div />
              <div className="relative">
                <TodayMarker
                  projectStart={projectStart}
                  projectEnd={projectEnd}
                  today={today}
                  showLabel={false}
                />
              </div>
            </div>

            {visibleFlatRows.map((row) => (
              <GanttRow
                key={row.id}
                row={row}
                expanded={expandedSet.has(row.id)}
                onToggle={() => toggle(row.id)}
                today={today}
                projectStart={projectStart}
                projectEnd={projectEnd}
                projectId={projectId}
                gridTemplateColumns={GRID_TEMPLATE}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
