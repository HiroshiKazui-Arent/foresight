'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Todo } from '@prisma/client'
import { CompletedCheckbox } from './completed-checkbox'
import { submitDailyReport } from '@/server/actions/daily-report'

interface TodoInputRowProps {
  todo: Todo
  projectId: string
}

export function TodoInputRow({ todo, projectId }: TodoInputRowProps) {
  const router = useRouter()
  const [completed, setCompleted] = useState(todo.completed)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(checked: boolean) {
    if (saving) return
    const previous = completed
    setCompleted(checked)
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await submitDailyReport(todo.id, projectId, checked)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch {
      setCompleted(previous)
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ml-12 flex flex-col gap-0.5 py-1">
      <div className="flex items-center gap-3 text-sm">
        <span className="min-w-0 flex-1 truncate text-gray-700">{todo.name}</span>
        <div className="flex shrink-0 items-center gap-2">
          <CompletedCheckbox checked={completed} onChange={handleChange} disabled={saving} />
          <span className="text-xs text-gray-400" aria-live="polite">
            {saving ? '保存中' : saved ? '✓' : ''}
          </span>
        </div>
      </div>
      {error && (
        <span aria-live="polite" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}
