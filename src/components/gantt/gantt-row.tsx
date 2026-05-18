/**
 * GanttRow — ガント表の 1 行分のレンダリング
 *
 * 6 列構成 (WBS / 工程名 / ステータス / 進捗 / 進捗入力 / ガント領域)。
 * level インデント・展開トグル・タスク行のみ「入力」ボタン (TaskProgressModal) を担当。
 *
 * `<TodayMarker>` はヘッダ行に overlay 配置 (gantt-view) しているのでここでは描画しない。
 */

import { StatusPill } from '@/components/status-pill'
import { PeriodBar } from '@/components/gantt/period-bar'
import { ExpandToggle } from '@/components/gantt/expand-toggle'
import { GanttProgressCell } from '@/components/gantt/gantt-progress-cell'
import { TaskProgressModal } from '@/components/gantt/task-progress-modal'
import type { GanttRow as GanttRowData } from '@/lib/gantt-rows'

export interface GanttRowProps {
  row: GanttRowData
  expanded: boolean
  onToggle: () => void
  today: Date
  projectStart: Date
  projectEnd: Date
  projectId: string
  /** 表示位置を制御する column-template 文字列 */
  gridTemplateColumns: string
}

const INDENT_PX_PER_LEVEL = 16

/** level に対応する文字色 / 太さスタイル */
function nameTextClass(level: 0 | 1 | 2): string {
  if (level === 0) return 'font-semibold text-gray-900'
  if (level === 1) return 'font-medium text-gray-800'
  return 'text-gray-700'
}

export function GanttRow({
  row,
  expanded,
  onToggle,
  today,
  projectStart,
  projectEnd,
  projectId,
  gridTemplateColumns,
}: GanttRowProps): React.ReactElement {
  const hasChildren = row.children.length > 0
  const indent = row.level * INDENT_PX_PER_LEVEL

  return (
    <div
      className="grid border-b text-sm hover:bg-gray-50"
      style={{ gridTemplateColumns }}
      data-row-type={row.type}
      data-row-id={row.id}
    >
      {/* WBS */}
      <div className="border-r px-2 py-2 font-mono text-xs text-gray-500">{row.wbs}</div>

      {/* 工程名 (indent + 展開ボタン + 名前のみ。進捗入力バッジは別カラムへ移動) */}
      <div
        className="flex min-w-0 items-center gap-1 border-r px-2 py-2"
        style={{ paddingLeft: indent + 8 }}
      >
        {hasChildren ? (
          <ExpandToggle expanded={expanded} onToggle={onToggle} />
        ) : (
          <span className="inline-block h-5 w-5" aria-hidden="true" />
        )}
        <span className={`min-w-0 truncate ${nameTextClass(row.level)}`} title={row.name}>
          {row.name}
        </span>
      </div>

      {/* ステータス */}
      <div className="flex items-center border-r px-2 py-2">
        <StatusPill status={row.status} />
      </div>

      {/* 進捗 (2 行) */}
      <div className="flex items-center border-r px-2 py-2">
        <GanttProgressCell scheduledPct={row.scheduledPct} actualPct={row.actualPct} />
      </div>

      {/* 進捗入力: Task 行のみ TaskProgressModal を描画、Milestone / ToDo は空セル */}
      <div className="flex items-center justify-center border-r px-2 py-2">
        {row.type === 'task' ? (
          <TaskProgressModal task={row} projectId={projectId} />
        ) : (
          <div aria-hidden="true" />
        )}
      </div>

      {/* ガント領域: TodayMarker overlay と座標系を揃えるため px-2 は付けない (full cell width 基準) */}
      <div className="relative h-9 py-2">
        <div className="relative h-5">
          <PeriodBar
            startDate={row.startDate}
            endDate={row.endDate}
            actualStartDate={row.actualStartDate}
            actualEndDate={row.actualEndDate}
            today={today}
            projectStart={projectStart}
            projectEnd={projectEnd}
          />
        </div>
      </div>
    </div>
  )
}
