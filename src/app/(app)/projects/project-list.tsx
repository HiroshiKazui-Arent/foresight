'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressPill } from '@/components/progress-pill'
import { StatusPill } from '@/components/status-pill'
import { DaysPill } from '@/components/days-pill'
import { GanttBar } from '@/components/gantt/gantt-bar'
import { TodayLine } from '@/components/gantt/today-line'
import { xForDate } from '@/components/gantt/timeline-utils'
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
import { createProject } from '@/server/actions/project'
import type { ProgressBarData } from '@/types/progress'

interface ProjectListItem {
  id: string
  name: string
  startDate: Date
  endDate: Date
  progressBar: ProgressBarData
}

interface ProjectListProps {
  projects: ProjectListItem[]
  today: Date
}

// UTC 年月日を ja-JP ロケール相当 (YYYY/M/D) に変換。
// toLocaleDateString('ja-JP') はサーバー(UTC)とブラウザ(JST)でタイムゾーンが異なるため
// hydration mismatch を起こす。UTC メソッドで統一する。
function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}

export function ProjectList({ projects, today }: ProjectListProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => setMounted(true), [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !startDate || !endDate) {
      setError('すべての項目を入力してください')
      return
    }
    setLoading(true)
    setError('')
    try {
      await createProject(name.trim(), new Date(startDate), new Date(endDate))
      setOpen(false)
      setName('')
      setStartDate('')
      setEndDate('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プロジェクトの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">プロジェクト一覧</h1>
        {/* Radix UI Dialog は React 19 SSR と @radix-ui/react-id の useLayoutEffect が競合するため
            mounted 後のみレンダリングして SSR から除外する */}
        {mounted ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="primary">+ 新規プロジェクト</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新規プロジェクト作成</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                {error && (
                  <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <Input
                  label="プロジェクト名"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="プロジェクト名を入力"
                />
                <Input
                  label="開始日"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  label="終了日"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      キャンセル
                    </Button>
                  </DialogClose>
                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? '作成中...' : '作成'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <Button variant="primary" disabled>
            + 新規プロジェクト
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">
            プロジェクトがありません。「+ 新規プロジェクト」から作成してください。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => router.push('/projects/' + project.id)}
              className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
                <div className="flex items-center gap-3">
                  <StatusPill status={project.progressBar.status} />
                  <DaysPill days={project.progressBar.daysDeviation} />
                </div>
              </div>
              <div className="relative mb-2 h-4">
                <GanttBar
                  actualPct={project.progressBar.actualPct}
                  scheduledPct={project.progressBar.scheduledPct}
                  status={project.progressBar.status}
                />
                <TodayLine todayX={xForDate(today, project.startDate, project.endDate)} />
              </div>
              <div className="flex items-center justify-between">
                <ProgressPill
                  actualPct={project.progressBar.actualPct}
                  scheduledPct={project.progressBar.scheduledPct}
                />
                <span className="text-xs text-gray-400">
                  {fmtDate(project.startDate)} 〜 {fmtDate(project.endDate)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
