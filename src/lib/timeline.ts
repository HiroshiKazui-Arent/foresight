/**
 * タイムライン共有座標系ヘルパー (lib 層)
 *
 * components/gantt/timeline-utils.ts と同一ロジックを lib 層として提供。
 * G1 (S8) / G2 (S6) 両方から @/lib/timeline として import できるようにする。
 *
 * xForDate / barOffsetWidth は getTime() 差分のみで計算するためタイムゾーン非依存。
 */

/**
 * 日付 d の x 座標を 0〜100 (%) で返す。
 * d < projectStart → 0, d > projectEnd → 100 にクランプ。
 */
export function xForDate(d: Date, projectStart: Date, projectEnd: Date): number {
  const totalMs = projectEnd.getTime() - projectStart.getTime()
  if (!Number.isFinite(totalMs) || totalMs === 0) return 0
  const elapsedMs = d.getTime() - projectStart.getTime()
  if (!Number.isFinite(elapsedMs)) return 0
  const raw = (elapsedMs / totalMs) * 100
  return Math.max(0, Math.min(100, raw))
}

/**
 * バーの左端 (%) と幅 (%) を返す。
 * rowStart / rowEnd がプロジェクト期間外にはみ出す場合もクランプ。
 * rowEnd < rowStart の逆転バーは width=0 を返す。
 */
export function barOffsetWidth(
  rowStart: Date,
  rowEnd: Date,
  projectStart: Date,
  projectEnd: Date,
): { left: number; width: number } {
  if (projectEnd.getTime() <= projectStart.getTime()) return { left: 0, width: 0 }

  const left = xForDate(rowStart, projectStart, projectEnd)
  const right = xForDate(rowEnd, projectStart, projectEnd)
  const width = Math.max(0, right - left)

  return { left, width }
}
