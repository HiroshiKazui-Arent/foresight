import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LoadingScreen } from '@/components/loading-screen'

describe('LoadingScreen', () => {
  it('role="status" を持つ要素をレンダする (a11y)', () => {
    const html = renderToStaticMarkup(<LoadingScreen />)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-busy="true"')
  })

  it('デフォルトラベル "読み込み中…" が表示される', () => {
    const html = renderToStaticMarkup(<LoadingScreen />)
    expect(html).toContain('読み込み中…')
  })

  it('カスタムラベルが渡されればそれが表示される', () => {
    const html = renderToStaticMarkup(<LoadingScreen label="プロジェクトを読み込み中" />)
    expect(html).toContain('プロジェクトを読み込み中')
    expect(html).not.toContain('読み込み中…')
  })

  it('animate-spin クラスを持つスピナーがレンダされる', () => {
    const html = renderToStaticMarkup(<LoadingScreen />)
    expect(html).toContain('animate-spin')
  })
})
