/**
 * TodayMarker — ガントチャートの今日線コンポーネント
 *
 * spec v4.0 の今日線ルール:
 * - projectStart <= today <= projectEnd のときのみ描画
 * - 縦線 (bg-red-500 w-0.5)
 * - 上部に「今日(MM/DD)」ラベル (showLabel=true のとき)
 *
 * 重要: 縦線とラベルは両方とも `left: X%` の同一座標に **中心揃え** する。
 * 旧実装 (flex-col items-center + auto-width container) は label 有無で
 * 縦線の x 位置が ~31px ズレるバグを抱えていたため、両要素とも absolute
 * 配置で `-translate-x-1/2` を使って X% に視覚的中心を合わせる。
 */

import { xForDate } from '@/lib/timeline'

export interface TodayMarkerProps {
  projectStart: Date
  projectEnd: Date
  today: Date
  showLabel?: boolean
}

/** 日付を "M/D" 形式にフォーマット (UTC) */
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
  if (today < projectStart || today > projectEnd) return null

  const x = xForDate(today, projectStart, projectEnd)
  const label = `今日(${fmtMonthDay(today)})`

  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ left: `${x}%` }}>
      {/* 縦線: 自身の幅 (2px) の半分を左にずらして X% に中心配置 */}
      <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-red-500" />
      {/* 上部ラベル: 同じく -translate-x-1/2 で X% に中心配置 */}
      {showLabel && (
        <span className="absolute top-0 z-10 -translate-x-1/2 rounded bg-red-500 px-1 py-0.5 text-xs font-semibold whitespace-nowrap text-white">
          {label}
        </span>
      )}
    </div>
  )
}
