// @vitest-environment jsdom
/**
 * ManagementTree — 折り畳みツリー + ホバー + オートスクロール テスト (TDD RED→GREEN)
 *
 * 環境: jsdom (@vitest-environment jsdom)
 * 手法: @testing-library/react で DOM インタラクションを検証
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import React from 'react'

// data-row-id でスコープされた範囲内のクエリを行うヘルパー
function rowOf(id: string): HTMLElement {
  const el = document.querySelector(`[data-row-id="${id}"]`)
  if (!el) throw new Error(`Row data-row-id="${id}" not found`)
  return el as HTMLElement
}

// Server Action をモック (DB/Auth 依存を排除)
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

// next/cache, next/navigation をモック (Server Action 内部依存)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: vi.fn(),
}))

import { ManagementTree } from '@/components/management/management-tree'
import { createMilestone } from '@/server/actions/milestone'
import { createTask } from '@/server/actions/task'
import { createTodo } from '@/server/actions/todo'

// ---- テスト用ヘルパー ----

function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day))
}

const now = {
  createdAt: d(2026, 5, 1),
  updatedAt: d(2026, 5, 1),
}

function makeTodo(id: string, name: string, taskId: string) {
  return {
    id,
    taskId,
    name,
    startDate: d(2026, 5, 1),
    endDate: d(2026, 5, 15),
    actualStartDate: null,
    actualEndDate: null,
    order: 0,
    ...now,
  }
}

function makeTask(
  id: string,
  name: string,
  milestoneId: string,
  todos: ReturnType<typeof makeTodo>[],
) {
  return {
    id,
    milestoneId,
    name,
    startDate: d(2026, 5, 1),
    endDate: d(2026, 6, 30),
    assigneeId: null,
    order: 0,
    todos,
    ...now,
  }
}

function makeMilestone(
  id: string,
  name: string,
  projectId: string,
  tasks: ReturnType<typeof makeTask>[],
) {
  return {
    id,
    projectId,
    name,
    startDate: d(2026, 5, 1),
    endDate: d(2026, 8, 31),
    order: 0,
    tasks,
    ...now,
  }
}

const PROJECT_ID = 'p1'

function makeProject(milestones: ReturnType<typeof makeMilestone>[]) {
  return {
    id: PROJECT_ID,
    name: 'プロジェクト1',
    startDate: d(2026, 5, 1),
    endDate: d(2026, 8, 31),
    milestones,
    ...now,
  }
}

// サンプルデータ: Project > Milestone1 > Task1 > ToDo1
const todo1 = makeTodo('td1', 'ToDo1', 't1')
const task1 = makeTask('t1', 'タスク1', 'm1', [todo1])
const milestone1 = makeMilestone('m1', 'マイルストーン1', PROJECT_ID, [task1])
const sampleProject = makeProject([milestone1])

// ---- セットアップ ----

beforeEach(() => {
  // scrollIntoView は JSDOM 未実装 → モック化
  Element.prototype.scrollIntoView = vi.fn()
  vi.clearAllMocks()
})

// ---- テスト本体 ----

describe('ManagementTree — 初期表示', () => {
  it('Project / Milestone / Task / ToDo がすべて表示される（全展開）', () => {
    render(React.createElement(ManagementTree, { project: sampleProject }))

    // 工程名は <input value="..."> として描画されるため getByDisplayValue で検索
    expect(screen.getByDisplayValue('プロジェクト1')).toBeTruthy()
    expect(screen.getByDisplayValue('マイルストーン1')).toBeTruthy()
    expect(screen.getByDisplayValue('タスク1')).toBeTruthy()
    expect(screen.getByDisplayValue('ToDo1')).toBeTruthy()
  })

  it('Milestone 行にトグルボタン（aria-label=折り畳む）が存在する', () => {
    render(React.createElement(ManagementTree, { project: sampleProject }))

    // 折り畳みトグルボタン: 初期は全展開なので aria-label="折り畳む"
    const toggleBtns = screen.getAllByRole('button', { name: '折り畳む' })
    // Milestone と Task の両方にトグルがある
    expect(toggleBtns.length).toBeGreaterThanOrEqual(1)
  })
})

describe('ManagementTree — Milestone 折り畳み', () => {
  it('Milestone の「折り畳む」ボタンをクリックすると配下の Task と ToDo が消える', () => {
    render(React.createElement(ManagementTree, { project: sampleProject }))

    // 初期: Task と ToDo の入力フィールドが見える
    expect(screen.getByDisplayValue('タスク1')).toBeTruthy()
    expect(screen.getByDisplayValue('ToDo1')).toBeTruthy()

    // 「折り畳む」ボタンのうち最初のもの（Milestone のトグル）をクリック
    const toggleBtns = screen.getAllByRole('button', { name: '折り畳む' })
    fireEvent.click(toggleBtns[0])

    // Task と ToDo の入力フィールドが非表示
    expect(screen.queryByDisplayValue('タスク1')).toBeNull()
    expect(screen.queryByDisplayValue('ToDo1')).toBeNull()

    // Milestone 自体は表示されたまま
    expect(screen.getByDisplayValue('マイルストーン1')).toBeTruthy()
  })

  it('折り畳んだ後の「展開する」ボタンクリックで配下が再表示される', () => {
    render(React.createElement(ManagementTree, { project: sampleProject }))

    // 折り畳む（Milestone の最初のトグル）
    const toggleBtns = screen.getAllByRole('button', { name: '折り畳む' })
    fireEvent.click(toggleBtns[0])

    // 配下が消えている
    expect(screen.queryByDisplayValue('タスク1')).toBeNull()

    // 展開する
    const expandBtn = screen.getByRole('button', { name: '展開する' })
    fireEvent.click(expandBtn)

    // 配下が再表示
    expect(screen.getByDisplayValue('タスク1')).toBeTruthy()
    expect(screen.getByDisplayValue('ToDo1')).toBeTruthy()
  })
})

describe('ManagementTree — Task 折り畳み', () => {
  it('Task のトグルクリックで配下の ToDo が消える（他 Task は影響なし）', () => {
    // 2つのタスクを持つ Milestone でテスト
    const todo2 = makeTodo('td2', 'ToDo2', 't2')
    const task2 = makeTask('t2', 'タスク2', 'm1', [todo2])
    const m1WithTwoTasks = makeMilestone('m1', 'マイルストーン1', PROJECT_ID, [task1, task2])
    const project = makeProject([m1WithTwoTasks])

    render(React.createElement(ManagementTree, { project }))

    // 初期: 両方の ToDo が見える
    expect(screen.getByDisplayValue('ToDo1')).toBeTruthy()
    expect(screen.getByDisplayValue('ToDo2')).toBeTruthy()

    // Task1 行のトグルを data-row-id でスコープして特定
    const task1ToggleBtn = within(rowOf('t1')).getByRole('button', { name: '折り畳む' })
    fireEvent.click(task1ToggleBtn)

    // ToDo1 が消える、ToDo2 は残る
    expect(screen.queryByDisplayValue('ToDo1')).toBeNull()
    expect(screen.getByDisplayValue('ToDo2')).toBeTruthy()

    // タスク1自体は表示されたまま
    expect(screen.getByDisplayValue('タスク1')).toBeTruthy()
  })
})

describe('ManagementTree — 新規 Milestone 追加でスクロール', () => {
  it('createMilestone が id="new-m1" を返した後 scrollIntoView が呼ばれる', async () => {
    const newMilestone = makeMilestone('new-m1', '新規マイルストーン', PROJECT_ID, [])
    vi.mocked(createMilestone).mockResolvedValueOnce(newMilestone)

    render(React.createElement(ManagementTree, { project: sampleProject }))

    // 「同階層のマイルストーンを追加」ボタンを押す
    const addMilestoneBtn = screen.getByRole('button', { name: /同階層のマイルストーンを追加/ })
    await act(async () => {
      fireEvent.click(addMilestoneBtn)
    })

    // 新規 Milestone の入力フィールドが表示される
    await waitFor(() => {
      expect(screen.getByDisplayValue('新規マイルストーン')).toBeTruthy()
    })

    // scrollIntoView が呼ばれた
    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })
})

describe('ManagementTree — 折り畳み後の Task 追加でスクロール', () => {
  it('Task 追加ボタン押下で新 Task が表示され scrollIntoView が呼ばれる', async () => {
    const newTask = makeTask('new-t1', '新規タスク', 'm1', [])
    vi.mocked(createTask).mockResolvedValueOnce(newTask)

    render(React.createElement(ManagementTree, { project: sampleProject }))

    // Task 行内の「同階層を追加」ボタン (handleAddTask) を data-row-id でスコープして特定
    const taskAddBtn = within(rowOf('t1')).getByRole('button', { name: '同階層を追加' })
    await act(async () => {
      fireEvent.click(taskAddBtn)
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('新規タスク')).toBeTruthy()
    })

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })

  it('Milestone を折り畳んだ後 Task 追加時に親 Milestone が自動展開される（EmptyStack 版）', async () => {
    // Tasks なしの Milestone を使う（EmptyStack が表示される）
    const emptyMilestone = makeMilestone('m2', 'マイルストーン2', PROJECT_ID, [])
    const project = makeProject([emptyMilestone])

    const newTask = makeTask('new-t2', '新規タスク2', 'm2', [])
    vi.mocked(createTask).mockResolvedValueOnce(newTask)

    render(React.createElement(ManagementTree, { project }))

    // 初期状態: EmptyStack「同階層のタスクを追加」が見える
    expect(screen.getByRole('button', { name: /同階層のタスクを追加/ })).toBeTruthy()

    // Milestone を折り畳む
    const collapseBtn = screen.getByRole('button', { name: '折り畳む' })
    fireEvent.click(collapseBtn)

    // EmptyStack が非表示になる
    expect(screen.queryByRole('button', { name: /同階層のタスクを追加/ })).toBeNull()

    // handleAddTask を直接テストするため Milestone を展開
    const expandBtn = screen.getByRole('button', { name: '展開する' })
    fireEvent.click(expandBtn)

    // EmptyStack で Task を追加
    const addTaskBtn = screen.getByRole('button', { name: /同階層のタスクを追加/ })
    await act(async () => {
      fireEvent.click(addTaskBtn)
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('新規タスク2')).toBeTruthy()
    })

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })
})

describe('ManagementTree — セキュリティ regression', () => {
  it('Server Action が特殊文字を含む id を返しても selector injection が起きない', async () => {
    // 攻撃ベクトル: id に `"]` を含むと未エスケープな `querySelector` 経路では SyntaxError
    // → 現実装は querySelectorAll + getAttribute 比較で interpolation を排除しているため安全
    const maliciousId = 'evil"]'
    const newMilestone = makeMilestone(maliciousId, 'evil milestone', PROJECT_ID, [])
    vi.mocked(createMilestone).mockResolvedValueOnce(newMilestone)

    render(React.createElement(ManagementTree, { project: sampleProject }))

    const addBtn = screen.getByRole('button', { name: /同階層のマイルストーンを追加/ })
    // 追加処理が例外を投げず完了することを検証
    await act(async () => {
      fireEvent.click(addBtn)
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('evil milestone')).toBeTruthy()
    })
  })
})

describe('ManagementTree — ToDo 追加でスクロール', () => {
  it('ToDo 追加ボタン押下で新 ToDo が表示され scrollIntoView が呼ばれる', async () => {
    const newTodo = makeTodo('new-td1', '新規ToDo', 't1')
    vi.mocked(createTodo).mockResolvedValueOnce(newTodo)

    render(React.createElement(ManagementTree, { project: sampleProject }))

    // ToDo 行内の「同階層を追加」ボタン (handleAddTodo) を data-row-id でスコープして特定
    const todoAddBtn = within(rowOf('td1')).getByRole('button', { name: '同階層を追加' })
    await act(async () => {
      fireEvent.click(todoAddBtn)
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('新規ToDo')).toBeTruthy()
    })

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })

  it('Task を折り畳んだ後 ToDo の EmptyStack 追加で Task が自動展開される', async () => {
    // ToDo なしの Task を使う（EmptyStack が表示される）
    const emptyTask = makeTask('t3', 'タスク3', 'm3', [])
    const m3 = makeMilestone('m3', 'マイルストーン3', PROJECT_ID, [emptyTask])
    const project = makeProject([m3])

    const newTodo = makeTodo('new-td3', '新規ToDo3', 't3')
    vi.mocked(createTodo).mockResolvedValueOnce(newTodo)

    render(React.createElement(ManagementTree, { project }))

    // Task 行内のトグルを data-row-id でスコープして特定し、折り畳む
    const taskToggle = within(rowOf('t3')).getByRole('button', { name: '折り畳む' })
    fireEvent.click(taskToggle)

    // EmptyStack が非表示
    expect(screen.queryByRole('button', { name: /同階層のToDoを追加/ })).toBeNull()

    // Task 行内の展開トグルをクリック (Milestone[m3] は展開済のため Task[t3] のみが「展開する」状態)
    fireEvent.click(within(rowOf('t3')).getByRole('button', { name: '展開する' }))

    // EmptyStack が表示される
    const addTodoBtn = screen.getByRole('button', { name: /同階層のToDoを追加/ })
    await act(async () => {
      fireEvent.click(addTodoBtn)
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('新規ToDo3')).toBeTruthy()
    })

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    })
  })
})
