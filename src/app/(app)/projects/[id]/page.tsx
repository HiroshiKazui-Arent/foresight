import { getProject } from '@/server/actions/project'
import { requireProjectMember } from '@/lib/authz'
import { TreeView } from '@/components/tree-view/tree-view'
import Link from 'next/link'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectMember(id)
  const project = await getProject(id)

  const today = new Date()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-700">
            ← プロジェクト一覧
          </Link>
          <h1 className="text-2xl font-bold">{project.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/projects/${id}/dashboard`}
            className="inline-flex items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            予兆検知
          </Link>
          <Link
            href={`/projects/${id}/daily`}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            日報入力
          </Link>
          <Link
            href={`/projects/${id}/settings`}
            className="inline-flex items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-300"
          >
            設定
          </Link>
        </div>
      </div>

      <TreeView project={project} today={today} mode="view" />
    </div>
  )
}
