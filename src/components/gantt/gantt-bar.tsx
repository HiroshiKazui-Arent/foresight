import { useId } from 'react'
import { ProgressStatus } from '@/types/progress'
import { barOffsetWidth, xForDate } from '@/components/gantt/timeline-utils'

// 日付プロパティは全 5 つ (projectStart/projectEnd/rowStart/rowEnd/today) 揃えて
// 渡すか、全て省略するかのどちらか (discriminated union)。
// プレビュー用途のみ Legacy variant (全省略) を使う。
type GanttBarPropsWithDates = {
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  projectStart: Date
  projectEnd: Date
  rowStart: Date
  rowEnd: Date
  today: Date
}

type GanttBarPropsLegacy = {
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  projectStart?: never
  projectEnd?: never
  rowStart?: never
  rowEnd?: never
  today?: never
}

type GanttBarProps = GanttBarPropsWithDates | GanttBarPropsLegacy

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
  today,
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
  let cScheduled = clampPct(scheduledPct)

  // todayInBar: バー内の今日線位置 (0〜100%)。日付あり variant のみ計算。
  const todayInBar =
    today !== undefined && rowStart !== undefined && rowEnd !== undefined
      ? xForDate(today, rowStart, rowEnd)
      : null

  // ドリフト対策: cScheduled と todayInBar が 0.5% 未満の差なら todayInBar に揃える
  // (描画スリバー回避)
  if (todayInBar !== null && Math.abs(cScheduled - todayInBar) < 0.5) {
    cScheduled = todayInBar
  }

  // isOverdue: 期日超過 (today > rowEnd 厳格大なり、未完、completed 以外)
  // — aria-label の補足にのみ使用。バー描画は status 色 + ハッチングで表現し、
  //   一律 bg-red-700 で塗りつぶす特殊レイヤーは仕様に反するため設けない。
  const isOverdue =
    today !== undefined &&
    rowEnd !== undefined &&
    status !== 'completed' &&
    today.getTime() > rowEnd.getTime() &&
    cActual < 100

  const ariaLabel = `進捗バー: ${STATUS_LABELS[status]} 実績${cActual}%${
    isOverdue ? ' (期日超過)' : ''
  }`

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

  // Layer 2 (斜線) の右端: today クランプ
  const hatchEnd = todayInBar !== null ? Math.min(cScheduled, todayInBar) : cScheduled
  const gapWidth = Math.max(0, hatchEnd - cActual)

  // Layer 4 (未来予定灰) の左端: today クランプ
  const futureLeft = todayInBar !== null ? Math.max(cScheduled, todayInBar) : cScheduled
  const futureWidth = Math.max(0, 100 - futureLeft)

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

      {/* 層2: 遅延ギャップ (actualPct〜min(scheduledPct, todayInBar))
          — SVG pattern で斜線ハッチング。
          overdue 時は todayInBar が 100 にクランプされ、ハッチが
          バー全幅まで延びる (status 色のハッチで未消化分を表現)。 */}
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

      {/* 層3: 未来予定エリア (max(scheduledPct, todayInBar)〜100)
          — overdue 時は futureWidth=0 で自動的に描画されない */}
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
