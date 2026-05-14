'use client'

import { useState, useId } from 'react'
import Link from 'next/link'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Todo } from '@prisma/client'
import { ProgressPill } from '@/components/progress-pill'
import { StatusPill } from '@/components/status-pill'
import { DaysPill } from '@/components/days-pill'
import { GanttBar } from '@/components/gantt/gantt-bar'
import { TodoInputRow } from '@/components/daily-report/todo-input-row'
import { InlineEdit } from './inline-edit'
import { AddRowButton } from './add-row-button'
import { buildTaskProgressData } from './progress-utils'
import { TodoRow } from './todo-row'

type TaskWithTodos = Task & { todos: Todo[] }

interface TaskRowProps {
  task: TaskWithTodos
  today: Date
  projectId: string
  projectStart: Date
  projectEnd: Date
  mode?: 'view' | 'input'
  onUpdateTask: (id: string, name: string) => Promise<void>
  onAddTodo: (taskId: string, name: string, startDate: Date, endDate: Date) => Promise<void>
}

export function TaskRow({
  task,
  today,
  projectId,
  projectStart,
  projectEnd,
  mode = 'view',
  onUpdateTask,
  onAddTodo,
}: TaskRowProps) {
  // デフォルト展開: マイルストーン → タスク → ToDo の 3 階層を最初から見せる
  // (折りたたみのままだと ToDo が DB に存在しても UI 上見えず、進捗度の根拠が
  // ユーザーに伝わらないため)
  const [expanded, setExpanded] = useState(true)
  const todoListId = useId()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const progress = buildTaskProgressData(task, today)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex flex-col gap-1 rounded-md border border-transparent py-1 hover:border-gray-200 hover:bg-gray-50"
    >
      {/* 5カラムGrid (milestone と同一テンプレート): name / progress / status / days / bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 88px 60px 56px 1fr',
          alignItems: 'center',
        }}
      >
        {/* 1. 名前カラム: drag + chevron + name + link (pl-9 でタスク階層インデント) */}
        <div className="flex min-w-0 items-center gap-2 pr-3 pl-9">
          {/* ドラッグハンドル (view モードのみ) */}
          {mode !== 'input' && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="cursor-grab p-1 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-500 active:cursor-grabbing"
              aria-label="ドラッグして並び替え"
            >
              ⠿
            </button>
          )}

          {/* ToDo 展開トグル (マイルストーンと同サイズ・タスク名の前に配置) */}
          {mode !== 'input' && task.todos.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="text-gray-500 transition-transform hover:text-gray-700"
              aria-label={expanded ? 'ToDo を折りたたむ' : 'ToDo を展開する'}
              aria-expanded={expanded}
              aria-controls={todoListId}
            >
              {expanded ? '▼' : '▶'}
            </button>
          )}

          {/* タスク名（インライン編集） + V3 遷移リンク */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <InlineEdit
              value={task.name}
              onSave={(newName) => onUpdateTask(task.id, newName)}
              className="truncate text-sm font-medium"
            />
            {mode !== 'input' && (
              <Link
                href={`/projects/${projectId}/tasks/${task.id}`}
                className="shrink-0 rounded p-1 text-xs text-gray-400 hover:text-blue-500"
                aria-label="タスク詳細を開く"
                title="タスク詳細"
              >
                →
              </Link>
            )}
          </div>
        </div>

        {/* 2. 進捗 % */}
        <div className="flex items-center justify-start px-1">
          <ProgressPill actualPct={progress.actualPct} scheduledPct={progress.scheduledPct} />
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
            rowStart={task.startDate}
            rowEnd={task.endDate}
            today={today}
            actualPct={progress.actualPct}
            scheduledPct={progress.scheduledPct}
            renderStatus={progress.renderStatus}
          />
        </div>
      </div>

      {/* view モード: ToDo をガントバー付きで展開表示 */}
      {mode !== 'input' && expanded && task.todos.length > 0 && (
        <div id={todoListId} className="flex flex-col">
          {task.todos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              today={today}
              projectStart={projectStart}
              projectEnd={projectEnd}
            />
          ))}
        </div>
      )}

      {/* input モード: ToDo 行の進捗入力 (V1 と同じ 5 カラム + 完了チェックボックス) */}
      {mode === 'input' && task.todos.length > 0 && (
        <div className="flex flex-col">
          {task.todos.map((todo) => (
            <TodoInputRow
              key={todo.id}
              todo={todo}
              projectId={projectId}
              today={today}
              projectStart={projectStart}
              projectEnd={projectEnd}
            />
          ))}
        </div>
      )}

      {/* ToDo 追加ボタン (view モード + タスク展開時のみ):
          折りたたみ中に追加しても追加した ToDo が見えないため非表示にする */}
      {mode !== 'input' && expanded && (
        <div className="pl-[60px]">
          <AddRowButton
            label="ToDo を追加"
            onAdd={(name, startDate, endDate) => onAddTodo(task.id, name, startDate, endDate)}
          />
        </div>
      )}
    </div>
  )
}
