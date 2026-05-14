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
  const [expanded, setExpanded] = useState(false)
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
      className="group ml-6 flex flex-col gap-1 rounded-md border border-transparent py-1 hover:border-gray-200 hover:bg-gray-50"
    >
      {/* 2カラムGrid: 左=ラベル+ピル、右=ガントバー */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, auto) 1fr',
          alignItems: 'center',
        }}
      >
        {/* 左カラム: ヘッダー */}
        <div className="flex items-center gap-2">
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

          {/* タスク名（インライン編集） + ToDo 展開トグル + V3 遷移リンク */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <InlineEdit
              value={task.name}
              onSave={(newName) => onUpdateTask(task.id, newName)}
              className="text-sm font-medium"
            />
            {mode !== 'input' && task.todos.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="shrink-0 rounded p-1 text-xs text-gray-400 hover:text-gray-700"
                aria-label={expanded ? 'ToDo を折りたたむ' : 'ToDo を展開する'}
                aria-expanded={expanded}
                aria-controls={todoListId}
              >
                {expanded ? '▾' : '▸'}
              </button>
            )}
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

          {/* 進捗情報 */}
          <div className="flex shrink-0 items-center gap-2">
            <ProgressPill actualPct={progress.actualPct} scheduledPct={progress.scheduledPct} />
            <StatusPill status={progress.status} />
            <DaysPill days={progress.daysDeviation} />
          </div>
        </div>

        {/* 右カラム: ガントバー */}
        <div className="relative pr-2" style={{ height: '20px' }}>
          <GanttBar
            projectStart={projectStart}
            projectEnd={projectEnd}
            rowStart={task.startDate}
            rowEnd={task.endDate}
            today={today}
            actualPct={progress.actualPct}
            scheduledPct={progress.scheduledPct}
            status={progress.status}
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

      {/* input モード: ToDo 行の進捗入力 */}
      {mode === 'input' && task.todos.length > 0 && (
        <div className="flex flex-col">
          {task.todos.map((todo) => (
            <TodoInputRow key={todo.id} todo={todo} projectId={projectId} />
          ))}
        </div>
      )}

      {/* ToDo 追加ボタン (view モードのみ) */}
      {mode !== 'input' && (
        <div className="ml-6">
          <AddRowButton
            label="ToDo を追加"
            onAdd={(name, startDate, endDate) => onAddTodo(task.id, name, startDate, endDate)}
          />
        </div>
      )}
    </div>
  )
}
