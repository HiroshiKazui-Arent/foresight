interface TaskProgressSummaryProps {
  completed: number
  total: number
  scheduledPct: number
}

/**
 * G3 進捗入力画面右側のタスク集計サマリー
 * spec v4.0 4.1: Task 実績% = 完了 ToDo 数 / 全 ToDo 数 × 100
 */
export function TaskProgressSummary({ completed, total, scheduledPct }: TaskProgressSummaryProps) {
  // ゼロ除算回避 (ToDo が 1 件もない Task のエッジケース)
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  const isFull = total > 0 && completed === total
  const pctColor = isFull ? 'text-emerald-600' : 'text-gray-700'

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-700">このタスクの進捗</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded bg-gray-50 px-3 py-2">
          <div className="text-xs text-gray-500">完了 ToDo</div>
          <div className="text-xl font-bold text-gray-800">
            {completed}/{total}
          </div>
        </div>
        <div className="rounded bg-gray-50 px-3 py-2">
          <div className="text-xs text-gray-500">実績 / 予定</div>
          <div className="text-xl font-bold">
            <span className={pctColor}>{pct}%</span>
            <span className="font-normal text-gray-400"> / </span>
            <span className="text-gray-800">{Math.round(scheduledPct)}%</span>
          </div>
        </div>
      </div>
      <ul className="space-y-1 text-xs text-gray-500">
        <li>・着手日は実績バーの開始日になる</li>
        <li>・完了日が入ると ToDo は 100%。未入力なら 0%</li>
        <li>・タスク進捗 = 完了 ToDo 数 / ToDo 総数</li>
      </ul>
    </div>
  )
}
