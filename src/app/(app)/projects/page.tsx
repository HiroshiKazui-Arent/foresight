import { getUserProjects } from '@/server/actions/project'
import {
  calcProjectActualPct,
  calcMilestoneActualPct,
  calcTaskActualPct,
  calcScheduledPct,
  calcStatus,
  calcDaysDeviation,
} from '@/lib/progress'
import { ProjectList } from './project-list'

export default async function ProjectsPage() {
  const projects = await getUserProjects()
  const today = new Date()

  const projectItems = projects.map((project) => {
    // マイルストーンごとの実績% を計算
    const milestoneData = project.milestones.map((milestone) => {
      const taskData = milestone.tasks.map((task) => {
        const taskActual = calcTaskActualPct(task.todos)
        return { actualPct: taskActual, startDate: task.startDate, endDate: task.endDate }
      })
      const milestoneActual = calcMilestoneActualPct(taskData)
      return {
        actualPct: milestoneActual,
        startDate: milestone.startDate,
        endDate: milestone.endDate,
      }
    })

    const actualPct = calcProjectActualPct(milestoneData)
    const durationDays =
      (project.endDate.getTime() - project.startDate.getTime()) / (1000 * 60 * 60 * 24)
    const scheduledPct = calcScheduledPct(project.startDate, project.endDate, today)
    const status = calcStatus(actualPct, scheduledPct)
    const daysDeviation = calcDaysDeviation(actualPct, scheduledPct, durationDays)

    return {
      id: project.id,
      name: project.name,
      startDate: project.startDate,
      endDate: project.endDate,
      progressBar: { actualPct, scheduledPct, status, daysDeviation },
    }
  })

  return <ProjectList projects={projectItems} today={today} />
}
