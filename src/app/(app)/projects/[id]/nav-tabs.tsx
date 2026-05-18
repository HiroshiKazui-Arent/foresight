'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavTabsProps {
  projectId: string
}

/**
 * プロジェクト内ナビゲーション (G1 ガント表示 / G2 工程管理)
 *
 * 現在のパスに基づいてアクティブタブをハイライト表示する。
 * usePathname() を使うため Client Component。
 */
export function NavTabs({ projectId }: NavTabsProps) {
  const pathname = usePathname()
  // /projects/{id}/manage 以下は G2、それ以外 (/projects/{id}, /projects/{id}/tasks/*) は G1 系
  const isManage = pathname.endsWith('/manage') || pathname.includes('/manage/')
  const isGantt = !isManage

  return (
    <nav aria-label="プロジェクト画面切替" className="mb-4 flex gap-1 border-b border-gray-200">
      <Link
        href={`/projects/${projectId}`}
        aria-current={isGantt ? 'page' : undefined}
        className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
          isGantt
            ? 'border-blue-600 font-semibold text-blue-700'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
        }`}
      >
        ガント表示
      </Link>
      <Link
        href={`/projects/${projectId}/manage`}
        aria-current={isManage ? 'page' : undefined}
        className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
          isManage
            ? 'border-blue-600 font-semibold text-blue-700'
            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
        }`}
      >
        工程管理
      </Link>
    </nav>
  )
}
