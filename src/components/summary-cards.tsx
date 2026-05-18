/**
 * SummaryCards — プロジェクトサマリーカード群
 *
 * 全体進捗カードと遅延サマリーカードを表示する。
 * S8 で実データから生成されたサマリーを受け取る形に接続する。
 */

import type { ProjectSummary, DelaySummary } from '@/lib/summary'

export interface SummaryCardsProps {
  projectSummary: ProjectSummary
  delaySummary: DelaySummary
}

export function SummaryCards({
  projectSummary,
  delaySummary,
}: SummaryCardsProps): React.ReactElement {
  const { scheduledPct, actualPct } = projectSummary
  const { delayedCount, maxDelayDays, notStartedRiskCount } = delaySummary

  const isOnTrack = actualPct >= scheduledPct
  const actualColor = isOnTrack ? 'text-emerald-600' : 'text-red-600'
  const scheduledLabel = `${Math.round(scheduledPct)}%`
  const actualLabel = `${Math.round(actualPct)}%`
  const delayDaysLabel = `${Math.round(maxDelayDays)}日`

  return (
    <div className="flex flex-wrap gap-4">
      {/* 全体進捗カード */}
      <section
        aria-labelledby="summary-progress-heading"
        className="rounded-lg border bg-white px-4 py-3 shadow-sm"
      >
        <h2 id="summary-progress-heading" className="mb-1 text-xs font-medium text-gray-500">
          全体進捗
        </h2>
        <dl className="flex items-baseline gap-3">
          <div className="flex items-baseline gap-1 text-sm text-gray-600">
            <dt>予定</dt>
            <dd className="font-semibold" aria-label={`予定 ${scheduledLabel}`}>
              {scheduledLabel}
            </dd>
          </div>
          <div className={`flex items-baseline gap-1 text-sm font-semibold ${actualColor}`}>
            <dt>実績</dt>
            <dd aria-label={`実績 ${actualLabel}`}>{actualLabel}</dd>
          </div>
        </dl>
      </section>

      {/* 遅延サマリーカード */}
      <section
        aria-labelledby="summary-delay-heading"
        className="rounded-lg border bg-white px-4 py-3 shadow-sm"
      >
        <h2 id="summary-delay-heading" className="mb-1 text-xs font-medium text-gray-500">
          遅延状況
        </h2>
        <dl className="flex items-baseline gap-3 text-sm">
          <div className="flex items-baseline gap-1">
            <dt>遅延中</dt>
            <dd className="font-semibold text-red-600" aria-label={`遅延中 ${delayedCount}件`}>
              {delayedCount}件
            </dd>
          </div>
          <div className="flex items-baseline gap-1">
            <dt>最大遅れ</dt>
            <dd className="font-semibold" aria-label={`最大遅れ ${delayDaysLabel}`}>
              {delayDaysLabel}
            </dd>
          </div>
          <div className="flex items-baseline gap-1">
            <dt>未着手リスク</dt>
            <dd
              className="font-semibold text-amber-600"
              aria-label={`未着手リスク ${notStartedRiskCount}件`}
            >
              {notStartedRiskCount}件
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
