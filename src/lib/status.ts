export type Status = 'completed' | 'in-progress' | 'delayed' | 'not-started'

/**
 * 4 段階ステータス判定 (純関数)。spec.md v4.0 4.3 表と 1:1 対応。
 *
 * @param input.actualPct         0..100 実績進捗率
 * @param input.scheduledPct      0..100 予定進捗率
 * @param input.startDate         タスク/マイルストーンの予定開始日
 * @param input.endDate           タスク/マイルストーンの予定終了日
 * @param input.today             現在日付
 * @param input.hasAnyActualStart 集約用: 配下に actualStartDate が入っている子が 1 件でもあるか
 */
export function calcStatus(input: {
  actualPct: number
  scheduledPct: number
  startDate: Date
  endDate: Date
  today: Date
  hasAnyActualStart: boolean
}): Status {
  // 完全完了 (最優先)
  if (input.actualPct === 100) return 'completed'

  // 未着手かつ開始予定日前 → 未着手
  if (input.actualPct === 0 && !input.hasAnyActualStart && input.today < input.startDate) {
    return 'not-started'
  }

  // 開始予定日経過しても着手ゼロ → 遅延 (未着手リスクは delayed の subset、フィルターで再判定)
  if (input.actualPct === 0 && !input.hasAnyActualStart && input.today >= input.startDate) {
    return 'delayed'
  }

  // 集約特殊ケース: actualPct=0 だが子に actualStartDate あり → in-progress
  // (子は着手済みだが完了 ToDo がまだ 0 件という稀な状態)
  if (input.actualPct === 0 && input.hasAnyActualStart) return 'in-progress'

  // 着手済み (actualPct > 0) で 100% 未満 → 進行中 or 遅延
  if (input.actualPct < input.scheduledPct) return 'delayed'
  return 'in-progress'
}
