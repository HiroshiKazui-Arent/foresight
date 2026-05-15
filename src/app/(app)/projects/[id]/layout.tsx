/**
 * プロジェクト詳細レイアウト
 *
 * G1 ガント表示 / G2 工程管理 のナビゲーショントグルを提供する。
 * G2 (/projects/[id]/manage/) は S6 で実装。現状は「準備中」ラベル付き先出し。
 */

import Link from 'next/link'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params

  return (
    <div>
      {/* ナビゲーション: ガント表示 / 工程管理 トグル */}
      <nav aria-label="プロジェクト画面切替" className="mb-4 flex gap-2 border-b pb-2">
        <Link
          href={`/projects/${id}`}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-600 underline-offset-2 hover:underline"
        >
          ガント表示
        </Link>
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="工程管理 (S6 で実装予定、現在は使用不可)"
          className="cursor-not-allowed rounded-md px-3 py-1.5 text-sm font-medium text-gray-400"
          title="S6 で実装予定"
        >
          工程管理
          <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-500">準備中</span>
        </button>
      </nav>
      {children}
    </div>
  )
}
