'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Todo } from '@prisma/client'
import { ProgressInput } from './progress-input'
import { CompletedCheckbox } from './completed-checkbox'
import { submitDailyReport } from '@/server/actions/daily-report'

interface TodoInputRowProps {
  todo: Todo
  projectId: string
}

export function TodoInputRow({ todo, projectId }: TodoInputRowProps) {
  const router = useRouter()
  const [actualPct, setActualPct] = useState(todo.actualPct)
  const [completed, setCompleted] = useState(todo.completed)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await submitDailyReport(todo.id, projectId, actualPct, completed)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  function handleCompletedChange(checked: boolean) {
    setCompleted(checked)
    if (checked) setActualPct(100)
  }

  return (
    <div className="ml-12 flex flex-col gap-0.5 py-1">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 text-sm">
        <span className="min-w-0 flex-1 truncate text-gray-700">{todo.name}</span>
        <div className="flex shrink-0 items-center gap-2">
          <CompletedCheckbox
            checked={completed}
            onChange={handleCompletedChange}
            disabled={saving}
          />
          <ProgressInput value={actualPct} onChange={setActualPct} disabled={saving || completed} />
          <button
            type="submit"
            disabled={saving}
            aria-busy={saving}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '保存中' : saved ? '保存済み ✓' : '保存'}
          </button>
        </div>
      </form>
      {error && (
        <span aria-live="polite" className="ml-0 text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}
