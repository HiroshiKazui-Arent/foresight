'use client'

import type { Todo } from '@prisma/client'
import { ProgressPill } from '@/components/progress-pill'
import { StatusPill } from '@/components/status-pill'
import { DaysPill } from '@/components/days-pill'
import { GanttBar } from '@/components/gantt/gantt-bar'
import { buildTodoProgressData } from './progress-utils'

interface TodoRowProps {
  todo: Pick<Todo, 'id' | 'name' | 'completed' | 'startDate' | 'endDate'>
  today: Date
  projectStart: Date
  projectEnd: Date
}

export function TodoRow({ todo, today, projectStart, projectEnd }: TodoRowProps) {
  const progress = buildTodoProgressData(todo, today)

  return (
    <div className="ml-12 flex flex-col gap-1 rounded-md py-0.5">
      {/* 2カラムGrid: 左=ラベル+ピル、右=ガントバー */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, auto) 1fr',
          alignItems: 'center',
        }}
      >
        {/* 左カラム: チェックマーク + ToDo名 + ピル群 */}
        <div className="flex items-center gap-2">
          {/* completed チェックマーク (StatusPill がセマンティクスを担うため aria-hidden) */}
          <span className="w-4 shrink-0 text-sm text-green-600" aria-hidden="true">
            {todo.completed ? '✓' : ''}
          </span>

          {/* ToDo 名 (読み取り専用) */}
          <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{todo.name}</span>

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
            rowStart={todo.startDate}
            rowEnd={todo.endDate}
            today={today}
            actualPct={progress.actualPct}
            scheduledPct={progress.scheduledPct}
            status={progress.status}
          />
        </div>
      </div>
    </div>
  )
}
