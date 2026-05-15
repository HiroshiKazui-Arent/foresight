import { daysBetween } from '@/lib/date-utils'

/** 0..100 の範囲にクランプする内部ユーティリティ */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 予定進捗率を計算する (純関数)。
 * 計算式: (today - startDate) / (endDate - startDate) × 100
 * - today < startDate → 0%
 * - today > endDate   → 100%
 * - startDate === endDate (同日タスク) は total <= 0 のフォールバックを使用
 */
export function calcScheduledPct(startDate: Date, endDate: Date, today: Date): number {
  const total = endDate.getTime() - startDate.getTime()
  if (total <= 0) return today >= endDate ? 100 : 0 // 不整合データのフォールバック
  const elapsed = today.getTime() - startDate.getTime()
  return clamp((elapsed / total) * 100, 0, 100)
}

/**
 * Task の実績進捗率を計算する (純関数)。
 * 計算式: 完了 ToDo 数 / 全 ToDo 数 × 100
 * - 空配列は 0%
 * - actualEndDate != null で完了扱い
 */
export function calcTaskActualPct(todos: { actualEndDate: Date | null }[]): number {
  if (todos.length === 0) return 0
  const completed = todos.filter((t) => t.actualEndDate != null).length
  return (completed / todos.length) * 100
}

/**
 * Milestone/Project の実績進捗率を期間日数の加重平均で計算する (純関数)。
 * 重み = daysBetween(startDate, endDate) (最低 1 日)。
 * - 空配列は 0%
 * - 子が同日タスクのみの場合も重み 1 で均等平均になる
 */
export function calcWeightedActualPct(
  children: {
    actualPct: number
    startDate: Date
    endDate: Date
  }[],
): number {
  if (children.length === 0) return 0
  const weights = children.map((c) => daysBetween(c.startDate, c.endDate))
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  return children.reduce((acc, c, i) => acc + (c.actualPct * weights[i]) / totalWeight, 0)
}
