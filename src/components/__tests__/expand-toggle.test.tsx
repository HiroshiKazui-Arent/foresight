import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExpandToggle } from '@/components/gantt/expand-toggle'

describe('ExpandToggle', () => {
  it('expanded=true → ▼ を表示', () => {
    const html = renderToStaticMarkup(ExpandToggle({ expanded: true, onToggle: vi.fn() }))
    expect(html).toContain('▼')
    expect(html).toContain('aria-expanded="true"')
  })

  it('expanded=false → ▶ を表示', () => {
    const html = renderToStaticMarkup(ExpandToggle({ expanded: false, onToggle: vi.fn() }))
    expect(html).toContain('▶')
    expect(html).toContain('aria-expanded="false"')
  })

  it('aria-label が含まれる', () => {
    const html = renderToStaticMarkup(ExpandToggle({ expanded: true, onToggle: vi.fn() }))
    expect(html).toMatch(/aria-label/)
  })

  it('カスタム ariaLabel を上書きできる', () => {
    const html = renderToStaticMarkup(
      ExpandToggle({ expanded: false, onToggle: vi.fn(), ariaLabel: 'マイルストーンを展開' }),
    )
    expect(html).toContain('マイルストーンを展開')
  })
})
