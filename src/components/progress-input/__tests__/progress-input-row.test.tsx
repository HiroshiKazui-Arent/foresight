/**
 * ProgressInputRow の単体テスト
 *
 * 環境: vitest / node (renderToStaticMarkup)
 * 目的: 予定期間 (scheduledStartDate → scheduledEndDate) が「予定：M/D → M/D（N日）」
 *       形式で行内に描画されることを検証する。
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

import { ProgressInputRow } from '@/components/progress-input/progress-input-row'

function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day))
}

describe('ProgressInputRow — 予定期間表示', () => {
  it('scheduledStartDate / scheduledEndDate が「予定：M/D → M/D（N日）」形式で描画される', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProgressInputRow, {
        todoId: 'td-1',
        name: 'テスト ToDo',
        scheduledStartDate: d(2025, 5, 1),
        scheduledEndDate: d(2025, 5, 5),
        actualStartDate: null,
        actualEndDate: null,
        onSave: async () => {},
      }),
    )
    // daysBetween(5/1, 5/5) = 4
    expect(html).toContain('予定：5/1 → 5/5（4日）')
  })

  it('ToDo 名 input が引き続き描画される (regression)', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProgressInputRow, {
        todoId: 'td-1',
        name: '受入確認 ToDo',
        scheduledStartDate: d(2025, 5, 1),
        scheduledEndDate: d(2025, 5, 2),
        actualStartDate: null,
        actualEndDate: null,
        onSave: async () => {},
      }),
    )
    expect(html).toContain('受入確認 ToDo')
  })
})
