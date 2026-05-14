'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Todo } from '@prisma/client'
import { CompletedCheckbox } from './completed-checkbox'
import { StatusPill } from '@/components/status-pill'
import { DaysPill } from '@/components/days-pill'
import { GanttBar } from '@/components/gantt/gantt-bar'
import { buildTodoProgressData } from '@/components/tree-view/progress-utils'
import { submitDailyReport } from '@/server/actions/daily-report'

interface TodoInputRowProps {
  todo: Todo
  projectId: string
  today: Date
  projectStart: Date
  projectEnd: Date
}

/**
 * 日報入力モードの ToDo 行。
 *
 * V1 ツリービューの TodoRow と同じ 5 カラム grid レイアウトに統一し、
 * 進捗 % ピル (ProgressPill) のみ完了チェックボックス (CompletedCheckbox) に
 * 差し替える。バー・ステータス・遅延日数は V1 と同様に表示し、
 * 「日報とプロジェクト表示の違いは進捗度 or 完了チェックボックスだけ」とする。
 */
export function TodoInputRow({
  todo,
  projectId,
  today,
  projectStart,
  projectEnd,
}: TodoInputRowProps) {
  const router = useRouter()
  const [completed, setCompleted] = useState(todo.completed)
  // Step 5 でデュアルチェックボックス UI に置き換えるまでの暫定 started 状態管理
  const [started, setStarted] = useState(todo.started)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(checked: boolean) {
    if (saving) return
    // 完了チェックを入れると開始も自動的に true になる
    const nextStarted = checked || started
    const previousCompleted = completed
    const previousStarted = started
    setCompleted(checked)
    setStarted(nextStarted)
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await submitDailyReport(todo.id, projectId, {
        started: nextStarted,
        completed: checked,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch {
      setCompleted(previousCompleted)
      setStarted(previousStarted)
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // ステータス・バー・遅延日数は最新の completed 状態に基づいて算出する
  const progress = buildTodoProgressData({ ...todo, completed }, today)

  return (
    <div className="flex flex-col gap-0.5 py-0.5">
      {/* 5カラムGrid (TodoRow と同一テンプレート): name / 完了チェックボックス / status / days / bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 88px 60px 56px 1fr',
          alignItems: 'center',
        }}
      >
        {/* 1. 名前カラム (pl-[60px] で ToDo 階層インデント) */}
        <div className="flex min-w-0 items-center gap-2 pr-3 pl-[60px]">
          <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{todo.name}</span>
        </div>

        {/* 2. 完了チェックボックス (進捗 % ピルの代わり) */}
        <div className="flex items-center justify-start px-1">
          <CompletedCheckbox checked={completed} onChange={handleChange} disabled={saving} />
          <span className="ml-1 text-xs text-gray-400" aria-live="polite">
            {saving ? '保存中' : saved ? '✓' : ''}
          </span>
        </div>

        {/* 3. ステータス */}
        <div className="flex items-center justify-start px-1">
          <StatusPill status={progress.status} />
        </div>

        {/* 4. 遅延日数 */}
        <div className="flex items-center justify-start px-1">
          <DaysPill days={progress.daysDeviation} />
        </div>

        {/* 5. ガントバー (共有タイムライン) */}
        <div className="relative" style={{ height: '20px' }}>
          <GanttBar
            projectStart={projectStart}
            projectEnd={projectEnd}
            rowStart={todo.startDate}
            rowEnd={todo.endDate}
            today={today}
            actualPct={progress.actualPct}
            scheduledPct={progress.scheduledPct}
            renderStatus={progress.renderStatus}
          />
        </div>
      </div>

      {error && (
        <span aria-live="polite" className="pl-[60px] text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}
