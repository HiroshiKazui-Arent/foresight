import { test, expect, type Page } from '@playwright/test'

async function navigateToMilestonePage(page: Page) {
  await page.goto('/projects')
  await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
  await page.waitForURL(/\/projects\/[a-z0-9]+$/)

  // 最初のマイルストーン(要件定義フェーズ)のタイムラインアイコンリンク
  await page.getByRole('link', { name: 'タイムラインビューで開く' }).first().click()
  await page.waitForURL(/\/milestones\/[a-z0-9]+$/)
}

test.describe('タイムライン画面', () => {
  test('マイルストーンのタイムラインが表示される', async ({ page }) => {
    await navigateToMilestonePage(page)

    await expect(page.getByText('要件定義フェーズ').first()).toBeVisible()
    await expect(page.getByText('ユーザーヒアリング')).toBeVisible()
    await expect(page.getByText('要件ドキュメント作成')).toBeVisible()
  })

  test('パンくずリストで前のページに戻れる', async ({ page }) => {
    await navigateToMilestonePage(page)

    await page.getByRole('link', { name: /← フォーサイト開発プロジェクト/ }).click()
    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/)
  })

  test('ToDo 一覧が表示される', async ({ page }) => {
    await navigateToMilestonePage(page)

    // タスク行を展開して ToDo を表示する
    await page.getByRole('button', { name: '展開する' }).first().click()

    await expect(page.getByText('利用者インタビュー')).toBeVisible()
    await expect(page.getByText('ペルソナ定義')).toBeVisible()
  })
})
