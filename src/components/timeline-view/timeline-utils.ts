type DateRange = {
  startDate: Date
  endDate: Date
}

export type BarPosition = {
  offsetPct: number
  widthPct: number
}

export type TodayLine = {
  showTodayLine: boolean
  todayOffsetPct: number
}

export function calcBarPosition(item: DateRange, scope: DateRange): BarPosition {
  const scopeRangeMs = scope.endDate.getTime() - scope.startDate.getTime()

  if (scopeRangeMs <= 0) {
    return { offsetPct: 0, widthPct: 100 }
  }

  const rawOffset = ((item.startDate.getTime() - scope.startDate.getTime()) / scopeRangeMs) * 100
  const rawWidth = ((item.endDate.getTime() - item.startDate.getTime()) / scopeRangeMs) * 100

  const offsetPct = Math.max(0, Math.min(100, rawOffset))
  const widthPct = Math.max(1, Math.min(100 - offsetPct, rawWidth))

  return { offsetPct, widthPct }
}

export function calcTodayLine(today: Date, scope: DateRange): TodayLine {
  const scopeRangeMs = scope.endDate.getTime() - scope.startDate.getTime()

  if (scopeRangeMs <= 0) {
    return { showTodayLine: false, todayOffsetPct: -1 }
  }

  const todayOffsetPct = ((today.getTime() - scope.startDate.getTime()) / scopeRangeMs) * 100
  const showTodayLine = todayOffsetPct >= 0 && todayOffsetPct <= 100

  return { showTodayLine, todayOffsetPct }
}
