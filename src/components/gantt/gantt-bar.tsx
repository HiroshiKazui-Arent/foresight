import { useId } from 'react'
import type { ProgressStatus, RenderStatus } from '@/types/progress'
import { barOffsetWidth, xForDate } from '@/components/gantt/timeline-utils'

// ---------------------------------------------------------------------------
// Legacy discriminated union (status 駆動)
// ---------------------------------------------------------------------------

// 日付プロパティは全 5 つ (projectStart/projectEnd/rowStart/rowEnd/today) 揃えて
// 渡すか、全て省略するかのどちらか (discriminated union)。
// プレビュー用途のみ Legacy variant (全省略) を使う。
type GanttBarPropsWithDates = {
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  renderStatus?: never
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
  renderStatus?: never
  projectStart?: never
  projectEnd?: never
  rowStart?: never
  rowEnd?: never
  today?: never
}

// ---------------------------------------------------------------------------
// New renderStatus-driven variant
// ---------------------------------------------------------------------------

type GanttBarPropsWithRenderStatus = {
  actualPct: number
  scheduledPct: number
  renderStatus: RenderStatus
  status?: never
  projectStart: Date
  projectEnd: Date
  rowStart: Date
  rowEnd: Date
  today: Date
}

type GanttBarProps = GanttBarPropsWithRenderStatus | GanttBarPropsWithDates | GanttBarPropsLegacy

// ---------------------------------------------------------------------------
// Shared constants (legacy path)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// New renderStatus labels
// ---------------------------------------------------------------------------

