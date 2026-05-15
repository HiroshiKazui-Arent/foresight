'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Milestone, Task, Todo } from '@prisma/client'
import { InlineEdit } from './inline-edit'
import { AddRowButton } from './add-row-button'
import { TaskRow } from './task-row'

type TaskWithTodos = Task & { todos: Todo[] }
type MilestoneWithTasks = Milestone & { tasks: TaskWithTodos[] }

interface MilestoneRowProps {
  milestone: MilestoneWithTasks
  today: Date
  projectStart: Date
  projectEnd: Date
  mode?: 'view' | 'input'
  onUpdateMilestone: (id: string, name: string) => Promise<void>
  onAddTask: (milestoneId: string, name: string, startDate: Date, endDate: Date) => Promise<void>
  onUpdateTask: (id: string, name: string) => Promise<void>
  onAddTodo: (taskId: string, name: string, startDate: Date, endDate: Date) => Promise<void>
}

export function MilestoneRow({
  milestone,
  today,
  projectStart,
  projectEnd,
  mode = 'view',
  onUpdateMilestone,
  onAddTask,
  onUpdateTask,
  onAddTodo,
}: MilestoneRowProps) {
  const [expanded, setExpanded] = useState(true)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: milestone.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const taskIds = milestone.tasks.map((t) => t.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group mb-2 rounded-md border border-gray-200 bg-white shadow-sm"
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 88px 60px 56px 1fr',
          alignItems: 'center',
        }}
      >
        <div className="flex min-w-0 items-center gap-2 px-3 py-2">
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

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-500 transition-transform hover:text-gray-700"
            aria-label={expanded ? '折りたたむ' : '展開する'}
            aria-expanded={expanded}
          >
            {expanded ? '▼' : '▶'}
          </button>

          <InlineEdit
            value={milestone.name}
            onSave={(newName) => onUpdateMilestone(milestone.id, newName)}
            className="truncate font-semibold"
          />
        </div>

        <div className="px-1 text-xs text-gray-400">—</div>
        <div className="px-1 text-xs text-gray-400">—</div>
        <div className="px-1 text-xs text-gray-400">—</div>

        <div className="relative" style={{ height: '24px' }}>
          <div className="h-6 rounded bg-slate-100" title="v4.0 reset 中 (S5–S8 で再構築)" />
        </div>
      </div>

      {expanded && (
        <div className="pb-2">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {milestone.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                projectStart={projectStart}
                projectEnd={projectEnd}
                mode={mode}
                onUpdateTask={onUpdateTask}
                onAddTodo={onAddTodo}
              />
            ))}
          </SortableContext>

          {mode !== 'input' && (
            <div className="pl-12">
              <AddRowButton
                label="タスクを追加"
                onAdd={(name, startDate, endDate) =>
                  onAddTask(milestone.id, name, startDate, endDate)
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
