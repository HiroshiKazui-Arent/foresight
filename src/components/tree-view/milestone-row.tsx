'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Milestone, Task, Todo } from '@prisma/client'
import { ProgressPill } from '@/components/progress-pill'
import { StatusPill } from '@/components/status-pill'
import { DaysPill } from '@/components/days-pill'
import { GanttBar } from '@/components/gantt/gantt-bar'
import Link from 'next/link'
import { InlineEdit } from './inline-edit'
import { AddRowButton } from './add-row-button'
import { TaskRow } from './task-row'
import { buildMilestoneProgressData } from './progress-utils'

type TaskWithTodos = Task & { todos: Todo[] }
type MilestoneWithTasks = Milestone & { tasks: TaskWithTodos[] }

interface MilestoneRowProps {
  milestone: MilestoneWithTasks
  projectId: string
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
  projectId,
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

  const progress = buildMilestoneProgressData(milestone, today)
  const taskIds = milestone.tasks.map((t) => t.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group mb-2 rounded-md border border-gray-200 bg-white shadow-sm"
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
        <div className="flex items-center gap-2 px-3 py-2">
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

          {/* 折りたたみボタン */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-500 transition-transform hover:text-gray-700"
            aria-label={expanded ? '折りたたむ' : '展開する'}
            aria-expanded={expanded}
          >
            {expanded ? '▼' : '▶'}
          </button>

          {/* マイルストーン名（インライン編集）+ V2 リンク */}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <InlineEdit
              value={milestone.name}
              onSave={(newName) => onUpdateMilestone(milestone.id, newName)}
              className="font-semibold"
            />
            {mode !== 'input' && (
              <Link
                href={`/projects/${projectId}/milestones/${milestone.id}`}
                className="shrink-0 rounded p-1 text-xs text-gray-400 hover:text-blue-500"
                aria-label="タイムラインビューで開く"
                title="タイムラインビュー"
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
        <div className="relative pr-4" style={{ height: '24px' }}>
          <GanttBar
            projectStart={projectStart}
            projectEnd={projectEnd}
            rowStart={milestone.startDate}
            rowEnd={milestone.endDate}
            actualPct={progress.actualPct}
            scheduledPct={progress.scheduledPct}
            status={progress.status}
          />
        </div>
      </div>

      {/* タスク一覧（折りたたみ可能） */}
      {expanded && (
        <div className="px-2 pb-2">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {milestone.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                projectId={projectId}
                projectStart={projectStart}
                projectEnd={projectEnd}
                mode={mode}
                onUpdateTask={onUpdateTask}
                onAddTodo={onAddTodo}
              />
            ))}
          </SortableContext>

          {/* タスク追加ボタン (view モードのみ) */}
          {mode !== 'input' && (
            <AddRowButton
              label="タスクを追加"
              onAdd={(name, startDate, endDate) =>
                onAddTask(milestone.id, name, startDate, endDate)
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
