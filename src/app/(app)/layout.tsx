import { auth, signOut } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/projects" className="font-semibold hover:opacity-80">
            フォーサイトマネジメント
          </Link>
          <Link href="/users" className="text-sm text-gray-600 hover:text-gray-900">
            ユーザー管理
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user?.name}</span>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-800">
              サインアウト
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
