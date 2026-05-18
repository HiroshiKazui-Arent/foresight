import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ManagementRow } from '@/components/management/management-row'

const baseProps = {
  name: 'サンプル工程',
  startDate: new Date('2026-04-01'),
  endDate: new Date('2026-04-30'),
  onUpdateName: vi.fn(),
  onUpdateDates: vi.fn(),
  onAddSibling: vi.fn(),
  onDelete: vi.fn(),
}

describe('ManagementRow — レベルマーク', () => {
  it('level=project → "P" マーク', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="project" />)
    expect(html).toContain('>P<')
  })

  it('level=milestone → "M" マーク', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="milestone" />)
    expect(html).toContain('>M<')
  })

  it('level=task → "T" マーク', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="task" />)
    expect(html).toContain('>T<')
  })

  it('level=todo → "To" マーク', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="todo" />)
    expect(html).toContain('>To<')
  })
})

describe('ManagementRow — 入力欄', () => {
  it('工程名(name)を表示する', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="task" />)
    expect(html).toContain('サンプル工程')
  })

  it('開始日と終了日の input[type=date] を 2 個持つ', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="task" />)
    const matches = html.match(/type="date"/g) ?? []
    expect(matches.length).toBe(2)
  })

  it('開始日/終了日に YYYY-MM-DD 形式の値を埋め込む', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="task" />)
    expect(html).toContain('2026-04-01')
    expect(html).toContain('2026-04-30')
  })
})

describe('ManagementRow — G2 不変条件: 実績日は触らせない', () => {
  it('actualStartDate / actualEndDate に対応する input を持たない', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="todo" />)
    expect(html.toLowerCase()).not.toContain('actual')
    expect(html).not.toContain('実績')
    expect(html).not.toContain('着手日')
    expect(html).not.toContain('完了日')
  })

  it('日付 input は 2 個ちょうど(予定開始+予定終了のみ、実績用は無し)', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="todo" />)
    const matches = html.match(/type="date"/g) ?? []
    expect(matches.length).toBe(2)
  })
})

describe('ManagementRow — 操作ボタン', () => {
  it('milestone / task / todo 行は + (同階層追加) ボタンを持つ', () => {
    for (const level of ['milestone', 'task', 'todo'] as const) {
      const html = renderToStaticMarkup(<ManagementRow {...baseProps} level={level} />)
      expect(html).toMatch(/aria-label="同階層[^"]*追加"/)
    }
  })

  it('project 行は + ボタンを持たない(プロジェクト兄弟は本画面の責務外)', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="project" />)
    expect(html).not.toMatch(/aria-label="同階層[^"]*追加"/)
  })

  it('milestone / task / todo 行は × (削除) ボタンを持つ', () => {
    for (const level of ['milestone', 'task', 'todo'] as const) {
      const html = renderToStaticMarkup(<ManagementRow {...baseProps} level={level} />)
      expect(html).toMatch(/aria-label="削除"/)
    }
  })

  it('project 行は × ボタンを持たない(本画面ではプロジェクト自体は消せない)', () => {
    const html = renderToStaticMarkup(<ManagementRow {...baseProps} level="project" />)
    expect(html).not.toMatch(/aria-label="削除"/)
  })
})

describe('ManagementRow — インデント', () => {
  it('レベルが深くなるほど左余白(padding/margin)が増える', () => {
    const project = renderToStaticMarkup(<ManagementRow {...baseProps} level="project" />)
    const milestone = renderToStaticMarkup(<ManagementRow {...baseProps} level="milestone" />)
    const task = renderToStaticMarkup(<ManagementRow {...baseProps} level="task" />)
    const todo = renderToStaticMarkup(<ManagementRow {...baseProps} level="todo" />)

    expect(project).toContain('data-indent="0"')
    expect(milestone).toContain('data-indent="1"')
    expect(task).toContain('data-indent="2"')
    expect(todo).toContain('data-indent="3"')
  })
})
