import {
  calcScheduledPct,
  calcStatus,
  calcDaysDeviation,
  calcTaskActualPct,
  calcMilestoneActualPct,
  calcProjectActualPct,
} from './progress'
import type { ProgressStatus } from '@/types/progress'
import type {
  TodoForecast,
  TaskForecast,
  MilestoneForecast,
  ProjectForecast,
} from '@/types/dashboard'

// getProject の戻り値と一致する構造型（'use server' ファイルへの直接 import を避けるため手動定義）
type TodoData = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  actualPct: number
  weight: number
}

type TaskData = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  milestoneId: string
  todos: TodoData[]
}

type MilestoneData = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  projectId: string
  tasks: TaskData[]
}

type ProjectData = {
  id: string
  name: string
  milestones: MilestoneData[]
}

const WARNING_STATUSES: ProgressStatus[] = ['warning', 'delayed']

/**
 * 完了予測日。actualPct が 0 または未着手(elapsedMs <= 0)なら null。
 * actualPct は [0, 100] にクランプしてから計算する。
 */
export function calcCompletionDate(
  actualPct: number,
  startDate: Date,
  endDate: Date,
  today: Date,
): Date | null {
  const clamped = Math.max(0, Math.min(100, actualPct))
  if (clamped >= 100) return today
  if (clamped === 0) return null
  const elapsedMs = today.getTime() - startDate.getTime()
  if (elapsedMs <= 0) return null
  const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000)
  const progressPerDay = clamped / elapsedDays
  const remainingDays = (100 - clamped) / progressPerDay
  const result = new Date(today.getTime() + remainingDays * 24 * 60 * 60 * 1000)
  if (!isFinite(result.getTime())) return null
  return result
}

/**
 * スリップ日数。completionDate が null または endDate 以前なら 0。
 */
export function calcSlipDays(completionDate: Date | null, endDate: Date): number {
  if (!completionDate) return 0
  const ms = completionDate.getTime() - endDate.getTime()
  if (!isFinite(ms)) return 0
  return Math.max(0, ms / (24 * 60 * 60 * 1000))
}

/**
 * 推奨アクション文字列。
 */
export function buildRecommendation(status: ProgressStatus, slipDays: number): string {
  if (status === 'warning') {
    if (slipDays > 0) {
      return `大幅遅延: ${Math.ceil(slipDays)}日のスリップ予測 — 即時対応が必要です`
    }
    return '大幅遅延(-20%以上) — 即時対応が必要です'
  }
  if (status === 'delayed') {
    if (slipDays > 0) {
      return `遅延傾向: ${Math.ceil(slipDays)}日のスリップ予測 — 担当者への確認を推奨`
    }
    return '遅延傾向 — 進捗確認を推奨'
  }
  return ''
}

