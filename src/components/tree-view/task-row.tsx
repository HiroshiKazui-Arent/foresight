'use client'

import { useState, useId } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Todo } from '@prisma/client'
import { InlineEdit } from './inline-edit'
import { AddRowButton } from './add-row-button'
import { TodoRow } from './todo-row'

type TaskWithTodos = Task & { todos: Todo[] }

interface TaskRowProps {
  task: TaskWithTodos
  today: Date
  projectStart: Date
  projectEnd: Date
  mode?: 'view' | 'input'
  onUpdateTask: (id: string, name: string) => Promise<void>
  onAddTodo: (taskId: string, name: string, startDate: Date, endDate: Date) => Promise<void>
}

export function TaskRow({
  task,
  today,
  projectStart,
  projectEnd,
  mode = 'view',
  onUpdateTask,
  onAddTodo,
}: TaskRowProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex flex-col gap-1 rounded-md border border-transparent py-1 hover:border-gray-200 hover:bg-gray-50"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 88px 60px 56px 1fr',
          alignItems: 'center',
        }}
      >
        <div className="flex min-w-0 items-center gap-2 pr-3 pl-9">
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

          <InlineEdit
            value={task.name}
            onSave={(newName) => onUpdateTask(task.id, newName)}
            className="truncate text-sm font-medium"
          />
        </div>

        <div className="px-1 text-xs text-gray-400">—</div>
        <div className="px-1 text-xs text-gray-400">—</div>
        <div className="px-1 text-xs text-gray-400">—</div>

        <div className="relative" style={{ height: '20px' }}>
          <div className="h-5 rounded bg-slate-100" title="v4.0 reset 中 (S5–S8 で再構築)" />
        </div>
      </div>

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
