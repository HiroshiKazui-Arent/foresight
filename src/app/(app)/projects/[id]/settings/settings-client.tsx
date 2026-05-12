'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { updateProject, deleteProject } from '@/server/actions/project'
import { createInvitation } from '@/server/actions/invitation'

interface Member {
  id: string
  name: string
  email: string
}

interface ProjectSettingsProps {
  project: {
    id: string
    name: string
    startDate: string
    endDate: string
    members: Member[]
  }
}

function toDateInput(iso: string) {
  return iso.split('T')[0]
}

export function ProjectSettingsClient({ project }: ProjectSettingsProps) {
  const router = useRouter()

  // --- 基本情報編集 ---
  const [name, setName] = useState(project.name)
  const [startDate, setStartDate] = useState(toDateInput(project.startDate))
  const [endDate, setEndDate] = useState(toDateInput(project.endDate))
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editSaved, setEditSaved] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !startDate || !endDate) {
      setEditError('すべての項目を入力してください')
      return
    }
    setEditSaving(true)
    setEditError('')
    setEditSaved(false)
    try {
      await updateProject(project.id, {
        name: name.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
      setEditSaved(true)
      router.refresh()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setEditSaving(false)
    }
  }

  // --- 招待 ---
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) {
      setInviteError('メールアドレスを入力してください')
      return
    }
    setInviteLoading(true)
    setInviteError('')
    setInviteLink('')
    try {
      const { token } = await createInvitation(inviteEmail.trim(), project.id)
      setInviteLink(window.location.origin + '/invite/' + token)
      setInviteEmail('')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : '招待の作成に失敗しました')
    } finally {
      setInviteLoading(false)
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  function handleInviteOpenChange(open: boolean) {
    setInviteOpen(open)
    if (!open) {
      setInviteEmail('')
      setInviteLink('')
      setInviteError('')
      setInviteCopied(false)
    }
  }

  // --- プロジェクト削除 ---
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleDelete() {
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await deleteProject(project.id)
      router.push('/projects')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '削除に失敗しました')
      setDeleteLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← プロジェクトへ戻る
        </Link>
        <h1 className="text-2xl font-bold">プロジェクト設定</h1>
      </div>

      {/* 基本情報 */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">基本情報</h2>
        <form onSubmit={handleSave} className="space-y-4">
          {editError && (
            <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {editError}
            </div>
          )}
          {editSaved && (
            <div className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
              保存しました
            </div>
          )}
          <Input
            label="プロジェクト名"
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setEditSaved(false)
            }}
          />
          <Input
            label="開始日"
            type="date"
            required
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setEditSaved(false)
            }}
          />
          <Input
            label="終了日"
            type="date"
            required
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setEditSaved(false)
            }}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={editSaving}>
              {editSaving ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </section>

      {/* メンバー一覧 */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">メンバー ({project.members.length}人)</h2>
          <Dialog open={inviteOpen} onOpenChange={handleInviteOpenChange}>
            <DialogTrigger asChild>
              <Button variant="secondary">+ メンバーを招待</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>メンバーを招待</DialogTitle>
              </DialogHeader>
              {!inviteLink ? (
                <form onSubmit={handleInvite} className="space-y-4">
                  {inviteError && (
                    <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {inviteError}
                    </div>
                  )}
                  <Input
                    label="招待するメールアドレス"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">
                        キャンセル
                      </Button>
                    </DialogClose>
                    <Button type="submit" variant="primary" disabled={inviteLoading}>
                      {inviteLoading ? '生成中...' : '招待リンクを生成'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    招待リンクを相手に手渡しで共有してください。
                  </p>
                  <div className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2">
                    <span className="flex-1 truncate text-xs text-gray-700">{inviteLink}</span>
                    <Button type="button" variant="secondary" onClick={copyInviteLink}>
                      {inviteCopied ? 'コピー済み' : 'コピー'}
                    </Button>
                  </div>
                  <div className="flex justify-end">
                    <DialogClose asChild>
                      <Button type="button" variant="primary">
                        閉じる
                      </Button>
                    </DialogClose>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 font-medium">名前</th>
              <th className="pb-2 font-medium">メール</th>
            </tr>
          </thead>
          <tbody>
            {project.members.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="py-2">{m.name}</td>
                <td className="py-2 text-gray-600">{m.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 危険ゾーン */}
      <section className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-red-700">危険ゾーン</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">プロジェクトを削除</p>
            <p className="text-xs text-gray-500">
              削除すると元に戻せません。すべてのデータが失われます。
            </p>
          </div>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">削除</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>プロジェクトを削除しますか？</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  「{project.name}」を削除します。マイルストーン・タスク・ToDo
                  を含む全データが失われます。この操作は元に戻せません。
                </p>
                {deleteError && (
                  <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {deleteError}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      キャンセル
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleteLoading}
                    onClick={handleDelete}
                  >
                    {deleteLoading ? '削除中...' : '削除する'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </div>
  )
}
