'use client'

import { useState } from 'react'
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
import { createInvitation, revokeInvitation } from '@/server/actions/invitation'

interface UserItem {
  id: string
  name: string
  email: string
  createdAt: string
}

interface InvitationItem {
  id: string
  email: string
  status: string
  expiresAt: string
  createdAt: string
  project: { id: string; name: string } | null
  invitedBy: { name: string }
}

interface UsersClientProps {
  users: UserItem[]
  invitations: InvitationItem[]
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '招待中',
  ACCEPTED: '受諾済',
  REVOKED: '取り消し済',
  EXPIRED: '期限切れ',
}

// UTC 年月日を YYYY/M/D 形式に変換 (hydration mismatch 防止)
function fmtDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return `${dt.getUTCFullYear()}/${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`
}

export function UsersClient({ users, invitations }: UsersClientProps) {
  const router = useRouter()

  // --- 招待ダイアログ ---
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
      const { token } = await createInvitation(inviteEmail.trim())
      setInviteLink(window.location.origin + '/invite/' + token)
      setInviteEmail('')
      router.refresh()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : '招待の作成に失敗しました')
    } finally {
      setInviteLoading(false)
    }
  }

  async function copyLink() {
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

  // --- 招待取り消し ---
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  async function handleRevoke(invitationId: string) {
    setRevokingId(invitationId)
    setRevokeError(null)
    try {
      await revokeInvitation(invitationId)
      router.refresh()
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : '取り消しに失敗しました')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-2xl font-bold">ユーザー管理</h1>

      {/* ユーザー一覧 */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">ユーザー一覧 ({users.length}人)</h2>
        {users.length === 0 ? (
          <p className="text-sm text-gray-500">ユーザーがいません。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">名前</th>
                <th className="pb-2 font-medium">メール</th>
                <th className="pb-2 font-medium">登録日</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2">{u.name}</td>
                  <td className="py-2 text-gray-600">{u.email}</td>
                  <td className="py-2 text-gray-400">{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 招待一覧 */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">招待一覧</h2>
          <Dialog open={inviteOpen} onOpenChange={handleInviteOpenChange}>
            <DialogTrigger asChild>
              <Button variant="primary">+ ユーザーを招待</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ユーザーを招待</DialogTitle>
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
                    <Button type="button" variant="secondary" onClick={copyLink}>
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
        {revokeError && (
          <div className="mb-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {revokeError}
          </div>
        )}
        {invitations.length === 0 ? (
          <p className="text-sm text-gray-500">招待はありません。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">メール</th>
                <th className="pb-2 font-medium">ステータス</th>
                <th className="pb-2 font-medium">有効期限</th>
                <th className="pb-2 font-medium">プロジェクト</th>
                <th className="pb-2 font-medium">招待者</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="py-2">{inv.email}</td>
                  <td className="py-2">
                    <span
                      className={
                        inv.status === 'PENDING'
                          ? 'rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800'
                          : inv.status === 'ACCEPTED'
                            ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800'
                            : 'rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600'
                      }
                    >
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-400">{fmtDate(inv.expiresAt)}</td>
                  <td className="py-2 text-gray-600">{inv.project?.name ?? '—'}</td>
                  <td className="py-2 text-gray-600">{inv.invitedBy.name}</td>
                  <td className="py-2">
                    {inv.status === 'PENDING' && (
                      <Button
                        variant="ghost"
                        onClick={() => handleRevoke(inv.id)}
                        disabled={revokingId === inv.id}
                      >
                        {revokingId === inv.id ? '取り消し中...' : '取り消し'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
