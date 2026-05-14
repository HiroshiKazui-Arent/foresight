'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GanttBar } from '@/components/gantt/gantt-bar'
import { ProgressPill } from '@/components/progress-pill'
import { StatusPill } from '@/components/status-pill'
import { DaysPill } from '@/components/days-pill'
import { createTodo, updateTodo, deleteTodo } from '@/server/actions/todo'
import { toDateInputValue, fromDateInputValue } from '@/lib/date-utils'
import { validateAddRowForm } from '@/components/tree-view/add-row-utils'
import { calcTodoBarPosition, getBottleneckClass } from './task-detail-utils'
import type { TaskWithDetail, TodoWithProgress } from '@/types/task-detail'

type Props = {
  task: TaskWithDetail
  todos: TodoWithProgress[]
  projectId: string
  today: Date
}

function isNextControlFlow(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'digest' in e &&
    typeof (e as { digest: unknown }).digest === 'string' &&
    ((e as { digest: string }).digest.startsWith('NEXT_') ||
      (e as { digest: string }).digest === 'DYNAMIC_SERVER_USAGE')
  )
}

export function TaskDetailView({ task, todos, projectId, today }: Props) {
  const router = useRouter()

  const scopeRangeMs = task.endDate.getTime() - task.startDate.getTime()
  const todayOffsetPct =
    scopeRangeMs > 0 ? ((today.getTime() - task.startDate.getTime()) / scopeRangeMs) * 100 : -1
  const showTodayLine = todayOffsetPct >= 0 && todayOffsetPct <= 100

  // ─── ToDo 名インライン編集 ────────────────────────────────────────────────

  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  async function handleNameSave(id: string) {
    if (!editingNameValue.trim()) {
      setNameError('名前を入力してください')
      return
    }
    try {
      await updateTodo(id, projectId, { name: editingNameValue })
      setEditingNameId(null)
      setNameError(null)
      router.refresh()
    } catch (e) {
      if (isNextControlFlow(e)) throw e
      setNameError('名前の更新に失敗しました')
    }
  }

  // ─── ToDo 日付インライン編集 ──────────────────────────────────────────────

  const [editingDateId, setEditingDateId] = useState<string | null>(null)
  const [editingStartDate, setEditingStartDate] = useState('')
  const [editingEndDate, setEditingEndDate] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)

  async function handleDateSave(id: string) {
    if (!editingStartDate) {
      setDateError('開始日を入力してください')
      return
    }
    if (!editingEndDate) {
      setDateError('終了日を入力してください')
      return
    }
    const start = fromDateInputValue(editingStartDate)
    const end = fromDateInputValue(editingEndDate)
    if (start.getTime() >= end.getTime()) {
      setDateError('開始日は終了日より前にしてください')
      return
    }
    try {
      await updateTodo(id, projectId, { startDate: start, endDate: end })
      setEditingDateId(null)
      setDateError(null)
      router.refresh()
    } catch (e) {
      if (isNextControlFlow(e)) throw e
      setDateError('日付の更新に失敗しました')
    }
  }

  // ─── ToDo 削除 ────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!window.confirm('このToDo を削除しますか？')) return
    try {
      await deleteTodo(id, projectId)
      router.refresh()
    } catch (e) {
      if (isNextControlFlow(e)) throw e
      console.error(e)
    }
  }

  // ─── ToDo 追加フォーム ────────────────────────────────────────────────────

  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState('')
  const [addStartDate, setAddStartDate] = useState('')
  const [addEndDate, setAddEndDate] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateAddRowForm(addName, addStartDate, addEndDate)
    if (err) {
      setAddError(err)
      return
    }
    try {
      await createTodo(
        task.id,
        projectId,
        addName,
        fromDateInputValue(addStartDate),
        fromDateInputValue(addEndDate),
      )
      router.refresh()
      setShowAddForm(false)
      setAddName('')
      setAddStartDate('')
      setAddEndDate('')
      setAddError(null)
    } catch (e) {
      if (isNextControlFlow(e)) throw e
      setAddError('追加に失敗しました')
    }
  }

  return (
    <div className="space-y-4">
      {/* タスクサマリ行 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">タスク進捗</span>
          <ProgressPill actualPct={task.actualPct} scheduledPct={task.scheduledPct} />
          <StatusPill status={task.status} />
          <DaysPill days={task.daysDeviation} />
        </div>
        <div className="relative">
          <GanttBar
            projectStart={task.startDate}
            projectEnd={task.endDate}
            rowStart={task.startDate}
            rowEnd={task.endDate}
            today={today}
            actualPct={task.actualPct}
            scheduledPct={task.scheduledPct}
            renderStatus={task.renderStatus}
          />
          {showTodayLine && (
            <div
              className="pointer-events-none absolute top-0 h-full w-px bg-blue-500"
              style={{ left: `${todayOffsetPct}%` }}
              aria-label="今日線"
            />
          )}
        </div>
      </div>

      {/* ToDo 一覧 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">ToDo 一覧</h2>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          >
            +
          </button>
        </div>

        {/* ToDo 追加フォーム */}
        {showAddForm && (
          <form
            onSubmit={handleAddSubmit}
            className="flex flex-wrap items-end gap-2 rounded border border-blue-200 bg-blue-50 p-3"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">名前</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                placeholder="ToDo 名"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">開始日</label>
              <input
                type="date"
                value={addStartDate}
                onChange={(e) => setAddStartDate(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">終了日</label>
              <input
                type="date"
                value={addEndDate}
                onChange={(e) => setAddEndDate(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              追加
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setAddError(null)
              }}
              className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
            >
              キャンセル
            </button>
            {addError && <p className="w-full text-xs text-red-600">{addError}</p>}
          </form>
        )}

        {/* 空状態 */}
        {todos.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">ToDo がありません</p>
        )}

        {/* ToDo 行 */}
        {todos.map((todo) => {
          const { offsetPct, widthPct } = calcTodoBarPosition(
            task.startDate.getTime(),
            task.endDate.getTime(),
            todo.startDate.getTime(),
            todo.endDate.getTime(),
          )
          const bottleneckCls = getBottleneckClass(todo.progressData.status)

          return (
            <div
              key={todo.id}
              className={`rounded-md border border-gray-200 bg-white p-3 ${bottleneckCls}`}
            >
              {/* ToDo 名 */}
              <div className="mb-2 flex items-center gap-2">
                {editingNameId === todo.id ? (
                  <div className="flex flex-1 flex-col gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={editingNameValue}
                      onChange={(e) => setEditingNameValue(e.target.value)}
                      onBlur={() => handleNameSave(todo.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNameSave(todo.id)
                        if (e.key === 'Escape') {
                          setEditingNameId(null)
                          setNameError(null)
                        }
                      }}
                      className="rounded border border-blue-400 px-2 py-0.5 text-sm"
                    />
                    {nameError && <p className="text-xs text-red-600">{nameError}</p>}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex-1 text-left text-sm font-medium text-gray-800 hover:underline"
                    onClick={() => {
                      setEditingNameId(todo.id)
                      setEditingNameValue(todo.name)
                    }}
                  >
                    {todo.name}
                  </button>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  <ProgressPill
                    actualPct={todo.progressData.actualPct}
                    scheduledPct={todo.progressData.scheduledPct}
                  />
                  <StatusPill status={todo.progressData.status} />
                  <DaysPill days={todo.progressData.daysDeviation} />
                  <button
                    type="button"
                    onClick={() => handleDelete(todo.id)}
                    className="rounded p-1 text-xs text-gray-400 hover:text-red-500"
                    aria-label="ToDo を削除"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 日付インライン編集 */}
              <div className="mb-2">
                {editingDateId === todo.id ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={editingStartDate}
                        onChange={(e) => setEditingStartDate(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleDateSave(todo.id)
                          if (e.key === 'Escape') {
                            setEditingDateId(null)
                            setDateError(null)
                          }
                        }}
                        className="rounded border border-blue-400 px-2 py-0.5 text-xs"
                      />
                      <span className="text-xs text-gray-400">〜</span>
                      <input
                        type="date"
                        value={editingEndDate}
                        onChange={(e) => setEditingEndDate(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleDateSave(todo.id)
                          if (e.key === 'Escape') {
                            setEditingDateId(null)
                            setDateError(null)
                          }
                        }}
                        className="rounded border border-blue-400 px-2 py-0.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleDateSave(todo.id)}
                        className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDateId(null)
                          setDateError(null)
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                    {dateError && <p className="text-xs text-red-600">{dateError}</p>}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-gray-400 hover:text-blue-500"
                    onClick={() => {
                      setEditingDateId(todo.id)
                      setEditingStartDate(toDateInputValue(todo.startDate))
                      setEditingEndDate(toDateInputValue(todo.endDate))
                    }}
                  >
                    {toDateInputValue(todo.startDate)} 〜 {toDateInputValue(todo.endDate)}
                  </button>
                )}
              </div>

              {/* ガントバー（タスクスコープ内の相対位置） */}
              <div className="relative h-4 overflow-hidden rounded bg-gray-100">
                {showTodayLine && (
                  <div
                    className="pointer-events-none absolute top-0 z-10 h-full w-px bg-blue-500"
                    style={{ left: `${todayOffsetPct}%` }}
                  />
                )}
                <div
                  className="absolute top-0 h-full"
                  style={{ marginLeft: `${offsetPct}%`, width: `${widthPct}%` }}
                >
                  <GanttBar
                    projectStart={todo.startDate}
                    projectEnd={todo.endDate}
                    rowStart={todo.startDate}
                    rowEnd={todo.endDate}
                    today={today}
                    actualPct={todo.progressData.actualPct}
                    scheduledPct={todo.progressData.scheduledPct}
                    renderStatus={todo.progressData.renderStatus}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
