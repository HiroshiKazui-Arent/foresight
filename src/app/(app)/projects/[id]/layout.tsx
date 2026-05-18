/**
 * プロジェクト詳細レイアウト
 *
 * G1 ガント表示 / G2 工程管理 で共通の:
 * - プロジェクトヘッダ (← 一覧 / プロジェクト名 / 設定)
 * - ナビゲーショントグル (ガント表示 / 工程管理)
 * を提供する。
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireProjectMember } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { NavTabs } from './nav-tabs'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params
  await requireProjectMember(id)

  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true },
  })
  if (!project) notFound()

  return (
    <div>
      {/* プロジェクトヘッダ (G1 / G2 共通) */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-700">
            ← プロジェクト一覧
          </Link>
          <h1 className="text-2xl font-bold">{project.name}</h1>
        </div>
        <Link
          href={`/projects/${id}/settings`}
          className="inline-flex items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-300"
        >
          設定
        </Link>
      </div>

      {/* ナビゲーション: ガント表示 / 工程管理 (アクティブタブをハイライト) */}
      <NavTabs projectId={id} />
      {children}
    </div>
  )
}
