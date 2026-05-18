/**
 * v4.0 視覚スナップショット E2E
 *
 * G1 ガント表示の主要状態 (全体 / フィルター切替) をフルページスクリーンショットで残し、
 * 構造的に重要な要素 (バー / ステータスピル / サマリーカード) が描画されることを確認する。
 *
 * 厳密な画像比較 (toHaveScreenshot) は環境差異 (フォント等) で false-positive になりやすいため、
 * 構造 assertion + 画像保存の組み合わせとし、画像は CI アーティファクトとして人間レビューする。
 */

import { test, expect } from '@playwright/test'

const SHOTS_DIR = 'e2e/v4-shots'

test.describe('v4.0 視覚スナップショット', () => {
  test('G1 初期表示: バー / ピル / サマリーが描画される', async ({ page }) => {
    const errors: { url: string; status: number }[] = []
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push({ url: res.url(), status: res.status() })
    })

    await page.goto('/projects')
    await page
      .getByRole('button', { name: /フォーサイト開発プロジェクト/ })
      .first()
      .click()
    await expect(page.getByText('全体進捗')).toBeVisible({ timeout: 10000 })

    // 構造 assertions
    // バー (period-bar の予定/実績)
    const blueBars = await page.locator('[class*="bg-blue-200"]').count()
    expect(blueBars).toBeGreaterThan(0)
    const emeraldBars = await page.locator('[class*="bg-emerald-500"]').count()
    expect(emeraldBars).toBeGreaterThan(0) // 完了 ToDo が seed にある

    // 今日線 (TodayMarker — projectStart <= today <= projectEnd で描画)
    await expect(page.getByText(/今日\(\d+\/\d+\)/)).toBeVisible()

    // ステータスピル: 4 種類すべての可能性をチェック (少なくとも 1 種は存在)
    const statusPills = await page.locator('[role="status"][aria-label*="ステータス"]').count()
    expect(statusPills).toBeGreaterThan(0)

    // v4.0 6 列化: data-row-type="task" 行に「入力」ボタンが含まれる
    const firstTaskRow = page.locator('[data-row-type="task"]').first()
    await expect(firstTaskRow.getByRole('button', { name: '入力', exact: true })).toBeVisible()

    // 5xx 無し
    expect(errors, `5xx responses: ${JSON.stringify(errors)}`).toEqual([])

    // 上下分離仕様: 完了 ToDo 行に予定バーと実績バーが両方描画されること
    const completedRow = page
      .locator('[data-row-type="todo"]')
      .filter({ hasText: '[completed] 期日内完了' })
    await expect(completedRow).toHaveCount(1)
    const completedPlanBars = await completedRow.locator('[class*="bg-blue-200"]').count()
    const completedActualBars = await completedRow.locator('[class*="bg-emerald-500"]').count()
    expect(completedPlanBars).toBeGreaterThanOrEqual(1)
    expect(completedActualBars).toBeGreaterThanOrEqual(1)

    await page.screenshot({ path: `${SHOTS_DIR}/01-g1-initial.png`, fullPage: true })
  })

  test('G1 フィルター切替: 「完了」のみ表示でスクショ', async ({ page }) => {
    await page.goto('/projects')
    await page
      .getByRole('button', { name: /フォーサイト開発プロジェクト/ })
      .first()
      .click()
    await expect(page.getByText('全体進捗')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: '完了', exact: true }).click()
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${SHOTS_DIR}/02-g1-filter-completed.png`, fullPage: true })
  })

  test('G2 工程管理: 4 階層 CRUD UI が描画される', async ({ page }) => {
    await page.goto('/projects')
    await page
      .getByRole('button', { name: /フォーサイト開発プロジェクト/ })
      .first()
      .click()
    await expect(page.getByText('全体進捗')).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: '工程管理', exact: true }).click()
    await expect(page.getByRole('heading', { name: /工程管理/ })).toBeVisible({ timeout: 10000 })

    // 4 階層レベルマーク
    await expect(page.getByText('M', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('T', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('To', { exact: true }).first()).toBeVisible()

    // G2 不変条件: 実績日入力欄が存在しない
    const actualDateInputs = await page
      .locator(
        'input[aria-label*="着手日"], input[aria-label*="完了日"], input[aria-label*="実績"]',
      )
      .count()
    expect(actualDateInputs).toBe(0)

    await page.screenshot({ path: `${SHOTS_DIR}/03-g2-manage.png`, fullPage: true })
  })
})
