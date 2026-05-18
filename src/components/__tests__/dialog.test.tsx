/**
 * DialogContent className マージ回帰テスト (TDD — RED → GREEN)
 *
 * バグ: DialogContent が `{...props}` 後置スプレッドで className を上書きしていた。
 *   `className="base" {...props}` の順序では props.className が base を完全上書きする。
 * 修正: className を props から分離してベース classes と template-string 連結する。
 *
 * 環境: vitest / node (jsdom なし)
 * 手法:
 *   - @radix-ui/react-dialog の Portal を透過モックして DialogContent を SSR する
 *   - render 後に role="dialog" 要素の class 属性を regex で検証
 */

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

// Portal をモックして SSR で子要素をそのままレンダリングする
// (Portal は通常 document.body にマウントするため SSR で空になる)
vi.mock('@radix-ui/react-dialog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@radix-ui/react-dialog')>()
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  }
})

import { Dialog, DialogContent } from '@/components/ui/dialog'

// ---- Helper ----

function extractClassName(html: string): string | null {
  const match =
    /role="dialog"[^>]*class="([^"]*)"/.exec(html) ?? /class="([^"]*)"[^>]*role="dialog"/.exec(html)
  return match ? match[1] : null
}

// ---- 受け入れ基準テスト ----

describe('DialogContent — className マージ', () => {
  it('Test 1: caller が className を渡したとき、ベース classes と caller className が両方含まれる', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Dialog,
        { open: true },
        React.createElement(DialogContent, { className: 'max-w-2xl' }, 'コンテンツ'),
      ),
    )

    const className = extractClassName(html)
    expect(className, `HTML: ${html.substring(0, 600)}`).not.toBeNull()

    // ベース classes が保持されていること (受け入れ基準 1)
    expect(className).toContain('fixed')
    expect(className).toContain('top-1/2')
    expect(className).toContain('left-1/2')
    expect(className).toContain('bg-white')
    expect(className).toContain('p-6')
    // caller が渡した className が付加されていること (受け入れ基準 1)
    expect(className).toContain('max-w-2xl')
  })

  it('Test 2: className を渡さなかったとき、"undefined" や "null" 文字列が混入しない', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Dialog,
        { open: true },
        React.createElement(DialogContent, null, 'コンテンツ'),
      ),
    )

    const className = extractClassName(html)
    expect(className, `HTML: ${html.substring(0, 600)}`).not.toBeNull()

    // 空文字 fallback が正しく機能しており余計な文字列が混入しない (受け入れ基準 2)
    expect(className).not.toContain('undefined')
    expect(className).not.toContain('null')
  })
})

// ---- 追加: TaskProgressModal 実際のケース (max-h-[85vh] max-w-2xl overflow-y-auto) ----

describe('DialogContent — TaskProgressModal 実利用ケース', () => {
  it('max-h-[85vh] max-w-2xl overflow-y-auto を渡したとき、ベース classes がすべて保持される', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Dialog,
        { open: true },
        React.createElement(
          DialogContent,
          { className: 'max-h-[85vh] max-w-2xl overflow-y-auto' },
          'モーダルコンテンツ',
        ),
      ),
    )

    const className = extractClassName(html)
    expect(className, `HTML: ${html.substring(0, 600)}`).not.toBeNull()

    expect(className).toContain('fixed')
    expect(className).toContain('top-1/2')
    expect(className).toContain('left-1/2')
    expect(className).toContain('-translate-x-1/2')
    expect(className).toContain('-translate-y-1/2')
    expect(className).toContain('rounded-lg')
    expect(className).toContain('bg-white')
    expect(className).toContain('p-6')
    expect(className).toContain('shadow-lg')
    // caller classes も保持
    expect(className).toContain('max-h-[85vh]')
    expect(className).toContain('max-w-2xl')
    expect(className).toContain('overflow-y-auto')
  })
})
