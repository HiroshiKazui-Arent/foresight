'use client'

import { useState } from 'react'

interface ProgressInputRowProps {
  todoId: string
  name: string
  scheduledStartDate: Date
  scheduledEndDate: Date
  actualStartDate: Date | null
  actualEndDate: Date | null
  onSave: (data: { actualStartDate: Date | null; actualEndDate: Date | null }) => Promise<void>
}

// UTC 統一 (management-row.tsx と同じ理由: ローカル時刻系で 1 日ズレ防止)
function toDateInputValue(d: Date | null): string {
  if (!d) return ''
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// 「未入力」と「不正な値」を区別するため判別共用体を使う。
// 旧実装は invalid と null を同じく null に潰しており、不正入力時に
// 既存の日付を黙って削除してしまう silent failure があった。
type ParseResult = { ok: true; value: Date | null } | { ok: false }
function parseDateInputValue(value: string): ParseResult {
  if (!value) return { ok: true, value: null }
  const date = new Date(value)
  if (isNaN(date.getTime())) return { ok: false }
  return { ok: true, value: date }
}

// Next.js の redirect()/notFound() は特殊な throw を投げる。
// クライアント側で setError に変換せず再 throw して RSC レイヤーに処理させる。
function isNextNavigationError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('digest' in e)) return false
  const digest = (e as { digest?: unknown }).digest
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') || digest === 'NEXT_NOT_FOUND')
  )
}

export function ProgressInputRow({
  todoId,
  name,
  actualStartDate,
  actualEndDate,
  onSave,
}: ProgressInputRowProps) {
  const [startDraft, setStartDraft] = useState(toDateInputValue(actualStartDate))
  const [endDraft, setEndDraft] = useState(toDateInputValue(actualEndDate))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // 完了判定は parsed end が「ok かつ非 null」のときのみ true
  const parsedEnd = parseDateInputValue(endDraft)
  const isCompleted = parsedEnd.ok && parsedEnd.value !== null
  const progressBadge = isCompleted ? '100%' : '0%'
  // emerald-800 で WCAG AA (>=4.5:1) を確保
  const badgeClass = isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'

  async function commit(nextStart: string, nextEnd: string) {
    // 並行 commit を防ぐ: 既に保存中なら blur を無視
    if (saving) return

    const startResult = parseDateInputValue(nextStart)
    const endResult = parseDateInputValue(nextEnd)

    if (!startResult.ok) {
      setError('有効な着手日を入力してください')
      setStartDraft(toDateInputValue(actualStartDate))
      return
    }
    if (!endResult.ok) {
      setError('有効な完了日を入力してください')
      setEndDraft(toDateInputValue(actualEndDate))
      return
    }

    const start = startResult.value
    const end = endResult.value

    if (end !== null && start === null) {
      setError('完了日を入力する場合は着手日も入力してください')
      return
    }
    if (start !== null && end !== null && start.getTime() > end.getTime()) {
      setError('着手日は完了日より前 (または同日) にしてください')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave({ actualStartDate: start, actualEndDate: end })
    } catch (e) {
      if (isNextNavigationError(e)) throw e // Next.js に navigation を任せる
      console.error('updateTodoActualDates failed:', e instanceof Error ? e.message : String(e))
      setError(e instanceof Error ? e.message : '保存に失敗しました')
      // 失敗時は元の値に戻す
      setStartDraft(toDateInputValue(actualStartDate))
      setEndDraft(toDateInputValue(actualEndDate))
    } finally {
      setSaving(false)
    }
  }

  function onStartBlur() {
    if (startDraft === toDateInputValue(actualStartDate)) return
    void commit(startDraft, endDraft).catch((e) => console.error('Unhandled start blur error:', e))
  }

  function onEndBlur() {
    if (endDraft === toDateInputValue(actualEndDate)) return
    void commit(startDraft, endDraft).catch((e) => console.error('Unhandled end blur error:', e))
  }

  return (
    <div
      data-todo-id={todoId}
      aria-busy={saving}
      className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm shadow-sm"
    >
      <span
        aria-label="レベル: todo"
        className="inline-flex h-6 w-7 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-600"
      >
        To
      </span>

      <input
        type="text"
        readOnly
        aria-label="ToDo 名"
        value={name}
        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-gray-700"
      />

      <input
        type="date"
        aria-label="着手日"
        value={startDraft}
        onChange={(e) => setStartDraft(e.target.value)}
        onBlur={onStartBlur}
        disabled={saving}
        className="rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
      />

      <input
        type="date"
        aria-label="完了日"
        value={endDraft}
        onChange={(e) => setEndDraft(e.target.value)}
        onBlur={onEndBlur}
        disabled={saving}
        className="rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
      />

      <span
        className={`inline-flex h-6 w-12 shrink-0 items-center justify-center rounded text-xs font-semibold ${badgeClass}`}
      >
        {progressBadge}
      </span>

      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}
