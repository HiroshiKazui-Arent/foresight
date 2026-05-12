import Link from 'next/link'
import { ProgressPill } from '@/components/progress-pill'
import { StatusPill } from '@/components/status-pill'
import { DaysPill } from '@/components/days-pill'
import type { ProgressStatus } from '@/types/progress'
import type {
  ProjectForecast,
  MilestoneForecast,
  TaskForecast,
  TodoForecast,
} from '@/types/dashboard'

function formatDate(d: Date | null): string {
  if (!d) return '予測不能'
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusBgClass(status: ProgressStatus): string {
  if (status === 'warning') return 'border-red-400 bg-red-50'
  if (status === 'delayed') return 'border-yellow-400 bg-yellow-50'
  return 'border-gray-200 bg-white'
}

function ChainArrow() {
  return (
    <div className="flex justify-center py-2 text-2xl text-gray-400" aria-hidden="true">
      ↓
    </div>
  )
}

function ProjectCard({ forecast }: { forecast: ProjectForecast }) {
  return (
    <div className={`rounded-lg border-l-4 p-4 shadow-sm ${statusBgClass(forecast.status)}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold text-gray-800">プロジェクト</span>
        <StatusPill status={forecast.status} />
      </div>
      <p className="mb-2 text-lg font-bold">{forecast.name}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <ProgressPill actualPct={forecast.actualPct} scheduledPct={forecast.scheduledPct} />
        <DaysPill days={forecast.daysDeviation} />
        <span>完了予測: {formatDate(forecast.completionDate)}</span>
        {forecast.slipDays > 0 && (
          <span className="font-medium text-red-600">
            +{Math.ceil(forecast.slipDays)}日スリップ
          </span>
        )}
      </div>
    </div>
  )
}

function MilestoneCard({ milestone }: { milestone: MilestoneForecast }) {
  return (
    <div className={`rounded-lg border-l-4 p-4 shadow-sm ${statusBgClass(milestone.status)}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold text-gray-800">マイルストーン</span>
        <StatusPill status={milestone.status} />
      </div>
      <p className="mb-2 font-bold">{milestone.name}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <ProgressPill actualPct={milestone.actualPct} scheduledPct={milestone.scheduledPct} />
        <DaysPill days={milestone.daysDeviation} />
        <span>完了予測: {formatDate(milestone.completionDate)}</span>
        {milestone.slipDays > 0 && (
          <span className="font-medium text-red-600">
            +{Math.ceil(milestone.slipDays)}日スリップ
          </span>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task, projectId }: { task: TaskForecast; projectId: string }) {
  return (
    <div className={`rounded-lg border-l-4 p-4 shadow-sm ${statusBgClass(task.status)}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs text-gray-500">{task.milestoneName}</span>
        <StatusPill status={task.status} />
      </div>
      <p className="mb-2 font-bold">
        <Link href={`/projects/${projectId}/tasks/${task.id}`} className="hover:underline">
          {task.name}
        </Link>
      </p>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <ProgressPill actualPct={task.actualPct} scheduledPct={task.scheduledPct} />
        <DaysPill days={task.daysDeviation} />
        <span>完了予測: {formatDate(task.completionDate)}</span>
        {task.slipDays > 0 && (
          <span className="font-medium text-red-600">+{Math.ceil(task.slipDays)}日スリップ</span>
        )}
      </div>
      {task.recommendation && (
        <div className="mt-2 rounded bg-white/60 px-3 py-1 text-sm text-gray-700">
          {task.recommendation}
        </div>
      )}
    </div>
  )
}

function TodoCard({ todo }: { todo: TodoForecast }) {
  return (
    <div className={`rounded-lg border-l-4 p-4 shadow-sm ${statusBgClass(todo.status)}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold text-gray-800">ToDo</span>
        <StatusPill status={todo.status} />
        <span className="text-sm text-gray-600">{todo.completed ? '✓ 完了' : '未完了'}</span>
      </div>
      <p className="mb-2 font-bold">{todo.name}</p>
      <div className="text-sm text-gray-600">期日: {formatDate(todo.endDate)}</div>
      {todo.recommendation && (
        <div className="mt-2 rounded bg-white/60 px-3 py-1 text-sm text-gray-700">
          {todo.recommendation}
        </div>
      )}
    </div>
  )
}

export function DashboardView({
  forecast,
  projectId,
}: {
  forecast: ProjectForecast
  projectId: string
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-2">
      <ProjectCard forecast={forecast} />

      {/* Milestone 0件: buildDashboardData は startDate === endDate === today を返す */}
      {forecast.startDate.getTime() === forecast.endDate.getTime() && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-gray-500">
          マイルストーンが登録されていません
        </div>
      )}

      {forecast.allClear && forecast.startDate.getTime() !== forecast.endDate.getTime() && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-green-800">
          すべての項目が順調です
        </div>
      )}

      {forecast.warningMilestones.map((ms) => (
        <div key={ms.id}>
          <ChainArrow />
          <MilestoneCard milestone={ms} />
          {ms.warningTasks.map((task) => (
            <div key={task.id}>
              <ChainArrow />
              <TaskCard task={task} projectId={projectId} />
              {task.warningTodos.length > 0 && (
                <div className="ml-6 space-y-2">
                  {task.warningTodos.map((todo) => (
                    <div key={todo.id}>
                      <ChainArrow />
                      <TodoCard todo={todo} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
