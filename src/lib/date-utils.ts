export const toDateInputValue = (d: Date) => d.toISOString().slice(0, 10)
export const fromDateInputValue = (s: string) => new Date(s + 'T00:00:00Z')

/**
 * 2 つの日付の間の日数を返す。同日(start === end)の場合は 1 を返す。
 * 両端を含む定義。計算式: max(1, ceil((end - start) / 86400000))
 * ゼロ除算回避 + 同日タスクも最低 1 日扱い。
 */
export function daysBetween(start: Date, end: Date): number {
  const diff = (end.getTime() - start.getTime()) / 86400000
  return Math.max(1, Math.ceil(diff))
}

/**
 * 日付に n 日を加算した新しい Date を返す。
 */
export function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86400000)
}

/**
 * date を [min, max] の範囲にクランプした新しい Date を返す。
 */
export function clampDate(date: Date, min: Date, max: Date): Date {
  if (date < min) return new Date(min)
  if (date > max) return new Date(max)
  return new Date(date)
}
