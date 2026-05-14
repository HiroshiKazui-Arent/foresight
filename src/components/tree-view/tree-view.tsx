'use client'

import { useCallback, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import type { Milestone, Project, Task, Todo } from '@prisma/client'
import { reorderMilestones, updateMilestone, createMilestone } from '@/server/actions/milestone'
import { reorderTasks, updateTask, createTask } from '@/server/actions/task'
import { createTodo } from '@/server/actions/todo'
import { TodayLine } from '@/components/gantt/today-line'
import { TimelineHeader } from '@/components/gantt/timeline-header'
import { xForDate } from '@/components/gantt/timeline-utils'
import { calcProjectDateRange } from './project-date-range'
import { MilestoneRow } from './milestone-row'
import { AddRowButton } from './add-row-button'

type TaskWithTodos = Task & { todos: Todo[] }
type MilestoneWithTasks = Milestone & { tasks: TaskWithTodos[] }
type ProjectWithMilestones = Project & { milestones: MilestoneWithTasks[] }

interface TreeViewProps {
  project: ProjectWithMilestones
  today: Date
  mode?: 'view' | 'input'
}

export function TreeView({ project, today, mode = 'view' }: TreeViewProps) {
  const [milestones, setMilestones] = useState<MilestoneWithTasks[]>(project.milestones)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const { start: projectStart, end: projectEnd } = calcProjectDateRange(
    milestones,
    project.startDate,
    project.endDate,
  )
  const todayX = xForDate(today, projectStart, projectEnd)

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (mode !== 'view') return
      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeId = String(active.id)
      const overId = String(over.id)

      const milestoneIds = milestones.map((m) => m.id)
      if (milestoneIds.includes(activeId) && milestoneIds.includes(overId)) {
        const oldIndex = milestoneIds.indexOf(activeId)
        const newIndex = milestoneIds.indexOf(overId)
        const reordered = arrayMove(milestones, oldIndex, newIndex)
        const previous = milestones
        setMilestones(reordered)
        try {
          await reorderMilestones(
            project.id,
            reordered.map((m) => m.id),
          )
        } catch {
          setMilestones(previous)
        }
        return
      }

      for (const milestone of milestones) {
        const taskIds = milestone.tasks.map((t) => t.id)
        if (taskIds.includes(activeId) && taskIds.includes(overId)) {
          const oldIndex = taskIds.indexOf(activeId)
          const newIndex = taskIds.indexOf(overId)
          const reorderedTasks = arrayMove(milestone.tasks, oldIndex, newIndex)
          const previous = milestones
          setMilestones((prev) =>
            prev.map((m) => (m.id === milestone.id ? { ...m, tasks: reorderedTasks } : m)),
          )
          try {
            await reorderTasks(
              milestone.id,
              project.id,
              reorderedTasks.map((t) => t.id),
            )
          } catch {
            setMilestones(previous)
          }
          return
        }
      }
    },
    [milestones, project.id, mode],
  )

  const handleUpdateMilestone = useCallback(
    async (id: string, name: string) => {
      await updateMilestone(id, project.id, { name })
      setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)))
    },
    [project.id],
  )

  const handleAddMilestone = useCallback(
    async (name: string, startDate: Date, endDate: Date) => {
      const created = await createMilestone(project.id, name, startDate, endDate)
      setMilestones((prev) => [...prev, { ...created, tasks: [] }])
    },
    [project.id],
  )

  const handleAddTask = useCallback(
    async (milestoneId: string, name: string, startDate: Date, endDate: Date) => {
      const created = await createTask(milestoneId, project.id, name, startDate, endDate)
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId ? { ...m, tasks: [...m.tasks, { ...created, todos: [] }] } : m,
        ),
      )
    },
    [project.id],
  )

  const handleUpdateTask = useCallback(
    async (id: string, name: string) => {
      await updateTask(id, project.id, { name })
      setMilestones((prev) =>
        prev.map((m) => ({
          ...m,
          tasks: m.tasks.map((t) => (t.id === id ? { ...t, name } : t)),
        })),
      )
    },
    [project.id],
  )

  const handleAddTodo = useCallback(
    async (taskId: string, name: string, startDate: Date, endDate: Date) => {
      const created = await createTodo(taskId, project.id, name, startDate, endDate)
      setMilestones((prev) =>
        prev.map((m) => ({
          ...m,
          tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, todos: [...t.todos, created] } : t)),
        })),
      )
    },
    [project.id],
  )

  const milestoneIds = milestones.map((m) => m.id)

  return (
    <div className="relative flex flex-col gap-2">
      {/* タイムラインヘッダー: 右カラムに月ラベルと今日バッジ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, auto) 1fr' }}>
        <div />
        <div className="relative overflow-hidden">
          <TimelineHeader projectStart={projectStart} projectEnd={projectEnd} today={today} />
        </div>
      </div>

      <DndContext
        id="tree-view-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={milestoneIds} strategy={verticalListSortingStrategy}>
          {milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              projectId={project.id}
              today={today}
              projectStart={projectStart}
              projectEnd={projectEnd}
              mode={mode}
              onUpdateMilestone={handleUpdateMilestone}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onAddTodo={handleAddTodo}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="pl-3">
        <AddRowButton label="マイルストーンを追加" onAdd={handleAddMilestone} />
      </div>

      {/* 今日線オーバーレイ: position:absolute でコンテナ全体を貫き、右カラムに縦線を描く */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, auto) 1fr' }}
        aria-hidden="true"
      >
        <div />
        <div className="relative">
          <TodayLine todayX={todayX} />
        </div>
      </div>
    </div>
  )
}
