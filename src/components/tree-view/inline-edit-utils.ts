/**
 * インライン編集のバリデーションユーティリティ
 */

export function validateInlineEditValue(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  if (trimmed.length > 255) return false
  return true
}

export function trimValue(value: string): string {
  return value.trim()
}
