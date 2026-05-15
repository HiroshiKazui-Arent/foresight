import type { ProgressStatus, RenderStatus } from '@/types/progress'

type StatusPillProps =
  | { renderStatus: RenderStatus; status?: never }
  | { status: ProgressStatus; renderStatus?: never }

const renderStatusConfig: Record<RenderStatus, { label: string; className: string }> = {
  scheduled: { label: '予定', className: 'bg-gray-200 text-gray-700' },
  completed: { label: '完了', className: 'bg-green-700 text-white' },
  'ahead-of-schedule': { label: '先行', className: 'bg-green-100 text-green-800' },
  'delayed-pre-deadline': { label: '遅延', className: 'bg-amber-400 text-white' },
  'overdue-past-deadline': { label: '超過', className: 'bg-red-600 text-white' },
  'not-started-overdue': { label: '未着', className: 'bg-red-800 text-white' },
}

// 旧 ProgressStatus 対応 (後方互換)
const legacyConfig: Record<ProgressStatus, { label: string; className: string }> = {
  completed: { label: '完了', className: 'bg-green-700 text-white' },
  'on-track': { label: '進行中', className: 'bg-green-200 text-green-800' },
  delayed: { label: '遅延', className: 'bg-yellow-200 text-yellow-800' },
  warning: { label: '警告', className: 'bg-red-200 text-red-800' },
  scheduled: { label: '予定', className: 'bg-gray-200 text-gray-700' },
}

export function StatusPill(props: StatusPillProps) {
  const { label, className } =
    'renderStatus' in props && props.renderStatus !== undefined
      ? renderStatusConfig[props.renderStatus]
      : props.status !== undefined
        ? legacyConfig[props.status]
        : renderStatusConfig['scheduled']
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
