import { ProgressStatus } from '@/types/progress'

interface GanttBarProps {
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
}

export const fillColors: Record<ProgressStatus, string> = {
  completed: '#15803d',
  'on-track': '#4ade80',
  delayed: '#facc15',
  warning: '#f87171',
  scheduled: '#d1d5db',
}

export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0
  return Math.max(0, Math.min(100, pct))
}

export function shouldShowScheduledMarker(scheduledPct: number): boolean {
  return scheduledPct > 0 && scheduledPct < 100
}

export function GanttBar({ actualPct, scheduledPct, status }: GanttBarProps) {
  const fill = fillColors[status]
  const cActual = clampPct(actualPct)
  const cScheduled = clampPct(scheduledPct)
  return (
    <svg width="100%" height="16" aria-label="進捗バー">
      <rect x="0" y="0" width="100%" height="100%" fill="#e5e7eb" rx="2" />
      {/* 実績バー（右端が今日線を兼ねる） */}
      <rect x="0" y="0" width={`${cActual}%`} height="100%" fill={fill} rx="2" />
      {/* 予定位置マーカー */}
      {shouldShowScheduledMarker(cScheduled) && (
        <line
          x1={`${cScheduled}%`}
          y1="0"
          x2={`${cScheduled}%`}
          y2="100%"
          stroke="#6b7280"
          strokeWidth="1.5"
          strokeDasharray="2,2"
        />
      )}
    </svg>
  )
}
