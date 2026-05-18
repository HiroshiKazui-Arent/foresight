'use client'

/**
 * G1PageClient — G1 ガント表示ページのクライアント部分
 *
 * フィルター state を持つため 'use client' 指定。
 * Server Component (page.tsx) からデータを受け取り描画する。
 */

import { useState } from 'react'
import { SummaryCards } from '@/components/summary-cards'
import { FilterPills } from '@/components/filter-pills'
import { TodayMarker } from '@/components/gantt/today-marker'
import type { FilterValue, ProjectSummary, DelaySummary } from '@/lib/summary'

// 列幅定数 (M1 対応)
const COL_WBS = '64px'
const COL_NAME = '248px'
const COL_STATUS = '90px'
const COL_PROGRESS = '112px'

interface G1PageClientProps {
  projectStart: Date
  projectEnd: Date
  today: Date
  projectSummary: ProjectSummary
  delaySummary: DelaySummary
}

export function G1PageClient({
  projectStart,
  projectEnd,
  today,
  projectSummary,
  delaySummary,
}: G1PageClientProps) {
  const [filter, setFilter] = useState<FilterValue>('all')

  return (
    <div>
      {/* サマリーカード (S8 で実データ接続) */}
      <div className="mb-4">
        <SummaryCards projectSummary={projectSummary} delaySummary={delaySummary} />
      </div>

      {/* フィルターピル */}
      <div className="mb-4">
        <FilterPills value={filter} onChange={setFilter} />
      </div>

      {/* ガント表本体 */}
      <div className="overflow-x-auto rounded-lg border">
        {/* ヘッダー行 (5列) */}
        <div
          className="grid border-b bg-gray-50 text-xs font-semibold text-gray-600"
          style={{
            gridTemplateColumns: `${COL_WBS} ${COL_NAME} ${COL_STATUS} ${COL_PROGRESS} 1fr`,
          }}
        >
          <div className="border-r px-2 py-2">WBS</div>
          <div className="border-r px-2 py-2">工程名</div>
          <div className="border-r px-2 py-2">ステータス</div>
          <div className="border-r px-2 py-2">進捗</div>
          {/* ガント領域ヘッダー: TodayMarker overlay */}
          <div className="relative px-2 py-2">
            ガント
            <div className="pointer-events-none absolute inset-0">
              <TodayMarker
                projectStart={projectStart}
                projectEnd={projectEnd}
                today={today}
                showLabel={true}
              />
            </div>
          </div>
        </div>

        {/* データ行 (S8 で本実装) */}
        <div
          className="grid text-sm"
          style={{
            gridTemplateColumns: `${COL_WBS} ${COL_NAME} ${COL_STATUS} ${COL_PROGRESS} 1fr`,
          }}
        >
          <div className="col-span-5 px-4 py-8 text-center text-xs text-gray-400">
            タスク行は S8 で実装されます
          </div>
        </div>
      </div>
    </div>
  )
}