export function buildDashboardData(project: ProjectData, today: Date): ProjectForecast {
  if (project.milestones.length === 0) {
    return {
      id: project.id,
      name: project.name,
      startDate: today,
      endDate: today,
      actualPct: 0,
      scheduledPct: 0,
      status: 'scheduled',
      daysDeviation: 0,
      completionDate: null,
      slipDays: 0,
      warningMilestones: [],
      allClear: true,
    }
  }

  const warningMilestones: MilestoneForecast[] = []
  const msActualsForProject: { actualPct: number; startDate: Date; endDate: Date }[] = []

  for (const milestone of project.milestones) {
    // 各 task の actualPct を一度だけ計算し再利用する
    const taskWithActuals = milestone.tasks.map((task) => ({
      task,
      actualPct: calcTaskActualPct(task.todos),
    }))

    const taskActualsForMs = taskWithActuals.map(({ task, actualPct }) => ({
      actualPct,
      startDate: task.startDate,
      endDate: task.endDate,
    }))

    const msActualPct = calcMilestoneActualPct(taskActualsForMs)
    msActualsForProject.push({
      actualPct: msActualPct,
      startDate: milestone.startDate,
      endDate: milestone.endDate,
    })

    const msScheduledPct = calcScheduledPct(milestone.startDate, milestone.endDate, today)
    const msStatus = calcStatus(msActualPct, msScheduledPct)
    const msDurationDays =
      (milestone.endDate.getTime() - milestone.startDate.getTime()) / (24 * 60 * 60 * 1000)
    const msDaysDeviation = calcDaysDeviation(msActualPct, msScheduledPct, msDurationDays)
    const msCompletionDate = calcCompletionDate(
      msActualPct,
      milestone.startDate,
      milestone.endDate,
      today,
    )
    const msSlipDays = calcSlipDays(msCompletionDate, milestone.endDate)

    const warningTasks: TaskForecast[] = []

    for (const { task, actualPct: taskActualPct } of taskWithActuals) {
      const taskScheduledPct = calcScheduledPct(task.startDate, task.endDate, today)
      const taskStatus = calcStatus(taskActualPct, taskScheduledPct)

      if (!WARNING_STATUSES.includes(taskStatus)) continue

      const taskDurationDays =
        (task.endDate.getTime() - task.startDate.getTime()) / (24 * 60 * 60 * 1000)
      const taskDaysDeviation = calcDaysDeviation(taskActualPct, taskScheduledPct, taskDurationDays)
      const taskCompletionDate = calcCompletionDate(
        taskActualPct,
        task.startDate,
        task.endDate,
        today,
      )
      const taskSlipDays = calcSlipDays(taskCompletionDate, task.endDate)

      const warningTodos: TodoForecast[] = []

      for (const todo of task.todos) {
        const todoScheduledPct = calcScheduledPct(todo.startDate, todo.endDate, today)
        const todoStatus = calcStatus(todo.actualPct, todoScheduledPct)

        if (!WARNING_STATUSES.includes(todoStatus)) continue

        const todoDurationDays =
          (todo.endDate.getTime() - todo.startDate.getTime()) / (24 * 60 * 60 * 1000)
        const todoDaysDeviation = calcDaysDeviation(
          todo.actualPct,
          todoScheduledPct,
          todoDurationDays,
        )
        const todoCompletionDate = calcCompletionDate(
          todo.actualPct,
          todo.startDate,
          todo.endDate,
          today,
        )
        const todoSlipDays = calcSlipDays(todoCompletionDate, todo.endDate)

        warningTodos.push({
          id: todo.id,
          name: todo.name,
          startDate: todo.startDate,
          endDate: todo.endDate,
          actualPct: todo.actualPct,
          scheduledPct: todoScheduledPct,
          status: todoStatus,
          daysDeviation: todoDaysDeviation,
          completionDate: todoCompletionDate,
          slipDays: todoSlipDays,
          recommendation: buildRecommendation(todoStatus, todoSlipDays),
        })
      }

      warningTasks.push({
        id: task.id,
        name: task.name,
        startDate: task.startDate,
        endDate: task.endDate,
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        actualPct: taskActualPct,
        scheduledPct: taskScheduledPct,
        status: taskStatus,
        daysDeviation: taskDaysDeviation,
        completionDate: taskCompletionDate,
        slipDays: taskSlipDays,
        recommendation: buildRecommendation(taskStatus, taskSlipDays),
        warningTodos,
      })
    }

    if (WARNING_STATUSES.includes(msStatus) || warningTasks.length > 0) {
      warningMilestones.push({
        id: milestone.id,
        name: milestone.name,
        startDate: milestone.startDate,
        endDate: milestone.endDate,
        actualPct: msActualPct,
        scheduledPct: msScheduledPct,
        status: msStatus,
        daysDeviation: msDaysDeviation,
        completionDate: msCompletionDate,
        slipDays: msSlipDays,
        warningTasks,
      })
    }
  }

  const projectActualPct = calcProjectActualPct(msActualsForProject)
  const projectStartDate = msActualsForProject.reduce(
    (min, ms) => (ms.startDate < min ? ms.startDate : min),
    msActualsForProject[0].startDate,
  )
  const projectEndDate = msActualsForProject.reduce(
    (max, ms) => (ms.endDate > max ? ms.endDate : max),
    msActualsForProject[0].endDate,
  )
  const projectScheduledPct = calcScheduledPct(projectStartDate, projectEndDate, today)
  const projectStatus = calcStatus(projectActualPct, projectScheduledPct)
  const projectDurationDays =
    (projectEndDate.getTime() - projectStartDate.getTime()) / (24 * 60 * 60 * 1000)
  const projectDaysDeviation = calcDaysDeviation(
    projectActualPct,
    projectScheduledPct,
    projectDurationDays,
  )
  const projectCompletionDate = calcCompletionDate(
    projectActualPct,
    projectStartDate,
    projectEndDate,
    today,
  )
  const projectSlipDays = calcSlipDays(projectCompletionDate, projectEndDate)

  return {
    id: project.id,
    name: project.name,
    startDate: projectStartDate,
    endDate: projectEndDate,
    actualPct: projectActualPct,
    scheduledPct: projectScheduledPct,
    status: projectStatus,
    daysDeviation: projectDaysDeviation,
    completionDate: projectCompletionDate,
    slipDays: projectSlipDays,
    warningMilestones,
    allClear: warningMilestones.length === 0,
  }
}
