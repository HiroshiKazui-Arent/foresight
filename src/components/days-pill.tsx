import { calcRealDaysDeviation } from '@/lib/progress'

type DaysPillProps =
  | { days: number }
  | {
      today: Date
      rowEnd: Date
      actualPct: number
      scheduledPct: number
      durationDays: number
    }

export function DaysPill(props: DaysPillProps) {
  const days =
    'days' in props
      ? props.days
      : calcRealDaysDeviation(
          props.today,
          props.rowEnd,
          props.actualPct,
          props.scheduledPct,
          props.durationDays,
        )
  const isLate = days < 0
  return (
    <span className={`text-sm font-medium ${isLate ? 'text-red-600' : 'text-green-600'}`}>
      {days > 0 ? '+' : ''}
      {Math.round(days)}日
    </span>
  )
}
