/**
 * PeriodBar — ガントチャートの期間バーコンポーネント (上下分離 2 本仕様)
 *
 * spec v4.0 Section 2.3 + 4.4 + handoff doc 準拠。
 * - 予定バー (青系 bg-blue-200): 常時描画、上段配置 (top: 0; height: 45%)
 * - 実績バー (緑系 bg-emerald-500): completed / in-progress のみ描画、下段配置 (bottom: 0; height: 45%)
 * - 両バーは独立に projectStart/projectEnd 基準で left/width を算出する (wrapper 内 nesting なし)
 * - 進捗% の塗りつぶしは一切持たない
 *
 * 親 (gantt-row のガント列) は `relative` で両バーを内包する想定。
 */

import { Fragment } from 'react'
import { barOffsetWidth } from '@/lib/timeline'
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

/** 日付を "M/D" 形式にフォーマット (UTC)。invalid Date は "?/?" にフォールバック */
function fmtDate(d: Date): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '?/?'
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
  // --- 予定バー座標 ---
  const plan = barOffsetWidth(startDate, endDate, projectStart, projectEnd)
  const scheduledDays = daysBetween(startDate, endDate)
  // spec v4.0 4.4 のフォーマット: `予定：MM/DD → MM/DD（N日）`(全角コロン・全角括弧)
  const scheduledTitle = `予定：${fmtDate(startDate)} → ${fmtDate(endDate)}（${scheduledDays}日）`

  // --- 実績バー座標 (条件付き) ---
  let actualLayout: { left: number; width: number; title: string } | null = null
  if (actualStartDate != null) {
    // completed → actualEndDate / in-progress → min(today, projectEnd)
    // Task の予定終了日 (endDate) ではクランプしない (spec v4.0)
    const actualEnd: Date =
      actualEndDate != null ? actualEndDate : clampDate(today, projectStart, projectEnd)
    const { left, width } = barOffsetWidth(actualStartDate, actualEnd, projectStart, projectEnd)
    // spec v4.0 4.4 のフォーマット:
    //   completed → `実績：MM/DD → MM/DD（N日）`
    //   in-progress → `実績：MM/DD →（N日経過）`
    const title =
      actualEndDate != null
        ? `実績：${fmtDate(actualStartDate)} → ${fmtDate(actualEndDate)}（${daysBetween(actualStartDate, actualEndDate)}日）`
        : `実績：${fmtDate(actualStartDate)} →（${daysBetween(actualStartDate, actualEnd)}日経過）`
    actualLayout = { left, width, title }
  }

  return (
    <Fragment>
      {/* 予定バー (上段) */}
      <div
        className="absolute rounded bg-blue-200"
        style={{
          top: 0,
          height: '45%',
          left: `${plan.left}%`,
          width: `${plan.width}%`,
          // 同日タスク (startDate === endDate) で width=0 % になり不可視になるのを防ぐ
          minWidth: '3px',
        }}
        title={scheduledTitle}
      />
      {/* 実績バー (下段、条件付き) */}
      {actualLayout != null && (
        <div
          className="absolute rounded bg-emerald-500"
          style={{
            bottom: 0,
            height: '45%',
            left: `${actualLayout.left}%`,
            width: `${actualLayout.width}%`,
            minWidth: '3px',
          }}
          title={actualLayout.title}
        />
      )}
    </Fragment>
  )
}
