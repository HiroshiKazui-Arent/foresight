import { getProject } from '@/server/actions/project'
import { GanttView } from '@/components/gantt/gantt-view'
import {
  buildGanttRows,
  collectTaskRowsForDelaySummary,
  type ProjectForGantt,
} from '@/lib/gantt-rows'
import { buildProjectSummary, buildDelaySummary } from '@/lib/summary'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProject(id) // 内部で requireProjectMember を呼ぶ

  // today は UTC midnight に正規化する。
  // Prisma の DateTime カラム (DB) は UTC midnight で保存されるため、
  // サーバーのローカルタイムゾーンに依存しない比較ができるようにする。
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const projectForGantt: ProjectForGantt = {
    startDate: project.startDate,
    endDate: project.endDate,
    milestones: project.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      startDate: m.startDate,
      endDate: m.endDate,
      tasks: m.tasks.map((t) => ({
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        todos: t.todos.map((td) => ({
          id: td.id,
          name: td.name,
          startDate: td.startDate,
          endDate: td.endDate,
          actualStartDate: td.actualStartDate,
          actualEndDate: td.actualEndDate,
        })),
      })),
    })),
  }

  const rows = buildGanttRows(projectForGantt, today)
  const projectSummary = buildProjectSummary(projectForGantt, today)
  const delaySummary = buildDelaySummary(collectTaskRowsForDelaySummary(rows), today)

  return (
    <GanttView
      projectId={id}
      projectStart={project.startDate}
      projectEnd={project.endDate}
      today={today}
      rows={rows}
      projectSummary={projectSummary}
      delaySummary={delaySummary}
    />
  )
}
