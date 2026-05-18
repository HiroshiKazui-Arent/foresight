import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskProgressSummary } from '@/components/progress-input/task-progress-summary'

describe('TaskProgressSummary — 集計', () => {
  it('完了 ToDo 数 / 全 ToDo 数 を「完了 X/N」形式で表示', () => {
    const html = renderToStaticMarkup(<TaskProgressSummary completed={1} total={5} />)
    expect(html).toContain('1/5')
  })

  it('実績進捗 = 完了/全体 × 100 を整数 % で表示', () => {
    const html = renderToStaticMarkup(<TaskProgressSummary completed={1} total={5} />)
    expect(html).toContain('20%')
  })

  it('全完了 → 100%', () => {
    const html = renderToStaticMarkup(<TaskProgressSummary completed={5} total={5} />)
    expect(html).toContain('100%')
  })

  it('全未着手 → 0%', () => {
    const html = renderToStaticMarkup(<TaskProgressSummary completed={0} total={5} />)
    expect(html).toContain('0%')
    expect(html).toContain('0/5')
  })

  it('ToDo が 0 件のエッジケースは 0% / 0/0 表示 (ゼロ除算回避)', () => {
    const html = renderToStaticMarkup(<TaskProgressSummary completed={0} total={0} />)
    expect(html).toContain('0%')
    expect(html).toContain('0/0')
  })
})

describe('TaskProgressSummary — 色付け', () => {
  it('100% → 緑系クラス', () => {
    const html = renderToStaticMarkup(<TaskProgressSummary completed={5} total={5} />)
    expect(html).toMatch(/text-emerald|text-green/)
  })

  it('部分完了 → 中間色 (緑ではない)', () => {
    const html = renderToStaticMarkup(<TaskProgressSummary completed={2} total={5} />)
    expect(html).not.toMatch(/text-emerald-700|text-green-700/)
  })
})
