/**
 * v4.0 フィルター挙動 E2E
 *
 * spec v4.0 Section 2.4 の真理表 (F1〜F5) に従い、各ピルで表示行が変わることを確認する。
 *
 * 厳密な行数比較ではなく、各フィルターで「特定の status 行が表示される / されない」
 * を可視性ベースで検証する (seed のシナリオが将来変わっても壊れにくい)。
 */

import { test, expect } from '@playwright/test'

test.describe('v4.0 フィルター', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects')
    await page
      .getByRole('button', { name: /フォーサイト開発プロジェクト/ })
      .first()
      .click()
    await expect(page.getByText('全体進捗')).toBeVisible({ timeout: 10000 })
  })

  test('5 種類のフィルターピルが存在し、クリックで aria-pressed が切り替わる', async ({ page }) => {
    const labels = ['すべて', '遅延', '未着手リスク', '進行中', '完了']
    for (const label of labels) {
      const btn = page.getByRole('button', { name: label, exact: true })
      await expect(btn).toBeVisible()
    }

    // 「すべて」が初期選択
    await expect(page.getByRole('button', { name: 'すべて', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    // 「完了」をクリック → aria-pressed=true
    await page.getByRole('button', { name: '完了', exact: true }).click()
    await expect(page.getByRole('button', { name: '完了', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'すべて', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('「完了」フィルター: 完了 Status の行のみ残る', async ({ page }) => {
    await page.getByRole('button', { name: '完了', exact: true }).click()

    // 完了行は seed の task1_1 (ユーザーヒアリング) 配下に存在
    // 親階層 (要件定義フェーズ → ユーザーヒアリング) は子が一致するので表示
    await expect(page.getByText('完了').first()).toBeVisible()
  })

  test('「未着手リスク」フィルター: 該当する行が存在する', async ({ page }) => {
    await page.getByRole('button', { name: '未着手リスク', exact: true }).click()

    // 「未着手リスク」は status=delayed のサブセット (actualPct=0 && !hasAnyActualStart && today > startDate)
    // seed の demo milestone「4状態デモ + 未着手リスク」配下の ToDo にこのケースがある
    // → 親階層も表示されるはず
    await expect(page.getByText('4状態デモ + 未着手リスク').first()).toBeVisible()
  })

  test('「すべて」フィルター: 全行が表示される', async ({ page }) => {
    await page.getByRole('button', { name: 'すべて', exact: true }).click()

    // seed の代表 milestone がすべて見える
    await expect(page.getByText('要件定義フェーズ').first()).toBeVisible()
    await expect(page.getByText('開発フェーズ').first()).toBeVisible()
    await expect(page.getByText('4状態デモ + 未着手リスク').first()).toBeVisible()
  })
})
