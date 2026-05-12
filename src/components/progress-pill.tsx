interface ProgressPillProps {
  actualPct: number
  scheduledPct: number
}

export function ProgressPill({ actualPct, scheduledPct }: ProgressPillProps) {
  return (
    <span className="text-sm text-gray-700">
      {Math.round(actualPct)}% / {Math.round(scheduledPct)}%
    </span>
  )
}
