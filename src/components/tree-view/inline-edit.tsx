'use client'

import { useState, useRef, useEffect } from 'react'
import { validateInlineEditValue, trimValue } from './inline-edit-utils'

interface InlineEditProps {
  value: string
  onSave: (value: string) => Promise<void>
  className?: string
}

export function InlineEdit({ value, onSave, className }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function startEditing() {
    setDraft(value)
    setError(null)
    setEditing(true)
  }

  function cancel() {
    setDraft(value)
    setError(null)
    setEditing(false)
  }

  async function save() {
    if (saving) return
    const trimmed = trimValue(draft)
    if (!validateInlineEditValue(trimmed)) {
      setError('名前は1〜255文字で入力してください')
      return
    }
    setSaving(true)
    try {
      await onSave(trimmed)
      setEditing(false)
      setError(null)
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      cancel()
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className={`rounded text-left hover:underline focus:ring-1 focus:ring-blue-400 focus:outline-none ${className ?? ''}`}
      >
        {value}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className={`rounded border border-blue-400 px-1.5 py-0.5 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50 ${className ?? ''}`}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
