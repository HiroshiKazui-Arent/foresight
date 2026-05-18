'use client'

import { useState } from 'react'

export type ManagementLevel = 'project' | 'milestone' | 'task' | 'todo'

const LEVEL_MARK: Record<ManagementLevel, string> = {
  project: 'P',
  milestone: 'M',
  task: 'T',
  todo: 'To',
}

const LEVEL_INDENT: Record<ManagementLevel, number> = {
  project: 0,
  milestone: 1,
  task: 2,
  todo: 3,
}

const LEVEL_MARK_COLOR: Record<ManagementLevel, string> = {
  project: 'bg-purple-100 text-purple-700',
  milestone: 'bg-amber-100 text-amber-700',
  task: 'bg-blue-100 text-blue-700',
  todo: 'bg-slate-100 text-slate-600',
}

interface ManagementRowProps {
  level: ManagementLevel
  name: string
  startDate: Date
  endDate: Date
  onUpdateName: (name: string) => void | Promise<void>
  onUpdateDates: (startDate: Date, endDate: Date) => void | Promise<void>
  onAddSibling?: () => void | Promise<void>
  onDelete?: () => void | Promise<void>
  // 折り畳みトグル用 props
  id?: string
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
}

// 日付は UTC で取り扱う。
// Prisma から渡される DateTime は `2026-04-01T00:00:00.000Z` 形式 (UTC 00:00)、
// 既存コードベース (add-row-button.tsx 等) も `new Date('2026-04-01')` を使用しており
// 同様に UTC 00:00 として解釈される。ローカル時刻系の getFullYear/getMonth/getDate と
// 数値コンストラクタ Date(y, m-1, d) は UTC+9 (Tokyo) 等で 1 日ズレるため使わない。
function toDateInputValue(d: Date): string {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseDateInputValue(value: string): Date | null {
  if (!value) return null
  // ISO 日付文字列 (YYYY-MM-DD) は仕様で UTC として解釈される
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

export function ManagementRow({
  level,
  name,
  startDate,
  endDate,
  onUpdateName,
  onUpdateDates,
  onAddSibling,
  onDelete,
  id,
  expandable = false,
  expanded = true,
  onToggle,
}: ManagementRowProps) {
  const indent = LEVEL_INDENT[level]
  const [nameDraft, setNameDraft] = useState(name)
  const [startDraft, setStartDraft] = useState(toDateInputValue(startDate))
  const [endDraft, setEndDraft] = useState(toDateInputValue(endDate))
  const [error, setError] = useState<string | null>(null)

  // プロジェクト行は本画面では兄弟追加/削除を禁止(spec v4.0 2.4: G2 は構成編集に限る、Project 自体は A1 で管理)
  const canAddSibling = level !== 'project'
  const canDelete = level !== 'project'

  async function commitName() {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed.length > 255) {
      setError('名前は1〜255文字で入力してください')
      setNameDraft(name)
      return
    }
    if (trimmed === name) return
    setError(null)
    try {
      await onUpdateName(trimmed)
    } catch (e) {
      // ブラウザ DevTools / 外部エラー報告に Prisma 内部情報を漏らさないよう message のみ記録
      console.error('updateName failed:', e instanceof Error ? e.message : String(e))
      setError(e instanceof Error ? e.message : '保存に失敗しました')
      setNameDraft(name)
    }
  }

  async function commitDates() {
    const newStart = parseDateInputValue(startDraft)
    const newEnd = parseDateInputValue(endDraft)
    if (!newStart || !newEnd) {
      setError('有効な日付を入力してください')
      setStartDraft(toDateInputValue(startDate))
      setEndDraft(toDateInputValue(endDate))
      return
    }
    if (newStart.getTime() >= newEnd.getTime()) {
      setError('開始日は終了日より前にしてください')
      setStartDraft(toDateInputValue(startDate))
      setEndDraft(toDateInputValue(endDate))
      return
    }
    if (newStart.getTime() === startDate.getTime() && newEnd.getTime() === endDate.getTime()) return
    setError(null)
    try {
      await onUpdateDates(newStart, newEnd)
    } catch (e) {
      console.error('updateDates failed:', e instanceof Error ? e.message : String(e))
      setError(e instanceof Error ? e.message : '保存に失敗しました')
      setStartDraft(toDateInputValue(startDate))
      setEndDraft(toDateInputValue(endDate))
    }
  }

  return (
    <div
      data-indent={indent}
      data-row-id={id}
      className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5 text-sm shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50"
      style={{ marginLeft: `${indent * 36}px` }}
    >
      {expandable ? (
        <button
          type="button"
          aria-label={expanded ? '折り畳む' : '展開する'}
          aria-expanded={expanded}
          onClick={onToggle}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        >
          {expanded ? '▼' : '▶'}
        </button>
      ) : (
        <span className="inline-block h-5 w-5 shrink-0" aria-hidden />
      )}
      <span
        aria-label={`レベル: ${level}`}
        className={`inline-flex h-6 w-7 shrink-0 items-center justify-center rounded text-xs font-semibold ${LEVEL_MARK_COLOR[level]}`}
      >
        {LEVEL_MARK[level]}
      </span>

      <input
        type="text"
        aria-label="工程名"
        value={nameDraft}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={commitName}
        className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 hover:border-gray-300 focus:border-blue-500 focus:outline-none"
      />

      <input
        type="date"
        aria-label="予定開始日"
        value={startDraft}
        onChange={(e) => setStartDraft(e.target.value)}
        onBlur={commitDates}
        className="rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
      />

      <input
        type="date"
        aria-label="予定終了日"
        value={endDraft}
        onChange={(e) => setEndDraft(e.target.value)}
        onBlur={commitDates}
        className="rounded border border-gray-300 px-1 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
      />

      {canAddSibling && onAddSibling && (
        <button
          type="button"
          aria-label="同階層を追加"
          onClick={() => onAddSibling()}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-blue-600"
          title="同階層を追加"
        >
          +
        </button>
      )}

      {canDelete && onDelete && (
        <button
          type="button"
          aria-label="削除"
          onClick={() => onDelete()}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-red-100 hover:text-red-600"
          title="削除"
        >
          ×
        </button>
      )}

      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}
