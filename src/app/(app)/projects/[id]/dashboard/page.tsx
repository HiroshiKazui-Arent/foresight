import { getProject } from '@/server/actions/project'
import { requireProjectMember } from '@/lib/authz'
import { buildDashboardData } from '@/lib/forecast'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import Link from 'next/link'

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectMember(id)
  const project = await getProject(id)

  const today = new Date()
  const forecast = buildDashboardData(project, today)

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/projects/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-bold">予兆検知ダッシュボード</h1>
      </div>
      <DashboardView forecast={forecast} projectId={id} />
    </div>
  )
}
