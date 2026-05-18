/**
 * StatusPill — 4状態ステータスバッジ (v4.0)
 *
 * spec v4.0 Section 2.1 の 4状態に対応。
 * v3.x の 5状態版とは別物。
 */

import type { Status } from '@/lib/status'

export interface StatusPillProps {
  status: Status
}

const CONFIG: Record<Status, { label: string; className: string }> = {
  completed: {
    label: '完了',
    className: 'bg-emerald-100 text-emerald-700',
  },
  'in-progress': {
    label: '進行中',
    className: 'bg-blue-100 text-blue-700',
  },
  delayed: {
    label: '遅延',
    className: 'bg-red-100 text-red-700',
  },
  'not-started': {
    label: '未着手',
    className: 'bg-slate-100 text-slate-600',
  },
}

export function StatusPill({ status }: StatusPillProps): React.ReactElement {
  const { label, className } = CONFIG[status]
  return (
    <span
      role="status"
      aria-label={`ステータス: ${label}`}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
