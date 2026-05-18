'use client'

import { useState, useTransition, useEffect } from 'react'
import type { Milestone, Project, Task, Todo } from '@prisma/client'
import { ManagementRow } from './management-row'
import { EmptyStack } from './empty-stack'
import { createMilestone, deleteMilestone, updateMilestone } from '@/server/actions/milestone'
import { createTask, deleteTask, updateTask } from '@/server/actions/task'
import { createTodo, deleteTodo, updateTodo } from '@/server/actions/todo'
import { updateProject } from '@/server/actions/project'

type TaskWithTodos = Task & { todos: Todo[] }
type MilestoneWithTasks = Milestone & { tasks: TaskWithTodos[] }
type ProjectWithMilestones = Project & { milestones: MilestoneWithTasks[] }

interface ManagementTreeProps {
  project: ProjectWithMilestones
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function ManagementTree({ project }: ManagementTreeProps) {
  const [milestones, setMilestones] = useState<MilestoneWithTasks[]>(project.milestones)
  const [projectName, setProjectName] = useState(project.name)
  const [projectStart, setProjectStart] = useState(project.startDate)
  const [projectEnd, setProjectEnd] = useState(project.endDate)
  const [pending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // 折り畳み状態: Set に入っている id は collapsed (空 = 全展開)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  // 追加後スクロール先 id
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null)

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expand(id: string) {
    setCollapsedIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  useEffect(() => {
    if (!pendingScrollId) return
    // selector に id を直接 interpolation しないことで CSS selector injection を構造的に防ぐ
    const el = Array.from(document.querySelectorAll<HTMLElement>('[data-row-id]')).find(
      (node) => node.getAttribute('data-row-id') === pendingScrollId,
    )
    // 要素がまだ DOM に存在しなければ、次の milestones / collapsedIds 更新で再実行させる
    if (!el) return
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setPendingScrollId(null)
  }, [pendingScrollId, milestones, collapsedIds])

  // Next.js の redirect() / notFound() は特殊な throw オブジェクトを投げる。
  // これを Error として扱わず再 throw することで RSC レイヤーが正しく navigation/404 を処理する。
  function isNextNavigationError(e: unknown): boolean {
    if (typeof e !== 'object' || e === null || !('digest' in e)) return false
    const digest = (e as { digest?: unknown }).digest
    return (
      typeof digest === 'string' &&
      (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')
    )
  }

  function reportError(e: unknown) {
    if (isNextNavigationError(e)) throw e
    // ブラウザ DevTools / 外部エラー報告に Prisma 内部情報を漏らさないよう message のみ記録
    console.error('management-tree action failed:', e instanceof Error ? e.message : String(e))
    setErrorMsg(e instanceof Error ? e.message : '操作に失敗しました')
  }

  // ---------- Project ----------
  async function handleProjectName(name: string) {
    setErrorMsg(null)
    try {
      const updated = await updateProject(project.id, { name })
      setProjectName(updated.name)
    } catch (e) {
      reportError(e)
      throw e
    }
  }

  async function handleProjectDates(startDate: Date, endDate: Date) {
    setErrorMsg(null)
    try {
      const updated = await updateProject(project.id, { startDate, endDate })
      setProjectStart(updated.startDate)
      setProjectEnd(updated.endDate)
    } catch (e) {
      reportError(e)
      throw e
    }
  }

  // ---------- Milestone ----------
  async function handleAddMilestone() {
    setErrorMsg(null)
    startTransition(async () => {
      try {
        const last = milestones[milestones.length - 1]
        const start = last ? last.endDate : projectStart
        const end = addDays(start, 7)
        const created = await createMilestone(project.id, '新規マイルストーン', start, end)
        setMilestones((prev) => [...prev, { ...created, tasks: [] }])
        setPendingScrollId(created.id)
      } catch (e) {
        reportError(e)
      }
    })
  }

  async function handleUpdateMilestoneName(id: string, name: string) {
    setErrorMsg(null)
    try {
      const updated = await updateMilestone(id, project.id, { name })
      setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, name: updated.name } : m)))
    } catch (e) {
      reportError(e)
      throw e
    }
  }

  async function handleUpdateMilestoneDates(id: string, startDate: Date, endDate: Date) {
    setErrorMsg(null)
    try {
      const updated = await updateMilestone(id, project.id, { startDate, endDate })
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, startDate: updated.startDate, endDate: updated.endDate } : m,
        ),
      )
    } catch (e) {
      reportError(e)
      throw e
    }
  }

  async function handleDeleteMilestone(id: string) {
    if (!confirm('このマイルストーン配下を削除します。よろしいですか？')) return
    setErrorMsg(null)
    startTransition(async () => {
      try {
        await deleteMilestone(id, project.id)
        setMilestones((prev) => prev.filter((m) => m.id !== id))
      } catch (e) {
        reportError(e)
      }
    })
  }

  // ---------- Task ----------
  async function handleAddTask(milestoneId: string) {
    setErrorMsg(null)
    const milestone = milestones.find((m) => m.id === milestoneId)
    if (!milestone) return
    startTransition(async () => {
      try {
        const last = milestone.tasks[milestone.tasks.length - 1]
        const start = last ? last.endDate : milestone.startDate
        const end = addDays(start, 3)
        // createTask は TodoTemplate を自動展開した結果の todos を含めて返す
        const created = await createTask(milestoneId, project.id, '新規タスク', start, end)
        expand(milestoneId)
        setMilestones((prev) =>
          prev.map((m) => (m.id === milestoneId ? { ...m, tasks: [...m.tasks, created] } : m)),
        )
        setPendingScrollId(created.id)
      } catch (e) {
        reportError(e)
      }
    })
  }

  async function handleUpdateTaskName(milestoneId: string, id: string, name: string) {
    setErrorMsg(null)
    try {
      const updated = await updateTask(id, project.id, { name })
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId
            ? { ...m, tasks: m.tasks.map((t) => (t.id === id ? { ...t, name: updated.name } : t)) }
            : m,
        ),
      )
    } catch (e) {
      reportError(e)
      throw e
    }
  }

  async function handleUpdateTaskDates(
    milestoneId: string,
    id: string,
    startDate: Date,
    endDate: Date,
  ) {
    setErrorMsg(null)
    try {
      const updated = await updateTask(id, project.id, { startDate, endDate })
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId
            ? {
                ...m,
                tasks: m.tasks.map((t) =>
                  t.id === id
                    ? { ...t, startDate: updated.startDate, endDate: updated.endDate }
                    : t,
                ),
              }
            : m,
        ),
      )
    } catch (e) {
      reportError(e)
      throw e
    }
  }

  async function handleDeleteTask(milestoneId: string, id: string) {
    if (!confirm('このタスク配下を削除します。よろしいですか？')) return
    setErrorMsg(null)
    startTransition(async () => {
      try {
        await deleteTask(id, project.id)
        setMilestones((prev) =>
          prev.map((m) =>
            m.id === milestoneId ? { ...m, tasks: m.tasks.filter((t) => t.id !== id) } : m,
          ),
        )
      } catch (e) {
        reportError(e)
      }
    })
  }

  // ---------- Todo ----------
  async function handleAddTodo(milestoneId: string, taskId: string) {
    setErrorMsg(null)
    const milestone = milestones.find((m) => m.id === milestoneId)
    const task = milestone?.tasks.find((t) => t.id === taskId)
    if (!task) return
    startTransition(async () => {
      try {
        const last = task.todos[task.todos.length - 1]
        const start = last ? last.endDate : task.startDate
        const end = addDays(start, 1)
        const created = await createTodo(taskId, project.id, '新規ToDo', start, end)
        expand(milestoneId)
        expand(taskId)
        setMilestones((prev) =>
          prev.map((m) =>
            m.id === milestoneId
              ? {
                  ...m,
                  tasks: m.tasks.map((t) =>
                    t.id === taskId ? { ...t, todos: [...t.todos, created] } : t,
                  ),
                }
              : m,
          ),
        )
        setPendingScrollId(created.id)
      } catch (e) {
        reportError(e)
      }
    })
  }

  async function handleUpdateTodoName(
    milestoneId: string,
    taskId: string,
    id: string,
    name: string,
  ) {
    setErrorMsg(null)
    try {
      const updated = await updateTodo(id, project.id, { name })
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId
            ? {
                ...m,
                tasks: m.tasks.map((t) =>
                  t.id === taskId
                    ? {
                        ...t,
                        todos: t.todos.map((td) =>
                          td.id === id ? { ...td, name: updated.name } : td,
                        ),
                      }
                    : t,
                ),
              }
            : m,
        ),
      )
    } catch (e) {
      reportError(e)
      throw e
    }
  }

  async function handleUpdateTodoDates(
    milestoneId: string,
    taskId: string,
    id: string,
    startDate: Date,
    endDate: Date,
  ) {
    setErrorMsg(null)
    try {
      const updated = await updateTodo(id, project.id, { startDate, endDate })
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === milestoneId
            ? {
                ...m,
                tasks: m.tasks.map((t) =>
                  t.id === taskId
                    ? {
                        ...t,
                        todos: t.todos.map((td) =>
                          td.id === id
                            ? { ...td, startDate: updated.startDate, endDate: updated.endDate }
                            : td,
                        ),
                      }
                    : t,
                ),
              }
            : m,
        ),
      )
    } catch (e) {
      reportError(e)
      throw e
    }
  }

  async function handleDeleteTodo(milestoneId: string, taskId: string, id: string) {
    if (!confirm('このToDoを削除します。よろしいですか？')) return
    setErrorMsg(null)
    startTransition(async () => {
      try {
        await deleteTodo(id, project.id)
        setMilestones((prev) =>
          prev.map((m) =>
            m.id === milestoneId
              ? {
                  ...m,
                  tasks: m.tasks.map((t) =>
                    t.id === taskId ? { ...t, todos: t.todos.filter((td) => td.id !== id) } : t,
                  ),
                }
              : m,
          ),
        )
      } catch (e) {
        reportError(e)
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      {errorMsg && (
        <div role="alert" className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMsg}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setErrorMsg(null)}
            aria-label="エラーを閉じる"
          >
            閉じる
          </button>
        </div>
      )}

      <ManagementRow
        level="project"
        name={projectName}
        startDate={projectStart}
        endDate={projectEnd}
        onUpdateName={handleProjectName}
        onUpdateDates={handleProjectDates}
        expandable={false}
      />

      {milestones.map((m) => (
        <div key={m.id} className="flex flex-col gap-1">
          <ManagementRow
            id={m.id}
            level="milestone"
            name={m.name}
            startDate={m.startDate}
            endDate={m.endDate}
            onUpdateName={(name) => handleUpdateMilestoneName(m.id, name)}
            onUpdateDates={(s, e) => handleUpdateMilestoneDates(m.id, s, e)}
            onAddSibling={() => handleAddMilestone()}
            onDelete={() => handleDeleteMilestone(m.id)}
            expandable={true}
            expanded={!collapsedIds.has(m.id)}
            onToggle={() => toggleCollapse(m.id)}
          />

          {!collapsedIds.has(m.id) &&
            m.tasks.map((t) => (
              <div key={t.id} className="flex flex-col gap-1">
                <ManagementRow
                  id={t.id}
                  level="task"
                  name={t.name}
                  startDate={t.startDate}
                  endDate={t.endDate}
                  onUpdateName={(name) => handleUpdateTaskName(m.id, t.id, name)}
                  onUpdateDates={(s, e) => handleUpdateTaskDates(m.id, t.id, s, e)}
                  onAddSibling={() => handleAddTask(m.id)}
                  onDelete={() => handleDeleteTask(m.id, t.id)}
                  expandable={true}
                  expanded={!collapsedIds.has(t.id)}
                  onToggle={() => toggleCollapse(t.id)}
                />

                {!collapsedIds.has(t.id) &&
                  t.todos.map((td) => (
                    <ManagementRow
                      key={td.id}
                      id={td.id}
                      level="todo"
                      name={td.name}
                      startDate={td.startDate}
                      endDate={td.endDate}
                      onUpdateName={(name) => handleUpdateTodoName(m.id, t.id, td.id, name)}
                      onUpdateDates={(s, e) => handleUpdateTodoDates(m.id, t.id, td.id, s, e)}
                      onAddSibling={() => handleAddTodo(m.id, t.id)}
                      onDelete={() => handleDeleteTodo(m.id, t.id, td.id)}
                      expandable={false}
                    />
                  ))}

                {!collapsedIds.has(t.id) && t.todos.length === 0 && (
                  <div style={{ marginLeft: '108px' }}>
                    <EmptyStack
                      label="同階層のToDoを追加"
                      onAdd={() => handleAddTodo(m.id, t.id)}
                    />
                  </div>
                )}
              </div>
            ))}

          {!collapsedIds.has(m.id) && m.tasks.length === 0 && (
            <div style={{ marginLeft: '72px' }}>
              <EmptyStack label="同階層のタスクを追加" onAdd={() => handleAddTask(m.id)} />
            </div>
          )}
        </div>
      ))}

      <div style={{ marginLeft: '36px' }}>
        <EmptyStack label="同階層のマイルストーンを追加" onAdd={() => handleAddMilestone()} />
      </div>

      {pending && <div className="text-xs text-gray-400">保存中…</div>}
    </div>
  )
}
