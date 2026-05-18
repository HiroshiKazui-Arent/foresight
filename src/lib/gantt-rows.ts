/**
 * G1 ガント表示用の行データ生成 + フィルター波及判定 (純関数群)。
 *
 * spec v4.0 / plans/spec-v4-reset.md S8 参照。
 * - buildGanttRows: Project → 階層フラット化 + 各行の status / scheduledPct / actualPct 算出
 * - hasMatchingDescendant: フィルター適用時に「該当子を持つ親階層は表示する」ルールの実装
 */

import type { Status } from '@/lib/status'
import { calcStatus } from '@/lib/status'
import { calcScheduledPct, calcTaskActualPct, calcWeightedActualPct } from '@/lib/progress'
import { matchesFilter, type FilterValue } from '@/lib/summary'

export type GanttRowType = 'milestone' | 'task' | 'todo'

export type GanttRow = {
  id: string
  type: GanttRowType
  level: 0 | 1 | 2
  wbs: string
  name: string
  startDate: Date
  endDate: Date
  actualStartDate: Date | null
  actualEndDate: Date | null
  scheduledPct: number
  actualPct: number
  status: Status
  hasAnyActualStart: boolean
  /** Task 行のみ参照: 進捗入力リンク先 ID */
  taskId?: string
  /** 子行 (Milestone → Task → ToDo) */
  children: GanttRow[]
}

export type ProjectForGantt = {
  startDate: Date
  endDate: Date
  milestones: {
    id: string
    name: string
    startDate: Date
    endDate: Date
    tasks: {
      id: string
      name: string
      startDate: Date
      endDate: Date
      todos: {
        id: string
        name: string
        startDate: Date
        endDate: Date
        actualStartDate: Date | null
        actualEndDate: Date | null
      }[]
    }[]
  }[]
}

/**
 * 子 ToDo 配列から実績期間を集約する。
 *
 * - 着手済み ToDo が 0 件 → `{actualStartDate: null, actualEndDate: null}` (実績バー描画なし)
 * - 着手済み ToDo の中に 1 件でも未完了 (`actualEndDate == null`) があれば集約は in-progress 扱い
 *   → `actualEndDate: null` (PeriodBar 側で today まで延ばす)
 * - すべて完了済みなら `actualEndDate = max(子の actualEndDate)`
 * - `actualStartDate = min(着手済み子の actualStartDate)`
 */
function aggregateActualRange(
  todos: { actualStartDate: Date | null; actualEndDate: Date | null }[],
): { actualStartDate: Date | null; actualEndDate: Date | null } {
  const started = todos.filter((t) => t.actualStartDate != null)
  if (started.length === 0) return { actualStartDate: null, actualEndDate: null }

  const minStart = new Date(Math.min(...started.map((t) => (t.actualStartDate as Date).getTime())))
  const hasInProgress = started.some((t) => t.actualEndDate == null)
  if (hasInProgress) return { actualStartDate: minStart, actualEndDate: null }

  const maxEnd = new Date(Math.max(...started.map((t) => (t.actualEndDate as Date).getTime())))
  return { actualStartDate: minStart, actualEndDate: maxEnd }
}

/**
 * Project から階層 GanttRow[] を組み立てる。
 * 各行の scheduledPct / actualPct / status / hasAnyActualStart を spec v4.0 のルールで算出。
 *
 * - Task.actualPct = 完了 ToDo 数 / 全 ToDo 数 × 100
 * - Milestone.actualPct = 配下 Task の actualPct を期間日数加重平均
 * - ToDo.actualPct = actualEndDate != null ? 100 : 0
 * - 集約レベル (Task / Milestone) の actualStartDate / actualEndDate は
 *   配下 ToDo を `aggregateActualRange` で集約 (実績バー描画用)
 * - hasAnyActualStart:
 *     Task = いずれかの ToDo に actualStartDate あり
 *     Milestone = いずれかの Task の hasAnyActualStart が true
 *     ToDo = actualStartDate != null
 */
