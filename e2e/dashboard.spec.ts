import { test, expect, type Page } from '@playwright/test'

async function navigateToDashboard(page: Page) {
  await page.goto('/projects')
  await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
  await page.waitForURL(/\/projects\/[a-z0-9]+$/)
  await page.getByRole('link', { name: '予兆検知' }).click()
  await page.waitForURL(/\/projects\/[a-z0-9]+\/dashboard$/)
}

test.describe('予兆検知ダッシュボード', () => {
  test('プロジェクト詳細に「予兆検知」ボタンが表示される', async ({ page }) => {
    await page.goto('/projects')
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await page.waitForURL(/\/projects\/[a-z0-9]+$/)

    await expect(page.getByRole('link', { name: '予兆検知' })).toBeVisible()
  })

  test('「予兆検知」ボタンでダッシュボードページに遷移する', async ({ page }) => {
    await page.goto('/projects')
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await page.waitForURL(/\/projects\/[a-z0-9]+$/)

    await page.getByRole('link', { name: '予兆検知' }).click()

    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+\/dashboard$/)
    await expect(page.getByRole('heading', { name: '予兆検知ダッシュボード' })).toBeVisible()
  })

  test('プロジェクトカードにプロジェクト名とステータスが表示される', async ({ page }) => {
    await navigateToDashboard(page)

    await expect(page.getByText('プロジェクト').first()).toBeVisible()
    await expect(page.getByText('フォーサイト開発プロジェクト(サンプル)').first()).toBeVisible()
    await expect(page.getByText(/完了予測:/).first()).toBeVisible()
  })

  test('シードデータの「要件定義フェーズ」が警告チェーンに表示される', async ({ page }) => {
    await navigateToDashboard(page)

    // 要件定義フェーズ(終了日=today)は scheduledPct≈100% に対して actualPct≈61% → warning
    await expect(page.getByText('マイルストーン').first()).toBeVisible()
    await expect(page.getByText('要件定義フェーズ').first()).toBeVisible()
  })

  test('警告ステータスの StatusPill が表示される', async ({ page }) => {
    await navigateToDashboard(page)

    // 少なくとも 1 つ warning/delayed ステータスが存在する
    const warningOrDelayed = page.getByText(/警告|遅延/)
    await expect(warningOrDelayed.first()).toBeVisible()
  })

  test('警告タスクのリンクからタスク詳細ページへ遷移できる', async ({ page }) => {
    await navigateToDashboard(page)

    // warningTasks に含まれる「要件ドキュメント作成」カードのリンクをクリック
    const taskLink = page.getByRole('link', { name: '要件ドキュメント作成' })
    await expect(taskLink).toBeVisible()
    await taskLink.click()

    await expect(page).toHaveURL(/\/tasks\/[a-z0-9]+$/)
  })

  test('戻るリンクでプロジェクト詳細に戻れる', async ({ page }) => {
    await navigateToDashboard(page)

    await page.getByRole('link', { name: /← フォーサイト開発プロジェクト/ }).click()

    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/)
    await expect(page.getByRole('link', { name: '予兆検知' })).toBeVisible()
  })
})
