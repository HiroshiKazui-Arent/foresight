/**
 * PeriodBar — ガントチャートの期間バーコンポーネント
 *
 * spec v4.0 Section 2.3 に準拠。
 * - 予定バー (青系 bg-blue-200): 常時描画
 * - 実績バー (緑系 bg-emerald-500): completed / in-progress のみ描画
 * - 進捗%塗りつぶしは一切持たない
 */

import { xForDate } from '@/lib/timeline'
import { clampDate, daysBetween } from '@/lib/date-utils'

export interface PeriodBarProps {
  startDate: Date
  endDate: Date
  actualStartDate?: Date | null
  actualEndDate?: Date | null
  today: Date
  projectStart: Date
  projectEnd: Date
}

/**
 * 日付を "M/DD" 形式にフォーマット (UTC)
 */
function fmtDate(d: Date): string {
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return `${m}/${day}`
}

export function PeriodBar({
  startDate,
  endDate,
  actualStartDate,
  actualEndDate,
  today,
  projectStart,
  projectEnd,
}: PeriodBarProps): React.ReactElement {
  // --- 予定バー ---
  // wrapper: clamp(startDate, projectStart, projectEnd) → clamp(endDate, projectStart, projectEnd)
  const clampedStart = clampDate(startDate, projectStart, projectEnd)
  const clampedEnd = clampDate(endDate, projectStart, projectEnd)

  const wrapperLeft = xForDate(clampedStart, projectStart, projectEnd)
  const wrapperRight = xForDate(clampedEnd, projectStart, projectEnd)
  const wrapperWidth = Math.max(0, wrapperRight - wrapperLeft)

  const scheduledDays = daysBetween(startDate, endDate)
  const scheduledTitle = `予定: ${fmtDate(startDate)} → ${fmtDate(endDate)} (${scheduledDays}日)`

  // --- 実績バー ---
  let actualBarStyle: React.CSSProperties | null = null
  let actualTitle: string | null = null

  if (actualStartDate != null) {
    // completed か in-progress かで終端を決める
    const actualEnd: Date =
      actualEndDate != null ? actualEndDate : clampDate(today, projectStart, projectEnd) // in-progress: today を projectEnd でクランプ

    // 実績バーの left/width は wrapper 内の相対位置
    // wrapper 内座標 = (グローバル x - wrapperLeft) / wrapperWidth * 100
    // ただし wrapper width が 0 の場合は 0 で固定
    const actualStartX = xForDate(
      clampDate(actualStartDate, projectStart, projectEnd),
      projectStart,
      projectEnd,
    )
    const actualEndX = xForDate(
      clampDate(actualEnd, projectStart, projectEnd),
      projectStart,
      projectEnd,
    )

    let relLeft: number
    let relWidth: number

    if (wrapperWidth > 0) {
      relLeft = ((actualStartX - wrapperLeft) / wrapperWidth) * 100
      relWidth = Math.max(0, ((actualEndX - actualStartX) / wrapperWidth) * 100)
    } else {
      relLeft = 0
      relWidth = 0
    }

    actualBarStyle = {
      position: 'absolute' as const,
      left: `${relLeft}%`,
      width: `${relWidth}%`,
      top: 0,
      bottom: 0,
    }

    if (actualEndDate != null) {
      const actualDays = daysBetween(actualStartDate, actualEndDate)
      actualTitle = `実績: ${fmtDate(actualStartDate)} → ${fmtDate(actualEndDate)} (${actualDays}日)`
    } else {
      actualTitle = `実績: ${fmtDate(actualStartDate)} → 進行中`
    }
  }

  return (
    <div
      className="h-5 overflow-hidden"
      style={{
        position: 'absolute',
        left: `${wrapperLeft}%`,
        width: `${wrapperWidth}%`,
      }}
    >
      {/* 予定バー */}
      <div className="absolute inset-0 rounded bg-blue-200" title={scheduledTitle} />
      {/* 実績バー */}
      {actualBarStyle != null && actualTitle != null && (
        <div className="rounded bg-emerald-500" style={actualBarStyle} title={actualTitle} />
      )}
    </div>
  )
}