export function buildGanttRows(project: ProjectForGantt, today: Date): GanttRow[] {
  return project.milestones.map((m, mIdx) => {
    const milestoneWbs = `${mIdx + 1}`

    const taskRows: GanttRow[] = m.tasks.map((t, tIdx) => {
      const taskWbs = `${milestoneWbs}.${tIdx + 1}`

      const todoRows: GanttRow[] = t.todos.map((todo, todoIdx) => {
        const todoWbs = `${taskWbs}.${todoIdx + 1}`
        const todoActualPct = todo.actualEndDate != null ? 100 : 0
        const todoScheduledPct = calcScheduledPct(todo.startDate, todo.endDate, today)
        const todoHasAnyActualStart = todo.actualStartDate != null
        const todoStatus = calcStatus({
          actualPct: todoActualPct,
          scheduledPct: todoScheduledPct,
          startDate: todo.startDate,
          endDate: todo.endDate,
          today,
          hasAnyActualStart: todoHasAnyActualStart,
        })

        return {
          id: todo.id,
          type: 'todo',
          level: 2,
          wbs: todoWbs,
          name: todo.name,
          startDate: todo.startDate,
          endDate: todo.endDate,
          actualStartDate: todo.actualStartDate,
          actualEndDate: todo.actualEndDate,
          scheduledPct: todoScheduledPct,
          actualPct: todoActualPct,
          status: todoStatus,
          hasAnyActualStart: todoHasAnyActualStart,
          children: [],
        }
      })

      const taskActualPct = calcTaskActualPct(t.todos)
      const taskScheduledPct = calcScheduledPct(t.startDate, t.endDate, today)
      const taskHasAnyActualStart = t.todos.some((td) => td.actualStartDate != null)
      // ToDo 0 件の Task は配下情報が無く本来「未着手扱い」が妥当。
      // calcStatus は actualPct=0 && !hasAnyActualStart で today >= startDate なら 'delayed' に倒れるが、
      // ToDo が無いタスクを "遅延" 扱いするのは未入力データの誤解を生むため明示的に 'not-started' に倒す。
      const taskStatus =
        t.todos.length === 0
          ? ('not-started' as const)
          : calcStatus({
              actualPct: taskActualPct,
              scheduledPct: taskScheduledPct,
              startDate: t.startDate,
              endDate: t.endDate,
              today,
              hasAnyActualStart: taskHasAnyActualStart,
            })

      // Task の実績期間 = 配下 ToDo から集約 (実績バー描画用)
      const taskActualRange = aggregateActualRange(t.todos)

      return {
        id: t.id,
        type: 'task',
        level: 1,
        wbs: taskWbs,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        actualStartDate: taskActualRange.actualStartDate,
        actualEndDate: taskActualRange.actualEndDate,
        scheduledPct: taskScheduledPct,
        actualPct: taskActualPct,
        status: taskStatus,
        hasAnyActualStart: taskHasAnyActualStart,
        taskId: t.id,
        children: todoRows,
      }
    })

    const milestoneActualPct = calcWeightedActualPct(
      m.tasks.map((t) => ({
        actualPct: calcTaskActualPct(t.todos),
        startDate: t.startDate,
        endDate: t.endDate,
      })),
    )
    const milestoneScheduledPct = calcScheduledPct(m.startDate, m.endDate, today)
    const milestoneHasAnyActualStart = taskRows.some((tr) => tr.hasAnyActualStart)
    const milestoneStatus = calcStatus({
      actualPct: milestoneActualPct,
      scheduledPct: milestoneScheduledPct,
      startDate: m.startDate,
      endDate: m.endDate,
      today,
      hasAnyActualStart: milestoneHasAnyActualStart,
    })

    // Milestone の実績期間 = 配下全 ToDo (Task をフラット化) から集約
    const milestoneTodos = m.tasks.flatMap((t) => t.todos)
    const milestoneActualRange = aggregateActualRange(milestoneTodos)

    return {
      id: m.id,
      type: 'milestone',
      level: 0,
      wbs: milestoneWbs,
      name: m.name,
      startDate: m.startDate,
      endDate: m.endDate,
      actualStartDate: milestoneActualRange.actualStartDate,
      actualEndDate: milestoneActualRange.actualEndDate,
      scheduledPct: milestoneScheduledPct,
      actualPct: milestoneActualPct,
      status: milestoneStatus,
      hasAnyActualStart: milestoneHasAnyActualStart,
      children: taskRows,
    }
  })
}

/**
 * フィルター波及判定: 行自身が一致するか、子孫のいずれかが一致するか。
 * spec v4.0 5.2「該当する子を持つ親階層はフィルター適用時も表示する」。
 *
 * filter='all' のときは常に true。
 */
export function hasMatchingDescendant(row: GanttRow, filter: FilterValue, today: Date): boolean {
  if (filter === 'all') return true

  const selfMatches = matchesFilter(
    {
      status: row.status,
      actualPct: row.actualPct,
      hasAnyActualStart: row.hasAnyActualStart,
      startDate: row.startDate,
      today,
    },
    filter,
  )
  if (selfMatches) return true

  for (const child of row.children) {
    if (hasMatchingDescendant(child, filter, today)) return true
  }
  return false
}

/**
 * Task 配列を集めて DelaySummary 集計用に整形する。
 * buildGanttRows の戻り値から Task レベルの行のみ抽出するヘルパー。
 */
export function collectTaskRowsForDelaySummary(rows: GanttRow[]): {
  status: Status
  actualPct: number
  scheduledPct: number
  hasAnyActualStart: boolean
  startDate: Date
  endDate: Date
}[] {
  const tasks: ReturnType<typeof collectTaskRowsForDelaySummary> = []
  for (const m of rows) {
    for (const t of m.children) {
      tasks.push({
        status: t.status,
        actualPct: t.actualPct,
        scheduledPct: t.scheduledPct,
        hasAnyActualStart: t.hasAnyActualStart,
        startDate: t.startDate,
        endDate: t.endDate,
      })
    }
  }
  return tasks
}
