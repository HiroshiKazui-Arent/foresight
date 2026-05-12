/**
 * AddRowButton フォームのバリデーションユーティリティ
 * 返り値: エラーメッセージ文字列（エラーなしの場合は null）
 */

export function validateAddRowForm(
  name: string,
  startDateStr: string,
  endDateStr: string,
): string | null {
  if (!name.trim()) return '名前を入力してください'
  if (!startDateStr) return '開始日を入力してください'
  if (!endDateStr) return '終了日を入力してください'

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)

  if (isNaN(startDate.getTime())) return '有効な開始日を入力してください'
  if (isNaN(endDate.getTime())) return '有効な終了日を入力してください'
  if (startDate.getTime() >= endDate.getTime()) return '開始日は終了日より前にしてください'

  return null
}
