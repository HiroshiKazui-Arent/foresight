'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { acceptInvitation } from '@/server/actions/invitation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface AcceptInviteFormProps {
  token: string
  email: string
  projectName: string | null
}

export function AcceptInviteForm({ token, email, projectName }: AcceptInviteFormProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await acceptInvitation(token, name, password)

    if ('error' in result) {
      setError(result.error)
      setLoading(false)
      return
    }

    // acceptInvitation 成功 → next-auth/react の signIn でクライアントサイドログイン
    const signInResult = await signIn('credentials', {
      email: result.email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (signInResult?.error) {
      setError(
        'アカウントの作成は完了しましたが、サインインに失敗しました。ログインページからサインインしてください。',
      )
      return
    }

    router.push('/projects')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow">
        <div>
          <h1 className="text-center text-2xl font-bold text-gray-900">招待を承認</h1>
          {projectName && (
            <p className="mt-2 text-center text-sm text-gray-600">
              プロジェクト「{projectName}」への招待
            </p>
          )}
          <p className="mt-1 text-center text-sm text-gray-500">{email}</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="氏名"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
            />
            <Input
              label="パスワード (8文字以上)"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '処理中...' : 'アカウントを作成してサインイン'}
          </Button>
        </form>
      </div>
    </div>
  )
}