const RENDER_STATUS_LABELS: Record<RenderStatus, string> = {
  scheduled: '予定',
  completed: '完了',
  'ahead-of-schedule': '先行',
  'delayed-pre-deadline': '遅延',
  'overdue-past-deadline': '超過',
  'not-started-overdue': '未着',
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0
  return Math.max(0, Math.min(100, pct))
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function GanttBar(props: GanttBarProps) {
  const uid = useId()

  if (props.renderStatus !== undefined) {
    return <GanttBarRenderStatusVariant {...(props as GanttBarPropsWithRenderStatus)} uid={uid} />
  }

  // Legacy status-driven path
  const { projectStart, projectEnd, rowStart, rowEnd, today, actualPct, scheduledPct, status } =
    props as GanttBarPropsWithDates | GanttBarPropsLegacy

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

      {/* 層2: 遅延ギャップ (actualPct〜min(scheduledPct, todayInBar)) */}
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

      {/* 層3: 未来予定エリア (max(scheduledPct, todayInBar)〜100) */}
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

// ---------------------------------------------------------------------------
// RenderStatus-driven variant (new 5-state rendering)
// ---------------------------------------------------------------------------

function GanttBarRenderStatusVariant({
  actualPct,
  scheduledPct,
  renderStatus,
  projectStart,
  projectEnd,
  rowStart,
  rowEnd,
  today,
  uid,
}: GanttBarPropsWithRenderStatus & { uid: string }) {
  // State 3 は today > rowEnd が定義上成立。State 4 は today >= rowStart であれば
  // today < rowEnd でも barRightDate = today を使う (仕様 Section 2 State 4)。
  const isExtended =
    renderStatus === 'overdue-past-deadline' || renderStatus === 'not-started-overdue'

  const barRightDate = isExtended ? today : rowEnd
  const { left, width } = barOffsetWidth(rowStart, barRightDate, projectStart, projectEnd)

  // bar-local coordinate: rowEnd position within [rowStart, barRightDate]
  const plannedEndX = isExtended ? xForDate(rowEnd, rowStart, barRightDate) : 100

  // actualPct/scheduledPct are % of [rowStart..rowEnd]; scale to extended bar
  const actualX = clampPct(isExtended ? (actualPct * plannedEndX) / 100 : actualPct)
  const scheduledX = clampPct(isExtended ? (scheduledPct * plannedEndX) / 100 : scheduledPct)
  const todayX = isExtended ? 100 : clampPct(xForDate(today, rowStart, rowEnd))

  // aria-label の「期日超過」は today が実際に rowEnd を超えた場合のみ
  const isOverdue = today.getTime() > rowEnd.getTime()
  const ariaLabel = `進捗バー: ${RENDER_STATUS_LABELS[renderStatus]} 実績${clampPct(actualPct)}%${
    isOverdue ? ' (期日超過)' : ''
  }`

  const orangeHatchId = `hatch-${uid}-orange`
  const redLightHatchId = `hatch-${uid}-red-light`

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '16px' }}
    >
      {/* State 0: scheduled — gray full-width div */}
      {renderStatus === 'scheduled' && (
        <div
          className="bg-gray-100"
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
        />
      )}

      {/* State 1: completed — green full-width div */}
      {renderStatus === 'completed' && (
        <div
          className="bg-green-500"
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
        />
      )}

      {/* State 5: ahead-of-schedule — green solid [0..aheadX%] + gray [aheadX..100%].
          不変条件: calcAggregateRenderStatus step 4 が today > rowEnd を弾くため、
          ahead-of-schedule は today <= rowEnd で発火する。よって isExtended は不要、
          バー wrapper は rowStart〜rowEnd で完結する。 */}
      {renderStatus === 'ahead-of-schedule' &&
        (() => {
          const aheadX = clampPct(actualPct)
          return (
            <>
              <div
                className="bg-green-500"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: `${aheadX}%`,
                  height: '100%',
                }}
              />
              {aheadX < 100 && (
                <div
                  className="bg-gray-100"
                  style={{
                    position: 'absolute',
                    left: `${aheadX}%`,
                    top: 0,
                    width: `${100 - aheadX}%`,
                    height: '100%',
                  }}
                />
              )}
            </>
          )
        })()}

      {/* States 2/3/4: SVG-based rendering */}
      {(renderStatus === 'delayed-pre-deadline' ||
        renderStatus === 'overdue-past-deadline' ||
        renderStatus === 'not-started-overdue') && (
        <svg
          viewBox="0 0 100 16"
          preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
          aria-hidden="true"
        >
          <defs>
            {/* Orange hatch: used for delayed gap in states 2 & 3 */}
            <pattern id={orangeHatchId} patternUnits="userSpaceOnUse" width="8" height="8">
              <line x1="0" y1="8" x2="8" y2="0" stroke="#f59e0b" strokeWidth="1.5" />
            </pattern>
            {/* Red-light hatch: light red background + red stroke, used in state 4 */}
            <pattern id={redLightHatchId} patternUnits="userSpaceOnUse" width="8" height="8">
              <rect width="8" height="8" fill="#fee2e2" />
              <line x1="0" y1="8" x2="8" y2="0" stroke="#ef4444" strokeWidth="1.5" />
            </pattern>
          </defs>

          {/* === State 2: delayed-pre-deadline === */}
          {renderStatus === 'delayed-pre-deadline' && (
            <>
              {/* Actual progress: amber solid */}
              {actualX > 0 && (
                <rect x={0} y={0} width={actualX} height={16} className="fill-amber-400" />
              )}
              {/* Delayed gap: orange hatch [actualX .. min(scheduledX, todayX)] */}
              {Math.max(0, Math.min(scheduledX, todayX) - actualX) > 0 && (
                <rect
                  x={actualX}
                  y={0}
                  width={Math.max(0, Math.min(scheduledX, todayX) - actualX)}
                  height={16}
                  fill={`url(#${orangeHatchId})`}
                />
              )}
              {/* Future gray [max(scheduledX, todayX) .. 100] */}
              {Math.max(0, 100 - Math.max(scheduledX, todayX)) > 0 && (
                <rect
                  x={Math.max(scheduledX, todayX)}
                  y={0}
                  width={Math.max(0, 100 - Math.max(scheduledX, todayX))}
                  height={16}
                  className="fill-gray-100"
                />
              )}
            </>
          )}

          {/* === State 3: overdue-past-deadline === */}
          {renderStatus === 'overdue-past-deadline' && (
            <>
              {/* Actual progress: amber solid [0 .. actualX] */}
              {actualX > 0 && (
                <rect x={0} y={0} width={actualX} height={16} className="fill-amber-400" />
              )}
              {/* Delayed gap: orange hatch [actualX .. plannedEndX] */}
              {plannedEndX - actualX > 0 && (
                <rect
                  x={actualX}
                  y={0}
                  width={plannedEndX - actualX}
                  height={16}
                  fill={`url(#${orangeHatchId})`}
                />
              )}
              {/* Overdue extension: red solid [plannedEndX .. 100] */}
              {100 - plannedEndX > 0 && (
                <rect
                  x={plannedEndX}
                  y={0}
                  width={100 - plannedEndX}
                  height={16}
                  className="fill-red-500"
                />
              )}
              {/* Planned-end vertical marker (only when bar is actually extended) */}
              {100 - plannedEndX > 0 && (
                <line
                  x1={plannedEndX}
                  y1={0}
                  x2={plannedEndX}
                  y2={16}
                  stroke="#1e293b"
                  strokeWidth="2"
                  className="planned-end-marker"
                />
              )}
            </>
          )}

          {/* === State 4: not-started-overdue === */}
          {renderStatus === 'not-started-overdue' && (
            <>
              {/* Planned range: light red hatch [0 .. plannedEndX] */}
              {plannedEndX > 0 && (
                <rect
                  x={0}
                  y={0}
                  width={plannedEndX}
                  height={16}
                  fill={`url(#${redLightHatchId})`}
                />
              )}
              {/* Overdue extension: red solid [plannedEndX .. 100] */}
              {100 - plannedEndX > 0 && (
                <rect
                  x={plannedEndX}
                  y={0}
                  width={100 - plannedEndX}
                  height={16}
                  className="fill-red-500"
                />
              )}
              {/* Planned-end vertical marker */}
              <line
                x1={plannedEndX}
                y1={0}
                x2={plannedEndX}
                y2={16}
                stroke="#1e293b"
                strokeWidth="2"
                className="planned-end-marker"
              />
            </>
          )}
        </svg>
      )}
    </div>
  )
}
