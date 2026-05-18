import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EmptyStack } from '@/components/management/empty-stack'

describe('EmptyStack — プレースホルダ', () => {
  it('「+ 同階層の工程を追加」テキストを含むボタンをレンダリングする', () => {
    const html = renderToStaticMarkup(<EmptyStack label="同階層の工程を追加" onAdd={vi.fn()} />)
    expect(html).toContain('同階層の工程を追加')
    expect(html).toContain('+')
  })

  it('button 要素として描画される(clickable)', () => {
    const html = renderToStaticMarkup(<EmptyStack label="工程を追加" onAdd={vi.fn()} />)
    expect(html).toMatch(/<button/)
  })

  it('label prop を反映する', () => {
    const html = renderToStaticMarkup(<EmptyStack label="マイルストーンを追加" onAdd={vi.fn()} />)
    expect(html).toContain('マイルストーンを追加')
  })
})
