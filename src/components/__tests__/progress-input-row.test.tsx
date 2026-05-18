import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgressInputRow } from '@/components/progress-input/progress-input-row'

const baseProps = {
  todoId: 'todo-1',
  name: '画面設計',
  scheduledStartDate: new Date('2026-04-01'),
  scheduledEndDate: new Date('2026-04-22'),
  actualStartDate: null as Date | null,
  actualEndDate: null as Date | null,
  onSave: vi.fn(),
}

describe('ProgressInputRow — 描画', () => {
  it('ToDo 名を表示する', () => {
    const html = renderToStaticMarkup(<ProgressInputRow {...baseProps} />)
    expect(html).toContain('画面設計')
  })

  it('日付 input は着手日 + 完了日の 2 個', () => {
    const html = renderToStaticMarkup(<ProgressInputRow {...baseProps} />)
    const matches = html.match(/type="date"/g) ?? []
    expect(matches.length).toBe(2)
  })

  it('入力欄の aria-label に「着手日」「完了日」を含む', () => {
    const html = renderToStaticMarkup(<ProgressInputRow {...baseProps} />)
    expect(html).toMatch(/aria-label="着手日"/)
    expect(html).toMatch(/aria-label="完了日"/)
  })
})

describe('ProgressInputRow — 進捗バッジ', () => {
  it('actualEndDate なし → 0% バッジ', () => {
    const html = renderToStaticMarkup(
      <ProgressInputRow
        {...baseProps}
        actualStartDate={new Date('2026-04-05')}
        actualEndDate={null}
      />,
    )
    expect(html).toContain('0%')
  })

  it('actualEndDate あり → 100% バッジ', () => {
    const html = renderToStaticMarkup(
      <ProgressInputRow
        {...baseProps}
        actualStartDate={new Date('2026-04-05')}
        actualEndDate={new Date('2026-04-20')}
      />,
    )
    expect(html).toContain('100%')
  })

  it('完了バッジは WCAG AA を満たす emerald-800 のテキスト色を使う', () => {
    const html = renderToStaticMarkup(
      <ProgressInputRow
        {...baseProps}
        actualStartDate={new Date('2026-04-05')}
        actualEndDate={new Date('2026-04-20')}
      />,
    )
    expect(html).toContain('text-emerald-800')
  })

  it('両方 null → 0%', () => {
    const html = renderToStaticMarkup(<ProgressInputRow {...baseProps} />)
    expect(html).toContain('0%')
  })
})

describe('ProgressInputRow — 既存値の埋め込み', () => {
  it('actualStartDate がある時、入力欄に値が埋め込まれる', () => {
    const html = renderToStaticMarkup(
      <ProgressInputRow
        {...baseProps}
        actualStartDate={new Date('2026-04-05')}
        actualEndDate={null}
      />,
    )
    expect(html).toContain('2026-04-05')
  })

  it('actualEndDate がある時、入力欄に値が埋め込まれる', () => {
    const html = renderToStaticMarkup(
      <ProgressInputRow
        {...baseProps}
        actualStartDate={new Date('2026-04-05')}
        actualEndDate={new Date('2026-04-20')}
      />,
    )
    expect(html).toContain('2026-04-20')
  })
})
