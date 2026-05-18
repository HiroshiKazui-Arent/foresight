'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ProgressInputRow } from '@/components/progress-input/progress-input-row'
import { TaskProgressSummary } from '@/components/progress-input/task-progress-summary'
import { updateTodoActualDates } from '@/server/actions/progress'

interface TodoData {
  id: string
  name: string
  startDate: Date
  endDate: Date
  actualStartDate: Date | null
  actualEndDate: Date | null
}

interface ProgressClientProps {
  projectId: string
  taskName: string
  todos: TodoData[]
  scheduledPct: number
}

export function ProgressClient({
  projectId,
  taskName,
  todos: initialTodos,
  scheduledPct,
}: ProgressClientProps) {
  const [todos, setTodos] = useState<TodoData[]>(initialTodos)

  async function handleSave(
    todoId: string,
    data: { actualStartDate: Date | null; actualEndDate: Date | null },
  ) {
    const updated = await updateTodoActualDates(todoId, projectId, data)
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId
          ? { ...t, actualStartDate: updated.actualStartDate, actualEndDate: updated.actualEndDate }
          : t,
      ),
    )
  }

  const completedCount = todos.filter((t) => t.actualEndDate !== null).length

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* メインパネル: ToDo 入力一覧 */}
      <div className="flex flex-1 flex-col gap-3">
        <header>
          <h1 className="text-lg font-semibold">進捗入力: {taskName}</h1>
          <p className="text-xs text-gray-500">
            ToDo に対して着手日 / 完了日を入力します。進捗は 0% または 100%。
          </p>
        </header>

        <div className="flex flex-col gap-1">
          {todos.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
              このタスクには ToDo が登録されていません。工程管理画面から追加してください。
            </div>
          ) : (
            todos.map((todo) => (
              <ProgressInputRow
                key={todo.id}
                todoId={todo.id}
                name={todo.name}
                scheduledStartDate={todo.startDate}
                scheduledEndDate={todo.endDate}
                actualStartDate={todo.actualStartDate}
                actualEndDate={todo.actualEndDate}
                onSave={(data) => handleSave(todo.id, data)}
              />
            ))
          )}
        </div>
      </div>

      {/* サイドパネル: タスクサマリー */}
      <aside className="lg:w-80">
        <TaskProgressSummary
          completed={completedCount}
          total={todos.length}
          scheduledPct={scheduledPct}
        />
        <Link
          href={`/projects/${projectId}`}
          className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-300"
        >
          ガント表示へ戻る
        </Link>
      </aside>
    </div>
  )
}
