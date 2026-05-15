import { getProject } from '@/server/actions/project'
import { requireProjectMember } from '@/lib/authz'
import { TreeView } from '@/components/tree-view/tree-view'
import { G1PageClient } from './g1-client'
import type { ProjectSummary, DelaySummary } from '@/lib/summary'

// S8 で実データから生成されるまでの placeholder 値
const PLACEHOLDER_PROJECT_SUMMARY: ProjectSummary = { scheduledPct: 0, actualPct: 0 }
const PLACEHOLDER_DELAY_SUMMARY: DelaySummary = {
  delayedCount: 0,
  maxDelayDays: 0,
  notStartedRiskCount: 0,
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectMember(id)
  const project = await getProject(id)

  const today = new Date()

  return (
    <div>
      {/* G1 ガント表示 layout shell */}
      <G1PageClient
        projectId={id}
        projectName={project.name}
        projectStart={project.startDate}
        projectEnd={project.endDate}
        today={today}
        projectSummary={PLACEHOLDER_PROJECT_SUMMARY}
        delaySummary={PLACEHOLDER_DELAY_SUMMARY}
      />

      {/* 暫定: 既存 TreeView (S6 で G2 工程管理に置き換わるまで) */}
      <div className="mt-8">
        <p className="mb-2 text-xs text-gray-400">
          ※ 以下は v3.x TreeView (S6 で G2 工程管理に置き換え予定)
        </p>
        <TreeView project={project} today={today} mode="view" />
      </div>
    </div>
  )
}
