'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ProgressInputRow } from '@/components/progress-input/progress-input-row'
import { TaskProgressSummary } from '@/components/progress-input/task-progress-summary'
import { updateTodoActualDates } from '@/server/actions/progress'
import type { GanttRow } from '@/lib/gantt-rows'
import { formatScheduledPeriod } from '@/lib/date-utils'

// ---- 純関数エクスポート (テスト用) ----

/**
 * Dialog の open 状態変化ハンドラーを生成する。
 *
 * - open=false (クローズ) のとき router.refresh() を 1 回呼び出し、
 *   Server Component を再実行してガントバー / 進捗% / サマリーを最新化する。
 * - open=true (オープン) のとき任意の onOpen コールバックを実行 (state 再同期用)。
 * - テスト時は router / setOpen を直接渡して検証できる純関数として公開。
 */
export function makeOpenChangeHandler(
  router: { refresh: () => void },
  setOpen: (open: boolean) => void,
  onOpen?: () => void,
) {
  return (next: boolean) => {
    setOpen(next)
    if (next) {
      if (onOpen) onOpen()
    } else {
      router.refresh()
    }
  }
}

// ---- 内部コンテンツ (テスト用に別エクスポート) ----

interface TodoItem {
  id: string
  name: string
  startDate: Date
  endDate: Date
  actualStartDate: Date | null
  actualEndDate: Date | null
}

interface ContentProps {
  taskName: string
  /** Task の予定開始日 (M/D 表示用) */
  taskStartDate: Date
  /** Task の予定期日 (M/D 表示用) */
  taskEndDate: Date
  /** Task の予定進捗 % (0-100, 表示時は Math.round で整数化) */
  taskScheduledPct: number
  todos: TodoItem[]
  onSave: (
    todoId: string,
    data: { actualStartDate: Date | null; actualEndDate: Date | null },
  ) => Promise<void>
  /** 「閉じる」ボタンを描画するか。Dialog 外でテストする場合は false を渡す */
  showCloseButton?: boolean
}

/**
 * Dialog 内コンテンツ。
 * Dialog コンテキスト不要の純粋な React コンポーネントとして実装し、
 * node 環境 (SSR + renderToStaticMarkup) でも内容を検証できる。
 *
 * DialogClose だけは Dialog コンテキストが必要なため、
 * テスト時には DialogClose なしの環境でも問題なく動作する
 * (PortalClose が呼ばれないだけで crash しない)。
 */
export function TaskProgressContent({
  taskName,
  taskStartDate,
  taskEndDate,
  taskScheduledPct,
  todos,
  onSave,
  showCloseButton = true,
}: ContentProps) {
  const completedCount = todos.filter((t) => t.actualEndDate !== null).length
  return (
    // ToDo 件数が多い Task では Dialog 全体がビューポートを超えうるため、
    // 内部スクロール (max-h + overflow-y-auto) で「閉じる」ボタンへ常に到達できるようにする。
    <div>
      <h2 className="mb-1 text-lg font-semibold">進捗入力: {taskName}</h2>
      <p className="mb-4 text-xs text-gray-500">
        {formatScheduledPeriod(taskStartDate, taskEndDate)}
      </p>
      <div className="flex flex-col gap-3">
        {todos.length === 0 ? (
          <div className="rounded border border-dashed px-4 py-8 text-center text-sm text-gray-500">
            このタスクには ToDo が登録されていません。
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
              onSave={(d) => onSave(todo.id, d)}
            />
          ))
        )}
        <TaskProgressSummary
          completed={completedCount}
          total={todos.length}
          scheduledPct={taskScheduledPct}
        />
        {showCloseButton && (
          <div className="flex justify-end">
            <DialogClose asChild>
              <Button variant="secondary">閉じる</Button>
            </DialogClose>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Modal 本体 ----

interface Props {
  /** type === 'task' の GanttRow。children に ToDo 行が入る */
  task: GanttRow
  projectId: string
}

function mapChildrenToTodos(children: GanttRow[]): TodoItem[] {
  return children.map((c) => ({
    id: c.id,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    actualStartDate: c.actualStartDate,
    actualEndDate: c.actualEndDate,
  }))
}

export function TaskProgressModal({ task, projectId }: Props) {
  const [open, setOpen] = useState(false)
  const [todos, setTodos] = useState<TodoItem[]>(() => mapChildrenToTodos(task.children))
  const router = useRouter()

  // 開いた瞬間に親 prop (task.children) から todos state を再同期する。
  // 別タブ・別操作で actualStartDate/actualEndDate が変わっていた場合の stale 表示を防ぐ。
  // useEffect ではなく onOpenChange 経路で同期するため、modal-open 中の親再描画では
  // ユーザー入力中の state を上書きしない。
  const handleOpenChange = makeOpenChangeHandler(router, setOpen, () => {
    setTodos(mapChildrenToTodos(task.children))
  })

  async function handleSave(
    todoId: string,
    data: { actualStartDate: Date | null; actualEndDate: Date | null },
  ) {
    // NOTE: save 失敗時のロールバックは呼び出し元 ProgressInputRow.commit() が担う。
    // ロールバック先は ProgressInputRow に渡した props 値 (= 当 state の値) であり、
    // 同一 modal セッション内で複数保存した場合は「前回 save 成功値」になる
    // (DB の現在値とは限らない)。Modal を閉じて router.refresh() すれば最新値に同期される。
    const updated = await updateTodoActualDates(todoId, projectId, data)
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId
          ? { ...t, actualStartDate: updated.actualStartDate, actualEndDate: updated.actualEndDate }
          : t,
      ),
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="px-2 py-0.5 text-xs">
          入力
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        {/*
          a11y: Radix Dialog は aria-labelledby/aria-describedby を自動接続するため
          DialogTitle + DialogDescription を必須要素として配置する (sr-only で視覚的には非表示)。
          見出しの視覚表現は TaskProgressContent 内の <h2> が担う。
        */}
        <DialogTitle className="sr-only">進捗入力: {task.name}</DialogTitle>
        <DialogDescription>
          このタスクに紐づく ToDo
          の着手日と完了日を入力してダイアログを閉じると、ガント表示が再描画されます。
        </DialogDescription>
        <TaskProgressContent
          taskName={task.name}
          taskStartDate={task.startDate}
          taskEndDate={task.endDate}
          taskScheduledPct={task.scheduledPct}
          todos={todos}
          onSave={handleSave}
        />
      </DialogContent>
    </Dialog>
  )
}
