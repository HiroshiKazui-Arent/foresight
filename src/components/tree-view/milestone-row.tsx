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
      {/* 5カラムGrid: name / progress / status / days / bar
          全行で同一テンプレートを使い、各列固定幅 + バーは 1fr。
          ピル群は名前のすぐ右に並び、視線移動を最小化する。 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 88px 60px 56px 1fr',
          alignItems: 'center',
        }}
      >
        {/* 1. 名前カラム: drag + chevron + name + link */}
        <div className="flex min-w-0 items-center gap-2 px-3 py-2">
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
              className="truncate font-semibold"
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
        <div className="relative" style={{ height: '24px' }}>
          <GanttBar
            projectStart={projectStart}
            projectEnd={projectEnd}
            rowStart={milestone.startDate}
            rowEnd={milestone.endDate}
            today={today}
            actualPct={progress.actualPct}
            scheduledPct={progress.scheduledPct}
            status={progress.status}
          />
        </div>
      </div>

      {/* タスク一覧（折りたたみ可能）— px-2 を廃止し全行 grid 列を統一 */}
      {expanded && (
        <div className="pb-2">
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

          {/* タスク追加ボタン (view モードのみ): タスク行ラベルインデント (pl-9) + タスク子要素相当 */}
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
