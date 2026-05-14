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
    <div className="flex flex-col gap-1 rounded-md py-0.5">
      {/* 5カラムGrid (milestone/task と同一テンプレート): name / progress / status / days / bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 88px 60px 56px 1fr',
          alignItems: 'center',
        }}
      >
        {/* 1. 名前カラム: checkmark + ToDo 名 (pl-[60px] で ToDo 階層インデント) */}
        <div className="flex min-w-0 items-center gap-2 pr-3 pl-[60px]">
          {/* completed チェックマーク (StatusPill がセマンティクスを担うため aria-hidden) */}
          <span className="w-4 shrink-0 text-sm text-green-600" aria-hidden="true">
            {todo.completed ? '✓' : ''}
          </span>

          {/* ToDo 名 (読み取り専用) */}
          <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{todo.name}</span>
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
