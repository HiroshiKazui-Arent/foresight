'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import {
  createTodoTemplate,
  updateTodoTemplate,
  deleteTodoTemplate,
  moveTodoTemplate,
} from '@/server/actions/todo-template'
import type { TodoTemplate } from '@prisma/client'

function isNextNavigationError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('digest' in e)) return false
  const digest = (e as { digest?: unknown }).digest
  return (
    digest === 'NEXT_REDIRECT' ||
    digest === 'NEXT_NOT_FOUND' ||
    (typeof digest === 'string' && digest.startsWith('NEXT_'))
  )
}

interface Props {
  templates: TodoTemplate[]
}

export function TodoTemplatesClient({ templates }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // インライン編集
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addName.trim()) {
      setAddError('名前を入力してください')
      return
    }
    setAddLoading(true)
    setAddError('')
    try {
      await createTodoTemplate(addName)
      setAddName('')
      setAddOpen(false)
      router.refresh()
    } catch (err) {
      if (isNextNavigationError(err)) throw err
      setAddError(err instanceof Error ? err.message : '作成に失敗しました')
    } finally {
      setAddLoading(false)
    }
  }

  function handleAddOpenChange(open: boolean) {
    setAddOpen(open)
    if (!open) {
      setAddName('')
      setAddError('')
    }
  }

  function startEdit(tpl: TodoTemplate) {
    setEditingId(tpl.id)
    setEditingName(tpl.name)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  async function commitEdit(id: string) {
    if (editingId !== id) return
    setEditingId(null)
    if (!editingName.trim()) {
      router.refresh()
      return
    }
    try {
      await updateTodoTemplate(id, editingName)
      router.refresh()
    } catch (err) {
      if (isNextNavigationError(err)) throw err
      setActionError(err instanceof Error ? err.message : '更新に失敗しました')
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        'このテンプレートを削除しますか？\n削除後に作成するタスクには展開されなくなります。',
      )
    )
      return
    setActionError(null)
    try {
      await deleteTodoTemplate(id)
      router.refresh()
    } catch (err) {
      if (isNextNavigationError(err)) throw err
      setActionError(err instanceof Error ? err.message : '削除に失敗しました')
    }
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    setActionError(null)
    try {
      await moveTodoTemplate(id, direction)
      router.refresh()
    } catch (err) {
      if (isNextNavigationError(err)) throw err
      setActionError(err instanceof Error ? err.message : '移動に失敗しました')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">テンプレート管理</h1>

      {actionError && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">標準 ToDo テンプレート ({templates.length} 件)</h2>
          <Dialog open={addOpen} onOpenChange={handleAddOpenChange}>
            <DialogTrigger asChild>
              <Button variant="primary">+ テンプレートを追加</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>テンプレートを追加</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                {addError && (
                  <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {addError}
                  </div>
                )}
                <Input
                  label="テンプレート名"
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="例: コードレビュー"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      キャンセル
                    </Button>
                  </DialogClose>
                  <Button type="submit" variant="primary" disabled={addLoading}>
                    {addLoading ? '追加中...' : '追加'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">テンプレートがありません。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="w-16 pb-2 font-medium">順番</th>
                <th className="pb-2 font-medium">名前</th>
                <th className="w-24 pb-2"></th>
                <th className="w-16 pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl, idx) => (
                <tr key={tpl.id} className="border-b last:border-0">
                  <td className="py-2 text-gray-400">{idx + 1}</td>
                  <td className="py-2">
                    {editingId === tpl.id ? (
                      <input
                        ref={editInputRef}
                        className="w-full rounded border border-blue-400 px-2 py-1 text-sm outline-none"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => commitEdit(tpl.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(tpl.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                    ) : (
                      <span
                        className="cursor-pointer rounded px-1 hover:bg-gray-100"
                        onClick={() => startEdit(tpl)}
                        title="クリックして編集"
                      >
                        {tpl.name}
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        onClick={() => handleMove(tpl.id, 'up')}
                        disabled={idx === 0}
                        title="上に移動"
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleMove(tpl.id, 'down')}
                        disabled={idx === templates.length - 1}
                        title="下に移動"
                      >
                        ↓
                      </Button>
                    </div>
                  </td>
                  <td className="py-2">
                    <Button
                      variant="ghost"
                      onClick={() => handleDelete(tpl.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      削除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-gray-400">
        ※ 新規タスク作成時にこの順序でデフォルト ToDo
        が自動展開されます。既存タスクには影響しません。
      </p>
    </div>
  )
}
