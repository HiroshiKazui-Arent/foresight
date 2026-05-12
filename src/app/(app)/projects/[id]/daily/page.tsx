import { requireProjectMember } from '@/lib/authz'
import { getProject } from '@/server/actions/project'
import { TreeView } from '@/components/tree-view/tree-view'
import Link from 'next/link'

export default async function DailyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectMember(id)
  const project = await getProject(id)

  const today = new Date()

  // 完了済み件数サマリ(M-01: actualPct 廃止に伴う UI 補助)
  let totalTodos = 0
  let completedTodos = 0
  for (const milestone of project.milestones) {
    for (const task of milestone.tasks) {
      for (const todo of task.todos) {
        totalTodos += 1
        if (todo.completed) completedTodos += 1
      }
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← プロジェクトへ戻る
          </Link>
          <h1 className="text-2xl font-bold">日報入力 — {project.name}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span aria-label="完了済み件数">
            完了済み: <strong className="text-gray-800">{completedTodos}</strong> / {totalTodos} 件
          </span>
          <span>
            {today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      <TreeView project={project} today={today} mode="input" />
    </div>
  )
}
