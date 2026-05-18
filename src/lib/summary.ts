import type { Status } from '@/lib/status'
import { daysBetween } from '@/lib/date-utils'
import { calcScheduledPct, calcTaskActualPct, calcWeightedActualPct } from '@/lib/progress'

export type ProjectSummary = {
  scheduledPct: number // プロジェクト予定%
  actualPct: number // プロジェクト実績%
}

export type DelaySummary = {
  delayedCount: number // status === 'delayed' の Task 数 (Milestone はカウントしない)
  maxDelayDays: number // 遅延中の最大遅れ日数
  notStartedRiskCount: number // 未着手リスク Task 数
}

export type FilterValue = 'all' | 'delayed' | 'not-started-risk' | 'in-progress' | 'completed'

/**
 * プロジェクト全体の予定% と実績% を集計する (純関数)。
 *
 * - 予定%: プロジェクトの startDate / endDate / today から `calcScheduledPct` で算出
 * - 実績%: 配下の Milestone を期間日数で加重平均。各 Milestone の actualPct は
 *   配下の Task の actualPct を更に期間日数で加重平均。Task の actualPct は
 *   `calcTaskActualPct` (完了 ToDo 数 / 全 ToDo 数 × 100)。
 *
 * spec v4.0 Section 2.2 / 2.4 / 4.2 参照。
 */
export function buildProjectSummary(
  project: {
    startDate: Date
    endDate: Date
    milestones: {
      startDate: Date
      endDate: Date
      tasks: {
        startDate: Date
        endDate: Date
        todos: { actualEndDate: Date | null }[]
      }[]
    }[]
  },
  today: Date,
): ProjectSummary {
  const scheduledPct = calcScheduledPct(project.startDate, project.endDate, today)

  const milestoneChildren = project.milestones.map((m) => {
    const taskChildren = m.tasks.map((t) => ({
      actualPct: calcTaskActualPct(t.todos),
      startDate: t.startDate,
      endDate: t.endDate,
    }))
    return {
      actualPct: calcWeightedActualPct(taskChildren),
      startDate: m.startDate,
      endDate: m.endDate,
    }
  })

  const actualPct = calcWeightedActualPct(milestoneChildren)

  return { scheduledPct, actualPct }
}

/**
 * Task 配列から遅延サマリーを集計する (純関数)。
 * Milestone はカウントしない (spec v4.0 Section 2.4 / Q2)。
 *
 * maxDelayDays の算出: 各遅延中 Task で
 *   - 期日超過日数 = max(0, today - endDate) [ms → 日換算]
 *   - 予定乖離日数 = (scheduledPct - actualPct) * periodDays / 100
 * の大きい方を採用し、全タスク中の最大値を返す。
 */
export function buildDelaySummary(
  tasks: {
    status: Status
    actualPct: number
    scheduledPct: number
    hasAnyActualStart: boolean
    startDate: Date
    endDate: Date
  }[],
  today: Date,
): DelaySummary {
  let delayedCount = 0
  let maxDelayDays = 0
  let notStartedRiskCount = 0

  for (const task of tasks) {
    if (task.status !== 'delayed') continue

    delayedCount++

    // 未着手リスク: actualPct=0 AND !hasAnyActualStart AND today > startDate
    if (task.actualPct === 0 && !task.hasAnyActualStart && today > task.startDate) {
      notStartedRiskCount++
    }

    // 遅れ日数の算出
    const overdueDays = Math.max(
      0,
      Math.floor((today.getTime() - task.endDate.getTime()) / 86400000),
    )
    const periodDays = daysBetween(task.startDate, task.endDate)
    const scheduledLagDays = ((task.scheduledPct - task.actualPct) * periodDays) / 100
    const delayDays = Math.max(overdueDays, scheduledLagDays)

    if (delayDays > maxDelayDays) {
      maxDelayDays = delayDays
    }
  }

  return { delayedCount, maxDelayDays, notStartedRiskCount }
}

/**
 * 行がフィルター条件に一致するか判定する (純関数)。
 * spec v4.0 Section 2.4 フィルター真理表に準拠。
 *
 * 未着手リスク判定式: status === 'delayed' && actualPct === 0 && !hasAnyActualStart && today > startDate
 *
 * 境界注意: `today === startDate` のとき `calcStatus` は `delayed` を返すが、
 * `not-started-risk` フィルターは `today > startDate` を要求するため**該当しない**。
 * 「未着手リスク」の意味は「開始予定日を**過ぎている**のに着手していない」状態。
 */
export function matchesFilter(
  row: {
    status: Status
    actualPct: number
    hasAnyActualStart: boolean
    startDate: Date
    today: Date
  },
  filter: FilterValue,
): boolean {
  if (filter === 'all') return true

  if (filter === 'completed') return row.status === 'completed'
  if (filter === 'in-progress') return row.status === 'in-progress'
  if (filter === 'delayed') return row.status === 'delayed'

  // not-started-risk: delayed の subset
  if (filter === 'not-started-risk') {
    return (
      row.status === 'delayed' &&
      row.actualPct === 0 &&
      !row.hasAnyActualStart &&
      row.today > row.startDate
    )
  }

  return false
}
