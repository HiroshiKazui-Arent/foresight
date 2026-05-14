import { useId } from 'react'
import { ProgressStatus } from '@/types/progress'
import { barOffsetWidth } from '@/components/gantt/timeline-utils'

// 日付プロパティは全4つ揃えて渡すか、全て省略するかのどちらか。
// 1〜3 個だけ渡すと TypeScript エラーになる (discriminated union)。
type GanttBarProps = {
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
} & (
  | { projectStart: Date; projectEnd: Date; rowStart: Date; rowEnd: Date }
  | { projectStart?: never; projectEnd?: never; rowStart?: never; rowEnd?: never }
)

export const STATUS_COLORS: Record<ProgressStatus, string> = {
  completed: 'bg-green-500',
  'on-track': 'bg-blue-500',
  delayed: 'bg-red-500',
  warning: 'bg-amber-400',
  scheduled: 'bg-gray-300',
}

// SVG ハッチング線の色 (warning / delayed のみ遅延ギャップ描画対象)
const HATCH_STROKE_COLORS: Partial<Record<ProgressStatus, string>> = {
  warning: '#f59e0b',
  delayed: '#ef4444',
}

const STATUS_LABELS: Record<ProgressStatus, string> = {
  completed: '完了',
  'on-track': '進行中',
  delayed: '遅延',
  warning: '警告',
  scheduled: '予定',
}

export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0
  return Math.max(0, Math.min(100, pct))
}

export function GanttBar({
  projectStart,
  projectEnd,
  rowStart,
  rowEnd,
  actualPct,
  scheduledPct,
  status,
}: GanttBarProps) {
  const uid = useId()
  const { left, width } =
    projectStart && projectEnd && rowStart && rowEnd
      ? barOffsetWidth(rowStart, rowEnd, projectStart, projectEnd)
      : { left: 0, width: 100 }

  const colorClass = STATUS_COLORS[status]
  const cActual = clampPct(actualPct)
  const cScheduled = clampPct(scheduledPct)
  const ariaLabel = `進捗バー: ${STATUS_LABELS[status]} 実績${cActual}%`

  if (status === 'completed') {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '16px' }}
      >
        <div
          className={colorClass}
          style={{ position: 'absolute', left: '0%', width: '100%', height: '100%' }}
        />
      </div>
    )
  }

  const gapWidth = Math.max(0, cScheduled - cActual)
  const futureLeft = cScheduled
  const futureWidth = 100 - cScheduled
  const hatchStroke = HATCH_STROKE_COLORS[status]
  // useId() でインスタンス固有の ID を生成し、同一ページ内での SVG pattern ID 重複を防ぐ
  const hatchPatternId = `hatch-${uid}-${status}`

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '16px' }}
    >
      {/* 層1: 実績エリア (0〜actualPct) */}
      <div
        className={colorClass}
        style={{ position: 'absolute', left: '0%', width: `${cActual}%`, height: '100%' }}
      />

      {/* 層2: 遅延ギャップ (actualPct〜scheduledPct) — SVG pattern で斜線ハッチング */}
      {gapWidth > 0 && (
        <svg
          style={{
            position: 'absolute',
            left: `${cActual}%`,
            width: `${gapWidth}%`,
            height: '100%',
          }}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {hatchStroke && (
            <defs>
              <pattern id={hatchPatternId} patternUnits="userSpaceOnUse" width="8" height="8">
                <line x1="0" y1="8" x2="8" y2="0" stroke={hatchStroke} strokeWidth="1.5" />
              </pattern>
            </defs>
          )}
          <rect
            width="100%"
            height="100%"
            fill={hatchStroke ? `url(#${hatchPatternId})` : '#94a3b8'}
          />
        </svg>
      )}

      {/* 層3: 未来予定エリア (scheduledPct〜100) */}
      {futureWidth > 0 && (
        <div
          className="bg-gray-100"
          style={{
            position: 'absolute',
            left: `${futureLeft}%`,
            width: `${futureWidth}%`,
            height: '100%',
          }}
        />
      )}
    </div>
  )
}
