import { describe, it, expect, vi } from 'vitest'

// 'use client' で server actions を import するため、server 側依存を全てモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  redirect: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/authz', () => ({ requireProjectMember: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/server/actions/milestone', () => ({
  createMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  deleteMilestone: vi.fn(),
}))
vi.mock('@/server/actions/task', () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}))
vi.mock('@/server/actions/todo', () => ({
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  deleteTodo: vi.fn(),
}))
vi.mock('@/server/actions/project', () => ({
  updateProject: vi.fn(),
}))

import { renderToStaticMarkup } from 'react-dom/server'
import { ManagementTree } from '@/components/management/management-tree'
import type { Milestone, Project, Task, Todo } from '@prisma/client'

type TaskWithTodos = Task & { todos: Todo[] }
type MilestoneWithTasks = Milestone & { tasks: TaskWithTodos[] }
type ProjectWithMilestones = Project & { milestones: MilestoneWithTasks[] }

function makeProject(): ProjectWithMilestones {
  const now = new Date('2026-04-01')
  const end = new Date('2026-07-31')
  return {
    id: 'proj-1',
    name: 'サンプルプロジェクト',
    startDate: now,
    endDate: end,
    createdAt: now,
    updatedAt: now,
    milestones: [
      {
        id: 'ms-1',
        projectId: 'proj-1',
        name: '基本設計完了',
        startDate: now,
        endDate: new Date('2026-05-10'),
        order: 0,
        createdAt: now,
        updatedAt: now,
        tasks: [
          {
            id: 'task-1',
            milestoneId: 'ms-1',
            name: '画面設計',
            startDate: now,
            endDate: new Date('2026-05-06'),
            order: 0,
            assigneeId: null,
            createdAt: now,
            updatedAt: now,
            todos: [
              {
                id: 'todo-1',
                taskId: 'task-1',
                name: '画面設計',
                startDate: new Date('2026-04-18'),
                endDate: new Date('2026-04-22'),
                actualStartDate: null,
                actualEndDate: null,
                order: 0,
                createdAt: now,
                updatedAt: now,
              },
              {
                id: 'todo-2',
                taskId: 'task-1',
                name: 'DB設計',
                startDate: new Date('2026-04-23'),
                endDate: new Date('2026-04-26'),
                actualStartDate: null,
                actualEndDate: null,
                order: 1,
                createdAt: now,
                updatedAt: now,
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('ManagementTree — ツリーレンダリング', () => {
  it('Project / Milestone / Task / Todo のすべての名前を描画する', () => {
    const html = renderToStaticMarkup(<ManagementTree project={makeProject()} />)
    expect(html).toContain('サンプルプロジェクト')
    expect(html).toContain('基本設計完了')
    expect(html).toContain('画面設計')
    expect(html).toContain('DB設計')
  })

  it('Project は 1 個、Milestone は 1 個、Task は 1 個、Todo は 2 個のレベルマークを描画する', () => {
    const html = renderToStaticMarkup(<ManagementTree project={makeProject()} />)
    const pCount = (html.match(/>P</g) ?? []).length
    const mCount = (html.match(/>M</g) ?? []).length
    const toCount = (html.match(/>To</g) ?? []).length
    // >T< は task のみ (>To< には 'o' が挟まり >T< マッチしない)
    const tCount = (html.match(/>T</g) ?? []).length
    expect(pCount).toBe(1)
    expect(mCount).toBe(1)
    expect(tCount).toBe(1)
    expect(toCount).toBe(2)
  })

  it('G2 不変条件: actualStartDate/actualEndDate を編集する入力欄を持たない', () => {
    const html = renderToStaticMarkup(<ManagementTree project={makeProject()} />)
    expect(html).not.toContain('着手日')
    expect(html).not.toContain('完了日')
    expect(html.toLowerCase()).not.toContain('actual')
    expect(html).not.toContain('実績')
  })

  it('「追加」ボタンが描画される(空ツリー対応 / 末尾追加用)', () => {
    const html = renderToStaticMarkup(<ManagementTree project={makeProject()} />)
    expect(html).toContain('マイルストーン')
    expect(html).toMatch(/同階層|追加/)
  })
})
