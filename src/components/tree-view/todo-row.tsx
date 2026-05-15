'use client'

import type { Todo } from '@prisma/client'

// v4.0 reset スタブ: today / projectStart / projectEnd は S5–S8 で実装される
// バー描画 (period-bar / today-marker) の予約 props。現状未使用。
interface TodoRowProps {
  todo: Pick<Todo, 'id' | 'name' | 'startDate' | 'endDate' | 'actualStartDate' | 'actualEndDate'>
  today: Date
  projectStart: Date
  projectEnd: Date
}

export function TodoRow({ todo }: TodoRowProps) {
  const completed = todo.actualEndDate != null

  return (
    <div className="flex flex-col gap-1 rounded-md py-0.5">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 88px 60px 56px 1fr',
          alignItems: 'center',
        }}
      >
        <div className="flex min-w-0 items-center gap-2 pr-3 pl-[60px]">
          <span className="w-4 shrink-0 text-sm text-green-600" aria-hidden="true">
            {completed ? '✓' : ''}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{todo.name}</span>
        </div>

        <div className="px-1 text-xs text-gray-400">—</div>
        <div className="px-1 text-xs text-gray-400">—</div>
        <div className="px-1 text-xs text-gray-400">—</div>

        <div className="relative" style={{ height: '20px' }}>
          <div className="h-5 rounded bg-slate-100" title="v4.0 reset 中 (S5–S8 で再構築)" />
        </div>
      </div>
    </div>
  )
}
