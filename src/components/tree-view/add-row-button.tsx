'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { validateAddRowForm } from './add-row-utils'

interface AddRowButtonProps {
  label: string
  onAdd: (name: string, startDate: Date, endDate: Date) => Promise<void>
}

export function AddRowButton({ label, onAdd }: AddRowButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleOpen() {
    setName('')
    setStartDate('')
    setEndDate('')
    setError(null)
    setOpen(true)
  }

  function handleCancel() {
    setOpen(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateAddRowForm(name, startDate, endDate)
    if (err) {
      setError(err)
      return
    }
    setSubmitting(true)
    try {
      await onAdd(name.trim(), new Date(startDate), new Date(endDate))
      setOpen(false)
      setError(null)
    } catch {
      setError('追加に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={handleOpen}
        className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600"
      >
        + {label}
      </Button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
    >
      <input
        type="text"
        placeholder="名前"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={submitting}
        className="min-w-32 flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        autoFocus
      />
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        disabled={submitting}
        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      />
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        disabled={submitting}
        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      />
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
      <div className="flex gap-1">
        <Button type="submit" variant="primary" disabled={submitting} className="px-3 py-1 text-xs">
          追加
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleCancel}
          disabled={submitting}
          className="px-3 py-1 text-xs"
        >
          キャンセル
        </Button>
      </div>
    </form>
  )
}
