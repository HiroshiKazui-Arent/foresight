import { test, expect, type Page } from '@playwright/test'

async function navigateToDailyReport(page: Page) {
  await page.goto('/projects')
  await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
  await page.waitForURL(/\/projects\/[a-z0-9]+$/)
  await page.getByRole('link', { name: '日報入力' }).click()
  await page.waitForURL(/\/projects\/[a-z0-9]+\/daily$/)
}

test.describe('日報入力', () => {
  test('プロジェクト詳細に「日報入力」ボタンが表示される', async ({ page }) => {
    await page.goto('/projects')
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await page.waitForURL(/\/projects\/[a-z0-9]+$/)

    await expect(page.getByRole('link', { name: '日報入力' })).toBeVisible()
  })

  test('「日報入力」ボタンで日報ページに遷移する', async ({ page }) => {
    await page.goto('/projects')
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await page.waitForURL(/\/projects\/[a-z0-9]+$/)

    await page.getByRole('link', { name: '日報入力' }).click()

    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+\/daily$/)
    await expect(page.getByRole('heading', { name: /日報入力/ })).toBeVisible()
  })

  test('ページタイトルにプロジェクト名が含まれる', async ({ page }) => {
    await navigateToDailyReport(page)

    await expect(
      page.getByRole('heading', { name: /日報入力 — フォーサイト開発プロジェクト/ }),
    ).toBeVisible()
  })

  test('各 ToDo に進捗入力フォームと「保存」ボタンが表示される', async ({ page }) => {
    await navigateToDailyReport(page)

    // input モードでは TodoInputRow が各 ToDo を描画し「保存」ボタンが並ぶ
    const saveButtons = page.getByRole('button', { name: '保存' })
    await expect(saveButtons.first()).toBeVisible()
    const count = await saveButtons.count()
    expect(count).toBeGreaterThan(0)
  })

  test('シードデータの ToDo 名が表示される', async ({ page }) => {
    await navigateToDailyReport(page)

    await expect(page.getByText('ユースケース整理')).toBeVisible()
    await expect(page.getByText('機能一覧作成')).toBeVisible()
  })

  test('「保存」ボタンで日報を提出すると「保存済み ✓」が表示される', async ({ page }) => {
    await navigateToDailyReport(page)

    // 最初の保存ボタンをクリックして保存フィードバックを確認
    const firstSave = page.getByRole('button', { name: '保存' }).first()
    await firstSave.click()

    // 保存完了のフィードバック (2 秒間表示)
    await expect(page.getByText('保存済み ✓').first()).toBeVisible()
  })

  test('「← プロジェクトへ戻る」リンクでプロジェクト詳細に戻れる', async ({ page }) => {
    await navigateToDailyReport(page)

    await page.getByRole('link', { name: '← プロジェクトへ戻る' }).click()

    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/)
  })
})
