import { vi, describe, it, expect } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/server/actions/daily-report', () => ({
  submitDailyReport: vi.fn().mockResolvedValue(undefined),
}))

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TodoInputRow } from '@/components/daily-report/todo-input-row'

const projectStart = new Date('2026-01-01')
const projectEnd = new Date('2026-12-31')
const today = new Date('2026-05-14')

const baseTodo = {
  id: 'todo-1',
  taskId: 'task-1',
  name: 'テスト ToDo',
  weight: 1,
  started: false,
  completed: false,
  startedAt: null,
  completedAt: null,
  startDate: new Date('2026-04-01'),
  endDate: new Date('2026-06-30'),
  order: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

function makeRow(overrides: Partial<typeof baseTodo> = {}) {
  return createElement(TodoInputRow, {
    todo: { ...baseTodo, ...overrides } as Parameters<typeof TodoInputRow>[0]['todo'],
    projectId: 'proj-1',
    today,
    projectStart,
    projectEnd,
  })
}

// ---------------------------------------------------------------------------
// デュアルチェックボックス
// ---------------------------------------------------------------------------
describe('デュアルチェックボックス', () => {
  it('「開始」aria-label を持つ input が存在する', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('aria-label="開始"')
  })

  it('「完了」aria-label を持つ input が存在する', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('aria-label="完了"')
  })

  it('「開始」ラベルテキストが表示される', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('>開始<')
  })

  it('「完了」ラベルテキストが表示される', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('>完了<')
  })
})

// ---------------------------------------------------------------------------
// 順序強制: started=false → completed が disabled
// ---------------------------------------------------------------------------
describe('順序強制', () => {
  it('started=false のとき completed input が disabled=""', () => {
    const html = renderToStaticMarkup(makeRow({ started: false, completed: false }))
    // React は disabled={true} を disabled="" として出力する
    expect(html).toMatch(
      /<input[^>]*disabled=""[^>]*aria-label="完了"|<input[^>]*aria-label="完了"[^>]*disabled=""/,
    )
  })

  it('started=true のとき completed input が disabled="" でない', () => {
    const html = renderToStaticMarkup(makeRow({ started: true, completed: false }))
    expect(html).not.toMatch(
      /<input[^>]*disabled=""[^>]*aria-label="完了"|<input[^>]*aria-label="完了"[^>]*disabled=""/,
    )
  })

  it('completed=true のとき started も true として初期化される', () => {
    const html = renderToStaticMarkup(makeRow({ started: true, completed: true }))
    // 両方チェック済み → completed も disabled でない
    expect(html).not.toMatch(
      /<input[^>]*disabled=""[^>]*aria-label="完了"|<input[^>]*aria-label="完了"[^>]*disabled=""/,
    )
  })
})

// ---------------------------------------------------------------------------
// グリッドレイアウト (5カラム固定)
// ---------------------------------------------------------------------------
describe('5カラム Grid レイアウト', () => {
  it('gridTemplateColumns が "240px 88px 60px 56px 1fr" のまま', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('grid-template-columns:240px 88px 60px 56px 1fr')
  })
})

// ---------------------------------------------------------------------------
// ToDo 名表示
// ---------------------------------------------------------------------------
describe('ToDo 名表示', () => {
  it('ToDo 名がレンダリングされる', () => {
    const html = renderToStaticMarkup(makeRow({ name: '設計書を書く' }))
    expect(html).toContain('設計書を書く')
  })
})

// ---------------------------------------------------------------------------
// GanttBar
// ---------------------------------------------------------------------------
describe('GanttBar のレンダリング', () => {
  it('role="img" が存在する (GanttBar がレンダリングされている)', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('role="img"')
  })
})
