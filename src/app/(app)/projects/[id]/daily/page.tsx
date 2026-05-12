import { requireProjectMember } from '@/lib/authz'
import { getProject } from '@/server/actions/project'
import { TreeView } from '@/components/tree-view/tree-view'
import Link from 'next/link'

export default async function DailyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectMember(id)
  const project = await getProject(id)

  const today = new Date()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← プロジェクトへ戻る
          </Link>
          <h1 className="text-2xl font-bold">日報入力 — {project.name}</h1>
        </div>
        <p className="text-sm text-gray-500">
          {today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <TreeView project={project} today={today} mode="input" />
    </div>
  )
}
