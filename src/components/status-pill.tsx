import { ProgressStatus } from '@/types/progress'

interface StatusPillProps {
  status: ProgressStatus
}

const config: Record<ProgressStatus, { label: string; className: string }> = {
  completed: { label: '完了', className: 'bg-green-700 text-white' },
  'on-track': { label: '進行中', className: 'bg-green-200 text-green-800' },
  delayed: { label: '遅延', className: 'bg-yellow-200 text-yellow-800' },
  warning: { label: '警告', className: 'bg-red-200 text-red-800' },
  scheduled: { label: '予定', className: 'bg-gray-200 text-gray-700' },
}

export function StatusPill({ status }: StatusPillProps) {
  const { label, className } = config[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
