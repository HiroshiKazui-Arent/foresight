/**
 * TodayMarker — ガントチャートの今日線コンポーネント
 *
 * spec v4.0 の今日線ルール:
 * - projectStart <= today <= projectEnd のときのみ描画
 * - 縦線 (bg-red-500 w-0.5)
 * - 上部に「今日(MM/DD)」ラベル (showLabel=true のとき)
 */

import { xForDate } from '@/lib/timeline'

export interface TodayMarkerProps {
  projectStart: Date
  projectEnd: Date
  today: Date
  showLabel?: boolean
}

/**
 * 日付を "M/D" 形式にフォーマット (UTC)
 * 月・日はゼロパディングなし
 */
function fmtMonthDay(d: Date): string {
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return `${m}/${day}`
}

export function TodayMarker({
  projectStart,
  projectEnd,
  today,
  showLabel = true,
}: TodayMarkerProps): React.ReactElement | null {
  // projectStart <= today <= projectEnd でのみ描画
  if (today < projectStart || today > projectEnd) {
    return null
  }

  const x = xForDate(today, projectStart, projectEnd)
  const label = `今日(${fmtMonthDay(today)})`

  return (
    <div
      className="pointer-events-none absolute inset-y-0 flex flex-col items-center"
      style={{ left: `${x}%` }}
    >
      {/* 上部ラベル */}
      {showLabel && (
        <span className="-translate-x-1/2 rounded bg-red-500 px-1 py-0.5 text-xs font-semibold whitespace-nowrap text-white">
          {label}
        </span>
      )}
      {/* 縦線 */}
      <div className="h-full w-0.5 bg-red-500" />
    </div>
  )
}
