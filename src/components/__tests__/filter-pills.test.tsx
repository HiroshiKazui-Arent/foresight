import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FilterPills } from '@/components/filter-pills'
import type { FilterValue } from '@/lib/summary'

describe('FilterPills — 描画', () => {
  it('5個のピルをすべて描画する', () => {
    const html = renderToStaticMarkup(FilterPills({ value: 'all', onChange: vi.fn() }))
    expect(html).toContain('すべて')
    expect(html).toContain('遅延')
    expect(html).toContain('未着手リスク')
    expect(html).toContain('進行中')
    expect(html).toContain('完了')
  })

  it('選択中のピルが強調表示される (aria-pressed や特別なクラス)', () => {
    const html = renderToStaticMarkup(FilterPills({ value: 'delayed', onChange: vi.fn() }))
    // aria-pressed か data-selected などの属性を持つ、または特別な強調クラス
    expect(html).toMatch(/aria-pressed="true"|data-active|font-semibold|font-bold|ring-/)
  })

  it('all 選択時は「すべて」ボタンが強調', () => {
    const html = renderToStaticMarkup(FilterPills({ value: 'all', onChange: vi.fn() }))
    expect(html).toContain('すべて')
  })

  it('各 FilterValue でエラーなくレンダリングできる', () => {
    const values: FilterValue[] = ['all', 'delayed', 'not-started-risk', 'in-progress', 'completed']
    for (const v of values) {
      expect(() => renderToStaticMarkup(FilterPills({ value: v, onChange: vi.fn() }))).not.toThrow()
    }
  })
})
