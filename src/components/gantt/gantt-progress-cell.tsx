/**
 * GanttProgressCell — ガント表の進捗カラム (2 行表示)
 *
 * spec v4.0 4.2 / S8 Files:
 * - 1 行目: `予定 X%` (黒系)
 * - 2 行目: `実績 Y%` (actualPct >= scheduledPct で緑、未満で赤)
 */

export interface GanttProgressCellProps {
  scheduledPct: number
  actualPct: number
}

export function GanttProgressCell({
  scheduledPct,
  actualPct,
}: GanttProgressCellProps): React.ReactElement {
  // NaN/Infinity が万一混入しても "NaN%" の表示にならないよう 0 にフォールバック
  const safeScheduled = Number.isFinite(scheduledPct) ? scheduledPct : 0
  const safeActual = Number.isFinite(actualPct) ? actualPct : 0
  const scheduledLabel = `${Math.round(safeScheduled)}%`
  const actualLabel = `${Math.round(safeActual)}%`
  const isOnTrack = safeActual >= safeScheduled
  const actualColor = isOnTrack ? 'text-emerald-600' : 'text-red-600'

  return (
    <div className="flex flex-col text-xs leading-tight">
      <span className="text-gray-600">
        予定 <span className="font-medium text-gray-900">{scheduledLabel}</span>
      </span>
      <span className={`font-medium ${actualColor}`}>実績 {actualLabel}</span>
    </div>
  )
}
