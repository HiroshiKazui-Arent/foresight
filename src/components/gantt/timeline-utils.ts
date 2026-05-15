/**
 * ガントチャート共有座標系ヘルパー
 *
 * xForDate / barOffsetWidth は getTime() 差分のみで計算するためタイムゾーン非依存。
 * monthBoundaries は Date.UTC(year, month, 1) で UTC 月初を生成するため
 * サーバー (Docker/UTC) とブラウザ (JST) でも同一結果を返す。
 * projectStart === projectEnd の場合はゼロ除算ガードとして 0 / 空を返す。
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
 */
export function barOffsetWidth(
  rowStart: Date,
  rowEnd: Date,
  projectStart: Date,
  projectEnd: Date,
): { left: number; width: number } {
  if (projectEnd.getTime() <= projectStart.getTime()) return { left: 0, width: 0 }

  // xForDate が [0,100] にクランプ済みのため追加クランプ不要。
  // rowEnd < rowStart の逆転バーは width=0 を返す。
  const left = xForDate(rowStart, projectStart, projectEnd)
  const right = xForDate(rowEnd, projectStart, projectEnd)
  const width = Math.max(0, right - left)

  return { left, width }
}

/**
 * projectStart〜projectEnd の間に含まれる月初 (1日) の Date 配列と
 * 各月初の x 座標 (%) を返す。
 * projectStart 自身が月初であれば配列に含む。
 * projectStart === projectEnd の場合は空配列を返す。
 */
export function monthBoundaries(projectStart: Date, projectEnd: Date): { date: Date; x: number }[] {
  const totalMs = projectEnd.getTime() - projectStart.getTime()
  if (totalMs === 0) return []

  const result: { date: Date; x: number }[] = []

  // projectStart の月から走査を開始する
  // 月初を Date.UTC(year, month, 1) で生成 (UTC 日付) → サーバー/ブラウザで同一結果
  let year = projectStart.getUTCFullYear()
  let month = projectStart.getUTCMonth()

  while (true) {
    const candidate = new Date(Date.UTC(year, month, 1))
    if (candidate.getTime() > projectEnd.getTime()) break

    if (candidate.getTime() >= projectStart.getTime()) {
      const x = xForDate(candidate, projectStart, projectEnd)
      result.push({ date: candidate, x })
    }

    // 次の月へ
    month++
    if (month > 11) {
      month = 0
      year++
    }
  }

  return result
}
