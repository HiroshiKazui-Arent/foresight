import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">フォーサイトマネジメント</h1>
        <p className="mt-2 text-gray-600">ようこそ、{session.user?.name} さん</p>
      </div>
    </div>
  )
}
