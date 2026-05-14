/**
 * プロジェクト全体のタイムライン座標系を算出するユーティリティ
 *
 * TreeView が projectStart/projectEnd を決定するロジックを純関数として分離する。
 * Milestone が存在する場合はその最小 startDate と最大 endDate を採用し、
 * Milestone が空の場合は project.startDate/project.endDate にフォールバックする。
 */

type MilestoneDateRange = {
  startDate: Date
  endDate: Date
}

type ProjectDateRange = {
  start: Date
  end: Date
}

/**
 * milestones の期間から projectStart/projectEnd を算出する。
 * milestones が空の場合は fallbackStart/fallbackEnd を返す。
 */
export function calcProjectDateRange(
  milestones: MilestoneDateRange[],
  fallbackStart: Date,
  fallbackEnd: Date,
): ProjectDateRange {
  if (milestones.length === 0) {
    return { start: fallbackStart, end: fallbackEnd }
  }

  const start = milestones.reduce(
    (min, m) => (m.startDate < min ? m.startDate : min),
    milestones[0].startDate,
  )
  const end = milestones.reduce(
    (max, m) => (m.endDate > max ? m.endDate : max),
    milestones[0].endDate,
  )

  return { start, end }
}
