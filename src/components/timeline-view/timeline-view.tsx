'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GanttBar } from '@/components/gantt/gantt-bar'
import { ProgressPill } from '@/components/progress-pill'
import { StatusPill } from '@/components/status-pill'
import { DaysPill } from '@/components/days-pill'
import { createTask } from '@/server/actions/task'
import type { TimelineMilestone, TimelineTask } from '@/types/timeline'
import { calcBarPosition, calcTodayLine } from './timeline-utils'
import { validateAddRowForm } from '@/components/tree-view/add-row-utils'

type Props = {
  milestone: TimelineMilestone
  tasks: TimelineTask[]
  projectId: string
  today: Date
}

export function TimelineView({ milestone, tasks, projectId, today }: Props) {
  const router = useRouter()
  const milestoneScope = { startDate: milestone.startDate, endDate: milestone.endDate }
  const { showTodayLine, todayOffsetPct } = calcTodayLine(today, milestoneScope)

  return (
    <div className="space-y-4">
      {/* マイルストーン サマリ行 */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-semibold text-blue-800">{milestone.name}</span>
          <ProgressPill
            actualPct={milestone.progressData.actualPct}
            scheduledPct={milestone.progressData.scheduledPct}
          />
          <StatusPill status={milestone.progressData.status} />
          <DaysPill days={milestone.progressData.daysDeviation} />
        </div>
        <GanttBar
          actualPct={milestone.progressData.actualPct}
          scheduledPct={milestone.progressData.scheduledPct}
          status={milestone.progressData.status}
        />
      </div>

      {/* タスク一覧 */}
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500">タスクがありません</p>
      ) : (
        <div className="space-y-2">
          {/* 今日線 + タスク行ラッパー */}
          <div className="relative">
            {showTodayLine && (
              <div
                className="pointer-events-none absolute top-0 z-10 h-full border-l-2 border-red-400"
                style={{ left: `${todayOffsetPct}%` }}
                aria-label="今日"
              />
            )}

            <div className="space-y-1">
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  milestoneScope={milestoneScope}
                  projectId={projectId}
                  today={today}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* タスク追加 */}
      <AddTaskForm
        milestoneId={milestone.id}
        projectId={projectId}
        onDone={() => router.refresh()}
      />
    </div>
  )
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────

type TaskRowProps = {
  task: TimelineTask
  milestoneScope: { startDate: Date; endDate: Date }
  projectId: string
  today: Date
}

function TaskRow({ task, milestoneScope, projectId, today }: TaskRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { offsetPct, widthPct } = calcBarPosition(task, milestoneScope)
  const taskScope = { startDate: task.startDate, endDate: task.endDate }

  return (
    <div className="rounded border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-2 py-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600"
          aria-label={expanded ? '折りたたむ' : '展開する'}
          aria-expanded={expanded}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span className="min-w-24 shrink-0 text-sm">{task.name}</span>
        <Link
          href={`/projects/${projectId}/tasks/${task.id}`}
          className="shrink-0 rounded p-0.5 text-xs text-gray-400 hover:text-blue-500"
          aria-label="タスク詳細ビューで開く"
          title="タスク詳細"
        >
          →
        </Link>
        <div className="relative min-w-0 flex-1">
          <div style={{ marginLeft: `${offsetPct}%`, width: `${widthPct}%` }}>
            <GanttBar
              actualPct={task.actualPct}
              scheduledPct={task.scheduledPct}
              status={task.status}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ProgressPill actualPct={task.actualPct} scheduledPct={task.scheduledPct} />
          <StatusPill status={task.status} />
          <DaysPill days={task.daysDeviation} />
        </div>
      </div>

      {/* ToDo 一覧（展開時） */}
      {expanded && <TodoList todos={task.todos} taskScope={taskScope} today={today} />}
    </div>
  )
}

// ─── TodoList ─────────────────────────────────────────────────────────────────

import type { TimelineTodo } from '@/types/timeline'

type TodoListProps = {
  todos: TimelineTodo[]
  taskScope: { startDate: Date; endDate: Date }
  today: Date
}

function TodoList({ todos, taskScope, today }: TodoListProps) {
  const { showTodayLine, todayOffsetPct } = calcTodayLine(today, taskScope)
  return (
    <div className="border-t border-gray-100 px-4 pt-1 pb-1">
      {todos.length === 0 ? (
        <p className="text-xs text-gray-400">ToDo がありません</p>
      ) : (
        todos.map((todo) => {
          const { offsetPct: tOffset, widthPct: tWidth } = calcBarPosition(todo, taskScope)
          return (
            <div key={todo.id} className="flex items-center gap-2 py-0.5">
              <span className="min-w-24 shrink-0 text-xs text-gray-600">{todo.name}</span>
              <div className="relative min-w-0 flex-1">
                {showTodayLine && (
                  <div
                    className="pointer-events-none absolute top-0 z-10 h-full border-l border-red-300"
                    style={{ left: `${todayOffsetPct}%` }}
                    aria-label="今日"
                  />
                )}
                <div style={{ marginLeft: `${tOffset}%`, width: `${tWidth}%` }}>
                  <GanttBar
                    actualPct={todo.progressData.actualPct}
                    scheduledPct={todo.progressData.scheduledPct}
                    status={todo.progressData.status}
                  />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ProgressPill
                  actualPct={todo.progressData.actualPct}
                  scheduledPct={todo.progressData.scheduledPct}
                />
                <StatusPill status={todo.progressData.status} />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── AddTaskForm ──────────────────────────────────────────────────────────────

type AddTaskFormProps = {
  milestoneId: string
  projectId: string
  onDone: () => void
}

function AddTaskForm({ milestoneId, projectId, onDone }: AddTaskFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleOpen() {
    setName('')
    setStartDate('')
    setEndDate('')
    setError(null)
    setOpen(true)
  }

  function handleCancel() {
    setOpen(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateAddRowForm(name, startDate, endDate)
    if (err) {
      setError(err)
      return
    }
    setSubmitting(true)
    try {
      await createTask(milestoneId, projectId, name.trim(), new Date(startDate), new Date(endDate))
      setOpen(false)
      setError(null)
      onDone()
    } catch (err: unknown) {
      // Next.js の notFound/redirect は再 throw して正常な制御フローを維持する
      if (
        err !== null &&
        typeof err === 'object' &&
        'digest' in err &&
        typeof (err as { digest: unknown }).digest === 'string' &&
        (err as { digest: string }).digest.startsWith('NEXT_')
      ) {
        throw err
      }
      setError('タスクの追加に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-gray-500 hover:text-blue-600"
      >
        + タスクを追加
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
    >
      <input
        type="text"
        placeholder="タスク名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={submitting}
        className="min-w-32 flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        autoFocus
      />
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        disabled={submitting}
        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      />
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        disabled={submitting}
        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      />
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          追加
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={submitting}
          className="rounded bg-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-300 disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
