/**
 * 今日線オーバーレイコンポーネント
 *
 * todayX が 0〜100 の範囲外のときは null を返す。
 */

/**
 * todayX が 0〜100 (%) の有効範囲内かどうかを返す。
 * コンポーネントの表示判定とテストの両方に使用する。
 */
export function isValidTodayX(x: number): boolean {
  return x >= 0 && x <= 100
}

interface TodayLineProps {
  todayX: number // 0〜100 (%)
}

export function TodayLine({ todayX }: TodayLineProps) {
  if (!isValidTodayX(todayX)) return null

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500"
      style={{ left: `${todayX}%` }}
      aria-label="今日の位置"
    />
  )
}
