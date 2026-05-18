import { requireProjectMember } from '@/lib/authz'
import { getProject } from '@/server/actions/project'
import { ManagementTree } from '@/components/management/management-tree'

export default async function ProjectManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectMember(id)
  const project = await getProject(id)

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold">工程管理: 追加・編集・削除</h1>
        <p className="text-xs text-gray-500">
          プロジェクト / マイルストーン / タスク / ToDo の構成を管理する画面。実績日(着手日 /
          完了日)は本画面では入力できません(進捗入力画面で行います)。
        </p>
      </header>
      <ManagementTree project={project} />
    </div>
  )
}
