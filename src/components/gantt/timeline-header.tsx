/**
 * タイムラインヘッダーコンポーネント
 *
 * 月ヘッダーラベルと今日バッジを表示する。
 * monthBoundaries / xForDate は timeline-utils から取得。
 */

import { monthBoundaries, xForDate } from './timeline-utils'

/**
 * 今日の日付を "今日 M/D" フォーマットの文字列に変換する。
 * 月・日はゼロパディングなし (例: 2025-03-05 → "今日 3/5")。
 */
export function formatTodayLabel(today: Date): string {
  const month = today.getMonth() + 1
  const day = today.getDate()
  return `今日 ${month}/${day}`
}

interface TimelineHeaderProps {
  projectStart: Date
  projectEnd: Date
  today: Date
}

export function TimelineHeader({ projectStart, projectEnd, today }: TimelineHeaderProps) {
  const boundaries = monthBoundaries(projectStart, projectEnd)
  const todayX = xForDate(today, projectStart, projectEnd)
  const todayLabel = formatTodayLabel(today)

  const todayInRange = today >= projectStart && today <= projectEnd

  return (
    <div className="relative h-8 w-full overflow-hidden">
      {/* 月名ラベル */}
      {boundaries.map(({ date, x }) => (
        <span
          key={date.getTime()}
          className="absolute top-0 text-xs text-gray-500"
          style={{ left: `${x}%` }}
        >
          {date.getMonth() + 1}月
        </span>
      ))}

      {/* 今日バッジ: 今日がプロジェクト期間内のみ表示 */}
      {todayInRange && (
        <span
          className="absolute top-0 text-xs font-semibold text-red-500"
          style={{ left: `${todayX}%` }}
          aria-label="今日"
        >
          {todayLabel}
        </span>
      )}
    </div>
  )
}
