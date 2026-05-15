'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Todo } from '@prisma/client'
import { StartedCheckbox } from './started-checkbox'
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
 * 進捗 % ピル (ProgressPill) のみ「開始 / 完了」デュアルチェックボックス
 * (44px × 2) に差し替える。バー・ステータス・遅延日数は V1 と同様。
 */
export function TodoInputRow({
  todo,
  projectId,
  today,
  projectStart,
  projectEnd,
}: TodoInputRowProps) {
  const router = useRouter()
  const [started, setStarted] = useState(todo.started)
  const [completed, setCompleted] = useState(todo.completed)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // useRef で committed 値を管理: 楽観的更新の rollback に stale closure が起きない
  const committedRef = useRef({ started: todo.started, completed: todo.completed })
  // React state の非同期フラッシュより先行する同期ガード
  const isSavingRef = useRef(false)
  // アンマウント後の setTimeout によるメモリリークを防ぐ
  const mountedRef = useRef(true)
  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  async function save(nextStarted: boolean, nextCompleted: boolean) {
    if (isSavingRef.current) return
    isSavingRef.current = true
    const prev = { ...committedRef.current }
    committedRef.current = { started: nextStarted, completed: nextCompleted }
    setStarted(nextStarted)
    setCompleted(nextCompleted)
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await submitDailyReport(todo.id, projectId, {
        started: nextStarted,
        completed: nextCompleted,
      })
      setSaved(true)
      setTimeout(() => {
        if (mountedRef.current) setSaved(false)
      }, 2000)
      router.refresh()
    } catch {
      committedRef.current = prev
      setStarted(prev.started)
      setCompleted(prev.completed)
      setError('保存に失敗しました')
    } finally {
      isSavingRef.current = false
      setSaving(false)
    }
  }

  function handleStartedChange(checked: boolean) {
    // un-start のとき completed も false に戻す (DB CHECK と整合)
    const nextCompleted = checked ? completed : false
    save(checked, nextCompleted)
  }

  function handleCompletedChange(checked: boolean) {
    // 完了にするとき started を自動 true にする
    const nextStarted = checked ? true : started
    save(nextStarted, checked)
  }

  const progress = buildTodoProgressData({ ...todo, started, completed }, today)

  return (
    <div className="flex flex-col gap-0.5 py-0.5" data-testid="todo-input-row">
      {/* 5カラムGrid (TodoRow と同一テンプレート): name / checkbox×2 / status / days / bar */}
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

        {/* 2. 開始/完了チェックボックス (88px = 44px × 2) */}
        <div className="flex items-center">
          <div className="flex w-11 items-center justify-center">
            <StartedCheckbox checked={started} onChange={handleStartedChange} disabled={saving} />
          </div>
          <div className="flex w-11 items-center justify-center">
            <CompletedCheckbox
              checked={completed}
              onChange={handleCompletedChange}
              disabled={saving || !started}
            />
          </div>
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

      {/* 保存フィードバック */}
      <span aria-live="polite" className="pl-[60px] text-xs">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : saving ? (
          <span className="text-gray-400">保存中</span>
        ) : saved ? (
          <span className="text-gray-400">✓</span>
        ) : null}
      </span>
    </div>
  )
}
