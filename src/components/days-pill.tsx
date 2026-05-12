interface DaysPillProps {
  days: number
}

export function DaysPill({ days }: DaysPillProps) {
  const isLate = days < 0
  return (
    <span className={`text-sm font-medium ${isLate ? 'text-red-600' : 'text-green-600'}`}>
      {days > 0 ? '+' : ''}
      {Math.round(days)}日
    </span>
  )
}
